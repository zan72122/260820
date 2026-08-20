/**
 * The interior lamps the teacher wired before the children arrived, and the big safe switch
 * the child is allowed to press.
 *
 * Only a couple of these are promoted to real lights: they are what throws the frame's
 * lattice shadow onto the yard. The light inside the paper itself comes from the baked
 * interior atlas, not from a dynamic light.
 */

import {
  AdditiveBlending,
  BackSide,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  SpotLight,
  Object3D,
  Vector3,
} from 'three';
import { LAMP_POSITIONS, NEBUTA } from './shape';
import { metalTextures, radialSprite, woodTextures } from '../util/textures';
import type { QualitySettings } from '../core/Quality';
import { clamp, damp } from '../util/math';

export class Lamps {
  readonly group = new Group();
  readonly switchGroup = new Group();
  readonly bulbs: Mesh[] = [];
  readonly lights: PointLight[] = [];
  readonly spot: SpotLight;
  readonly spotTarget = new Object3D();
  /** 0..1 per lamp, staggered so they warm up one after another. */
  readonly levels = [0, 0, 0];
  master = 0;
  private targetMaster = 0;
  private flicker = 0;
  private readonly bulbMat: MeshStandardMaterial;
  private readonly haloMat: MeshBasicMaterial;
  private readonly switchLed: Mesh;
  private readonly switchLever: Mesh;
  private switchAngle = 0;

