import * as THREE from 'three';
import { Rng } from '../util/math';
import { asphaltTexture, concreteTexture, markingTexture, soilTexture, soilRough, paintTexture } from '../util/textures';

export const LOT_Z = 2.55; // kerb line: soil lot on -Z, closed road on +Z

/** The whole static set: lot, closed road, barriers, and the suburban backdrop. */
export class Environment {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  private shadowCam: THREE.OrthographicCamera;
  private mergedFar: THREE.Object3D[] = [];

  constructor(quality: number) {
    const rng = new Rng(1310);

    // ---- ground: compacted soil and gravel working lot -------------------
    const lotMap = soilTexture(512, [102, 88, 66]);
    lotMap.repeat.set(14, 10);
    const lotRough = soilRough(256);
    lotRough.repeat.set(22, 16);
    const lot = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 26, 1, 1),
      new THREE.MeshStandardMaterial({ map: lotMap, roughnessMap: lotRough, roughness: 1, metalness: 0 })
    );
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(0, 0, LOT_Z - 13);
    lot.receiveShadow = true;
    this.group.add(lot);

    // ---- closed road ------------------------------------------------------
    const asph = asphaltTexture(512);
    asph.repeat.set(10, 4);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 13, 1, 1),
      new THREE.MeshStandardMaterial({ map: asph, roughness: 0.94, metalness: 0 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.012, LOT_Z + 6.5);
    road.receiveShadow = true;
    this.group.add(road);

    const conc = concreteTexture(256);
    conc.repeat.set(30, 1);
    const kerb = new THREE.Mesh(
      new THREE.BoxGeometry(40, 0.14, 0.3),
      new THREE.MeshStandardMaterial({ map: conc, roughness: 0.92, metalness: 0 })
    );
    kerb.position.set(0, 0.07, LOT_Z + 0.15);
    kerb.castShadow = true;
    kerb.receiveShadow = true;
    this.group.add(kerb);

    // faded centre line on the closed road
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 0.16),
      new THREE.MeshBasicMaterial({
        map: markingTexture('#d9d2b4', true, 256),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    );
    (line.material as THREE.MeshBasicMaterial).map!.wrapS = THREE.RepeatWrapping;
    (line.material as THREE.MeshBasicMaterial).map!.repeat.set(26, 1);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.02, LOT_Z + 6.2);
    this.group.add(line);

    // dried mud tracked out of the lot by the truck tyres
    for (let i = 0; i < 2; i++) {
      const tr = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 0.42),
        new THREE.MeshBasicMaterial({
          map: markingTexture('#6a5335', false, 256),
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        })
      );
      tr.rotation.x = -Math.PI / 2;
      tr.rotation.z = Math.PI / 2;
      tr.position.set(2.2 + i * 2.1, 0.021, LOT_Z + 0.9);
      this.group.add(tr);
    }

    this.group.add(this.buildBarrier(quality));
    this.group.add(this.buildToolStand());
    this.group.add(this.buildBackdrop(quality, rng));
    this.group.add(this.buildGravelPiles(rng, quality));

    // ---- lighting ---------------------------------------------------------
    const hemi = new THREE.HemisphereLight(0xbdd2e8, 0x6d5f4a, 1.5);
    this.group.add(hemi);
    const fill = new THREE.AmbientLight(0xdfe6ee, 0.28);
    this.group.add(fill);

    // Exactly one shadow-casting light. Its budget is spent on the work point.
    this.sun = new THREE.DirectionalLight(0xfff2dc, 2.35);
    this.sun.position.set(-5.5, 8.5, 5.0);
    this.sun.castShadow = true;
    this.shadowCam = this.sun.shadow.camera as THREE.OrthographicCamera;
    this.shadowCam.near = 0.5;
    this.shadowCam.far = 34;
    this.setShadowExtent(9);
    this.sun.shadow.bias = -0.0016;
    this.sun.shadow.normalBias = 0.028;
    this.group.add(this.sun);
    this.group.add(this.sun.target);
    this.applyQuality(quality);
  }

  private setShadowExtent(half: number) {
    this.shadowCam.left = -half;
    this.shadowCam.right = half;
    this.shadowCam.top = half;
    this.shadowCam.bottom = -half;
    this.shadowCam.updateProjectionMatrix();
  }

  /** Keep the single shadow map centred on whatever the player is working on. */
  focusShadows(point: THREE.Vector3) {
    this.sun.target.position.copy(point);
    this.sun.target.updateMatrixWorld();
    this.sun.position.set(point.x - 5.5, 8.5, point.z + 5.0);
  }

  applyQuality(quality: number) {
    const size = quality >= 2 ? 2048 : quality >= 1 ? 1024 : 512;
    this.sun.shadow.mapSize.set(size, size);
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
    for (const o of this.mergedFar) o.visible = quality >= 1;
  }

  // ---------------------------------------------------------------------

  private buildBarrier(quality: number): THREE.Group {
    const g = new THREE.Group();
    const coneSeg = quality >= 1 ? 12 : 6;
    const coneBody = new THREE.ConeGeometry(0.19, 0.62, coneSeg, 1, true);
    coneBody.translate(0, 0.33, 0);
    const coneMat = new THREE.MeshStandardMaterial({
      map: paintTexture(0xd8531f, 128),
      roughness: 0.72,
      metalness: 0,
    });
    const baseGeo = new THREE.BoxGeometry(0.36, 0.04, 0.36);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.9 });

    const spots: Array<[number, number]> = [];
    for (let x = -6.5; x <= 6.5; x += 1.7) spots.push([x, LOT_Z + 0.75]);
    spots.push([-7.2, 0.4], [-7.2, -1.6], [7.2, 0.4], [7.2, -1.6]);

    const cones = new THREE.InstancedMesh(coneBody, coneMat, spots.length);
    const bases = new THREE.InstancedMesh(baseGeo, baseMat, spots.length);
    cones.castShadow = true;
    bases.receiveShadow = true;
    const m = new THREE.Matrix4();
    const rng = new Rng(77);
    spots.forEach((p, i) => {
      m.makeRotationY(rng.range(0, Math.PI * 2));
      m.setPosition(p[0] + rng.range(-0.1, 0.1), 0.02, p[1] + rng.range(-0.1, 0.1));
      cones.setMatrixAt(i, m);
      bases.setMatrixAt(i, m);
    });
    cones.instanceMatrix.needsUpdate = true;
    bases.instanceMatrix.needsUpdate = true;
    g.add(cones, bases);

    // two lightweight plastic barriers marking the closed lane
    for (const x of [-4.4, 3.0]) {
      const b = new THREE.Group();
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.26, 0.06),
        new THREE.MeshStandardMaterial({ map: paintTexture(0xd94f22, 128), roughness: 0.7 })
      );
      panel.position.y = 0.78;
      const panel2 = panel.clone();
      panel2.position.y = 0.44;
      const legMat = new THREE.MeshStandardMaterial({ color: 0xe4e0d6, roughness: 0.8 });
      for (const lx of [-0.85, 0.85]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 0.36), legMat);
        leg.position.set(lx, 0.46, 0);
        leg.castShadow = true;
        b.add(leg);
      }
      panel.castShadow = true;
      panel2.castShadow = true;
      b.add(panel, panel2);
      b.position.set(x, 0, LOT_Z + 1.1);
      g.add(b);
    }
    return g;
  }

  private buildToolStand(): THREE.Group {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.95 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x5b5f63, roughness: 0.6, metalness: 0.7 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.62), woodMat);
    top.position.y = 0.62;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    for (const [lx, lz] of [
      [-0.5, -0.24],
      [0.5, -0.24],
      [-0.5, 0.24],
      [0.5, 0.24],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), metalMat);
      leg.position.set(lx, 0.3, lz);
      leg.castShadow = true;
      g.add(leg);
    }
    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.13, 0.28, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x9d3f24, roughness: 0.8, side: THREE.DoubleSide })
    );
    bucket.position.set(0.68, 0.14, 0.42);
    bucket.castShadow = true;
    g.add(bucket);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.2, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x3b4650, roughness: 0.75 })
    );
    box.position.set(-0.28, 0.75, 0);
    box.castShadow = true;
    g.add(box);
    g.position.set(-5.4, 0, 1.4);
    g.rotation.y = 0.4;
    return g;
  }

  private buildGravelPiles(rng: Rng, quality: number): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      map: soilTexture(256, [118, 108, 92]),
      roughness: 1,
      metalness: 0,
    });
    const geo = new THREE.SphereGeometry(1, quality >= 1 ? 14 : 8, quality >= 1 ? 9 : 5);
    const count = 5;
    const im = new THREE.InstancedMesh(geo, mat, count);
    im.castShadow = true;
    im.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const spots: Array<[number, number, number]> = [
      [-6.4, -2.9, 0.85],
      [6.0, -3.4, 0.7],
      [-2.0, -4.4, 0.55],
      [1.4, -5.0, 0.62],
      [4.6, 1.6, 0.4],
    ];
    for (let i = 0; i < count; i++) {
      const [x, z, s] = spots[i];
      q.setFromEuler(new THREE.Euler(0, rng.range(0, 6.28), 0));
      m.compose(
        new THREE.Vector3(x, -s * 0.55, z),
        q,
        new THREE.Vector3(s * 1.5, s, s * 1.25)
      );
      im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
    return g;
  }

  private buildBackdrop(quality: number, rng: Rng): THREE.Group {
    const g = new THREE.Group();

    // Backs of low suburban buildings, merged into a couple of instanced sets.
    const wallMat = new THREE.MeshStandardMaterial({ map: concreteTexture(256), roughness: 0.95 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x585d61, roughness: 0.9 });
    const bGeo = new THREE.BoxGeometry(1, 1, 1);
    const rows: Array<[number, number, number, number, number]> = [];
    for (let i = 0; i < 9; i++) {
      rows.push([
        -17 + i * 4.2 + rng.range(-0.6, 0.6),
        -15.5 - rng.range(0, 3),
        rng.range(3.0, 4.4),
        rng.range(3.4, 5.6),
        rng.range(3.2, 4.8),
      ]);
    }
    for (let i = 0; i < 6; i++) {
      rows.push([
        -13 + i * 5.4 + rng.range(-0.8, 0.8),
        LOT_Z + 14 + rng.range(0, 3),
        rng.range(3.4, 5.2),
        rng.range(3.6, 6.2),
        rng.range(3.4, 5.0),
      ]);
    }
    const walls = new THREE.InstancedMesh(bGeo, wallMat, rows.length);
    const roofs = new THREE.InstancedMesh(bGeo, roofMat, rows.length);
    const m = new THREE.Matrix4();
    rows.forEach((r, i) => {
      const [x, z, h, w, d] = r;
      m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      walls.setMatrixAt(i, m);
      m.compose(
        new THREE.Vector3(x, h + 0.12, z),
        new THREE.Quaternion(),
        new THREE.Vector3(w * 1.06, 0.24, d * 1.06)
      );
      roofs.setMatrixAt(i, m);
    });
    walls.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    g.add(walls, roofs);
    this.mergedFar.push(roofs);

    // low mesh fence along the back of the lot
    const fencePostGeo = new THREE.BoxGeometry(0.07, 1.15, 0.07);
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x6f7377, roughness: 0.7, metalness: 0.4 });
    const posts = 27;
    const fp = new THREE.InstancedMesh(fencePostGeo, fenceMat, posts);
    for (let i = 0; i < posts; i++) {
      m.makeTranslation(-16 + i * 1.25, 0.58, -9.2);
      fp.setMatrixAt(i, m);
    }
    fp.instanceMatrix.needsUpdate = true;
    g.add(fp);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(33, 1.1),
      new THREE.MeshStandardMaterial({
        color: 0x8f9498,
        roughness: 0.8,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      })
    );
    mesh.position.set(0, 0.6, -9.2);
    g.add(mesh);

    // utility poles with a simple cross arm and slack span
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x7d7367, roughness: 0.95 });
    const poleXs = [-11, -3.5, 4.2, 12];
    for (const px of poleXs) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 8.2, 8), poleMat);
      pole.position.set(px, 4.1, LOT_Z + 9.4);
      pole.castShadow = quality >= 1;
      g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleMat);
      arm.position.set(px, 7.4, LOT_Z + 9.4);
      g.add(arm);
    }
    const wireMat = new THREE.LineBasicMaterial({ color: 0x35383c, transparent: true, opacity: 0.75 });
    for (let k = 0; k < poleXs.length - 1; k++) {
      for (const off of [-0.6, 0, 0.6]) {
        const a = new THREE.Vector3(poleXs[k], 7.35, LOT_Z + 9.4 + off * 0.1);
        const b = new THREE.Vector3(poleXs[k + 1], 7.35, LOT_Z + 9.4 + off * 0.1);
        const mid = a.clone().lerp(b, 0.5).setY(6.85);
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(curve.getPoints(10)),
          wireMat
        );
        g.add(line);
      }
    }

    // street trees / planting, instanced
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 2.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a5847, roughness: 1 });
    const leafGeo = new THREE.IcosahedronGeometry(1, quality >= 1 ? 1 : 0);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x51603a, roughness: 1, flatShading: true });
    const treeSpots: Array<[number, number, number]> = [];
    for (let i = 0; i < 11; i++) {
      treeSpots.push([-15 + i * 3.0 + rng.range(-0.8, 0.8), -8.4 - rng.range(0, 1.6), rng.range(0.85, 1.35)]);
    }
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeSpots.length);
    treeSpots.forEach((t, i) => {
      const [x, z, s] = t;
      m.compose(new THREE.Vector3(x, 1.1 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(i, m);
      m.compose(
        new THREE.Vector3(x, 2.5 * s, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(0, 1), rng.range(0, 6.3), 0)),
        new THREE.Vector3(1.4 * s, 1.15 * s, 1.35 * s)
      );
      leaves.setMatrixAt(i, m);
    });
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    leaves.castShadow = quality >= 2;
    g.add(trunks, leaves);
    this.mergedFar.push(trunks);

    return g;
  }
}

/** Simple vertical gradient sky; keeps the palette suburban rather than cinematic. */
export function buildSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(90, 20, 14);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x8fb4d8) },
      mid: { value: new THREE.Color(0xc9d9e6) },
      bottom: { value: new THREE.Color(0xd9d6ca) },
    },
    vertexShader: `varying float vH;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vH = normalize(wp.xyz).y;
      gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `varying float vH; uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
      void main(){ float h = vH;
      vec3 c = h > 0.06 ? mix(mid, top, clamp((h-0.06)/0.75,0.0,1.0))
                        : mix(bottom, mid, clamp((h+0.25)/0.31,0.0,1.0));
      gl_FragColor = vec4(c,1.0);
      #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}
