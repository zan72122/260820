import {
  Color,
  DoubleSide,
  FrontSide,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  type Texture,
} from 'three/webgpu';
import {
  makeCurtainMaps,
  makeGlowTexture,
  makeMetalMaps,
  makeNonwovenMaps,
  makeSatinMaps,
  makeShaftTexture,
  makeStageFloorMaps,
  makeWallMaps,
} from './textures';

/**
 * Four materials get the expensive treatment, exactly as briefed:
 *   1. the heavy red leg curtain (sheen velvet, seams, hem fuzz)
 *   2. the waxed wooden deck (clearcoat over grain and scuff)
 *   3. costume satin / non-woven
 *   4. the metal lighting fixtures
 * Everything else is a plain, cheap standard material.
 */
export class Materials {
  curtain!: MeshPhysicalMaterial;
  grandCurtain!: MeshPhysicalMaterial;
  curtainHem!: MeshStandardMaterial;
  stageFloor!: MeshPhysicalMaterial;
  metal!: MeshStandardMaterial;
  metalDark!: MeshStandardMaterial;
  wall!: MeshStandardMaterial;
  wingWall!: MeshStandardMaterial;
  houseWall!: MeshStandardMaterial;
  houseFloor!: MeshStandardMaterial;
  blackout!: MeshStandardMaterial;
  seat!: MeshStandardMaterial;
  audience!: MeshStandardMaterial;
  skin!: MeshStandardMaterial;
  skinTeacher!: MeshStandardMaterial;
  hair!: MeshStandardMaterial;
  teacherWear!: MeshStandardMaterial;
  shoe!: MeshStandardMaterial;
  tape!: MeshStandardMaterial;
  tapeAlt!: MeshStandardMaterial;
  cardboard!: MeshStandardMaterial;
  plasticBox!: MeshStandardMaterial;
  glow!: MeshBasicMaterial;
  shaft!: MeshBasicMaterial;
  lampLens!: MeshBasicMaterial;
  exitSign!: MeshBasicMaterial;
  phoneScreen!: MeshBasicMaterial;

  glowTexture!: Texture;
  shaftTexture!: Texture;

  private costumeCache = new Map<string, MeshPhysicalMaterial>();
  private texSize: number;

  constructor(fast: boolean) {
    this.texSize = fast ? 256 : 512;
    this.build();
  }

