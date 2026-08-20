import * as THREE from 'three';
import { Rng } from '../util/math';
import {
  asphaltTexture,
  barrierTexture,
  concreteTexture,
  coneTexture,
  markingTexture,
  soilRough,
  soilTexture,
} from '../util/textures';

import { GroundHole, LOT_Z, SOIL_REPEAT_PER_M } from '../util/ground';

export { LOT_Z, SOIL_REPEAT_PER_M };

/**
 * The static set. The camera always looks from the open lot toward the road,
 * so the depth stack reads: soil and tools near, truck mid, closed road,
 * poles, fence and low buildings far.
 */
export class Environment {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  private shadowCam: THREE.OrthographicCamera;
  private farProps: THREE.Object3D[] = [];

  constructor(quality: number, holes: GroundHole[] = []) {
    const rng = new Rng(1310);

    const lotMap = soilTexture(512, [104, 90, 68]);
    lotMap.repeat.set(SOIL_REPEAT_PER_M, SOIL_REPEAT_PER_M);
    const lotRough = soilRough(256);
    lotRough.repeat.set(SOIL_REPEAT_PER_M * 1.7, SOIL_REPEAT_PER_M * 1.7);
    const lot = new THREE.Mesh(
      buildLotGeometry(holes),
      new THREE.MeshStandardMaterial({ map: lotMap, roughnessMap: lotRough, roughness: 1, metalness: 0 })
    );
    lot.receiveShadow = true;
    this.group.add(lot);

    const asph = asphaltTexture(512);
    asph.repeat.set(14, 6);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(56, 10, 1, 1),
      new THREE.MeshStandardMaterial({ map: asph, roughness: 0.95, metalness: 0 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.012, LOT_Z + 5.15);
    road.receiveShadow = true;
    this.group.add(road);

    // far verge beyond the carriageway: dry grass over the same soil
    const vergeMap = soilTexture(512, [100, 104, 78]);
    vergeMap.repeat.set(30, 16);
    const verge = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 26, 1, 1),
      new THREE.MeshStandardMaterial({ map: vergeMap, color: 0x9aa07c, roughness: 1, metalness: 0 })
    );
    verge.rotation.x = -Math.PI / 2;
    verge.position.set(0, 0.008, LOT_Z + 22);
    verge.receiveShadow = true;
    this.group.add(verge);

