import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { QualityLevel } from '../core/AdaptiveQuality';
import { Materials } from './Materials';
import { buildRoom } from './Room';
import { ManikinRig } from './Manikin';
import { CuffRig } from './Cuff';
import { EquipmentRig } from './Equipment';
import { StethoscopeRig } from './Stethoscope';
import { InstructorHands } from './InstructorHand';

/**
 * Assembles the lab and owns the renderer.
 *
 * Depth is built from scale, overlap, illumination falloff and a very light
 * aerial haze — the far ground is never blurred away. Shadow casting is spent
 * on the arm, the hands and the instruments; the room reads through baked
 * ambient light and grounded contact patches instead.
 */
export class SceneRoot {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly mats: Materials;
  readonly manikin: ManikinRig;
  readonly cuff: CuffRig;
  readonly equipment: EquipmentRig;
  readonly stethoscope: StethoscopeRig;
  readonly instructor: InstructorHands;

  private keyLight: THREE.DirectionalLight;
  private windowFill: THREE.DirectionalLight;
  private ceilingFill: THREE.DirectionalLight;
  private pmrem: THREE.PMREMGenerator;
  /** Milliseconds spent generating surfaces and assembling the lab. */
  readonly buildMs: { textures: number; scene: number };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(0x8d9ea5);
    // Just enough haze to separate the far wall. Not a blur.
    this.scene.fog = new THREE.FogExp2(0x9fb1b8, 0.075);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = env.texture;
    this.scene.environmentIntensity = 0.42;

    const t0 = performance.now();
    this.mats = new Materials();
    const t1 = performance.now();
    this.scene.add(buildRoom(this.mats));

    this.manikin = new ManikinRig(this.mats);
    this.scene.add(this.manikin.group);
    this.cuff = new CuffRig(this.mats);
    this.scene.add(this.cuff.group);
    this.equipment = new EquipmentRig(this.mats);
    this.scene.add(this.equipment.group);
    this.stethoscope = new StethoscopeRig(this.mats);
    this.scene.add(this.stethoscope.group);
    this.instructor = new InstructorHands(this.mats);
    this.scene.add(this.instructor.group);

    // Morning light through the window: low, warm, from the far left.
    this.keyLight = new THREE.DirectionalLight(0xffe9c9, 2.5);
    this.keyLight.position.set(-2.6, 2.3, -1.4);
    this.keyLight.target.position.set(0.45, 0.78, 0.2);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.bias = -0.0007;
    this.keyLight.shadow.normalBias = 0.006;
    const cam = this.keyLight.shadow.camera;
    cam.left = -1.0;
    cam.right = 1.0;
    cam.top = 0.9;
    cam.bottom = -0.5;
    cam.near = 1.0;
    cam.far = 7.0;
    cam.updateProjectionMatrix();
    this.scene.add(this.keyLight, this.keyLight.target);

    // Broad sky bounce from the window plane; no shadow, just fill.
    this.windowFill = new THREE.DirectionalLight(0xcadff0, 0.85);
    this.windowFill.position.set(-1.6, 1.4, -0.4);
    this.scene.add(this.windowFill);

    this.ceilingFill = new THREE.DirectionalLight(0xf2f4f0, 0.38);
    this.ceilingFill.position.set(0.6, 3.0, 0.9);
    this.scene.add(this.ceilingFill);

    this.scene.add(new THREE.HemisphereLight(0xc9dbe4, 0x3a3630, 0.34));
    this.buildMs = {
      textures: Math.round(t1 - t0),
      scene: Math.round(performance.now() - t1),
    };
  }

  applyQuality(q: QualityLevel, dpr: number): void {
    this.renderer.setPixelRatio(Math.min(dpr, q.maxDpr));
    this.renderer.shadowMap.enabled = q.shadows;
    if (q.shadows) {
      this.keyLight.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
    this.keyLight.castShadow = q.shadows;
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }
}
