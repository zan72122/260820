import * as THREE from 'three';
import {
  makeBrushedMetal,
  makeBulbRubber,
  makeContactShadow,
  makeCuffFabric,
  makeCurtain,
  makeGaugeFace,
  makeHookLoop,
  makeKnurl,
  makeManikinSkin,
  makePaintedWall,
  makeVinylFloor,
} from '../util/textures';

/**
 * Materials are built once and shared. Each family gets its own surface
 * structure — weave, knurl, tool marks, mould grain — so the equipment reads by
 * material rather than by colour, and nothing shares one generic plastic sheen.
 */
export class Materials {
  readonly fabric: THREE.MeshStandardMaterial;
  readonly hookLoop: THREE.MeshStandardMaterial;
  readonly bladder: THREE.MeshStandardMaterial;
  readonly brass: THREE.MeshStandardMaterial;
  readonly steelBrushed: THREE.MeshStandardMaterial;
  readonly steelSatin: THREE.MeshStandardMaterial;
  readonly chrome: THREE.MeshStandardMaterial;
  readonly diaphragm: THREE.MeshStandardMaterial;
  readonly elastomerRim: THREE.MeshStandardMaterial;
  readonly tubing: THREE.MeshStandardMaterial;
  readonly siliconeTip: THREE.MeshStandardMaterial;
  readonly bulbRubber: THREE.MeshStandardMaterial;
  readonly skin: THREE.MeshStandardMaterial;
  readonly skinSeam: THREE.MeshStandardMaterial;
  readonly instructorSkin: THREE.MeshStandardMaterial;
  readonly floor: THREE.MeshStandardMaterial;
  readonly wall: THREE.MeshStandardMaterial;
  readonly curtain: THREE.MeshStandardMaterial;
  readonly laminate: THREE.MeshStandardMaterial;
  readonly steelFrame: THREE.MeshStandardMaterial;
  readonly couchVinyl: THREE.MeshStandardMaterial;
  readonly glass: THREE.MeshStandardMaterial;
  readonly acrylic: THREE.MeshStandardMaterial;
  readonly gaugeFace: THREE.MeshStandardMaterial;
  readonly gaugeNeedle: THREE.MeshStandardMaterial;
  readonly vesselWall: THREE.MeshStandardMaterial;
  readonly contactShadow: THREE.MeshBasicMaterial;
  readonly doorPaint: THREE.MeshStandardMaterial;