  private build(): void {
    const S = this.texSize;

    // ---- hero 1: heavy red stage velvet -------------------------------
    const cur = makeCurtainMaps(S);
    cur.map.repeat.set(1, 1);
    cur.roughnessMap.repeat.set(1, 1);
    cur.normalMap.repeat.set(1, 1);
    this.curtain = new MeshPhysicalMaterial({
      map: cur.map,
      roughnessMap: cur.roughnessMap,
      normalMap: cur.normalMap,
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      // Sheen is what makes velvet read as velvet at a grazing angle.
      sheen: 1,
      sheenRoughness: 0.62,
      sheenColor: new Color(0xd8564a),
      side: DoubleSide,
      normalScale: { x: 0.42, y: 0.42 } as never,
    });

    const grand = makeCurtainMaps(S, 0.35);
    this.grandCurtain = new MeshPhysicalMaterial({
      map: grand.map,
      roughnessMap: grand.roughnessMap,
      normalMap: grand.normalMap,
      roughness: 1,
      metalness: 0,
      sheen: 1,
      sheenRoughness: 0.55,
      sheenColor: new Color(0xffa46a),
      side: DoubleSide,
    });

    this.curtainHem = new MeshStandardMaterial({
      color: 0x8a1c26,
      roughness: 0.9,
      metalness: 0,
      side: DoubleSide,
    });

    // ---- hero 2: waxed wooden stage deck ------------------------------
    const wood = makeStageFloorMaps(S);
    for (const t of [wood.map, wood.roughnessMap, wood.normalMap]) {
      t.wrapS = t.wrapT = RepeatWrapping;
      t.repeat.set(12, 6);
    }
    this.stageFloor = new MeshPhysicalMaterial({
      map: wood.map,
      roughnessMap: wood.roughnessMap,
      normalMap: wood.normalMap,
      roughness: 1,
      metalness: 0,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
      side: FrontSide,
    });

    // ---- hero 4: stage lighting metal ---------------------------------
    const met = makeMetalMaps(256);
    met.roughnessMap.repeat.set(2, 2);
    met.normalMap.repeat.set(2, 2);
    this.metal = new MeshStandardMaterial({
      color: 0x8d9099,
      metalness: 1,
      roughness: 1,
      roughnessMap: met.roughnessMap,
      normalMap: met.normalMap,
    });
    this.metalDark = new MeshStandardMaterial({
      color: 0x2b2d31,
      metalness: 0.9,
      roughness: 1,
      roughnessMap: met.roughnessMap,
      normalMap: met.normalMap,
    });

    // ---- supporting cast ----------------------------------------------
    const wall = makeWallMaps(S, [0.66, 0.6, 0.53]);
    wall.map.repeat.set(6, 3);
    wall.roughnessMap.repeat.set(6, 3);
    wall.normalMap.repeat.set(6, 3);
    this.wall = new MeshStandardMaterial({
      map: wall.map,
      roughnessMap: wall.roughnessMap,
      normalMap: wall.normalMap,
      roughness: 1,
      metalness: 0,
    });

    this.wingWall = new MeshStandardMaterial({ color: 0x171416, roughness: 0.95, metalness: 0 });
    this.houseWall = new MeshStandardMaterial({ color: 0x37333a, roughness: 0.94, metalness: 0 });
    this.blackout = new MeshStandardMaterial({
      color: 0x0d0b0d,
      roughness: 1,
      metalness: 0,
      side: DoubleSide,
    });
    this.houseFloor = new MeshStandardMaterial({ color: 0x2a2320, roughness: 0.72, metalness: 0 });
    this.seat = new MeshStandardMaterial({ color: 0x2e2a33, roughness: 0.78, metalness: 0.05 });
    this.audience = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });

    this.skin = new MeshStandardMaterial({ color: 0xf3c9a6, roughness: 0.72, metalness: 0 });
    this.skinTeacher = new MeshStandardMaterial({ color: 0xefc09c, roughness: 0.7, metalness: 0 });
    this.hair = new MeshStandardMaterial({ color: 0x2a1c16, roughness: 0.62, metalness: 0 });
    this.teacherWear = new MeshStandardMaterial({ color: 0x3f6f8a, roughness: 0.85, metalness: 0 });
    this.shoe = new MeshStandardMaterial({ color: 0xf0ece2, roughness: 0.82, metalness: 0 });

    // 立ち位置テープ - the vinyl tape crosses on the wing floor.
    this.tape = new MeshStandardMaterial({
      color: 0xf3e14a,
      roughness: 0.42,
      metalness: 0,
      emissive: 0x2a2405,
    });
    this.tapeAlt = new MeshStandardMaterial({
      color: 0x4fd0e0,
      roughness: 0.42,
      metalness: 0,
      emissive: 0x05262a,
    });

    this.cardboard = new MeshStandardMaterial({ color: 0xa8845a, roughness: 0.94, metalness: 0 });
    this.plasticBox = new MeshStandardMaterial({ color: 0x5c7fa8, roughness: 0.45, metalness: 0 });

    this.glowTexture = makeGlowTexture(128, 2.3);
    this.shaftTexture = makeShaftTexture(64);

    this.glow = new MeshBasicMaterial({
      map: this.glowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
      toneMapped: false,
    });
    this.shaft = new MeshBasicMaterial({
      map: this.shaftTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.13,
      side: DoubleSide,
      toneMapped: false,
    });
    this.lampLens = new MeshBasicMaterial({ color: 0xfff0d2, toneMapped: false });
    this.exitSign = new MeshBasicMaterial({ color: 0x4bd07a, toneMapped: false });
    this.phoneScreen = new MeshBasicMaterial({ color: 0x9fd8ff, toneMapped: false });
  }

  /** Costume fabric, cached per colour so a class of children costs 2-3 materials. */
  costume(key: string, rgb: [number, number, number], kind: 'satin' | 'nonwoven'): MeshPhysicalMaterial {
    const id = `${kind}:${key}`;
    const hit = this.costumeCache.get(id);
    if (hit) return hit;
    const S = Math.min(256, this.texSize);
    const maps = kind === 'satin' ? makeSatinMaps(S, rgb) : makeNonwovenMaps(S, rgb);
    const mat = new MeshPhysicalMaterial({
      map: maps.map,
      roughnessMap: maps.roughnessMap,
      normalMap: maps.normalMap,
      roughness: 1,
      metalness: 0,
      sheen: kind === 'satin' ? 0.85 : 0.25,
      sheenRoughness: kind === 'satin' ? 0.28 : 0.8,
      sheenColor: new Color(0xffffff),
      side: DoubleSide,
    });
    this.costumeCache.set(id, mat);
    return mat;
  }
}
