import * as THREE from 'three';
import { buildEnvironment, type EnvRig } from '../core/env';
import type { Stage } from '../core/renderer';
import { settings } from '../core/settings';
import { nextFrame } from '../core/util';
import { Crawler } from '../world/crawler';
import { Droplet, Raft } from '../world/droplet';
import { makeShopMaterials, type ShopMaterials } from '../world/materials';
import { Park } from '../world/park';
import { Puffs } from '../world/particles';
import { SeamCollar } from '../world/seam';
import { Slide } from '../world/slide';
import { ToolKit } from '../world/tools';

/**
 * Owns every object in the flume and builds it in stages.
 *
 * Nothing is loaded from disk; each stage is a chunk of procedural construction
 * with a frame yielded in between so the title screen keeps animating instead of
 * freezing on a long synchronous build.
 */
export class World {
  readonly slide = new Slide();
  env!: EnvRig;
  mat!: ShopMaterials;
  park!: Park;
  crawler!: Crawler;
  droplet!: Droplet;
  raft!: Raft;
  tools!: ToolKit;
  collars: SeamCollar[] = [];
  dust!: Puffs;
  /** Soft lamp riding with the camera so materials stay readable up close. */
  workLight!: THREE.PointLight;
  haze!: Puffs;
  spray!: Puffs;

  activeIndex = 0;
  private stage3Done = false;

  constructor(private stage: Stage) {}

  get scene(): THREE.Scene {
    return this.stage.scene;
  }

  get active(): SeamCollar {
    return this.collars[this.activeIndex];
  }

  /** Exterior: sky, lighting probe, the flume itself and the park around it. */
  async buildExterior(progress: (p: number) => void): Promise<void> {
    this.env = buildEnvironment(this.stage.renderer);
    const scene = this.scene;
    scene.environment = this.env.envMap;
    scene.fog = new THREE.FogExp2(0xc6dbe3, 0.0042);
    scene.add(this.env.sky, this.env.hemi, this.env.sun, this.env.sun.target);
    progress(0.15);
    await nextFrame();

    this.mat = makeShopMaterials(this.env.envMap);
    this.slide.build(this.env.envMap);
    scene.add(this.slide.root);
    progress(0.42);
    await nextFrame();

    this.park = new Park(this.slide, this.mat, this.env.envMap);
    scene.add(this.park.group);
    progress(0.62);
    await nextFrame();
  }

  /** Interior: every moulding joint plus the machine that services them. */
  async buildInterior(progress: (p: number) => void): Promise<void> {
    for (let i = 0; i < this.slide.seams.length; i++) {
      const collar = new SeamCollar(this.slide, i, this.slide.seams[i], this.env.envMap);
      this.collars.push(collar);
      this.scene.add(collar.group);
      progress(0.62 + (0.28 * (i + 1)) / this.slide.seams.length);
      await nextFrame();
    }

    this.crawler = new Crawler(this.slide, this.mat);
    this.scene.add(this.crawler.group, this.crawler.lampTarget);
    this.workLight = new THREE.PointLight(0xdcecf5, 0, 7, 1.15);
    this.scene.add(this.workLight);
    this.tools = new ToolKit(this.mat);
    this.scene.add(this.tools.group);
    this.droplet = new Droplet(this.slide, this.env.envMap);
    this.scene.add(this.droplet.group);
    progress(1);
    await nextFrame();
  }

  /** Test props, built only once the first repair is under way. */
  async buildTestRig(): Promise<void> {
    if (this.stage3Done) return;
    this.stage3Done = true;
    this.raft = new Raft(this.slide, this.env.envMap);
    this.scene.add(this.raft.group);
    await nextFrame();
    const scale = settings.fast ? 0.35 : this.stage.tier === 0 ? 0.5 : 1;
    this.dust = new Puffs(Math.round(90 * scale), 'rgba(150,138,112,0.95)', 0.02, 0.55, 11);
    this.haze = new Puffs(Math.round(70 * scale), 'rgba(255,255,255,0.9)', 0.026, 0.12, 17);
    this.spray = new Puffs(Math.round(60 * scale), 'rgba(200,240,255,0.95)', 0.018, 1.2, 23);
    this.scene.add(this.dust.points, this.haze.points, this.spray.points);
  }

  setActive(index: number): void {
    this.activeIndex = Math.max(0, Math.min(this.collars.length - 1, index));
  }

  applyTier(tier: number): void {
    const shadows = tier >= 1;
    this.stage.renderer.shadowMap.enabled = shadows;
    this.stage.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (this.crawler) {
      this.crawler.lamp.castShadow = shadows;
      this.crawler.lamp.shadow.mapSize.set(tier >= 2 ? 512 : 256, tier >= 2 ? 512 : 256);
      this.crawler.lamp.shadow.map?.dispose();
      this.crawler.lamp.shadow.map = null;
    }
    for (const c of this.collars) c.setShadowCasting(shadows);
  }

  update(dt: number): void {
    if (this.slide.shell) {
      this.slide.shell.visible = !this.slide.isInside(this.stage.camera.position);
    }
    if (this.workLight) {
      this.workLight.position.copy(this.stage.camera.position);
    }
    this.crawler?.update(dt);
    this.droplet?.update(dt);
    this.raft?.update(dt);
    this.dust?.update(dt);
    this.haze?.update(dt);
    this.spray?.update(dt);
    for (const c of this.collars) c.update(dt);
  }
}
