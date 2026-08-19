import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { damp } from '../core/rng';
import type { QualityProfile } from '../core/tuning';

export type Mood = 'cold' | 'work' | 'torch' | 'finish';

interface MoodPreset {
  key: number;
  fill: number;
  rim: number;
  ambient: number;
  env: number;
  exposure: number;
}

/** The kitchen exposure barely moves between beats — only the balance does. */
const MOODS: Record<Mood, MoodPreset> = {
  cold: { key: 2.55, fill: 1.45, rim: 0.35, ambient: 0.5, env: 0.78, exposure: 1.02 },
  work: { key: 2.75, fill: 1.15, rim: 0.45, ambient: 0.52, env: 0.8, exposure: 1.02 },
  torch: { key: 2.35, fill: 0.85, rim: 0.5, ambient: 0.46, env: 0.66, exposure: 0.99 },
  finish: { key: 2.5, fill: 0.72, rim: 1.5, ambient: 0.5, env: 0.86, exposure: 1.04 },
};

export class Lighting {
  readonly key: THREE.DirectionalLight;
  readonly fill: THREE.DirectionalLight;
  readonly rim: THREE.SpotLight;
  readonly ambient: THREE.HemisphereLight;
  /** Local light at the flame's contact point — the only thing the torch lights. */
  readonly contact: THREE.PointLight;
  /** A dim practical over the back of the kitchen so it reads as a room. */
  readonly backdrop: THREE.PointLight;

  private scene: THREE.Scene;
  private target: MoodPreset = MOODS.cold;
  private cur: MoodPreset = { ...MOODS.cold };
  private renderer: THREE.WebGLRenderer;
  private pmrem: THREE.PMREMGenerator | null = null;
  private envRt: THREE.WebGLRenderTarget | null = null;
  softLight = false;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: QualityProfile) {
    this.scene = scene;
    this.renderer = renderer;

    // Soft neutral key over the worktop.
    this.key = new THREE.DirectionalLight(0xfff2e2, MOODS.cold.key);
    this.key.position.set(2.6, 5.4, 3.0);
    if (quality.shadows) {
      this.key.castShadow = true;
      this.key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
      const c = this.key.shadow.camera;
      c.near = 1.5;
      c.far = 12;
      c.left = -2.6;
      c.right = 2.6;
      c.top = 2.6;
      c.bottom = -2.6;
      c.updateProjectionMatrix();
      this.key.shadow.bias = -0.0016;
      this.key.shadow.normalBias = 0.024;
      this.key.shadow.radius = 2.4;
    }
    scene.add(this.key);
    scene.add(this.key.target);
    this.key.target.position.set(0, 0.6, 0);

    // Cool bounce out of the open freezer, behind and to the left.
    this.fill = new THREE.DirectionalLight(0xa9c7e6, MOODS.cold.fill);
    this.fill.position.set(-4.2, 2.4, -2.6);
    scene.add(this.fill);

    // Warm low rim that only earns its keep on the finished cake.
    this.rim = new THREE.SpotLight(0xffcb8f, MOODS.cold.rim, 12, 0.9, 0.6, 1.2);
    this.rim.position.set(-2.2, 1.35, -3.2);
    this.rim.target.position.set(0, 0.75, 0);
    scene.add(this.rim);
    scene.add(this.rim.target);

    this.ambient = new THREE.HemisphereLight(0xbfd3e6, 0x2a2220, MOODS.cold.ambient);
    scene.add(this.ambient);

    this.backdrop = new THREE.PointLight(0xffd7a8, 9, 9, 1.6);
    this.backdrop.position.set(0.4, 3.1, -4.3);
    scene.add(this.backdrop);

    this.contact = new THREE.PointLight(0xbcd8ff, 0, 1.5, 2.0);
    this.contact.visible = false;
    scene.add(this.contact);

    this.buildEnvironment(quality);
  }

  /** A tiny PMREM room gives the steel and the torch nozzle something to
   *  reflect. It is generated once and then thrown away. */
  private buildEnvironment(quality: QualityProfile): void {
    void quality;
    // Always built, even in the fast profile: without it every metal surface
    // in the kitchen renders black.
    try {
      this.pmrem = new THREE.PMREMGenerator(this.renderer);
      this.pmrem.compileEquirectangularShader();
      const room = new RoomEnvironment();
      this.envRt = this.pmrem.fromScene(room, 0.04);
      this.scene.environment = this.envRt.texture;
      this.scene.environmentIntensity = MOODS.cold.env;
      this.scene.environmentRotation.set(0, 0.6, 0);
      room.dispose?.();
    } catch {
      this.scene.environment = null;
    }
  }

  setMood(mood: Mood): void {
    this.target = MOODS[mood];
  }

  update(dt: number): void {
    const soft = this.softLight ? 0.55 : 1;
    const k = 3.2;
    this.cur.key = damp(this.cur.key, this.target.key, k, dt);
    this.cur.fill = damp(this.cur.fill, this.target.fill, k, dt);
    this.cur.rim = damp(this.cur.rim, this.target.rim, k, dt);
    this.cur.ambient = damp(this.cur.ambient, this.target.ambient, k, dt);
    this.cur.env = damp(this.cur.env, this.target.env, k, dt);
    this.cur.exposure = damp(this.cur.exposure, this.target.exposure, k, dt);

    this.key.intensity = this.cur.key;
    this.fill.intensity = this.cur.fill;
    this.rim.intensity = this.cur.rim * (this.softLight ? 0.7 : 1);
    this.ambient.intensity = this.cur.ambient;
    this.backdrop.intensity = (this.softLight ? 5.5 : 9) * (0.7 + 0.3 * this.cur.env);
    this.scene.environmentIntensity = this.cur.env;
    this.renderer.toneMappingExposure = this.cur.exposure;
    void soft;
  }

  /** Drives the blue-white pool of light under the torch. */
  setContact(pos: THREE.Vector3 | null, strength: number): void {
    if (!pos || strength <= 0.001) {
      this.contact.visible = false;
      this.contact.intensity = 0;
      return;
    }
    this.contact.visible = true;
    this.contact.position.copy(pos);
    this.contact.intensity = strength * (this.softLight ? 1.1 : 2.6);
    this.contact.distance = 1.6;
  }

  dispose(): void {
    this.envRt?.dispose();
    this.pmrem?.dispose();
  }
}
