import * as THREE from 'three';
import { brushTexture } from './textures';
import { clamp } from '../core/rng';

export interface Stamp {
  /** dome UV, u = azimuth / 2pi, v = 0 at the equator, 1 at the pole */
  u: number;
  v: number;
  /** half-extent in UV units. The dome parameterisation is strongly
   *  anisotropic, so a round footprint on the cake is an ellipse here. */
  rx: number;
  ry: number;
  /** meringue coverage added (R) */
  cover: number;
  /** browning added (G) */
  bake: number;
  /** transverse ridge added (B) */
  ridge: number;
}

/**
 * A single low-resolution render target in dome-UV space carries three
 * accumulating channels:
 *
 *   R  meringue coverage   -> reveals + swells the shell
 *   G  browning            -> white -> cream -> gold -> amber
 *   B  ridge phase         -> the periodic peaks left by the star nozzle
 *
 * Additive blending means everything the player does is *accumulated*, so the
 * browning they painted stays exactly where they painted it — across pauses,
 * rotations and camera moves alike. Nothing is ever read back to the CPU.
 */
export class PaintMask {
  readonly target: THREE.WebGLRenderTarget;
  readonly texture: THREE.Texture;

  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private brush: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private renderer: THREE.WebGLRenderer;
  private queue: Stamp[] = [];

  constructor(renderer: THREE.WebGLRenderer, size: number) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(size, size, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      colorSpace: THREE.NoColorSpace,
    });
    this.target.texture.wrapS = THREE.RepeatWrapping;
    this.target.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture = this.target.texture;

    // UV space maps straight onto the ortho frustum.
    this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);

    this.brush = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: brushTexture(64),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.brush.frustumCulled = false;
    this.scene.add(this.brush);
  }

  /** Wipe back to bare, unpiped, unbaked. */
  clear(): void {
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.target);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear(true, false, false);
    this.renderer.setRenderTarget(prev);
    this.renderer.setClearColor(0x0d0b0d, 1);
    this.queue.length = 0;
  }

  /** Queue one dab. Stamps that straddle the u seam are mirrored automatically. */
  add(s: Stamp): void {
    if (s.rx <= 0 || s.ry <= 0) return;
    this.queue.push(s);
    const margin = s.rx * 1.2;
    if (s.u < margin) this.queue.push({ ...s, u: s.u + 1 });
    else if (s.u > 1 - margin) this.queue.push({ ...s, u: s.u - 1 });
  }

  get pending(): number {
    return this.queue.length;
  }

  /** Flush everything queued this frame into the mask. */
  flush(): void {
    if (this.queue.length === 0) return;
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevAutoClear = r.autoClear;
    r.autoClear = false;
    r.setRenderTarget(this.target);

    for (const s of this.queue) {
      this.brush.position.set(s.u, clamp(s.v, -0.5, 1.5), 0);
      this.brush.scale.set(s.rx * 2, s.ry * 2, 1);
      this.brush.material.color.setRGB(
        clamp(s.cover, 0, 4),
        clamp(s.bake, 0, 4),
        clamp(s.ridge, 0, 4),
      );
      this.brush.updateMatrixWorld(true);
      r.render(this.scene, this.camera);
    }

    r.setRenderTarget(prevTarget);
    r.autoClear = prevAutoClear;
    this.queue.length = 0;
  }

  dispose(): void {
    this.target.dispose();
    this.brush.geometry.dispose();
    this.brush.material.map?.dispose();
    this.brush.material.dispose();
  }
}
