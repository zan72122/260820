import { Mesh, Raycaster, Vector2, Vector3 } from 'three';
import type { BodySoundField, ChestCoord } from '../audio/BodySoundField';
import { clamp, damp } from '../core/mathutil';
import { chestSurfacePoint, worldToChestCoord } from '../scene/ChestSurface';
import type { CameraDirector } from '../game/CameraDirector';
import type { PointerInput } from './PointerInput';

/**
 * Moving the chestpiece with one finger.
 *
 * The finger never has to hit an exact intercostal space: the whole anterior
 * chest is draggable and the sound field underneath it is continuous. The
 * chestpiece is also drawn *above* the touch point, so a small hand does not
 * cover the very thing it is placing.
 */
export class ChestpieceDrag {
  /** Where the chestpiece actually is, after smoothing. */
  readonly coord: ChestCoord = { lat: 0, sup: 0.3 };
  /** Where the finger is asking it to be. */
  private wanted: ChestCoord = { lat: 0, sup: 0.3 };
  private raycaster = new Raycaster();
  private ndc = new Vector2();
  private lastHitOk = false;
  private lastNdc = new Vector2();
  private enabled = false;
  private surfaceScratch = { position: new Vector3(), normal: new Vector3() };

  /**
   * The chestpiece is drawn this many CSS pixels above the finger. Chosen so a
   * four-year-old's fingertip clears the 24 mm chestpiece on a phone.
   */
  fingerOffsetPx = 46;

  constructor(
    private pointer: PointerInput,
    private director: CameraDirector,
    private field: BodySoundField,
  ) {}

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Put the chestpiece somewhere without the child having dragged it there. */
  place(coord: ChestCoord, immediate = true): void {
    this.wanted = { ...coord };
    if (immediate) {
      this.coord.lat = coord.lat;
      this.coord.sup = coord.sup;
    }
  }

  /**
   * @param torso the mesh to raycast against
   * @returns true when the finger is currently over the chest
   */
  update(dt: number, torso: Mesh): boolean {
    const s = this.pointer.state;
    if (this.enabled && s.active) {
      const px = s.x;
      const py = s.y - this.fingerOffsetPx;
      this.pointer.toNdc(px, py, this.ndc);
      this.raycaster.setFromCamera(this.ndc, this.director.camera);
      const hits = this.raycaster.intersectObject(torso, false);
      if (hits.length > 0) {
        const c = worldToChestCoord(hits[0].point);
        // Only the front of the trunk is a listening surface.
        if (Math.abs(c.lat) <= 1.15) {
          this.wanted = this.field.clampToChest(c);
          this.lastHitOk = true;
        }
      } else if (this.lastHitOk) {
        // Slid past the edge of the trunk: keep going in screen space rather
        // than freezing, so the chestpiece never sticks at the silhouette.
        const dx = this.ndc.x - this.lastNdc.x;
        const dy = this.ndc.y - this.lastNdc.y;
        this.wanted = this.field.clampToChest({
          lat: this.wanted.lat - dx * 2.6,
          sup: this.wanted.sup + dy * 2.2,
        });
      }
      this.lastNdc.copy(this.ndc);
    }

    // Smoothing is what makes the acoustic change a slide instead of a jump.
    this.coord.lat = damp(this.coord.lat, this.wanted.lat, 13, dt);
    this.coord.sup = damp(this.coord.sup, this.wanted.sup, 13, dt);
    return this.enabled && s.active;
  }

  /** Normalised drag speed, for tubing friction and the sense of contact. */
  dragSpeed(): number {
    return clamp(this.pointer.state.speed / 900, 0, 1);
  }

  /** True while the finger is actually over the chest surface. */
  isOverChest(): boolean {
    return this.lastHitOk && this.pointer.state.active;
  }

  surface(): { position: Vector3; normal: Vector3 } {
    return chestSurfacePoint(this.coord, this.surfaceScratch);
  }
}
