import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { makeRng } from '../core/rng';
import { TABLE_TOP_Y } from './ChestSurface';
import type { MaterialLibrary } from './materials';

/**
 * A clinical skills lab that has been used.
 *
 * Not an operating theatre, not a science-fiction bay: sheet vinyl with welded
 * seams, a powder-coated exam table with a wipeable pad and a paper roll, a
 * rolling instrument stand, a cubicle curtain on a ceiling track, and daylight
 * from one window.
 */
export class Room {
  readonly root = new Group();
  /** Rolling stand that carries the record tiles. */
  readonly instrumentStand = new Group();
  /** Training listening head the eartips are seated into. */
  readonly listeningHead = new Group();
  /** The large side rail used for the posture change. */
  readonly bedHandle = new Group();
  readonly tileAnchor = new Group();

  constructor(mats: MaterialLibrary) {
    this.buildShell(mats);
    this.buildExamTable(mats);
    this.buildInstrumentStand(mats);
    this.buildBackground(mats);
  }

  private buildShell(mats: MaterialLibrary): void {
    const floor = new Mesh(new PlaneGeometry(9, 9), mats.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.root.add(floor);

    const wallBack = new Mesh(new PlaneGeometry(6.4, 3.0), mats.wall);
    wallBack.position.set(0, 1.5, -2.6);
    wallBack.receiveShadow = true;
    this.root.add(wallBack);

    const wallLeft = new Mesh(new PlaneGeometry(6.0, 3.0), mats.wall);
    wallLeft.rotation.y = Math.PI / 2;
    wallLeft.position.set(-2.6, 1.5, 0);
    wallLeft.receiveShadow = true;
    this.root.add(wallLeft);

    const wallRight = new Mesh(new PlaneGeometry(6.0, 3.0), mats.wall);
    wallRight.rotation.y = -Math.PI / 2;
    wallRight.position.set(2.6, 1.5, 0);
    wallRight.receiveShadow = true;
    this.root.add(wallRight);

    const ceiling = new Mesh(
      new PlaneGeometry(6.4, 6.0),
      new MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.95 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 2.82;
    this.root.add(ceiling);

    // Skirting, so the walls actually meet the floor.
    for (const [pos, rot, len] of [
      [[0, 0.05, -2.585], 0, 6.4],
      [[-2.585, 0.05, 0], Math.PI / 2, 6.0],
      [[2.585, 0.05, 0], Math.PI / 2, 6.0],
    ] as Array<[number[], number, number]>) {
      const skirt = new Mesh(new BoxGeometry(len, 0.1, 0.022), mats.powderCoat);
      skirt.position.set(pos[0], pos[1], pos[2]);
      skirt.rotation.y = rot;
      this.root.add(skirt);
    }

    // Daylight window on the right-hand wall.
    const frame = new Group();
    const glass = new Mesh(
      new PlaneGeometry(1.9, 1.15),
      new MeshStandardMaterial({
        color: 0xdfe8ef,
        roughness: 0.12,
        metalness: 0.0,
        emissive: 0xbcd0dd,
        emissiveIntensity: 0.55,
      }),
    );
    glass.rotation.y = -Math.PI / 2;
    frame.add(glass);
    for (const off of [-0.6, 0.0, 0.6]) {
      const mullion = new Mesh(new BoxGeometry(0.03, 1.2, 0.045), mats.powderCoat);
      mullion.position.set(0.01, 0, off);
      frame.add(mullion);
    }
    const sill = new Mesh(new BoxGeometry(0.09, 0.04, 2.0), mats.laminate);
    sill.position.set(-0.03, -0.6, 0);
    frame.add(sill);
    frame.position.set(2.57, 1.62, -0.5);
    this.root.add(frame);

    // Cubicle curtain, partly drawn, on a ceiling track.
    const track = new Mesh(new BoxGeometry(0.035, 0.035, 2.6), mats.powderCoat);
    track.position.set(-1.62, 2.72, -0.5);
    this.root.add(track);
    const curtain = new Group();
    const rng = makeRng(4711);
    for (let i = 0; i < 22; i++) {
      const fold = new Mesh(new CylinderGeometry(0.055, 0.062, 1.95, 8, 1, true), mats.curtain);
      const t = i / 21;
      fold.position.set(-1.62 + Math.sin(t * Math.PI * 5) * 0.035, 1.72, -1.62 + t * 2.0);
      fold.rotation.y = rng() * 0.4;
      curtain.add(fold);
    }
    this.root.add(curtain);
  }

  private buildExamTable(mats: MaterialLibrary): void {
    const table = new Group();

    // Base cabinet.
    const base = new Mesh(new BoxGeometry(0.66, 0.34, 1.5), mats.powderCoat);
    base.position.set(0, 0.48, -0.05);
    base.castShadow = true;
    base.receiveShadow = true;
    table.add(base);
    for (const z of [-0.45, 0.0, 0.45]) {
      const drawerLine = new Mesh(new BoxGeometry(0.665, 0.006, 0.012), mats.manikinShell);
      drawerLine.position.set(0, 0.48 + 0.001, z);
      table.add(drawerLine);
    }

    // Powder-coated legs and a foot rail.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new Mesh(new BoxGeometry(0.05, 0.31, 0.05), mats.powderCoat);
        leg.position.set(sx * 0.29, 0.155, sz * 0.82);
        leg.castShadow = true;
        table.add(leg);
        const foot = new Mesh(new CylinderGeometry(0.03, 0.034, 0.014, 12), mats.nonChillRim);
        foot.position.set(sx * 0.29, 0.007, sz * 0.82);
        table.add(foot);
      }
      const rail = new Mesh(new BoxGeometry(0.03, 0.03, 1.6), mats.powderCoat);
      rail.position.set(sx * 0.29, 0.16, 0);
      table.add(rail);
    }

    // Wipe-clean pad, then the paper roll over it.
    const pad = new Mesh(new BoxGeometry(0.72, 0.075, 1.94), mats.vinylPad);
    pad.position.set(0, TABLE_TOP_Y - 0.037, 0);
    pad.castShadow = true;
    pad.receiveShadow = true;
    table.add(pad);
    const paper = new Mesh(new BoxGeometry(0.46, 0.003, 1.42), mats.paper);
    paper.position.set(0, TABLE_TOP_Y + 0.0025, 0.12);
    paper.receiveShadow = true;
    table.add(paper);
    const roll = new Mesh(new CylinderGeometry(0.05, 0.05, 0.46, 20), mats.paper);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, TABLE_TOP_Y + 0.026, -0.94);
    table.add(roll);

