import {
  DirectionalLight,
  Group,
  HemisphereLight,
  PMREMGenerator,
  RectAreaLight,
  Scene,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

/**
 * Daylight from the one window, a soft fill from the ceiling panels, and an
 * image-based bounce so that metal, rubber and synthetic skin each pick up
 * the room rather than a single hard highlight.
 */
export class Lighting {
  readonly root = new Group();
  readonly sun: DirectionalLight;
  private hemi: HemisphereLight;
  private panel: RectAreaLight;

  constructor(scene: Scene, renderer: WebGLRenderer) {
    RectAreaLightUniformsLib.init();

    this.sun = new DirectionalLight(0xfff3e2, 2.05);
    this.sun.position.set(3.1, 2.5, -0.4);
    this.sun.target.position.set(-0.05, 0.82, -0.05);
    this.sun.castShadow = true;
    // The shadow budget is spent where it reads: the hands, the chestpiece and
    // where they meet the chest.
    this.sun.shadow.camera.left = -0.75;
    this.sun.shadow.camera.right = 0.75;
    this.sun.shadow.camera.top = 0.75;
    this.sun.shadow.camera.bottom = -0.75;
    this.sun.shadow.camera.near = 1.4;
    this.sun.shadow.camera.far = 6.5;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.012;
    this.root.add(this.sun);
    this.root.add(this.sun.target);

    this.hemi = new HemisphereLight(0xd8e4ee, 0x6d6355, 0.75);
    this.root.add(this.hemi);

    this.panel = new RectAreaLight(0xf2f5f7, 1.4, 1.2, 0.32);
    this.panel.position.set(-0.2, 2.76, -0.4);
    this.panel.rotation.x = -Math.PI / 2;
    this.root.add(this.panel);

    const pmrem = new PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.035);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();
  }

  setShadowResolution(size: number): void {
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    this.sun.shadow.mapSize.set(size, size);
  }

  setQuality(level: 'high' | 'medium' | 'low'): void {
    if (level === 'high') {
      this.setShadowResolution(1024);
      this.panel.intensity = 1.4;
    } else if (level === 'medium') {
      this.setShadowResolution(768);
      this.panel.intensity = 1.2;
    } else {
      this.setShadowResolution(512);
      this.panel.intensity = 1.0;
    }
  }
}
