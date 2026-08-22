import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Renderer + scene shell. WebGL2 baseline, capped DPR, ACES tone mapping,
 * a neutral indoor environment map for metal response, and one
 * shadow-casting work-lamp spot aimed at the lock.
 */
export interface SceneRootOptions {
  fast: boolean; // E2E / low-power profile
}

export class SceneRoot {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly lampLight: THREE.SpotLight;

  constructor(container: HTMLElement, opts: SceneRootOptions) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    const dpr = opts.fast ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = opts.fast
      ? THREE.PCFShadowMap
      : THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x241f19);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.72;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.01,
      40
    );

    // gentle ambient bounce
    const hemi = new THREE.HemisphereLight(0xfff3e0, 0x40342a, 0.42);
    this.scene.add(hemi);

    // cool spill from the corridor window
    const windowLight = new THREE.DirectionalLight(0xaebccb, 0.55);
    windowLight.position.set(-1.7, 1.9, -1.4);
    windowLight.target.position.set(0.4, 0.8, 0.6);
    this.scene.add(windowLight, windowLight.target);

    // warm work lamp — the one shadow caster, aimed at the lock area
    this.lampLight = new THREE.SpotLight(0xffe1b0, 24, 8, 0.58, 0.55, 1.6);
    this.lampLight.position.set(0.93, 1.49, 0.82); // inside the task-light shade
    this.lampLight.castShadow = true;
    this.lampLight.shadow.mapSize.set(opts.fast ? 1024 : 2048, opts.fast ? 1024 : 2048);
    this.lampLight.shadow.bias = -0.00012;
    this.lampLight.shadow.normalBias = 0.002;
    this.lampLight.shadow.camera.near = 0.05;
    this.lampLight.shadow.camera.far = 5;
    this.scene.add(this.lampLight);

    // faint fill so section faces never go pitch black
    const fill = new THREE.PointLight(0xffe9cf, 0.9, 3, 1.8);
    fill.position.set(1.0, 1.1, 0.55);
    this.scene.add(fill);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
