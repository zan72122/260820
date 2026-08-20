import * as THREE from 'three';
import { MaterialLibrary } from '../materials/library';
import { anodised, galvanised, paintedSteel, timber } from '../materials/recipes';
import { FLOORS, FLOOR_ORDER, type FloorId } from '../physics/params';
import { damp } from '../util/math';
import { CHAIN_PADS, TILE_RACK_POS } from './layout';
import { DeformablePanel, attachWearMap } from './panel';
import type { TurntableQuality } from './turntable';

/**
 * The free-arrangement yard.
 *
 * Three low cradles bolted to the apron, each tilted a little so a bounce
 * carries along the line, plus a rack of spare sample tiles. There is no goal
 * and no score: the interesting part is that swapping one tile changes where
 * the ball ends up, and the child gets to guess before they pull the ring.
 */

export interface ChainSlot {
  panel: DeformablePanel;
  floorId: FloorId | null;
  index: number;
  tilt: number;
  center: THREE.Vector3;
  halfX: number;
  halfZ: number;
  marker: THREE.Mesh;
}

export class ChainArea {
  readonly group = new THREE.Group();
  readonly slots: ChainSlot[] = [];
  readonly tiles: THREE.Mesh[] = [];
  private lib: MaterialLibrary;
  private tileRack = new THREE.Group();
  private markerPulse = 0;
  private highlight = -1;
  private tileHomes: THREE.Vector3[] = [];
  private carrying = -1;
  /** 0..1 hint lift applied to one spare tile. */
  nudge = 0;

  constructor(lib: MaterialLibrary, quality: TurntableQuality) {
    this.lib = lib;
    const galvMat = lib.get(galvanised, { repeat: 3, normalScale: 0.9 }, 'chain');
    const paintMat = lib.get(paintedSteel, { repeat: 2, normalScale: 0.9 }, 'chain');
    const anodMat = lib.get(anodised, { repeat: 2, normalScale: 0.8 }, 'chain');
    const timberMat = lib.get(timber, { repeat: 2, normalScale: 1.1 }, 'chain');

    // --- the three cradles -------------------------------------------------
    for (let i = 0; i < CHAIN_PADS.length; i++) {
      const cfg = CHAIN_PADS[i];
      const tilt = (cfg.tilt * Math.PI) / 180;

      const cradle = new THREE.Group();
      cradle.position.set(cfg.x, cfg.y, cfg.z);
      cradle.rotation.z = tilt;

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.halfX * 2 + 0.07, 0.05, cfg.halfZ * 2 + 0.07),
        paintMat
      );
      frame.position.y = -0.03;
      frame.castShadow = true;
      frame.receiveShadow = true;
      cradle.add(frame);