  constructor() {
    const cuff = makeCuffFabric();
    this.fabric = new THREE.MeshStandardMaterial({
      map: cuff.map,
      normalMap: cuff.normalMap,
      roughnessMap: cuff.roughnessMap,
      roughness: 1,
      metalness: 0,
      normalScale: new THREE.Vector2(1.15, 1.15),
      side: THREE.DoubleSide,
    });

    const hl = makeHookLoop();
    this.hookLoop = new THREE.MeshStandardMaterial({
      map: hl.map,
      normalMap: hl.normalMap,
      roughnessMap: hl.roughnessMap,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    // The inner bladder is a different material to the shell: smoother, glossier.
    this.bladder = new THREE.MeshStandardMaterial({
      color: 0x363d45,
      roughness: 0.62,
      metalness: 0,
    });

    const knurl = makeKnurl();
    this.brass = new THREE.MeshStandardMaterial({
      color: 0xb99a5f,
      metalness: 1,
      roughness: 0.42,
      normalMap: knurl.normalMap,
      roughnessMap: knurl.roughnessMap,
      normalScale: new THREE.Vector2(1.5, 1.5),
    });

    const brushed = makeBrushedMetal(0, 77, 3);
    this.steelBrushed = new THREE.MeshStandardMaterial({
      color: 0xb7bec3,
      metalness: 1,
      roughness: 0.33,
      normalMap: brushed.normalMap,
      roughnessMap: brushed.roughnessMap,
      normalScale: new THREE.Vector2(0.4, 0.4),
    });

    const brushed2 = makeBrushedMetal(1, 131, 6);
    this.steelSatin = new THREE.MeshStandardMaterial({
      color: 0x9ba3a8,
      metalness: 0.92,
      roughness: 0.52,
      normalMap: brushed2.normalMap,
      roughnessMap: brushed2.roughnessMap,
      normalScale: new THREE.Vector2(0.25, 0.25),
    });

    this.chrome = new THREE.MeshStandardMaterial({
      color: 0xc9d0d4,
      metalness: 1,
      roughness: 0.22,
    });

    // Thin polymer, not glass: a slight sheen and a hint of translucency,
    // done with opacity rather than transmission. Transmission costs a whole
    // extra scene pass per frame, which is not a fair trade on a phone.
    this.diaphragm = new THREE.MeshStandardMaterial({
      color: 0xe4e6e9,
      roughness: 0.26,
      metalness: 0.04,
      transparent: true,
      opacity: 0.94,
      envMapIntensity: 1.4,
    });

    this.elastomerRim = new THREE.MeshStandardMaterial({
      color: 0x1c2024,
      roughness: 0.82,
      metalness: 0,
    });

    this.tubing = new THREE.MeshStandardMaterial({
      color: 0x1f242a,
      roughness: 0.58,
      metalness: 0,
    });

    this.siliconeTip = new THREE.MeshStandardMaterial({
      color: 0x2b3238,
      roughness: 0.45,
      metalness: 0,
    });

    const rub = makeBulbRubber();
    this.bulbRubber = new THREE.MeshStandardMaterial({
      color: 0x2f3438,
      roughness: 0.66,
      metalness: 0,
      normalMap: rub.normalMap,
      roughnessMap: rub.roughnessMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
    });

    const sk = makeManikinSkin();
    this.skin = new THREE.MeshStandardMaterial({
      map: sk.map,
      normalMap: sk.normalMap,
      roughnessMap: sk.roughnessMap,
      roughness: 0.86,
      metalness: 0,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });
    this.skinSeam = new THREE.MeshStandardMaterial({
      color: 0x6b5348,
      roughness: 0.7,
      metalness: 0,
    });
    // The instructor is deliberately cheap: budget belongs to the equipment.
    this.instructorSkin = new THREE.MeshStandardMaterial({
      color: 0xb08a72,
      roughness: 0.78,
      metalness: 0,
    });

    const fl = makeVinylFloor();
    this.floor = new THREE.MeshStandardMaterial({
      map: fl.map,
      normalMap: fl.normalMap,
      roughnessMap: fl.roughnessMap,
      roughness: 0.55,
      metalness: 0,
    });

    const wl = makePaintedWall();
    this.wall = new THREE.MeshStandardMaterial({
      color: 0xc6cdca,
      normalMap: wl.normalMap,
      roughnessMap: wl.roughnessMap,
      roughness: 0.92,
      metalness: 0,
    });

    const cu = makeCurtain();
    this.curtain = new THREE.MeshStandardMaterial({
      color: 0xd9d3c4,
      normalMap: cu.normalMap,
      roughnessMap: cu.roughnessMap,
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    this.laminate = new THREE.MeshStandardMaterial({
      color: 0xbdb6a8,
      roughness: 0.44,
      metalness: 0,
    });

    this.steelFrame = new THREE.MeshStandardMaterial({
      color: 0x8a9296,
      roughness: 0.52,
      metalness: 0.85,
    });

    this.couchVinyl = new THREE.MeshStandardMaterial({
      color: 0x365058,
      roughness: 0.6,
      metalness: 0,
    });

    this.glass = new THREE.MeshStandardMaterial({
      color: 0xe4edf1,
      roughness: 0.05,
      metalness: 0.02,
      transparent: true,
      opacity: 0.2,
      envMapIntensity: 1.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.acrylic = new THREE.MeshStandardMaterial({
      color: 0xd5e0e4,
      roughness: 0.14,
      metalness: 0,
      transparent: true,
      opacity: 0.14,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const gf = makeGaugeFace();
    this.gaugeFace = new THREE.MeshStandardMaterial({
      map: gf.map,
      roughnessMap: gf.roughnessMap,
      roughness: 0.6,
      metalness: 0,
    });
    this.gaugeNeedle = new THREE.MeshStandardMaterial({
      color: 0x14181b,
      roughness: 0.5,
      metalness: 0.2,
    });

    this.vesselWall = new THREE.MeshStandardMaterial({
      color: 0xd49a90,
      roughness: 0.2,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
      envMapIntensity: 0.9,
      side: THREE.DoubleSide,
    });

    this.contactShadow = new THREE.MeshBasicMaterial({
      map: makeContactShadow(),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
      color: 0x000000,
    });

    this.doorPaint = new THREE.MeshStandardMaterial({
      color: 0xc3c9c4,
      roughness: 0.55,
      metalness: 0.05,
    });
  }

  /** A grounded contact shadow patch. Nothing in the scene floats. */
  makeShadowPatch(width: number, depth: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      this.contactShadow,
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = -1;
    return mesh;
  }
}