    const conc = concreteTexture(256);
    conc.repeat.set(44, 1);
    const kerb = new THREE.Mesh(
      new THREE.BoxGeometry(56, 0.14, 0.3),
      new THREE.MeshStandardMaterial({ map: conc, color: 0xb2ada2, roughness: 0.95, metalness: 0 })
    );
    kerb.position.set(0, 0.07, LOT_Z + 0.15);
    kerb.castShadow = true;
    kerb.receiveShadow = true;
    this.group.add(kerb);

    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(56, 0.15),
      new THREE.MeshBasicMaterial({
        map: markingTexture('#cdc7ab', true, 256),
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      })
    );
    const lineMap = (line.material as THREE.MeshBasicMaterial).map!;
    lineMap.wrapS = lineMap.wrapT = THREE.RepeatWrapping;
    lineMap.repeat.set(34, 1);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.021, LOT_Z + 5.0);
    this.group.add(line);

    // mud dragged out of the lot by the tyres
    for (let i = 0; i < 2; i++) {
      const tr = new THREE.Mesh(
        new THREE.PlaneGeometry(3.6, 0.45),
        new THREE.MeshBasicMaterial({
          map: markingTexture('#6a5335', false, 256),
          transparent: true,
          opacity: 0.36,
          depthWrite: false,
        })
      );
      tr.rotation.x = -Math.PI / 2;
      tr.rotation.z = Math.PI / 2;
      tr.position.set(3.5 + i * 2.15, 0.022, LOT_Z + 1.0);
      this.group.add(tr);
    }

    this.group.add(this.buildBarrier(quality, rng));
    this.group.add(this.buildToolStand());
    this.group.add(this.buildSpoil(rng, quality));
    this.group.add(this.buildBackdrop(quality, rng));
    this.group.add(this.buildLoosePebbles(rng, quality));

    const hemi = new THREE.HemisphereLight(0xb6cbe0, 0x715f45, 1.15);
    this.group.add(hemi);
    this.group.add(new THREE.AmbientLight(0xdae2ea, 0.2));

    // One shadow-casting light; its budget is spent on the work point.
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.55);
    this.sun.castShadow = true;
    this.shadowCam = this.sun.shadow.camera as THREE.OrthographicCamera;
    this.shadowCam.near = 0.5;
    this.shadowCam.far = 30;
    this.setShadowExtent(8);
    this.sun.shadow.bias = -0.0014;
    this.sun.shadow.normalBias = 0.026;
    this.group.add(this.sun, this.sun.target);
    this.focusShadows(new THREE.Vector3());
    this.applyQuality(quality);
  }

  private setShadowExtent(half: number) {
    this.shadowCam.left = -half;
    this.shadowCam.right = half;
    this.shadowCam.top = half;
    this.shadowCam.bottom = -half;
    this.shadowCam.updateProjectionMatrix();
  }

  /** Sun comes over the player's left shoulder so shadows fall away from view. */
  focusShadows(point: THREE.Vector3) {
    this.sun.target.position.copy(point);
    this.sun.target.updateMatrixWorld();
    this.sun.position.set(point.x - 5.0, 8.0, point.z - 4.2);
  }

  applyQuality(quality: number) {
    const size = quality >= 2 ? 2048 : quality >= 1 ? 1024 : 512;
    if (this.sun.shadow.mapSize.width !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
      }
    }
    for (const o of this.farProps) o.visible = quality >= 1;
  }

  // ---------------------------------------------------------------------

  private buildBarrier(quality: number, rng: Rng): THREE.Group {
    const g = new THREE.Group();
    const coneSeg = quality >= 1 ? 14 : 7;
    const coneBody = new THREE.ConeGeometry(0.2, 0.66, coneSeg, 3, true);
    coneBody.translate(0, 0.35, 0);
    const coneMat = new THREE.MeshStandardMaterial({
      map: coneTexture(128),
      roughness: 0.66,
      metalness: 0,
    });
    const baseGeo = new THREE.BoxGeometry(0.38, 0.045, 0.38);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a2825, roughness: 0.92 });

    const spots: Array<[number, number]> = [];
    for (let x = -5.6; x <= 8.2; x += 1.75) spots.push([x, LOT_Z + 0.8]);
    spots.push([-6.4, 0.6], [-6.6, -2.0], [7.4, -0.4], [7.6, -2.4]);
    for (let x = -5.2; x <= 6.4; x += 2.9) spots.push([x, -4.3]);

    const cones = new THREE.InstancedMesh(coneBody, coneMat, spots.length);
    const bases = new THREE.InstancedMesh(baseGeo, baseMat, spots.length);
    cones.castShadow = true;
    bases.receiveShadow = true;
    bases.castShadow = true;
    const m = new THREE.Matrix4();
    spots.forEach((p, i) => {
      m.makeRotationY(rng.range(0, Math.PI * 2));
      m.setPosition(p[0] + rng.range(-0.1, 0.1), 0.022, p[1] + rng.range(-0.12, 0.12));
      cones.setMatrixAt(i, m);
      bases.setMatrixAt(i, m);
    });
    cones.instanceMatrix.needsUpdate = true;
    bases.instanceMatrix.needsUpdate = true;
    g.add(cones, bases);

    for (const [x, z, rot] of [
      [-3.6, LOT_Z + 1.2, 0],
      [1.4, -4.5, 0.06],
    ] as Array<[number, number, number]>) {
      const b = new THREE.Group();
      const panelMat = new THREE.MeshStandardMaterial({ map: barrierTexture(256), roughness: 0.76 });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.26, 0.055), panelMat);
      panel.position.y = 0.8;
      const panel2 = panel.clone();
      panel2.position.y = 0.46;
      const legMat = new THREE.MeshStandardMaterial({ color: 0xd8d3c6, roughness: 0.85 });
      for (const lx of [-0.9, 0.9]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.94, 0.34), legMat);
        leg.position.set(lx, 0.47, 0);
        leg.castShadow = true;
        b.add(leg);
      }
      panel.castShadow = true;
      panel2.castShadow = true;
      b.add(panel, panel2);
      b.position.set(x, 0, z);
      b.rotation.y = rot;
      g.add(b);
    }
    return g;
  }

  private buildToolStand(): THREE.Group {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6d5c46, roughness: 0.96 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x5b5f63, roughness: 0.62, metalness: 0.65 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.64), woodMat);
    top.position.y = 0.62;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    for (const [lx, lz] of [
      [-0.52, -0.25],
      [0.52, -0.25],
      [-0.52, 0.25],
      [0.52, 0.25],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.6, 0.055), metalMat);
      leg.position.set(lx, 0.3, lz);
      leg.castShadow = true;
      g.add(leg);
    }
    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.135, 0.3, 14, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x8f4426, roughness: 0.85, side: THREE.DoubleSide })
    );
    bucket.position.set(0.72, 0.15, 0.44);
    bucket.castShadow = true;
    g.add(bucket);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.2, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x3a444d, roughness: 0.8 })
    );
    box.position.set(-0.3, 0.75, 0);
    box.castShadow = true;
    g.add(box);
    g.position.set(-4.9, 0, 1.7);
    g.rotation.y = -0.35;
    return g;
  }

  /** Low spoil heaps rather than boulders: this soil came out of a hole. */
  private buildSpoil(rng: Rng, quality: number): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      map: soilTexture(256, [112, 96, 72]),
      roughness: 1,
      metalness: 0,
    });
    (mat.map as THREE.Texture).repeat.set(2, 2);
    const geo = new THREE.SphereGeometry(1, quality >= 1 ? 16 : 8, quality >= 1 ? 10 : 5);
    const spots: Array<[number, number, number]> = [
      [-6.6, -0.4, 0.6],
      [7.0, 1.1, 0.52],
      [-2.2, -4.6, 0.4],
      [5.6, -4.2, 0.44],
    ];
    const im = new THREE.InstancedMesh(geo, mat, spots.length);
    im.castShadow = true;
    im.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach(([x, z, s], i) => {
      q.setFromEuler(new THREE.Euler(0, rng.range(0, 6.28), 0));
      m.compose(new THREE.Vector3(x, -s * 0.72, z), q, new THREE.Vector3(s * 2.2, s, s * 1.75));
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
    return g;
  }

  /** Loose stone scattered over the lot so the ground is not a flat sheet. */
  private buildLoosePebbles(rng: Rng, quality: number): THREE.Group {
    const g = new THREE.Group();
    const count = quality >= 1 ? 130 : 60;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8d8172, roughness: 1, flatShading: true });
    const im = new THREE.InstancedMesh(geo, mat, count);
    im.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const s = rng.range(0.016, 0.055);
      q.setFromEuler(new THREE.Euler(rng.range(0, 6.3), rng.range(0, 6.3), rng.range(0, 6.3)));
      m.compose(
        new THREE.Vector3(rng.range(-9, 9), s * 0.25, rng.range(-6.5, 2.2)),
        q,
        new THREE.Vector3(s * 1.5, s * 0.7, s * 1.3)
      );
      im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
    this.farProps.push(im);
    return g;
  }

  private buildBackdrop(quality: number, rng: Rng): THREE.Group {
    const g = new THREE.Group();
    const m = new THREE.Matrix4();

    // Backs of low buildings, well beyond the road and softened by haze.
    const wallMat = new THREE.MeshStandardMaterial({ map: concreteTexture(256), color: 0xb9b4a9, roughness: 0.96 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a5f63, roughness: 0.92 });
    const bGeo = new THREE.BoxGeometry(1, 1, 1);
    const rows: Array<[number, number, number, number, number]> = [];
    for (let i = 0; i < 12; i++) {
      rows.push([
        -24 + i * 4.6 + rng.range(-0.9, 0.9),
        21.5 + rng.range(0, 6.0),
        rng.range(3.2, 5.4),
        rng.range(3.6, 6.4),
        rng.range(3.6, 5.4),
      ]);
    }
    const walls = new THREE.InstancedMesh(bGeo, wallMat, rows.length);
    const roofs = new THREE.InstancedMesh(bGeo, roofMat, rows.length);
    rows.forEach(([x, z, h, w, d], i) => {
      m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      walls.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, h + 0.14, z), new THREE.Quaternion(), new THREE.Vector3(w * 1.07, 0.28, d * 1.07));
      roofs.setMatrixAt(i, m);
    });
    walls.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    g.add(walls, roofs);
    this.farProps.push(roofs);

    // mesh fence along the far side of the road
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x74787c, roughness: 0.72, metalness: 0.35 });
    const posts = 34;
    const fp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 1.2, 0.07), fenceMat, posts);
    for (let i = 0; i < posts; i++) {
      m.makeTranslation(-22 + i * 1.32, 0.6, 14.4);
      fp.setMatrixAt(i, m);
    }
    fp.instanceMatrix.needsUpdate = true;
    g.add(fp);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(45, 1.15),
      new THREE.MeshStandardMaterial({
        color: 0x8a8f93,
        roughness: 0.85,
        transparent: true,
        opacity: 0.36,
        side: THREE.DoubleSide,
      })
    );
    mesh.position.set(0, 0.62, 14.4);
    g.add(mesh);

    // utility poles on the far verge, with slack spans
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x827868, roughness: 0.96 });
    const poleXs = [-12.5, -4.0, 4.6, 13.4];
    for (const px of poleXs) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 8.4, 8), poleMat);
      pole.position.set(px, 4.2, LOT_Z + 10.6);
      pole.castShadow = quality >= 1;
      g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.1), poleMat);
      arm.position.set(px, 7.5, LOT_Z + 10.6);
      g.add(arm);
      for (const ax of [-0.68, 0.68]) {
        const ins = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 0.12, 6),
          new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.4 })
        );
        ins.position.set(px + ax, 7.62, LOT_Z + 10.6);
        g.add(ins);
      }
    }
    const wireMat = new THREE.LineBasicMaterial({ color: 0x3b3f44, transparent: true, opacity: 0.7 });
    for (let k = 0; k < poleXs.length - 1; k++) {
      for (const off of [-0.68, 0, 0.68]) {
        const a = new THREE.Vector3(poleXs[k] + off, 7.5, LOT_Z + 10.6);
        const b = new THREE.Vector3(poleXs[k + 1] + off, 7.5, LOT_Z + 10.6);
        const mid = a.clone().lerp(b, 0.5).setY(6.95);
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(10)),
          wireMat
        );
        g.add(line);
      }
    }

    // Street planting: clustered ellipsoids, desaturated, never a single ball.
    const trunkGeo = new THREE.CylinderGeometry(0.09, 0.15, 2.4, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5f5344, roughness: 1 });
    const leafGeo = new THREE.IcosahedronGeometry(1, quality >= 1 ? 1 : 0);
    const leafMats = [
      new THREE.MeshStandardMaterial({ color: 0x53603f, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x46543a, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x5d6a48, roughness: 1 }),
    ];
    const treeSpots: Array<[number, number, number]> = [];
    for (let i = 0; i < 10; i++) {
      treeSpots.push([-20 + i * 4.3 + rng.range(-1.2, 1.2), 16.8 + rng.range(-0.9, 1.6), rng.range(0.85, 1.25)]);
    }
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
    treeSpots.forEach(([x, z, s], i) => {
      m.compose(new THREE.Vector3(x, 1.2 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(i, m);
    });
    trunks.instanceMatrix.needsUpdate = true;
    g.add(trunks);
    for (let lobe = 0; lobe < 3; lobe++) {
      const im = new THREE.InstancedMesh(leafGeo, leafMats[lobe], treeSpots.length);
      treeSpots.forEach(([x, z, s], i) => {
        const ox = rng.range(-0.55, 0.55) * s;
        const oy = rng.range(-0.25, 0.4) * s;
        const oz = rng.range(-0.5, 0.5) * s;
        const r = rng.range(0.62, 0.92) * s;
        m.compose(
          new THREE.Vector3(x + ox, 2.7 * s + oy, z + oz),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(0, 1), rng.range(0, 6.3), 0)),
          new THREE.Vector3(r * 1.15, r * 0.86, r)
        );
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
      g.add(im);
      this.farProps.push(im);
    }

    return g;
  }
}

