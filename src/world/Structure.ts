import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CourseSpline } from '../course/CourseSpline';
import { concreteMaps, galvanisedMaps, gratingAlpha, rubberMaps, withRepeat } from './Textures';

export const GROUND_Y = -0.35;

function transformed(geo: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.clone();
  g.applyMatrix4(m);
  return g;
}

/**
 * Everything that holds the test section up and lets people work on it:
 * concrete, galvanised steelwork, the walkway, the pump room and the launch
 * platform. All of it is out of the child's way, and all of it gives the
 * flume its sense of weight and scale.
 */
export class TestSection {
  readonly group = new THREE.Group();
  readonly holdBack: THREE.Object3D;
  readonly benchOrigin = new THREE.Vector3(-2.6, 6.12, 2.35);
  private readonly steelMat: THREE.MeshStandardMaterial;

  constructor(private readonly spline: CourseSpline) {
    const concrete = concreteMaps();
    const steel = galvanisedMaps();

    this.steelMat = new THREE.MeshStandardMaterial({
      color: 0xb9bfc1,
      roughness: 0.48,
      metalness: 0.6,
      map: steel.map,
      roughnessMap: steel.roughnessMap,
      normalMap: steel.normalMap,
      envMapIntensity: 0.9,
    });
    this.steelMat.normalScale.set(0.4, 0.4);

    const apronMaps = withRepeat(concrete, 9, 3);
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0xa8a49a,
      roughness: 0.99,
      metalness: 0,
      map: apronMaps.map,
      roughnessMap: apronMaps.roughnessMap,
      normalMap: apronMaps.normalMap,
      envMapIntensity: 0.75,
    });
    concreteMat.normalScale.set(0.35, 0.35);

    // Apron the whole rig stands on, with a fall towards the drains.
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(140, 38, 6, 4), concreteMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(33, GROUND_Y, -4);
    apron.receiveShadow = true;
    this.group.add(apron);

    // Landscaping beyond the pad, so the rig sits in a park and not in a void.
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(760, 760, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x5f6f46, roughness: 1, metalness: 0 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(33, GROUND_Y - 0.06, 0);
    grass.receiveShadow = true;
    this.group.add(grass);

    this.buildSupports();
    this.buildSupplyPipes();
    this.buildWalkway();
    this.buildLaunchPlatform();
    this.buildPumpRoom();
    this.buildFenceAndCrew();

    this.holdBack = this.buildHoldBack();
    this.group.add(this.holdBack);
  }

  /** Bent steel frames every few metres, taller as the course climbs. */
  private buildSupports(): void {
    const legGeo = new THREE.CylinderGeometry(0.085, 0.095, 1, 8);
    legGeo.translate(0, 0.5, 0);
    const beamGeo = new THREE.BoxGeometry(0.16, 0.18, 3.1);
    const braceGeo = new THREE.BoxGeometry(0.075, 0.075, 1);
    const padGeo = new THREE.BoxGeometry(0.62, 0.12, 0.62);

    const parts: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();

    for (let x = 1.5; x < 77; x += 3.1) {
      const s = this.spline.sAtX(x);
      const frame = this.spline.frameAt(s);
      const deck = frame.position.y - 0.1;
      const height = deck - GROUND_Y;
      if (height < 0.35) continue;

      for (const side of [-1, 1]) {
        const z = side * 1.42;
        parts.push(
          transformed(
            legGeo,
            m.compose(pos.set(x, GROUND_Y, z), q.identity(), scale.set(1, height, 1)),
          ),
        );
        parts.push(
          transformed(
            padGeo,
            m.compose(pos.set(x, GROUND_Y + 0.06, z), q.identity(), scale.set(1, 1, 1)),
          ),
        );
      }
      parts.push(
        transformed(
          beamGeo,
          m.compose(pos.set(x, deck, 0), q.identity(), scale.set(1, 1, 1)),
        ),
      );

      if (height > 1.6) {
        const braceLen = Math.hypot(2.84, height * 0.8);
        const angle = Math.atan2(height * 0.8, 2.84);
        q.setFromEuler(new THREE.Euler(0, 0, 0));
        q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -angle + Math.PI / 2);
        parts.push(
          transformed(
            braceGeo,
            m.compose(
              pos.set(x, GROUND_Y + height * 0.5, 0),
              q,
              scale.set(1, 1, braceLen),
            ),
          ),
        );
      }
    }

    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, this.steelMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  /** The water supply: a main from the pump room and a riser at every station. */
  private buildSupplyPipes(): void {
    const parts: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    // Main header, hung under the flume and following it all the way up the
    // hill so it never fouls the moulding.
    const from = 13.5;
    const to = 41.5;
    const headerPts: THREE.Vector3[] = [];
    for (let x = from; x <= to; x += 1.2) {
      const p = this.spline.positionAt(this.spline.sAtX(x)).clone();
      p.y -= 0.62;
      p.z = -0.95;
      headerPts.push(p);
    }
    const headerCurve = new THREE.CatmullRomCurve3(headerPts);
    parts.push(new THREE.TubeGeometry(headerCurve, headerPts.length * 2, 0.17, 10, false));

    // Flanged joints and the riser that feeds each pair of bores.
    const flange = new THREE.CylinderGeometry(0.24, 0.24, 0.055, 12);
    const riser = new THREE.CylinderGeometry(0.07, 0.07, 1, 8);
    riser.translate(0, 0.5, 0);
    for (let x = from + 1.4; x < to; x += 2.4) {
      const p = this.spline.positionAt(this.spline.sAtX(x)).clone();
      const t = this.spline.tangentAt(this.spline.sAtX(x));
      const headerPoint = p.clone().add(new THREE.Vector3(0, -0.62, -0.95));
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), t.clone().normalize());
      parts.push(transformed(flange, m.compose(headerPoint, q, scale.set(1, 1, 1))));
      const height = p.y - 0.12 - headerPoint.y;
      if (height > 0.1) {
        parts.push(
          transformed(
            riser,
            m.compose(headerPoint.clone(), new THREE.Quaternion(), scale.set(1, height, 1)),
          ),
        );
      }
    }

    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, this.steelMat);
    mesh.castShadow = true;
    this.group.add(mesh);
  }

  /** Inspection walkway on the far side, in open grating. */
  private buildWalkway(): void {
    const rows: number[] = [];
    for (let x = 2; x <= 66; x += 1.6) rows.push(this.spline.sAtX(x));
    const cols = 2;
    const positions = new Float32Array(rows.length * cols * 3);
    const uvs = new Float32Array(rows.length * cols * 2);
    const p = new THREE.Vector3();
    for (let r = 0; r < rows.length; r++) {
      this.spline.positionAt(rows[r], p);
      for (let c = 0; c < cols; c++) {
        const z = -2.45 - c * 1.15;
        const i = (r * cols + c) * 3;
        positions[i] = p.x;
        positions[i + 1] = p.y + 0.22;
        positions[i + 2] = z;
        const uv = (r * cols + c) * 2;
        uvs[uv] = c * 0.6;
        uvs[uv + 1] = rows[r] / 1.1;
      }
    }
    const indices: number[] = [];
    for (let r = 0; r < rows.length - 1; r++) {
      const a = r * cols;
      indices.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const steel = galvanisedMaps();
    const grateMat = new THREE.MeshStandardMaterial({
      color: 0xa8afb1,
      roughness: 0.6,
      metalness: 0.55,
      map: steel.map,
      alphaMap: gratingAlpha(),
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      envMapIntensity: 0.8,
    });
    const deck = new THREE.Mesh(geo, grateMat);
    deck.receiveShadow = true;
    this.group.add(deck);

    // Handrail: posts plus two runs of tube.
    const parts: THREE.BufferGeometry[] = [];
    const postGeo = new THREE.CylinderGeometry(0.032, 0.032, 1.05, 6);
    postGeo.translate(0, 0.52, 0);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const railPoints: THREE.Vector3[] = [];
    for (let x = 2; x <= 66; x += 1.6) {
      const s = this.spline.sAtX(x);
      this.spline.positionAt(s, p);
      parts.push(
        transformed(postGeo, m.compose(new THREE.Vector3(p.x, p.y + 0.22, -3.55), q, scale)),
      );
      railPoints.push(new THREE.Vector3(p.x, p.y + 1.24, -3.55));
    }
    const railCurve = new THREE.CatmullRomCurve3(railPoints);
    parts.push(new THREE.TubeGeometry(railCurve, railPoints.length, 0.03, 6, false));
    const lower = railPoints.map((v) => v.clone().setY(v.y - 0.48));
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lower), lower.length, 0.026, 6, false));
    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    if (merged) {
      const rail = new THREE.Mesh(merged, this.steelMat);
      rail.castShadow = true;
      this.group.add(rail);
    }
  }

  /** Launch platform, stair, bench and the operator's station. */
  private buildLaunchPlatform(): void {
    const deckMaps = withRepeat(concreteMaps(), 4, 3);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0xb0ada4,
      roughness: 0.88,
      metalness: 0,
      map: deckMaps.map,
      normalMap: deckMaps.normalMap,
      envMapIntensity: 0.7,
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.34, 7.4), deckMat);
    deck.position.set(-5.6, 6.06 - 0.2, -0.4);
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.group.add(deck);

    const parts: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const legGeo = new THREE.CylinderGeometry(0.11, 0.12, 1, 8);
    legGeo.translate(0, 0.5, 0);
    for (const lx of [-10.2, -1.6]) {
      for (const lz of [-3.6, 2.6]) {
        parts.push(
          transformed(
            legGeo,
            m.compose(new THREE.Vector3(lx, GROUND_Y, lz), q, scale.set(1, 6.06 - 0.37 - GROUND_Y, 1)),
          ),
        );
      }
    }
    // Stair stringer down to the apron.
    const stepGeo = new THREE.BoxGeometry(1.5, 0.06, 0.36);
    for (let i = 0; i < 18; i++) {
      parts.push(
        transformed(
          stepGeo,
          m.compose(
            new THREE.Vector3(-10.9, 6.0 - i * 0.35, -2.6 - i * 0.3),
            q,
            scale.set(1, 1, 1),
          ),
        ),
      );
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    if (merged) {
      const steelwork = new THREE.Mesh(merged, this.steelMat);
      steelwork.castShadow = true;
      this.group.add(steelwork);
    }

    // Ballast bench: where the test weights live between runs. Painted, not
    // galvanised, so it reads as a table rather than as more water.
    const benchMat = new THREE.MeshStandardMaterial({
      color: 0x8e9498,
      roughness: 0.62,
      metalness: 0.15,
      envMapIntensity: 0.6,
    });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 1.5), benchMat);
    bench.position.copy(this.benchOrigin).add(new THREE.Vector3(0, -0.05, 0));
    bench.castShadow = true;
    bench.receiveShadow = true;
    this.group.add(bench);
    const benchLeg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.09), benchMat);
    for (const bx of [-1.3, 1.3]) {
      for (const bz of [-0.55, 0.55]) {
        const leg = benchLeg.clone();
        leg.position.copy(this.benchOrigin).add(new THREE.Vector3(bx, -0.47, bz));
        this.group.add(leg);
      }
    }
  }

  /** The hold-back arm that keeps a raft on the ramp until it is sent off. */
  private buildHoldBack(): THREE.Object3D {
    const pivot = new THREE.Object3D();
    pivot.position.set(-1.35, 6.05, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.1), this.steelMat);
    arm.position.set(0, 0.36, 0);
    arm.castShadow = true;
    pivot.add(arm);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x2c3236, roughness: 0.8, map: rubberMaps().map }),
    );
    pad.rotation.z = Math.PI / 2;
    pad.position.set(0.1, 0.36, 0);
    pivot.add(pad);
    return pivot;
  }

  /** Pump room and its suction pipework, well clear of the water. */
  private buildPumpRoom(): void {
    const wallMaps = withRepeat(concreteMaps(), 3, 1.5);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xa5a29a,
      roughness: 0.9,
      metalness: 0,
      map: wallMaps.map,
      normalMap: wallMaps.normalMap,
      envMapIntensity: 0.7,
    });
    const house = new THREE.Mesh(new THREE.BoxGeometry(9, 4.2, 6.5), wallMat);
    house.position.set(25, GROUND_Y + 2.1, -15.5);
    house.castShadow = true;
    house.receiveShadow = true;
    this.group.add(house);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 0.25, 7.1),
      new THREE.MeshStandardMaterial({ color: 0x9fa7a9, roughness: 0.55, metalness: 0.5 }),
    );
    roof.position.set(25, GROUND_Y + 4.3, -15.5);
    roof.castShadow = true;
    this.group.add(roof);

    // Suction and delivery mains between the pump room and the header.
    const parts: THREE.BufferGeometry[] = [];
    const pipe = new THREE.CylinderGeometry(0.22, 0.22, 1, 12);
    pipe.translate(0, 0.5, 0);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const runs: Array<[THREE.Vector3, THREE.Vector3]> = [
      [new THREE.Vector3(25, GROUND_Y + 0.7, -12.3), new THREE.Vector3(25, GROUND_Y + 0.7, -5.2)],
      [new THREE.Vector3(25, GROUND_Y + 0.7, -5.2), new THREE.Vector3(14.6, GROUND_Y + 0.7, -5.2)],
      [new THREE.Vector3(14.6, GROUND_Y + 0.7, -5.2), new THREE.Vector3(14.6, GROUND_Y + 0.7, -1.1)],
    ];
    for (const [from, to] of runs) {
      const dir = to.clone().sub(from);
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      parts.push(transformed(pipe, m.compose(from, q, scale.set(1, dir.length(), 1))));
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    if (merged) {
      const mesh = new THREE.Mesh(merged, this.steelMat);
      mesh.castShadow = true;
      this.group.add(mesh);
    }
  }

  /** Site fence, and the one technician on shift - outside the barrier. */
  private buildFenceAndCrew(): void {
    const parts: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const post = new THREE.CylinderGeometry(0.045, 0.045, 1.4, 6);
    post.translate(0, 0.7, 0);
    const railPts: THREE.Vector3[] = [];
    for (let x = -12; x <= 80; x += 2.6) {
      parts.push(transformed(post, m.compose(new THREE.Vector3(x, GROUND_Y, -8.6), q, scale)));
      railPts.push(new THREE.Vector3(x, GROUND_Y + 1.32, -8.6));
    }
    parts.push(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), railPts.length, 0.028, 6, false),
    );
    const lower = railPts.map((v) => v.clone().setY(v.y - 0.62));
    parts.push(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lower), lower.length, 0.024, 6, false),
    );
    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    if (merged) {
      const fence = new THREE.Mesh(merged, this.steelMat);
      fence.castShadow = true;
      this.group.add(fence);
    }

    // A single technician watching the test from behind the fence.
    const crew = new THREE.Group();
    const vest = new THREE.MeshStandardMaterial({ color: 0xd8e04a, roughness: 0.85 });
    const trousers = new THREE.MeshStandardMaterial({ color: 0x3e4652, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc79a78, roughness: 0.8 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 10), vest);
    torso.position.y = 1.18;
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.62, 4, 8), trousers);
    legs.position.y = 0.55;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skin);
    head.position.y = 1.62;
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: 0.5 }),
    );
    helmet.position.y = 1.66;
    crew.add(torso, legs, head, helmet);
    crew.position.set(21.5, GROUND_Y, -10.2);
    crew.rotation.y = -0.4;
    crew.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    this.group.add(crew);
  }

  /** Drop the hold-back arm out of the way when the raft is sent off. */
  setHoldBack(engaged: boolean, t: number): void {
    const target = engaged ? 0 : -1.25;
    this.holdBack.rotation.z += (target - this.holdBack.rotation.z) * Math.min(1, t * 6);
  }
}
