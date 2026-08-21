import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/**
 * Late-morning light over a water park that has not opened yet: one sun, one
 * sky, one environment map. Everything else in the scene borrows from these so
 * near, middle and far distance stay consistent.
 */
export class Environment {
  readonly sun = new THREE.DirectionalLight(0xfff0d6, 3.2);
  readonly hemi = new THREE.HemisphereLight(0xa9cbe0, 0x4e5a4a, 0.22);
  readonly sky: Sky;
  readonly sunDirection = new THREE.Vector3();
  private envRT: THREE.WebGLRenderTarget | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    quality: { shadows: boolean; shadowSize: number },
  ) {
    const elevation = 33;
    const azimuth = 128;
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sunDirection.setFromSphericalCoords(1, phi, theta);

    this.sky = new Sky();
    this.sky.scale.setScalar(2400);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4.2;
    u.rayleigh.value = 2.6;
    u.mieCoefficient.value = 0.0042;
    u.mieDirectionalG.value = 0.82;
    u.sunPosition.value.copy(this.sunDirection);
    if (u.cloudCoverage) u.cloudCoverage.value = 0.28;
    if (u.cloudDensity) u.cloudDensity.value = 0.35;
    scene.add(this.sky);

    this.sun.position.copy(this.sunDirection).multiplyScalar(120).add(new THREE.Vector3(20, 0, 0));
    this.sun.target.position.set(28, 2, 0);
    scene.add(this.sun);
    scene.add(this.sun.target);
    scene.add(this.hemi);

    this.setShadows(quality.shadows, quality.shadowSize);

    // Aerial perspective: the far towers wash into the sky, the test section
    // in front of the player stays crisp.
    scene.fog = new THREE.Fog(0xc9dceb, 150, 780);

    this.buildEnvironment(renderer);
  }

  setShadows(enabled: boolean, size: number): void {
    this.sun.castShadow = enabled;
    if (!enabled) return;
    const cam = this.sun.shadow.camera;
    cam.left = -34;
    cam.right = 34;
    cam.top = 26;
    cam.bottom = -22;
    cam.near = 40;
    cam.far = 240;
    cam.updateProjectionMatrix();
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.bias = -0.0009;
    this.sun.shadow.normalBias = 0.045;
  }

  /** Follow the raft with the shadow frustum so the near work stays sharp. */
  focusShadow(x: number, y: number): void {
    if (!this.sun.castShadow) return;
    this.sun.target.position.set(x, y, 0);
    this.sun.position.copy(this.sunDirection).multiplyScalar(120).add(new THREE.Vector3(x, y, 0));
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
  }

  private buildEnvironment(renderer: THREE.WebGLRenderer): void {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const captureScene = new THREE.Scene();
    const skyClone = new Sky();
    skyClone.scale.setScalar(2400);
    const cu = skyClone.material.uniforms;
    const su = this.sky.material.uniforms;
    for (const key of Object.keys(cu)) {
      if (su[key] && cu[key].value && (cu[key].value as THREE.Vector3).copy) {
        (cu[key].value as THREE.Vector3).copy(su[key].value);
      } else if (su[key]) {
        cu[key].value = su[key].value;
      }
    }
    cu.showSunDisc.value = 0;
    captureScene.add(skyClone);
    // A dull ground plate keeps bounce light from the concrete in the map.
    const ground = new THREE.Mesh(
      new THREE.SphereGeometry(4000, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x8e9482, side: THREE.BackSide }),
    );
    captureScene.add(ground);

    this.envRT = pmrem.fromScene(captureScene, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.5;

    skyClone.geometry.dispose();
    skyClone.material.dispose();
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
    pmrem.dispose();
  }

  dispose(): void {
    this.envRT?.dispose();
  }
}
