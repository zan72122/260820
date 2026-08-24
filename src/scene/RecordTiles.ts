import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, PlaneGeometry, Vector3 } from 'three';
import type { ChestCoord, WindowId } from '../audio/BodySoundField';
import { clamp01, damp } from '../core/mathutil';
import type { MaterialLibrary } from './materials';
import { makeTileEngraving } from './textures';

export interface TileHandle {
  id: WindowId;
  coord: ChestCoord;
  group: Group;
  /** The face that is raycast for taps. */
  face: Mesh;
  playing: number;
}

/**
 * The physical record tiles on the instrument stand.
 *
 * They are lab hardware, not a UI: a struck metal plate per place that was
 * listened to, showing only a small grey chest outline with the spot marked.
 * No colour coding, no names, no waveform, no score. Pressing one plays the
 * heartbeat as it sounds there — on the same beat that is going on right now.
 */
export class RecordTiles {
  readonly root = new Group();
  private tiles: TileHandle[] = [];
  private slots: Vector3[] = [];

  constructor(private mats: MaterialLibrary) {
    for (let i = 0; i < 4; i++) {
      this.slots.push(new Vector3(-0.153 + i * 0.102, 0.006, 0.0));
    }
  }

  get list(): ReadonlyArray<TileHandle> {
    return this.tiles;
  }

  has(id: WindowId): boolean {
    return this.tiles.some((t) => t.id === id);
  }

  /** The instructor sets a new tile down on the stand. */
  add(id: WindowId, coord: ChestCoord): TileHandle {
    const existing = this.tiles.find((t) => t.id === id);
    if (existing) {
      existing.coord = coord;
      return existing;
    }
    const group = new Group();
    const plate = new Mesh(new BoxGeometry(0.088, 0.011, 0.088), this.mats.engravedPlate);
    plate.castShadow = true;
    plate.receiveShadow = true;
    group.add(plate);

    const faceMat = new MeshPhysicalMaterial({
      map: makeTileEngraving(coord.lat, coord.sup),
      roughness: 0.58,
      metalness: 0.45,
      clearcoat: 0.12,
    });
    const face = new Mesh(new PlaneGeometry(0.082, 0.082), faceMat);
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.0057;
    face.userData.tileId = id;
    group.add(face);

    const slot = this.slots[Math.min(this.tiles.length, 3)];
    group.position.copy(slot);
    group.position.y += 0.09;
    group.rotation.y = (Math.random() - 0.5) * 0.09;
    this.root.add(group);

    const handle: TileHandle = { id, coord, group, face, playing: 0 };
    this.tiles.push(handle);
    return handle;
  }

  find(id: WindowId): TileHandle | undefined {
    return this.tiles.find((t) => t.id === id);
  }

  pickables(): Mesh[] {
    return this.tiles.map((t) => t.face);
  }

  markPlaying(id: WindowId, on: boolean): void {
    const t = this.find(id);
    if (t) t.playing = on ? 1 : 0;
  }

  update(dt: number): void {
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      const slot = this.slots[Math.min(i, 3)];
      t.group.position.x = damp(t.group.position.x, slot.x, 6, dt);
      t.group.position.z = damp(t.group.position.z, slot.z, 6, dt);
      // A pressed tile sits a fraction lower in its slot, like a real key.
      const targetY = slot.y - clamp01(t.playing) * 0.0035;
      t.group.position.y = damp(t.group.position.y, targetY, 9, dt);
    }
  }
}
