import * as THREE from 'three';
import { bareSteel, rubberBelt } from '../world/textures';
import { BALE_HALF_W, BALE_R_MAX, BALE_R_MIN, CHAMBER_R } from '../game/constants';
import { Bale } from './Bale';

/**
 * The roll room.
 *
 * A ring of driven steel rollers with three rubber belts running round
 * the inside; the crop entering from the throat is rolled up into a
 * cylinder that grows outward until it fills the chamber.  Seen through
 * the inspection window on the machine's left flank the whole thing
 * reads as one thing: a circle that gets bigger.
 */
export class Chamber {
  readonly group = new THREE.Group();
  readonly bale: Bale;

  private belts: THREE.Mesh[] = [];
  private beltTex: THREE.Texture;
  private rollers: THREE.Group = new THREE.Group();
  /** Rollers carried by the tailgate — the owner re-parents these. */
  readonly rearRollers: THREE.Group = new THREE.Group();
  private filmRoll: THREE.Mesh;
  private filmSheet: THREE.Mesh;
  private filmSheetMat: THREE.MeshStandardMaterial;
  private endPlate: THREE.Mesh;
  private lamp: THREE.PointLight;

  private spinPhase = 0;

  constructor() {
    const steelTex = bareSteel();
    const steel = new THREE.MeshStandardMaterial({
      map: steelTex,
      roughness: 0.42,
      metalness: 0.85,
      color: 0xb0b6b8,
    });
    const darkSteel = new THREE.MeshStandardMaterial({
      color: 0x3d4245,
      roughness: 0.66,
      metalness: 0.4,
    });

    /* ---- driven rollers around the chamber wall ------------------- */
    const rollGeo = new THREE.CylinderGeometry(0.052, 0.052, BALE_HALF_W * 2 + 0.16, 8);
    rollGeo.rotateZ(Math.PI / 2);
    const ribGeo = new THREE.CylinderGeometry(0.062, 0.062, 0.05, 8);
    ribGeo.rotateZ(Math.PI / 2);
    const N = 15;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const y = Math.sin(a) * (CHAMBER_R + 0.09);
      const z = Math.cos(a) * (CHAMBER_R + 0.09);
      // The back third of the ring lives on the tailgate, exactly as it
      // does on a real fixed-chamber baler, so it swings clear on eject.
      const onGate = z < -0.12;
      const parent = onGate ? this.rearRollers : this.rollers;
      const r = new THREE.Mesh(rollGeo, steel);
      r.position.set(0, y, z);
      parent.add(r);
      for (let k = -2; k <= 2; k++) {
        const rib = new THREE.Mesh(ribGeo, darkSteel);
        rib.position.set(k * 0.26, y, z);
        parent.add(rib);
      }
    }
    this.group.add(this.rollers);

    /* ---- rubber belts hugging the roll ---------------------------- */
    this.beltTex = rubberBelt().clone();
    this.beltTex.wrapS = this.beltTex.wrapT = THREE.RepeatWrapping;
    this.beltTex.repeat.set(6, 1);
    this.beltTex.needsUpdate = true;
    const beltMat = new THREE.MeshStandardMaterial({
      map: this.beltTex,
      roughness: 0.82,
      metalness: 0.05,
      color: 0x8f9490,
      side: THREE.DoubleSide,
    });
    for (const x of [-0.36, 0, 0.36]) {
      const g = new THREE.CylinderGeometry(1, 1, 0.2, 26, 1, true);
      g.rotateZ(Math.PI / 2);
      const m = new THREE.Mesh(g, beltMat);
      m.position.x = x;
      this.belts.push(m);
      this.group.add(m);
    }

    /* ---- the roll itself ------------------------------------------ */
    this.bale = new Bale(BALE_HALF_W);
    this.group.add(this.bale.group);