  constructor(quality: QualitySettings) {
    this.group.name = 'lamps';
    const wood = woodTextures(256, { hueA: '#9a7c52', hueB: '#6a4f31', ringFreq: 9, wear: 0.2 });
    const metal = metalTextures(128);
    const mountMat = new MeshStandardMaterial({
      map: wood.map,
      normalMap: wood.normalMap,
      roughness: 0.85,
      metalness: 0,
    });
    this.bulbMat = new MeshStandardMaterial({
      color: new Color('#fff0d0'),
      emissive: new Color('#ffb457'),
      emissiveIntensity: 0,
      roughness: 0.25,
      metalness: 0,
    });
    this.haloMat = new MeshBasicMaterial({
      map: radialSprite(96, 2.6),
      color: new Color('#ffbe6a'),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      opacity: 0,
    });

    const bulbGeo = new SphereGeometry(0.038, 10, 8);
    const socketGeo = new CylinderGeometry(0.022, 0.026, 0.05, 8);
    const haloGeo = new SphereGeometry(0.11, 10, 8);

    LAMP_POSITIONS.forEach((p, i) => {
      const socket = new Mesh(socketGeo, mountMat);
      socket.position.copy(p).add(new Vector3(0, 0.045, 0));
      this.group.add(socket);
      const bulb = new Mesh(bulbGeo, this.bulbMat);
      bulb.position.copy(p);
      this.group.add(bulb);
      this.bulbs.push(bulb);
      const halo = new Mesh(haloGeo, this.haloMat);
      halo.position.copy(p);
      halo.material = this.haloMat;
      halo.renderOrder = 5;
      this.group.add(halo);

      if (i < quality.realInteriorLights) {
        const light = new PointLight(new Color('#ffb45a'), 0, 3.4, 1.7);
        light.position.copy(p);
        light.castShadow = false;
        this.group.add(light);
        this.lights.push(light);
      }
    });

    // one shadow-casting spot aimed down: this is what prints the frame's lattice on the yard
    this.spot = new SpotLight(new Color('#ffbd6d'), 0, 6.5, Math.PI * 0.46, 0.65, 1.4);
    this.spot.position.set(0, 0.75, 0);
    this.spotTarget.position.set(0, -1.2, 0);
    this.spot.target = this.spotTarget;
    this.spot.castShadow = quality.tier !== 'low';
    this.spot.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    this.spot.shadow.camera.near = 0.25;
    this.spot.shadow.camera.far = 6;
    this.spot.shadow.bias = -0.0016;
    this.spot.shadow.normalBias = 0.02;
    this.group.add(this.spot, this.spotTarget);

    // --- the switch: a chunky, obviously-pressable box on the cart rail
    const body = new Mesh(
      new CylinderGeometry(0.105, 0.115, 0.055, 18),
      new MeshStandardMaterial({ color: new Color('#f2f2ef'), roughness: 0.42, metalness: 0.02 }),
    );
    body.rotation.x = Math.PI / 2;
    this.switchGroup.add(body);
    this.switchLever = new Mesh(
      new CylinderGeometry(0.075, 0.075, 0.034, 18),
      new MeshStandardMaterial({ color: new Color('#e8dfd0'), roughness: 0.35, metalness: 0.03 }),
    );
    this.switchLever.rotation.x = Math.PI / 2;
    this.switchLever.position.z = 0.038;
    this.switchGroup.add(this.switchLever);
    this.switchLed = new Mesh(
      new SphereGeometry(0.024, 10, 8),
      new MeshStandardMaterial({
        color: new Color('#ffd9a0'),
        emissive: new Color('#ff7a2a'),
        emissiveIntensity: 2.2,
        roughness: 0.2,
      }),
    );
    this.switchLed.position.set(0, 0.074, 0.022);
    this.switchGroup.add(this.switchLed);
    const ring = new Mesh(
      new CylinderGeometry(0.122, 0.122, 0.014, 20),
      new MeshStandardMaterial({
        map: metal.map,
        color: new Color('#c9c9cd'),
        metalness: 0.85,
        roughness: 0.34,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 0.008;
    this.switchGroup.add(ring);
    // a soft glow so a four year old can see where to press
    const attention = new Mesh(
      new SphereGeometry(0.27, 12, 10),
      new MeshBasicMaterial({
        map: radialSprite(64, 3),
        color: new Color('#ffd28a'),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: BackSide,
        opacity: 0.0,
      }),
    );
    attention.name = 'switch-attention';
    this.switchGroup.add(attention);
    // a post on the front corner of the deck puts it in easy sight and easy reach
    const post = new Mesh(
      new CylinderGeometry(0.022, 0.026, 0.26, 10),
      new MeshStandardMaterial({ color: new Color('#8f9298'), metalness: 0.5, roughness: 0.45 }),
    );
    post.position.set(0, -0.17, 0.02);
    this.switchGroup.add(post);
    this.switchGroup.position.set(0.9, NEBUTA.deckY + 0.26, -0.3);
    this.switchGroup.rotation.y = 0.7;
    this.switchGroup.visible = false;
  }

  setTarget(v: number): void {
    this.targetMaster = clamp(v, 0, 1);
  }

  get on(): boolean {
    return this.targetMaster > 0.5;
  }

  toggle(): boolean {
    this.targetMaster = this.targetMaster > 0.5 ? 0 : 1;
    return this.targetMaster > 0.5;
  }

  update(dt: number, time: number, attentionPulse: number): void {
    // filament warm-up: the lamps do not all reach full brightness at once
    this.master = damp(this.master, this.targetMaster, 3.2, dt);
    this.flicker = damp(this.flicker, Math.sin(time * 7.3) * 0.5 + Math.sin(time * 17.1) * 0.5, 6, dt);
    for (let i = 0; i < 3; i++) {
      const lag = 1 - i * 0.16;
      const target = clamp((this.master - i * 0.06) / Math.max(0.2, lag), 0, 1);
      this.levels[i] = damp(this.levels[i], target, 4.5 - i * 0.6, dt);
      const wobble = 1 + this.flicker * 0.018 * this.levels[i];
      this.levels[i] = clamp(this.levels[i] * wobble, 0, 1.05);
    }
    const avg = (this.levels[0] + this.levels[1] + this.levels[2]) / 3;
    this.bulbMat.emissiveIntensity = 3.6 * avg;
    this.haloMat.opacity = 0.55 * avg;
    for (let i = 0; i < this.lights.length; i++) this.lights[i].intensity = 2.1 * this.levels[i];
    this.spot.intensity = 5.4 * avg;

    this.switchAngle = damp(this.switchAngle, this.on ? 1 : 0, 14, dt);
    this.switchLever.position.z = 0.035 - this.switchAngle * 0.016;
    const led = this.switchLed.material as MeshStandardMaterial;
    led.emissive.set(this.on ? '#7dff9a' : '#ff7a2a');
    led.emissiveIntensity = 1.6 + Math.sin(time * 3) * 0.35;
    const attention = this.switchGroup.getObjectByName('switch-attention') as Mesh | undefined;
    if (attention) {
      const m = attention.material as MeshBasicMaterial;
      m.opacity = attentionPulse * (0.28 + 0.16 * Math.sin(time * 3.4));
      attention.scale.setScalar(1 + attentionPulse * 0.12 * Math.sin(time * 3.4));
    }
  }

  reset(): void {
    this.master = 0;
    this.targetMaster = 0;
    this.levels[0] = this.levels[1] = this.levels[2] = 0;
  }

  dispose(): void {
    this.bulbMat.dispose();
    this.haloMat.dispose();
  }
}