    this.root.add(table);

    // Side rail: the large handle used to change the manikin's posture.
    const railTube = new Mesh(new CylinderGeometry(0.017, 0.017, 0.72, 14), mats.chromeSteel);
    railTube.rotation.x = Math.PI / 2;
    railTube.castShadow = true;
    this.bedHandle.add(railTube);
    for (const sz of [-1, 1]) {
      const post = new Mesh(new CylinderGeometry(0.013, 0.013, 0.23, 12), mats.chromeSteel);
      post.position.set(0, -0.115, sz * 0.33);
      this.bedHandle.add(post);
      const bracket = new Mesh(new BoxGeometry(0.05, 0.03, 0.05), mats.powderCoat);
      bracket.position.set(-0.012, -0.226, sz * 0.33);
      this.bedHandle.add(bracket);
      const grip = new Mesh(new TorusGeometry(0.021, 0.008, 8, 18), mats.nonChillRim);
      grip.rotation.y = Math.PI / 2;
      grip.position.set(0, 0, sz * 0.2);
      this.bedHandle.add(grip);
    }
    this.bedHandle.position.set(-0.395, TABLE_TOP_Y + 0.15, 0.16);
    this.root.add(this.bedHandle);
  }

  private buildInstrumentStand(mats: MaterialLibrary): void {
    const stand = this.instrumentStand;

    const top = new Mesh(new BoxGeometry(0.56, 0.022, 0.38), mats.laminate);
    top.position.set(0, 0.8, 0);
    top.castShadow = true;
    top.receiveShadow = true;
    stand.add(top);
    const lip = new Mesh(new BoxGeometry(0.575, 0.016, 0.395), mats.powderCoat);
    lip.position.set(0, 0.789, 0);
    stand.add(lip);

    const column = new Mesh(new CylinderGeometry(0.023, 0.028, 0.78, 14), mats.powderCoat);
    column.position.set(0, 0.39, 0);
    column.castShadow = true;
    stand.add(column);

    // Weighted base with casters, sitting flat on the floor.
    const base = new Mesh(new CylinderGeometry(0.2, 0.22, 0.03, 20), mats.powderCoat);
    base.position.set(0, 0.05, 0);
    base.castShadow = true;
    stand.add(base);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const caster = new Mesh(new CylinderGeometry(0.026, 0.026, 0.016, 12), mats.nonChillRim);
      caster.rotation.z = Math.PI / 2;
      caster.position.set(Math.cos(a) * 0.17, 0.026, Math.sin(a) * 0.17);
      stand.add(caster);
    }

    // Handle with the rub-through a hand actually leaves.
    const handle = new Mesh(new TorusGeometry(0.055, 0.009, 8, 20, Math.PI), mats.chromeSteel);
    handle.rotation.set(Math.PI / 2, 0, 0);
    handle.position.set(0, 0.66, 0.13);
    stand.add(handle);

    this.tileAnchor.position.set(0, 0.812, 0.06);
    stand.add(this.tileAnchor);

    // Training listening head: a mount with two ear canals for seating the
    // eartips before listening. It lives on the stand, not on the manikin.
    const headBase = new Mesh(new CylinderGeometry(0.042, 0.05, 0.022, 16), mats.powderCoat);
    this.listeningHead.add(headBase);
    const post = new Mesh(new CylinderGeometry(0.012, 0.012, 0.06, 12), mats.brushedSteel);
    post.position.y = 0.04;
    this.listeningHead.add(post);
    const form = new Mesh(new SphereGeometry(0.055, 20, 14), mats.trainingPolymer);
    form.scale.set(0.8, 0.94, 0.9);
    form.position.y = 0.104;
    form.castShadow = true;
    this.listeningHead.add(form);
    // A moulded band across the crown marks it as a fixture, not a face.
    const band = new Mesh(new TorusGeometry(0.045, 0.005, 8, 20), mats.nonChillRim);
    band.rotation.y = Math.PI / 2;
    band.position.y = 0.108;
    this.listeningHead.add(band);
    for (const sx of [-1, 1]) {
      const cup = new Mesh(new CylinderGeometry(0.019, 0.021, 0.012, 16), mats.nonChillRim);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(sx * 0.046, 0.104, 0.002);
      this.listeningHead.add(cup);
      const canal = new Mesh(new CylinderGeometry(0.008, 0.008, 0.014, 10), mats.manikinShell);
      canal.rotation.z = Math.PI / 2;
      canal.position.set(sx * 0.05, 0.104, 0.002);
      this.listeningHead.add(canal);
    }
    this.listeningHead.position.set(-0.03, 0.812, -0.115);
    stand.add(this.listeningHead);

    stand.position.set(0.72, 0, 0.26);
    stand.rotation.y = -0.42;
    this.root.add(stand);
  }

  private buildBackground(mats: MaterialLibrary): void {
    // Mid and far ground: a supply cabinet, a wall rail, a stool, a bin.
    const cabinet = new Group();
    const body = new Mesh(new BoxGeometry(0.9, 1.68, 0.42), mats.powderCoat);
    body.position.set(0, 0.84, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    cabinet.add(body);
    for (const y of [0.55, 1.15]) {
      const door = new Mesh(new BoxGeometry(0.87, 0.55, 0.014), mats.laminate);
      door.position.set(0, y, 0.215);
      cabinet.add(door);
      const pull = new Mesh(new CylinderGeometry(0.007, 0.007, 0.11, 8), mats.chromeSteel);
      pull.rotation.z = Math.PI / 2;
      pull.position.set(0.28, y, 0.226);
      cabinet.add(pull);
    }
    cabinet.position.set(-1.42, 0, -2.3);
    this.root.add(cabinet);

    const stool = new Group();
    const seat = new Mesh(new CylinderGeometry(0.15, 0.15, 0.05, 18), mats.nonChillRim);
    seat.position.y = 0.52;
    seat.castShadow = true;
    stool.add(seat);
    const col = new Mesh(new CylinderGeometry(0.025, 0.03, 0.48, 12), mats.chromeSteel);
    col.position.y = 0.26;
    stool.add(col);
    const foot = new Mesh(new CylinderGeometry(0.17, 0.18, 0.022, 18), mats.powderCoat);
    foot.position.y = 0.03;
    stool.add(foot);
    stool.position.set(-1.1, 0, 0.55);
    this.root.add(stool);

    const bin = new Mesh(new CylinderGeometry(0.16, 0.14, 0.44, 16), mats.powderCoat);
    bin.position.set(1.75, 0.22, -1.55);
    bin.castShadow = true;
    this.root.add(bin);

    const rail = new Mesh(new BoxGeometry(2.2, 0.05, 0.05), mats.powderCoat);
    rail.position.set(0.2, 1.45, -2.56);
    this.root.add(rail);
  }
}
