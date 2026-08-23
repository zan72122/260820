/**
 * One-finger input: raycast on pointer-down against registered hit shapes
 * (oversized invisible proxies for toddler fingers), then hand the drag to
 * the owning control. No multitouch gestures are required anywhere.
 */
import * as THREE from 'three';

export interface DragTarget {
  /** Oversized invisible mesh used for hit testing. */
  hitMesh: THREE.Object3D;
  enabled: () => boolean;
  onDown?: (hit: THREE.Intersection, pointer: PointerInfo) => void;
  onDrag?: (pointer: PointerInfo) => void;
  onUp?: (pointer: PointerInfo, wasTap: boolean) => void;
}

export interface PointerInfo {
  ndc: THREE.Vector2;
  dxPx: number; // total movement in css px since down
  dyPx: number;
  x: number;
  y: number;
  ray: THREE.Ray;
}

export class InputManager {
  private raycaster = new THREE.Raycaster();
  private targets: DragTarget[] = [];
  private active: DragTarget | null = null;
  private downX = 0;
  private downY = 0;
  private pointerId: number | null = null;
  onAnyPointerDown: (() => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: THREE.PerspectiveCamera,
  ) {
    canvas.addEventListener('pointerdown', this.handleDown, { passive: false });
    window.addEventListener('pointermove', this.handleMove, { passive: false });
    window.addEventListener('pointerup', this.handleUp, { passive: false });
    window.addEventListener('pointercancel', this.handleUp, { passive: false });
  }

  register(t: DragTarget) {
    this.targets.push(t);
  }

  private pointerInfo(e: PointerEvent): PointerInfo {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    return {
      ndc,
      dxPx: e.clientX - this.downX,
      dyPx: e.clientY - this.downY,
      x: e.clientX,
      y: e.clientY,
      ray: this.raycaster.ray.clone(),
    };
  }

  private handleDown = (e: PointerEvent) => {
    if (this.pointerId !== null) return; // one finger owns the lab
    this.onAnyPointerDown?.();
    this.downX = e.clientX;
    this.downY = e.clientY;
    const info = this.pointerInfo(e);
    const enabled = this.targets.filter((t) => t.enabled());
    const meshes = enabled.map((t) => t.hitMesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return;
    let obj: THREE.Object3D | null = hits[0].object;
    let owner: DragTarget | undefined;
    while (obj && !owner) {
      owner = enabled.find((t) => t.hitMesh === obj);
      obj = obj.parent;
    }
    if (!owner) return;
    this.pointerId = e.pointerId;
    this.active = owner;
    e.preventDefault();
    owner.onDown?.(hits[0], info);
  };

  private handleMove = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId || !this.active) return;
    e.preventDefault();
    this.active.onDrag?.(this.pointerInfo(e));
  };

  private handleUp = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    const info = this.pointerInfo(e);
    const wasTap = Math.hypot(info.dxPx, info.dyPx) < 12;
    this.active?.onUp?.(info, wasTap);
    this.active = null;
    this.pointerId = null;
  };
}
