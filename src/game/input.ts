import * as THREE from 'three';
import type { Game } from './game';

/**
 * One-finger interaction:
 *  - grab the moving letter (or its bogie/handle) and slide it on the rail —
 *    the finger and the letter move 1:1, which is the whole point
 *  - horizontal swipe on empty space advances to the next pair (only after
 *    the current pair has been solved)
 * The camera never moves while a finger is down, and the letter is grabbed
 * low (bogie/handle) or on its body, so the negative space stays visible.
 */
export class Input {
  private raycaster = new THREE.Raycaster();
  private dragging = false;
  private lastWorldX = 0;
  private downX = 0;
  private downY = 0;
  private pointerId: number | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private game: Game,
    private camera: THREE.PerspectiveCamera,
  ) {
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
  }

  private ndc(e: PointerEvent): THREE.Vector2 {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  }

  /** intersect the pointer ray with the letters' travel plane (z = 0). */
  private worldX(e: PointerEvent): number {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const o = this.raycaster.ray.origin;
    const d = this.raycaster.ray.direction;
    if (Math.abs(d.z) < 1e-6) return o.x;
    const t = -o.z / d.z;
    return o.x + d.x * t;
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.game.interacted();
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const hits = this.raycaster.intersectObjects(this.game.dragTargets, false);
    if (hits.length > 0 && (this.game.phase === 'adjust' || this.game.phase === 'result')) {
      this.dragging = true;
      this.lastWorldX = this.worldX(e);
      this.canvas.setPointerCapture(e.pointerId);
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId || !this.dragging) return;
    const wx = this.worldX(e);
    const dx = wx - this.lastWorldX;
    this.lastWorldX = wx;
    if (dx !== 0) this.game.dragBy(dx);
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (this.dragging) {
      this.dragging = false;
      this.game.dragEnd();
      return;
    }
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) {
      this.game.swipeNext();
    }
  };
}