/**
 * The lot is emitted as explicit quads with a rectangular gap under every dig
 * patch. Without the gaps the flat lot would sit inside every excavation and
 * the pipe could never be seen from above. UVs are world metres, so the lot
 * and the patches share one texel density.
 */
function buildLotGeometry(holes: GroundHole[]): THREE.BufferGeometry {
  const minX = -28;
  const maxX = 28;
  const minZ = LOT_Z - 34;
  const maxZ = LOT_Z;
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];

  const quad = (x0: number, z0: number, x1: number, z1: number) => {
    if (x1 - x0 < 1e-4 || z1 - z0 < 1e-4) return;
    const corners: Array<[number, number]> = [
      [x0, z0],
      [x1, z1],
      [x1, z0],
      [x0, z0],
      [x0, z1],
      [x1, z1],
    ];
    for (const [x, z] of corners) {
      pos.push(x, 0, z);
      nrm.push(0, 1, 0);
      uv.push(x, z);
    }
  };

  // inset a little so the patch always overlaps the lot rather than gapping
  const rects = holes
    .map((h) => ({
      x0: h.x - h.size / 2 + 0.03,
      x1: h.x + h.size / 2 - 0.03,
      z0: h.z - h.size / 2 + 0.03,
      z1: h.z + h.size / 2 - 0.03,
    }))
    .sort((a, b) => a.x0 - b.x0);

  let cursor = minX;
  for (const r of rects) {
    const x0 = Math.max(cursor, Math.min(r.x0, maxX));
    if (x0 > cursor) quad(cursor, minZ, x0, maxZ);
    const x1 = Math.min(r.x1, maxX);
    if (x1 > x0) {
      quad(x0, minZ, x1, Math.max(minZ, r.z0));
      quad(x0, Math.min(maxZ, r.z1), x1, maxZ);
    }
    cursor = Math.max(cursor, x1);
  }
  quad(cursor, minZ, maxX, maxZ);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  return geo;
}

/** Vertical gradient sky. Suburban daylight, no cinematic grading. */
export function buildSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(120, 20, 14);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x8ab0d4) },
      mid: { value: new THREE.Color(0xc4d5e3) },
      bottom: { value: new THREE.Color(0xd6d4ca) },
    },
    vertexShader: `varying float vH;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vH = normalize(wp.xyz).y;
      gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `varying float vH; uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
      void main(){ float h = vH;
      vec3 c = h > 0.05 ? mix(mid, top, clamp((h-0.05)/0.8,0.0,1.0))
                        : mix(bottom, mid, clamp((h+0.22)/0.27,0.0,1.0));
      gl_FragColor = vec4(c,1.0);
      #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}
