import * as THREE from 'three';

const geo = new THREE.BufferGeometry();
geo.setAttribute(
  'position',
  new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)
);
geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));

const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

/** Minimal full-screen triangle pass (avoids pulling in the post-processing stack). */
export class FullScreenPass {
  readonly mesh: THREE.Mesh;
  private scene = new THREE.Scene();

  constructor(public material: THREE.ShaderMaterial) {
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(this.scene, cam);
    renderer.setRenderTarget(prevTarget);
  }

  dispose() {
    this.material.dispose();
  }
}

export const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