      // Feet that actually reach the concrete under the tilted frame.
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const footH = Math.max(0.02, cfg.y - 0.02 + sx * Math.sin(tilt) * cfg.halfX * 0.9);
          const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05, footH, 0.05), galvMat);
          foot.position.set(cfg.halfX * 0.86 * sx, -0.055 - footH / 2, cfg.halfZ * 0.72 * sz);
          foot.rotation.z = -tilt;
          foot.castShadow = true;
          foot.receiveShadow = true;
          cradle.add(foot);
        }
      }

      const lipGeo = new THREE.BoxGeometry(0.03, 0.035, cfg.halfZ * 2 + 0.07);
      for (const sx of [-1, 1]) {
        const lip = new THREE.Mesh(lipGeo, anodMat);
        lip.position.set((cfg.halfX + 0.02) * sx, -0.005, 0);
        lip.castShadow = true;
        cradle.add(lip);
      }

      // The snap target: a machined seat that glows faintly when a tile is
      // being carried nearby. No text, no arrow — just somewhere to put it.
      const marker = new THREE.Mesh(
        new THREE.PlaneGeometry(cfg.halfX * 2, cfg.halfZ * 2),
        new THREE.MeshBasicMaterial({
          color: 0xf4e6c4,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          toneMapped: false,
        })
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.004;
      marker.renderOrder = 6;
      cradle.add(marker);

      const panel = new DeformablePanel(FLOORS.rubber, {
        shape: 'rect',
        halfX: cfg.halfX,
        halfZ: cfg.halfZ,
        fieldRes: Math.max(32, Math.round(quality.fieldRes * 0.8)),
        meshRes: Math.max(16, Math.round(quality.meshRes * 0.7)),
        wearRes: quality.wearRes,
      });
      panel.group.visible = false;
      cradle.add(panel.group);

      this.group.add(cradle);
      this.slots.push({
        panel,
        floorId: null,
        index: i,
        tilt,
        center: new THREE.Vector3(cfg.x, cfg.y, cfg.z),
        halfX: cfg.halfX,
        halfZ: cfg.halfZ,
        marker,
      });
    }

    // --- the tile rack -----------------------------------------------------
    this.tileRack.position.set(TILE_RACK_POS.x, TILE_RACK_POS.y, TILE_RACK_POS.z);
    this.tileRack.rotation.y = -0.5;

    const rackBase = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.06, 0.34), timberMat);
    rackBase.position.y = 0.03;
    rackBase.castShadow = true;
    rackBase.receiveShadow = true;
    this.tileRack.add(rackBase);
    const rackBack = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.36, 0.05), timberMat);
    rackBack.position.set(0, 0.2, -0.14);
    rackBack.rotation.x = -0.22;
    rackBack.castShadow = true;
    rackBack.receiveShadow = true;
    this.tileRack.add(rackBack);

    const tileGeo = new THREE.BoxGeometry(0.15, 0.024, 0.15);
    for (let i = 0; i < FLOOR_ORDER.length; i++) {
      const tile = new THREE.Mesh(tileGeo, galvMat);
      const x = (i - (FLOOR_ORDER.length - 1) / 2) * 0.18;
      tile.position.set(x, 0.14, -0.05);
      tile.rotation.x = -0.22;
      tile.castShadow = true;
      tile.receiveShadow = true;
      tile.userData.pick = 'tile';
      tile.userData.floorIndex = i;
      this.tileRack.add(tile);
      this.tiles.push(tile);
      this.tileHomes.push(tile.position.clone());
    }
    this.group.add(this.tileRack);
    this.group.visible = false;
  }

  /** Give a cradle a material, or clear it with `null`. */
  setSlot(index: number, floorId: FloorId | null) {
    const slot = this.slots[index];
    slot.floorId = floorId;
    if (!floorId) {
      slot.panel.group.visible = false;
      return;
    }
    const spec = FLOORS[floorId];
    slot.panel.spec = spec;
    slot.panel.reset();
    const mat = this.lib.get(
      spec.recipe,
      {
        repeat: 1,
        normalScale: spec.id === 'sand' || spec.id === 'felt' ? 1.4 : 1.0,
        envMapIntensity: spec.id === 'metal' ? 1.35 : 0.9,
        physical: spec.id === 'clay',
        clearcoat: spec.id === 'clay' ? 0.5 : undefined,
        clearcoatRoughness: 0.28,
      },
      `chain${index}`
    );
    attachWearMap(mat, slot.panel.wearTexture);
    slot.panel.setMaterial(mat);
    slot.panel.group.visible = true;
  }

  /** Paint the tiles with the real materials once the yard is opened. */
  primeTiles() {
    for (let i = 0; i < this.tiles.length; i++) {
      const spec = FLOORS[FLOOR_ORDER[i]];
      this.tiles[i].material = this.lib.get(
        spec.recipe,
        { repeat: 1, envMapIntensity: spec.id === 'metal' ? 1.3 : 0.9 },
        `tile${i}`
      );
    }
  }

  floorIdForTile(index: number): FloorId {
    return FLOOR_ORDER[index];
  }

  /** Highlight the cradle a carried tile would land in. */
  setHighlight(index: number) {
    this.highlight = index;
  }

  /** Nearest cradle to a world point, or -1 if none is close enough. */
  nearestSlot(point: THREE.Vector3, maxDistance = 0.55) {
    let best = -1;
    let bestD = maxDistance;
    for (const s of this.slots) {
      const d = Math.hypot(point.x - s.center.x, point.z - s.center.z);
      if (d < bestD) {
        bestD = d;
        best = s.index;
      }
    }
    return best;
  }

  get filledCount() {
    return this.slots.filter((s) => s.floorId !== null).length;
  }

  /** Carry a spare tile with the finger. */
  carryTile(index: number, world: THREE.Vector3 | null) {
    this.carrying = index;
    const tile = this.tiles[index];
    if (!world) {
      tile.position.copy(this.tileHomes[index]);
      tile.position.y += 0.04;
      return;
    }
    this.tileRack.worldToLocal(tile.position.copy(world));
    tile.rotation.x = 0;
  }

  restoreTile(index: number) {
    this.carrying = -1;
    this.tiles[index].position.copy(this.tileHomes[index]);
    this.tiles[index].rotation.x = -0.22;
  }

  update(dt: number) {
    this.markerPulse += dt * 2.6;
    for (let i = 0; i < this.tiles.length; i++) {
      if (i === this.carrying) continue;
      this.tiles[i].position.y = this.tileHomes[i].y + (i === 0 ? this.nudge * 0.03 : 0);
    }
    const pulse = 0.16 + Math.sin(this.markerPulse) * 0.07;
    for (const s of this.slots) {
      const mat = s.marker.material as THREE.MeshBasicMaterial;
      const want = this.highlight === s.index ? pulse + 0.16 : this.highlight >= 0 && !s.floorId ? pulse * 0.5 : 0;
      mat.opacity = damp(mat.opacity, want, 12, dt);
      s.panel.update(dt);
    }
  }

  dispose() {
    for (const s of this.slots) s.panel.dispose();
  }
}