    /* ---- net / film roll feeding from the top --------------------- */
    const filmGeo = new THREE.CylinderGeometry(0.115, 0.115, BALE_HALF_W * 2 - 0.04, 14);
    filmGeo.rotateZ(Math.PI / 2);
    this.filmRoll = new THREE.Mesh(
      filmGeo,
      new THREE.MeshStandardMaterial({ color: 0xeef1ec, roughness: 0.45 })
    );
    this.filmRoll.position.set(0, CHAMBER_R + 0.02, CHAMBER_R * 0.62);
    this.group.add(this.filmRoll);

    this.filmSheetMat = new THREE.MeshStandardMaterial({
      color: 0xf4f7f2,
      roughness: 0.3,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const sheetGeo = new THREE.PlaneGeometry(BALE_HALF_W * 1.5, 0.5, 1, 3);
    sheetGeo.rotateY(Math.PI / 2);
    sheetGeo.rotateZ(Math.PI / 2);
    this.filmSheet = new THREE.Mesh(sheetGeo, this.filmSheetMat);
    this.group.add(this.filmSheet);

    /* ---- end plates ----------------------------------------------- */
    const plate = new THREE.CylinderGeometry(CHAMBER_R + 0.2, CHAMBER_R + 0.2, 0.05, 24);
    plate.rotateZ(Math.PI / 2);
    this.endPlate = new THREE.Mesh(plate, darkSteel);
    this.endPlate.position.x = BALE_HALF_W + 0.22;
    this.group.add(this.endPlate);

    // A working lamp inside so the roll still reads through the window.
    this.lamp = new THREE.PointLight(0xffe8c6, 18, 5.5, 1.5);
    this.lamp.position.set(-0.55, 0.42, 0.34);
    this.group.add(this.lamp);

    this.setFill(0);
  }

  /** fill 0..1 -> real radius of the cylinder */
  setFill(fill: number) {
    const f = THREE.MathUtils.clamp(fill, 0, 1);
    // grow by area, not by radius: the roll fattens fast at first and
    // then creeps to full, which is how a real chamber behaves
    const r = Math.sqrt(BALE_R_MIN * BALE_R_MIN + (BALE_R_MAX * BALE_R_MAX - BALE_R_MIN * BALE_R_MIN) * f);
    this.bale.setRadius(r);
    const br = r + 0.035;
    for (const b of this.belts) b.scale.set(1, br, br);
  }

  get radius() {
    return this.bale.radius;
  }

  setWrapCoverage(c: number) {
    this.bale.setCoverage(c);
    this.filmSheetMat.opacity = c > 0 && c < 1 ? 0.72 : 0;
    if (this.filmSheetMat.opacity > 0) {
      // stretch the sheet from the roll down onto the top of the bale
      const top = this.bale.radius + 0.05;
      const from = this.filmRoll.position;
      const midY = (from.y + top) * 0.5;
      const midZ = from.z * 0.5;
      this.filmSheet.position.set(0, midY, midZ);
      const dy = top - from.y;
      const dz = 0 - from.z;
      const len = Math.hypot(dy, dz);
      this.filmSheet.scale.set(1, len / 0.5, 1);
      this.filmSheet.rotation.x = Math.atan2(dz, dy) * -1;
    }
  }

  /** speed in revolutions/sec of the roll */
  update(dt: number, speed: number) {
    this.spinPhase += dt * speed;
    this.bale.spin(dt * speed * Math.PI * 2);
    for (const b of this.belts) b.rotation.x = this.bale.group.rotation.x;
    this.beltTex.offset.x = -this.spinPhase * 0.9;
    this.filmRoll.rotation.x -= dt * speed * 5;
    this.rollers.rotation.x = 0;
  }

  setLampIntensity(v: number) {
    this.lamp.intensity = v;
  }

  /** Hand the finished roll over to the world; a fresh one starts inside. */
  releaseBale(): Bale {
    const out = this.bale;
    this.group.remove(out.group);
    const fresh = new Bale(BALE_HALF_W);
    (this as { bale: Bale }).bale = fresh;
    this.group.add(fresh.group);
    this.setFill(0);
    return out;
  }
}
