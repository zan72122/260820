/**
 * The two places the game happens in: the bright craft room and the kindergarten yard.
 *
 * The yard's crowd, lanterns and planting are instanced; the hayashi players and their
 * instruments are modelled properly, because the drum skin, the brass kane, the wooden body
 * and the cotton happi must not share one material.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  HemisphereLight,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import {
  clothTextures,
  drumHeadTextures,
  groundTextures,
  metalTextures,
  plankTextures,
  radialSprite,
  rubberTextures,
  woodTextures,
} from '../util/textures';
import { mergeGeometries } from '../util/merge';
import { makeRng } from '../util/math';
import type { QualitySettings } from '../core/Quality';

export interface HayashiRig {
  group: Group;
  drummer: Group;
  bachiL: Group;
  bachiR: Group;
  kaneArm: Group;
  fluteArm: Group;
  drumHead: Mesh;
}

export class Scenery {
  readonly workshop = new Group();
  readonly yard = new Group();
  readonly hayashi: HayashiRig;
  /** Warm pool the nebuta throws on the ground; the parade moves it around. */
  readonly lightPool: Mesh;
  /** The lantern string's own glow, so the yard is never a black void before the light-up. */
  private readonly lanternGlow: PointLight;
  private readonly yardFill: HemisphereLight;
  private readonly lanterns: InstancedMesh;
  private readonly crowd: InstancedMesh;
  private readonly crowdBase: Float32Array;
  private readonly plants: InstancedMesh;
  private readonly disposables: { dispose(): void }[] = [];

  constructor(private readonly quality: QualitySettings) {
    this.workshop.name = 'workshop';
    this.yard.name = 'yard';
    const rng = makeRng(20260820);

    /* ------------------------------------------------ shared materials */
    const ground = groundTextures(quality.tier === 'low' ? 256 : 512);
    ground.map.repeat.set(14, 14);
    ground.normalMap.repeat.set(14, 14);
    ground.roughnessMap.repeat.set(14, 14);
    const groundMat = new MeshStandardMaterial({
      map: ground.map,
      normalMap: ground.normalMap,
      roughnessMap: ground.roughnessMap,
      normalScale: new Vector2(1.1, 1.1),
      roughness: 1,
      metalness: 0,
    });
    const floorWood = plankTextures(quality.tier === 'low' ? 256 : 512);
    floorWood.map.repeat.set(5, 5);
    floorWood.normalMap.repeat.set(5, 5);
    floorWood.roughnessMap.repeat.set(5, 5);
    const paintedWall = new MeshStandardMaterial({ color: new Color('#e6dcc6'), roughness: 0.94 });
    const wainscot = new MeshStandardMaterial({ color: new Color('#c2a980'), roughness: 0.7 });
    const metal = metalTextures(256);
    const metalMat = new MeshStandardMaterial({
      map: metal.map,
      normalMap: metal.normalMap,
      roughnessMap: metal.roughnessMap,
      color: new Color('#c3c6cb'),
      metalness: 0.86,
      roughness: 0.36,
    });

    /* ------------------------------------------------ craft room */
    const floor = new Mesh(
      new PlaneGeometry(11, 11),
      new MeshStandardMaterial({
        map: floorWood.map,
        normalMap: floorWood.normalMap,
        roughnessMap: floorWood.roughnessMap,
        roughness: 1,
        metalness: 0,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.workshop.add(floor);

    const wallGeo = new PlaneGeometry(11, 3.1);
    for (const [x, z, ry] of [
      [0, -5.5, 0],
      [-5.5, 0, Math.PI / 2],
      [5.5, 0, -Math.PI / 2],
      [0, 5.5, Math.PI],
    ] as [number, number, number][]) {
      const w = new Mesh(wallGeo, paintedWall);
      w.position.set(x, 1.55, z);
      w.rotation.y = ry;
      w.receiveShadow = true;
      this.workshop.add(w);
    }
    // a low wainscot band so the walls read as a room, not as sky
    for (const [x, z, ry] of [
      [0, -5.48, 0],
      [-5.48, 0, Math.PI / 2],
      [5.48, 0, -Math.PI / 2],
      [0, 5.48, Math.PI],
    ] as [number, number, number][]) {
      const band = new Mesh(new PlaneGeometry(11, 0.7), wainscot);
      band.position.set(x, 0.35, z);
      band.rotation.y = ry;
      band.receiveShadow = true;
      this.workshop.add(band);
    }
    const ceiling = new Mesh(
      new PlaneGeometry(11, 11),
      new MeshStandardMaterial({ color: new Color('#f5f1e6'), roughness: 0.96 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 3.1;
    this.workshop.add(ceiling);
    // window band letting the afternoon in
    const glass = new MeshPhysicalMaterial({
      color: new Color('#e8f4ff'),
      roughness: 0.06,
      metalness: 0,
      transmission: 0.9,
      thickness: 0.02,
      ior: 1.45,
      transparent: true,
      opacity: 0.4,
    });
    for (let i = 0; i < 3; i++) {
      const pane = new Mesh(new PlaneGeometry(1.5, 1.5), glass);
      pane.position.set(-2.4 + i * 2.4, 1.75, -5.45);
      this.workshop.add(pane);
      const frame = new Mesh(new BoxGeometry(1.64, 1.64, 0.05), paintedWall);
      frame.position.set(-2.4 + i * 2.4, 1.75, -5.49);
      this.workshop.add(frame);
    }

    this.workshop.add(this.buildWorkbench(rng));
    this.workshop.add(this.buildRoomProps(rng));

    /* ------------------------------------------------ yard */
    const yardFloor = new Mesh(new PlaneGeometry(46, 46), groundMat);
    yardFloor.rotation.x = -Math.PI / 2;
    yardFloor.receiveShadow = true;
    this.yard.add(yardFloor);

    const building = new Group();
    const wallMat = new MeshStandardMaterial({ color: new Color('#e7ddc9'), roughness: 0.9 });
    const roofMat = new MeshStandardMaterial({ color: new Color('#6d5a4a'), roughness: 0.78 });
    const winMat = new MeshStandardMaterial({
      color: new Color('#2c3a4d'),
      roughness: 0.2,
      metalness: 0.1,
      emissive: new Color('#ffd79a'),
      emissiveIntensity: 0,
    });
    this.windowMat = winMat;
    const main = new Mesh(new BoxGeometry(15, 3.4, 6), wallMat);
    main.position.set(-2, 1.7, -12.5);
    main.castShadow = true;
    main.receiveShadow = true;
    building.add(main);
    const roof = new Mesh(new BoxGeometry(15.8, 0.32, 6.8), roofMat);
    roof.position.set(-2, 3.55, -12.5);
    building.add(roof);
    for (let i = 0; i < 7; i++) {
      const w = new Mesh(new BoxGeometry(1.3, 1.1, 0.12), winMat);
      w.position.set(-8.2 + i * 2.05, 1.9, -9.45);
      building.add(w);
    }
    this.yard.add(building);

    // fence
    const postGeo = new CylinderGeometry(0.05, 0.055, 1.1, 6);
    const railGeo = new BoxGeometry(1.9, 0.07, 0.05);
    const fenceWood = woodTextures(256, { hueA: '#b8a887', hueB: '#8d7c5e', ringFreq: 10, wear: 0.55, seed: 5 });
    const fenceMat = new MeshStandardMaterial({
      map: fenceWood.map,
      normalMap: fenceWood.normalMap,
      roughnessMap: fenceWood.roughnessMap,
      roughness: 1,
    });
    const fence = new Group();
    for (let i = 0; i < 16; i++) {
      const x = -15 + i * 2;
      const p = new Mesh(postGeo, fenceMat);
      p.position.set(x, 0.55, 11.5);
      p.castShadow = true;
      fence.add(p);
      if (i < 15) {
        for (const y of [0.5, 0.9]) {
          const r = new Mesh(railGeo, fenceMat);
          r.position.set(x + 1, y, 11.5);
          fence.add(r);
        }
      }
    }
    this.yard.add(fence);

    /* ------------------------------------------------ lanterns */
    const lanternGeo = this.buildLantern();
    this.lanternMat = new MeshStandardMaterial({
      color: new Color('#f4e3c0'),
      emissive: new Color('#ff9a3c'),
      emissiveIntensity: 0,
      roughness: 0.85,
      side: DoubleSide,
    });
    this.lanterns = new InstancedMesh(lanternGeo, this.lanternMat, quality.lanternCount);
    this.lanterns.castShadow = false;
    const m4 = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    for (let i = 0; i < quality.lanternCount; i++) {
      const t = i / Math.max(1, quality.lanternCount - 1);
      const x = -11 + t * 22;
      const y = 2.5 - Math.sin(t * Math.PI) * 0.5 + rng() * 0.05;
      const z = -7.5 + Math.sin(t * 5.3) * 0.5;
      s.setScalar(0.85 + rng() * 0.3);
      q.setFromAxisAngle(new Vector3(0, 0, 1), (rng() - 0.5) * 0.2);
      m4.compose(new Vector3(x, y, z), q, s);
      this.lanterns.setMatrixAt(i, m4);
    }
    this.lanterns.instanceMatrix.needsUpdate = true;
    this.yard.add(this.lanterns);

    this.lanternGlow = new PointLight(new Color('#ffb257'), 0, 26, 1.5);
    this.lanternGlow.position.set(0, 2.6, -6.5);
    this.yard.add(this.lanternGlow);
    this.yardFill = new HemisphereLight(new Color('#6d7fbb'), new Color('#5a463a'), 0);
    this.yard.add(this.yardFill);

    /* ------------------------------------------------ planting */
    const plantGeo = mergeGeometries([
      { geometry: new ConeGeometry(0.34, 0.7, 6), matrix: new Matrix4().makeTranslation(0, 0.35, 0) },
      {
        geometry: new SphereGeometry(0.26, 6, 5),
        matrix: new Matrix4().makeTranslation(0.16, 0.62, 0.1),
      },
    ]);
    const plantMat = new MeshStandardMaterial({ color: new Color('#4f6b3a'), roughness: 0.95 });
    this.plants = new InstancedMesh(plantGeo, plantMat, quality.plantCount);
    this.plants.castShadow = quality.tier !== 'low';
    for (let i = 0; i < quality.plantCount; i++) {
      const a = rng() * Math.PI * 2;
      const r = 10 + rng() * 8;
      s.setScalar(0.7 + rng() * 0.9);
      q.setFromAxisAngle(new Vector3(0, 1, 0), rng() * 6.28);
      m4.compose(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r - 2), q, s);
      this.plants.setMatrixAt(i, m4);
    }
    this.plants.instanceMatrix.needsUpdate = true;
    this.yard.add(this.plants);

    /* ------------------------------------------------ crowd */
    const figure = this.buildFigureGeometry();
    const crowdMat = new MeshStandardMaterial({ roughness: 0.88, metalness: 0 });
    this.crowd = new InstancedMesh(figure, crowdMat, Math.max(1, quality.crowdCount));
    this.crowd.castShadow = quality.tier !== 'low';
    this.crowdBase = new Float32Array(Math.max(1, quality.crowdCount) * 4);
    const palette = ['#d94f4f', '#3f76b8', '#e2a53c', '#5aa06a', '#c76ba6', '#e8e2d4'];
    for (let i = 0; i < quality.crowdCount; i++) {
      const a = -0.6 + rng() * 3.2;
      const r = 7 + rng() * 5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r + 1;
      const scale = 0.72 + rng() * 0.5;
      this.crowdBase[i * 4] = x;
      this.crowdBase[i * 4 + 1] = z;
      this.crowdBase[i * 4 + 2] = scale;
      this.crowdBase[i * 4 + 3] = rng() * 6.28;
      q.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-x, -z));
      m4.compose(new Vector3(x, 0, z), q, s.setScalar(scale));
      this.crowd.setMatrixAt(i, m4);
      this.crowd.setColorAt(i, new Color(palette[Math.floor(rng() * palette.length)]));
    }
    this.crowd.instanceMatrix.needsUpdate = true;
    if (this.crowd.instanceColor) this.crowd.instanceColor.needsUpdate = true;
    this.yard.add(this.crowd);

    /* ------------------------------------------------ hayashi */
    this.hayashi = this.buildHayashi(metalMat);
    this.yard.add(this.hayashi.group);

    /* ------------------------------------------------ light pool */
    this.lightPool = new Mesh(
      new CircleGeometry(3.1, 40),
      new MeshBasicMaterial({
        map: radialSprite(128, 2.9),
        color: new Color('#ff9c46'),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this.lightPool.rotation.x = -Math.PI / 2;
    this.lightPool.position.y = 0.012;
    this.lightPool.renderOrder = 1;
    this.yard.add(this.lightPool);

    this.disposables.push(
      groundMat,
      paintedWall,
      wainscot,
      metalMat,
      glass,
      wallMat,
      roofMat,
      winMat,
      fenceMat,
      plantMat,
      crowdMat,
    );
    this.yard.visible = false;
  }

  private windowMat!: MeshStandardMaterial;
  private lanternMat!: MeshStandardMaterial;

  /* ------------------------------------------------------------------ props */

  private buildWorkbench(rng: () => number): Group {
    const g = new Group();
    const benchWood = woodTextures(512, { hueA: '#cbb083', hueB: '#9c8055', ringFreq: 14, wear: 0.45, seed: 61 });
    const benchMat = new MeshStandardMaterial({
      map: benchWood.map,
      normalMap: benchWood.normalMap,
      roughnessMap: benchWood.roughnessMap,
      roughness: 1,
    });
    const top = new Mesh(new BoxGeometry(2.3, 0.06, 0.9), benchMat);
    top.position.set(-2.85, 0.52, 1.85);
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    for (const [dx, dz] of [
      [-1.02, 0.36],
      [1.02, 0.36],
      [-1.02, -0.36],
      [1.02, -0.36],
    ] as [number, number][]) {
      const leg = new Mesh(new BoxGeometry(0.07, 0.5, 0.07), benchMat);
      leg.position.set(-2.85 + dx, 0.25, 1.85 + dz);
      leg.castShadow = true;
      g.add(leg);
    }

    // stack of white sheets
    const paperMat = new MeshStandardMaterial({ color: new Color('#f7f1e4'), roughness: 0.95 });
    for (let i = 0; i < 7; i++) {
      const sheet = new Mesh(new BoxGeometry(0.62, 0.004, 0.44), paperMat);
      sheet.position.set(-3.37 + (rng() - 0.5) * 0.01, 0.556 + i * 0.005, 1.81 + (rng() - 0.5) * 0.012);
      sheet.rotation.y = (rng() - 0.5) * 0.06;
      sheet.castShadow = true;
      g.add(sheet);
    }

    // paste pot with its brush
    const potMat = new MeshStandardMaterial({ color: new Color('#8d9aa6'), roughness: 0.5, metalness: 0.05 });
    const pot = new Mesh(new CylinderGeometry(0.11, 0.09, 0.1, 16), potMat);
    pot.position.set(-2.35, 0.6, 1.97);
    pot.castShadow = true;
    g.add(pot);
    const paste = new Mesh(
      new CircleGeometry(0.1, 16),
      new MeshPhysicalMaterial({
        color: new Color('#f2ecdc'),
        roughness: 0.12,
        clearcoat: 0.9,
        clearcoatRoughness: 0.1,
      }),
    );
    paste.rotation.x = -Math.PI / 2;
    paste.position.set(-2.35, 0.645, 1.97);
    g.add(paste);
    g.add(this.buildBrush(-2.27, 0.68, 1.97, 0.5, '#d8c49a', 0.09));

    // ink dish
    const inkDish = new Mesh(new CylinderGeometry(0.1, 0.085, 0.045, 16), potMat);
    inkDish.position.set(-1.99, 0.565, 1.75);
    g.add(inkDish);
    const inkPool = new Mesh(
      new CircleGeometry(0.088, 16),
      new MeshPhysicalMaterial({ color: new Color('#0d0b0c'), roughness: 0.1, clearcoat: 1 }),
    );
    inkPool.rotation.x = -Math.PI / 2;
    inkPool.position.set(-1.99, 0.588, 1.75);
    g.add(inkPool);
    g.add(this.buildBrush(-1.87, 0.6, 1.69, -0.4, '#2a2320', 0.08));

    // dye bowls
    const dyeCols = ['#d0203a', '#e8701d', '#ef8ba6', '#efc02c', '#2f6fb5', '#264a7a'];
    dyeCols.forEach((c, i) => {
      const bowl = new Mesh(new CylinderGeometry(0.07, 0.055, 0.045, 14), potMat);
      bowl.position.set(-3.65 + i * 0.19, 0.565, 2.17);
      g.add(bowl);
      const liquid = new Mesh(
        new CircleGeometry(0.06, 14),
        new MeshPhysicalMaterial({ color: new Color(c), roughness: 0.08, clearcoat: 1, metalness: 0 }),
      );
      liquid.rotation.x = -Math.PI / 2;
      liquid.position.set(-3.65 + i * 0.19, 0.588, 2.17);
      g.add(liquid);
    });

    // teacher's wax pen and a rag, kept at the far end of the bench
    const waxPen = new Mesh(
      new CylinderGeometry(0.016, 0.02, 0.19, 8),
      new MeshStandardMaterial({ color: new Color('#b9832f'), roughness: 0.45, metalness: 0.3 }),
    );
    waxPen.rotation.z = Math.PI * 0.42;
    waxPen.position.set(-1.73, 0.575, 2.07);
    g.add(waxPen);
    const rag = new Mesh(
      new BoxGeometry(0.24, 0.02, 0.18),
      new MeshStandardMaterial({ color: new Color('#cfd6cd'), roughness: 1 }),
    );
    rag.position.set(-1.65, 0.56, 1.65);
    rag.rotation.y = 0.4;
    g.add(rag);
    return g;
  }

  /** Low shelf, stools and a strip of children's paintings on the wall. */
  private buildRoomProps(rng: () => number): Group {
    const g = new Group();
    const w = woodTextures(256, { hueA: '#d3b689', hueB: '#a5875c', ringFreq: 16, wear: 0.4, seed: 12 });
    const mat = new MeshStandardMaterial({
      map: w.map,
      normalMap: w.normalMap,
      roughnessMap: w.roughnessMap,
      roughness: 1,
    });
    const shelf = new Group();
    for (let i = 0; i < 3; i++) {
      const board = new Mesh(new BoxGeometry(2.6, 0.05, 0.34), mat);
      board.position.set(0, 0.28 + i * 0.36, 0);
      board.castShadow = true;
      board.receiveShadow = true;
      shelf.add(board);
    }
    for (const dx of [-1.25, 0, 1.25]) {
      const side = new Mesh(new BoxGeometry(0.05, 1.05, 0.34), mat);
      side.position.set(dx, 0.52, 0);
      shelf.add(side);
    }
    const binCols = ['#e2703a', '#4f86c6', '#e8b93c', '#63a06d'];
    for (let i = 0; i < 8; i++) {
      const bin = new Mesh(
        new BoxGeometry(0.3, 0.2, 0.26),
        new MeshStandardMaterial({ color: new Color(binCols[i % 4]), roughness: 0.55 }),
      );
      bin.position.set(-1.05 + (i % 4) * 0.7, 0.41 + Math.floor(i / 4) * 0.36, 0);
      bin.castShadow = true;
      shelf.add(bin);
    }
    shelf.position.set(1.4, 0, -5.1);
    g.add(shelf);

    const stoolMat = new MeshStandardMaterial({ color: new Color('#d8c38f'), roughness: 0.7 });
    for (let i = 0; i < 4; i++) {
      const stool = new Group();
      const seat = new Mesh(new CylinderGeometry(0.15, 0.15, 0.04, 12), stoolMat);
      seat.position.y = 0.26;
      seat.castShadow = true;
      stool.add(seat);
      for (let l = 0; l < 3; l++) {
        const a = (l / 3) * Math.PI * 2;
        const leg = new Mesh(new CylinderGeometry(0.016, 0.014, 0.26, 6), stoolMat);
        leg.position.set(Math.cos(a) * 0.1, 0.13, Math.sin(a) * 0.1);
        leg.rotation.z = -Math.cos(a) * 0.1;
        leg.rotation.x = Math.sin(a) * 0.1;
        stool.add(leg);
      }
      stool.position.set(-3.4 + i * 0.6, 0, 3.1 + rng() * 0.4);
      stool.rotation.y = rng() * 3;
      g.add(stool);
    }

    // paintings taped up along the wall
    const artCols = ['#f0d24a', '#e8724a', '#6aa4d8', '#78bb7a', '#e79ac0'];
    for (let i = 0; i < 5; i++) {
      const art = new Mesh(
        new PlaneGeometry(0.5, 0.38),
        new MeshStandardMaterial({ color: new Color(artCols[i]), roughness: 0.95 }),
      );
      art.position.set(-3.6 + i * 0.75, 1.55, -5.44);
      art.rotation.z = (rng() - 0.5) * 0.1;
      g.add(art);
    }
    return g;
  }

  private buildBrush(x: number, y: number, z: number, tilt: number, hairColor: string, len: number): Group {
    const g = new Group();
    const handle = new Mesh(
      new CylinderGeometry(0.008, 0.011, 0.24, 8),
      new MeshStandardMaterial({ color: new Color('#c9b48a'), roughness: 0.7 }),
    );
    g.add(handle);
    const ferrule = new Mesh(
      new CylinderGeometry(0.013, 0.013, 0.03, 8),
      new MeshStandardMaterial({ color: new Color('#b8b0a0'), metalness: 0.6, roughness: 0.4 }),
    );
    ferrule.position.y = -0.13;
    g.add(ferrule);
    const hair = new Mesh(
      new ConeGeometry(0.014, len, 10),
      new MeshStandardMaterial({ color: new Color(hairColor), roughness: 0.82 }),
    );
    hair.position.y = -0.145 - len / 2;
    hair.rotation.x = Math.PI;
    g.add(hair);
    g.position.set(x, y, z);
    g.rotation.z = tilt;
    g.rotation.x = 0.6;
    return g;
  }

  private buildLantern(): import('three').BufferGeometry {
    const profile: Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const r = 0.16 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) + 0.04;
      profile.push(new Vector2(r, t * 0.46 - 0.23));
    }
    return new LatheGeometry(profile, 10);
  }

  private buildFigureGeometry(): import('three').BufferGeometry {
    return mergeGeometries([
      {
        geometry: new ConeGeometry(0.19, 0.6, 8),
        matrix: new Matrix4().makeTranslation(0, 0.3, 0),
      },
      {
        geometry: new SphereGeometry(0.115, 10, 8),
        matrix: new Matrix4().makeTranslation(0, 0.72, 0),
      },
      {
        geometry: new CylinderGeometry(0.032, 0.028, 0.3, 6),
        matrix: new Matrix4().makeTranslation(0.16, 0.42, 0.02),
      },
      {
        geometry: new CylinderGeometry(0.032, 0.028, 0.3, 6),
        matrix: new Matrix4().makeTranslation(-0.16, 0.42, 0.02),
      },
    ]);
  }

  private buildHayashi(metalMat: MeshStandardMaterial): HayashiRig {
    const group = new Group();
    group.position.set(-4.6, 0, 4.2);
    group.rotation.y = 0.7;

    const happi = clothTextures(256, '#25406b', 88);
    const happiMat = new MeshStandardMaterial({
      map: happi.map,
      normalMap: happi.normalMap,
      roughnessMap: happi.roughnessMap,
      roughness: 1,
      metalness: 0,
      sheen: 0.4,
      // cotton keeps a soft edge light
    } as ConstructorParameters<typeof MeshStandardMaterial>[0]);
    const skinMat = new MeshStandardMaterial({ color: new Color('#e5b494'), roughness: 0.72 });
    const hairMat = new MeshStandardMaterial({ color: new Color('#1d1714'), roughness: 0.55 });
    const drumWood = woodTextures(512, { hueA: '#7c4526', hueB: '#4d2a17', ringFreq: 8, wear: 0.3, seed: 43 });
    const drumBodyMat = new MeshStandardMaterial({
      map: drumWood.map,
      normalMap: drumWood.normalMap,
      roughnessMap: drumWood.roughnessMap,
      roughness: 1,
      metalness: 0,
    });
    const head = drumHeadTextures(256);
    const drumHeadMat = new MeshStandardMaterial({
      map: head.map,
      normalMap: head.normalMap,
      roughnessMap: head.roughnessMap,
      roughness: 1,
      metalness: 0,
    });
    const brassMat = new MeshStandardMaterial({
      color: new Color('#c9a544'),
      metalness: 0.95,
      roughness: 0.24,
    });
    const leatherMat = new MeshStandardMaterial({ color: new Color('#6a4a30'), roughness: 0.72 });
    const bambooFluteMat = new MeshStandardMaterial({ color: new Color('#c9bd83'), roughness: 0.42 });
    const rubber = rubberTextures(128);
    const matRubber = new MeshStandardMaterial({ map: rubber.map, roughness: 1, color: new Color('#3a3a38') });

    const makePerson = (x: number, z: number, ry: number, colour: string): Group => {
      const p = new Group();
      const body = new Mesh(new ConeGeometry(0.21, 0.72, 10), happiMat.clone());
      (body.material as MeshStandardMaterial).color = new Color(colour);
      body.position.y = 0.36;
      body.castShadow = true;
      p.add(body);
      const headM = new Mesh(new SphereGeometry(0.125, 12, 10), skinMat);
      headM.position.y = 0.85;
      headM.castShadow = true;
      p.add(headM);
      const hair = new Mesh(new SphereGeometry(0.132, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
      hair.position.y = 0.86;
      p.add(hair);
      const band = new Mesh(new TorusGeometry(0.128, 0.016, 6, 14), leatherMat);
      band.position.y = 0.885;
      band.rotation.x = Math.PI / 2;
      p.add(band);
      p.position.set(x, 0, z);
      p.rotation.y = ry;
      return p;
    };

    // taiko on its stand
    const drum = new Group();
    const shell = new Mesh(new CylinderGeometry(0.31, 0.31, 0.44, 20), drumBodyMat);
    shell.rotation.z = Math.PI / 2;
    shell.castShadow = true;
    drum.add(shell);
    const drumHead = new Mesh(new CircleGeometry(0.305, 22), drumHeadMat);
    drumHead.rotation.y = Math.PI / 2;
    drumHead.position.x = 0.222;
    drum.add(drumHead);
    const backHead = new Mesh(new CircleGeometry(0.305, 22), drumHeadMat);
    backHead.rotation.y = -Math.PI / 2;
    backHead.position.x = -0.222;
    drum.add(backHead);
    for (const sx of [0.2, -0.2]) {
      const ring = new Mesh(new TorusGeometry(0.3, 0.016, 6, 22), metalMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = sx;
      drum.add(ring);
    }
    drum.position.set(0.9, 0.72, 0);
    drum.rotation.z = 0.12;
    group.add(drum);
    const standMat = new MeshStandardMaterial({ color: new Color('#6b4a2e'), roughness: 0.85 });
    for (const dz of [0.34, -0.34]) {
      const leg = new Mesh(new BoxGeometry(0.06, 0.72, 0.06), standMat);
      leg.position.set(0.9, 0.36, dz);
      leg.rotation.x = dz > 0 ? 0.18 : -0.18;
      leg.castShadow = true;
      group.add(leg);
      const foot = new Mesh(new BoxGeometry(0.1, 0.03, 0.16), matRubber);
      foot.position.set(0.9, 0.02, dz * 1.2);
      group.add(foot);
    }

    const drummer = makePerson(0.9, 0.66, Math.PI, '#25406b');
    group.add(drummer);
    const bachiGeo = new CylinderGeometry(0.014, 0.017, 0.36, 8);
    const bachiMat = new MeshStandardMaterial({ color: new Color('#e0cfa8'), roughness: 0.62 });
    const bachiL = new Group();
    const bachiR = new Group();
    for (const [arm, side] of [
      [bachiL, 1],
      [bachiR, -1],
    ] as [Group, number][]) {
      const stick = new Mesh(bachiGeo, bachiMat);
      stick.position.set(0, -0.18, 0);
      arm.add(stick);
      const hand = new Mesh(new SphereGeometry(0.045, 8, 6), skinMat);
      arm.add(hand);
      arm.position.set(0.9 + side * 0.16, 0.95, 0.42);
      arm.rotation.x = -0.9;
      group.add(arm);
    }

    // kane player
    const kanePlayer = makePerson(-0.1, 0.5, Math.PI * 0.9, '#7a2733');
    group.add(kanePlayer);
    const kaneArm = new Group();
    const kane = new Mesh(new CylinderGeometry(0.11, 0.11, 0.05, 18, 1, true), brassMat);
    kane.rotation.z = Math.PI / 2;
    kane.rotation.y = 0.3;
    kaneArm.add(kane);
    const kaneFace = new Mesh(new CircleGeometry(0.108, 18), brassMat);
    kaneFace.rotation.y = Math.PI / 2 + 0.3;
    kaneFace.position.set(-0.024, 0, 0.007);
    kaneArm.add(kaneFace);
    const mallet = new Mesh(new CylinderGeometry(0.008, 0.008, 0.2, 6), bachiMat);
    mallet.position.set(0.1, -0.06, 0.14);
    mallet.rotation.z = 0.6;
    kaneArm.add(mallet);
    kaneArm.position.set(-0.1, 0.8, 0.26);
    group.add(kaneArm);

    // fue player
    const fuePlayer = makePerson(-1.1, 0.36, Math.PI * 1.05, '#2c5c46');
    group.add(fuePlayer);
    const fluteArm = new Group();
    const flute = new Mesh(new CylinderGeometry(0.014, 0.015, 0.46, 10), bambooFluteMat);
    flute.rotation.z = Math.PI / 2;
    flute.rotation.y = 0.18;
    fluteArm.add(flute);
    for (let i = 0; i < 6; i++) {
      const holeRing = new Mesh(new TorusGeometry(0.0145, 0.002, 4, 8), leatherMat);
      holeRing.rotation.y = Math.PI / 2;
      holeRing.position.x = -0.12 + i * 0.05;
      fluteArm.add(holeRing);
    }
    fluteArm.position.set(-1.1, 0.86, 0.2);
    group.add(fluteArm);

    this.disposables.push(
      happiMat,
      skinMat,
      hairMat,
      drumBodyMat,
      drumHeadMat,
      brassMat,
      leatherMat,
      bambooFluteMat,
      standMat,
      bachiMat,
      matRubber,
    );

    return { group, drummer, bachiL, bachiR, kaneArm, fluteArm, drumHead };
  }

  /* ------------------------------------------------------------------ runtime */

  setPlace(place: 'workshop' | 'yard'): void {
    this.workshop.visible = place === 'workshop';
    this.yard.visible = place === 'yard';
  }

  /** Evening: school windows and paper lanterns come up as the sun goes down. */
  setEvening(t: number): void {
    this.windowMat.emissiveIntensity = t * 1.8;
    this.lanternMat.emissiveIntensity = t * 2.6;
    this.lanternGlow.intensity = t * 6.5;
    this.yardFill.intensity = t * 0.85;
  }

  update(dt: number, time: number, cart: Vector3, lampLevel: number, energy: number): void {
    const pool = this.lightPool.material as MeshBasicMaterial;
    pool.opacity = lampLevel * 0.26;
    this.lightPool.position.x = cart.x;
    this.lightPool.position.z = cart.z;
    this.lightPool.scale.setScalar(1 + Math.sin(time * 2.1) * 0.02 + energy * 0.08);

    // crowd sways, faster when the parade is moving
    if (this.quality.crowdCount > 0) {
      const m4 = new Matrix4();
      const q = new Quaternion();
      const v = new Vector3();
      const s = new Vector3();
      const axis = new Vector3(0, 1, 0);
      for (let i = 0; i < this.quality.crowdCount; i++) {
        const x = this.crowdBase[i * 4];
        const z = this.crowdBase[i * 4 + 1];
        const scale = this.crowdBase[i * 4 + 2];
        const ph = this.crowdBase[i * 4 + 3];
        const sway = Math.sin(time * (1.6 + energy * 1.8) + ph) * (0.03 + energy * 0.05);
        const hop = Math.max(0, Math.sin(time * (2.2 + energy * 2.4) + ph)) * energy * 0.06;
        q.setFromAxisAngle(axis, Math.atan2(cart.x - x, cart.z - z) + sway);
        m4.compose(v.set(x, hop, z), q, s.setScalar(scale));
        this.crowd.setMatrixAt(i, m4);
      }
      this.crowd.instanceMatrix.needsUpdate = true;
    }
    void dt;
  }

  /** Drives the players from the music clock: 0..1 within the current bar. */
  playHayashi(beat: number, hit: number, energy: number): void {
    const h = this.hayashi;
    const swing = Math.sin(beat * Math.PI * 2);
    h.bachiL.rotation.x = -0.9 - Math.max(0, Math.sin(beat * Math.PI * 2)) * 0.85 * energy;
    h.bachiR.rotation.x = -0.9 - Math.max(0, Math.sin(beat * Math.PI * 2 + Math.PI)) * 0.85 * energy;
    h.drummer.rotation.z = swing * 0.05 * energy;
    h.kaneArm.rotation.z = Math.sin(beat * Math.PI * 4) * 0.22 * energy;
    h.fluteArm.rotation.z = Math.sin(beat * Math.PI * 1.5) * 0.09 * energy;
    const scale = 1 + hit * 0.035;
    h.drumHead.scale.set(scale, scale, 1);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
