import * as THREE from 'three';
import { materials } from './materials.js';
import * as T from './textures.js';
import { roundedBox, heapGeometry, mesh, lumpySphere, mergeGroup } from './geo.js';

/* ------------------------------------------------------------------
   The winter street.  The road runs along +Z; the plow drives in +Z.
   Everything is pooled and recycled so the street never ends.
      +X side : the packed snow wall the plow eats
      -X side : the lane the dump truck runs in
------------------------------------------------------------------- */

export const ROAD = {
  halfWidth: 5.6,
  wallX: 3.55,         // centre of the packed snow wall
  wallHalf: 1.2,       // -> the bank spans x 2.35 .. 4.75
  truckX: -3.4,        // the dump truck runs in the far lane
  plowX: 3.2,          // the plow hugs the bank, auger covers 1.6 .. 4.8
};

function hash(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function markingsCanvas() {
  const S = 512, c = document.createElement('canvas');
  c.width = 256; c.height = S;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 256, S);
  // dashed centre line
  x.fillStyle = 'rgba(238,238,226,0.82)';
  for (let i = 0; i < 2; i++) x.fillRect(120, i * 256 + 30, 16, 150);
  // solid edge lines
  x.fillStyle = 'rgba(232,236,230,0.55)';
  x.fillRect(8, 0, 10, S);
  x.fillRect(238, 0, 10, S);
  // scuff the paint
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) {
    x.fillStyle = `rgba(0,0,0,${0.2 + Math.random() * 0.7})`;
    x.beginPath();
    x.ellipse(Math.random() * 256, Math.random() * S, 2 + Math.random() * 9, 2 + Math.random() * 6, 0, 0, Math.PI * 2);
    x.fill();
  }
  x.globalCompositeOperation = 'source-over';
  return c;
}

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.M = materials();
    const M = this.M;

    /* ---------------- sky ---------------- */
    const skyGeo = new THREE.SphereGeometry(900, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x5d84ab) },
        mid: { value: new THREE.Color(0xa9c1d6) },
        bot: { value: new THREE.Color(0xe8d9c4) },
        sunDir: { value: new THREE.Vector3(-0.55, 0.16, 0.82).normalize() },
        sunCol: { value: new THREE.Color(0xffd9a0) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: `
        uniform vec3 top, mid, bot, sunCol; uniform vec3 sunDir;
        varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y*0.5+0.5, 0.0, 1.0);
          vec3 col = mix(bot, mid, smoothstep(0.42, 0.56, h));
          col = mix(col, top, smoothstep(0.55, 0.92, h));
          float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += sunCol * pow(d, 26.0) * 0.85;      // low winter sun
          col += sunCol * pow(d, 3.0) * 0.16;       // haze around it
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    scene.fog = new THREE.Fog(0xc7d5e2, 70, 380);

    /* ---------------- lights ---------------- */
    const hemi = new THREE.HemisphereLight(0xbcd6f0, 0xdfe7ee, 1.15);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffdcae, 2.5);
    sun.position.set(-26, 12, 34);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const cam = sun.shadow.camera;
    cam.left = -26; cam.right = 26; cam.top = 26; cam.bottom = -26;
    cam.near = 1; cam.far = 110;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    // cold bounce from the snow so shadow sides never go black
    const fill = new THREE.DirectionalLight(0xb8d0ea, 0.5);
    fill.position.set(24, 9, -18);
    scene.add(fill);

    /* ---------------- ground + road ---------------- */
    const groundGeo = new THREE.PlaneGeometry(700, 700);
    groundGeo.rotateX(-Math.PI / 2);
    this.ground = new THREE.Mesh(groundGeo, M.snowGround);
    this.ground.receiveShadow = true;
    this.ground.position.y = 0.02;
    scene.add(this.ground);
    this.groundTile = 700 / 18;

    const roadGeo = new THREE.PlaneGeometry(ROAD.halfWidth * 2, 400);
    roadGeo.rotateX(-Math.PI / 2);
    this.road = new THREE.Mesh(roadGeo, M.road);
    this.road.receiveShadow = true;
    this.road.position.y = 0.06;
    scene.add(this.road);
    this.roadTile = 400 / 26;

    // painted markings
    const markTex = T.toTexture(markingsCanvas(), 1);
    markTex.repeat.set(1, 26);
    const markMat = new THREE.MeshStandardMaterial({
      map: markTex, transparent: true, roughness: 0.55, metalness: 0.0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      depthWrite: false,
    });
    this.markings = new THREE.Mesh(roadGeo.clone(), markMat);
    this.markings.position.y = 0.065;
    scene.add(this.markings);

    // wheel ruts: wet, dark, slightly reflective streaks
    const rutMat = new THREE.MeshStandardMaterial({
      color: 0x2a3038, transparent: true, opacity: 0.26, roughness: 0.18, metalness: 0.15,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    this.ruts = [];
    for (const rx of [-3.5, -1.7, 1.0, 2.8]) {
      const g = new THREE.PlaneGeometry(0.7, 400);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, rutMat);
      m.position.set(rx, 0.07, 0);
      scene.add(m);
      this.ruts.push(m);
    }

    // slush windrow along the road edges
    const slushMat = new THREE.MeshStandardMaterial({
      color: 0xd6e2ee, roughness: 0.9, transparent: true, opacity: 0.9,
    });
    this.slush = [];
    for (const sx of [-1, 1]) {
      const g = new THREE.PlaneGeometry(1.5, 400);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, slushMat);
      m.position.set(sx * (ROAD.halfWidth - 0.6), 0.075, 0);
      m.receiveShadow = true;
      scene.add(m);
      this.slush.push(m);
    }

    /* ---------------- pooled street furniture ---------------- */
    this.pools = [];
    this._buildSnowPoles();
    this._buildPolesAndWires();
    this._buildSigns();
    this._buildGuardrail();
    this._buildTrees();
    this.buildingPool = this._buildBuildings();
    this._buildFarBank();
    this._buildMountains();

    /* ---------------- dump site ---------------- */
    this._buildDumpSite();

    this._tmp = new THREE.Vector3();
  }

  /* ------------ pools ------------ */
  _pool(count, spacing, factory, place, merge = false) {
    const items = [];
    for (let i = 0; i < count; i++) {
      let o = factory(i);
      if (merge) {
        const src = o;
        o = mergeGroup(src);
        o.userData = src.userData;
      }
      o.userData.idx = null;
      this.scene.add(o);
      items.push(o);
    }
    const pool = { items, spacing, place };
    this.pools.push(pool);
    return pool;
  }

  _buildSnowPoles() {
    // red/white roadside snow poles - instantly readable scale reference
    const geo = new THREE.CylinderGeometry(0.045, 0.045, 2.4, 6);
    const matA = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.7 });
    const matB = new THREE.MeshStandardMaterial({ color: 0xd8352a, roughness: 0.7 });
    const bandGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6);
    this._pool(26, 9, () => {
      const g = new THREE.Group();
      const sideSign = Math.random() < 0.5 ? 1 : -1;
      const p = mesh(geo, matA, g, [0, 1.2, 0]);
      p.castShadow = true;
      for (let k = 0; k < 4; k++) mesh(bandGeo, matB, g, [0, 0.35 + k * 0.6, 0]);
      // reflector arrow on top
      mesh(new THREE.ConeGeometry(0.09, 0.2, 6), matB, g, [0, 2.5, 0], [Math.PI, 0, 0]);
      g.userData.side = sideSign;
      return g;
    }, (o, z, idx) => {
      const side = hash(idx * 3.1) < 0.5 ? -1 : 1;
      o.position.set(side * (ROAD.halfWidth + 1.9 + hash(idx) * 0.5), 0, z);
      o.rotation.y = hash(idx * 7.7) * 0.4;
    }, true);
  }

  _buildPolesAndWires() {
    const M = this.M;
    const poleGeo = new THREE.CylinderGeometry(0.13, 0.17, 8.5, 8);
    const armGeo = new THREE.BoxGeometry(1.7, 0.09, 0.09);
    const insGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.14, 6);
    const wireGeo = new THREE.CylinderGeometry(0.018, 0.018, 24, 4);
    wireGeo.rotateX(Math.PI / 2);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.92 });
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.9 });
    const insMat = new THREE.MeshStandardMaterial({ color: 0x546070, roughness: 0.5 });
    const lampMat = M.lampWhite;
    this._pool(7, 26, () => {
      const g = new THREE.Group();
      mesh(poleGeo, poleMat, g, [0, 4.25, 0]);
      for (const y of [7.2, 6.5]) {
        mesh(armGeo, poleMat, g, [0, y, 0]);
        for (const sx of [-0.7, 0, 0.7]) mesh(insGeo, insMat, g, [sx, y + 0.11, 0]);
      }
      mesh(wireGeo, wireMat, g, [-0.7, 7.28, 12]);
      mesh(wireGeo, wireMat, g, [0.7, 7.28, 12]);
      mesh(wireGeo, wireMat, g, [0, 6.6, 12]);
      // street lamp
      mesh(new THREE.BoxGeometry(0.16, 0.1, 1.2), poleMat, g, [-0.6, 5.6, 0], [0, 0, 0.22]);
      mesh(roundedBox(0.34, 0.14, 0.7, 0.05), poleMat, g, [-1.15, 5.72, 0]);
      mesh(new THREE.PlaneGeometry(0.28, 0.6), lampMat, g, [-1.15, 5.63, 0], [Math.PI / 2, 0, 0]);
      // transformer can
      mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.7, 10), poleMat, g, [0.38, 5.9, 0]);
      return g;
    }, (o, z, idx) => {
      o.position.set(ROAD.halfWidth + 3.4, 0, z);
      o.rotation.y = Math.PI;
    }, true);
  }

  _buildSigns() {
    const M = this.M;
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.0, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.6, metalness: 0.5 });
    const faces = [
      { canvas: T.signSpeed(30), shape: 'circle' },
      { canvas: T.signWarnSnow(), shape: 'tri' },
      { canvas: T.signBlue(), shape: 'rect' },
      { canvas: T.signSpeed(40), shape: 'circle' },
    ];
    const mats = faces.map(f => new THREE.MeshStandardMaterial({
      map: T.toTexture(f.canvas, 1), roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide,
    }));
    const geos = [
      new THREE.CircleGeometry(0.42, 24),
      new THREE.CircleGeometry(0.46, 3),
      new THREE.PlaneGeometry(0.8, 0.8),
      new THREE.CircleGeometry(0.42, 24),
    ];
    this._pool(6, 34, () => {
      const g = new THREE.Group();
      mesh(postGeo, postMat, g, [0, 1.5, 0]);
      const holder = new THREE.Group();
      holder.position.set(0, 2.55, 0.05);
      g.add(holder);
      g.userData.holder = holder;
      // snow cap on top of the sign
      const cap = mesh(new THREE.BoxGeometry(0.9, 0.09, 0.2), this.M.snowPile, g, [0, 2.95, 0.06]);
      cap.visible = true;
      return g;
    }, (o, z, idx) => {
      const k = Math.floor(hash(idx * 5.3) * faces.length) % faces.length;
      const holder = o.userData.holder;
      if (o.userData.faceK !== k) {
        holder.clear();
        const m = new THREE.Mesh(geos[k], mats[k]);
        m.castShadow = true;
        if (k === 1) m.rotation.z = Math.PI;
        holder.add(m);
        o.userData.faceK = k;
      }
      const side = hash(idx * 2.9) < 0.62 ? 1 : -1;
      o.position.set(side * (ROAD.halfWidth + 2.4), 0, z);
      o.rotation.y = side > 0 ? Math.PI : 0;
    });
  }

  _buildGuardrail() {
    const railGeo = new THREE.BoxGeometry(0.06, 0.34, 8);
    const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xc7ccd2, roughness: 0.45, metalness: 0.6 });
    const snowMat = this.M.snowPile;
    this._pool(14, 8, () => {
      const g = new THREE.Group();
      mesh(railGeo, railMat, g, [0, 0.8, 0]);
      mesh(new THREE.BoxGeometry(0.12, 0.1, 8), snowMat, g, [0.02, 0.99, 0]);
      for (const z of [-3.6, 0, 3.6]) mesh(postGeo, railMat, g, [0, 0.5, z]);
      return g;
    }, (o, z, idx) => {
      o.position.set(-(ROAD.halfWidth + 1.4), 0, z);
    }, true);
  }

  _buildTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3b30, roughness: 0.95 });
    const needleMat = new THREE.MeshStandardMaterial({ color: 0x24402f, roughness: 0.95 });
    const snowMat = this.M.snowPile;
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 2.2, 7);
    const coneGeo = new THREE.ConeGeometry(1.5, 3.0, 9);
    const snowConeGeo = new THREE.ConeGeometry(1.42, 2.4, 9);
    const branchGeo = new THREE.CylinderGeometry(0.05, 0.09, 2.0, 5);
    this._pool(14, 13, (i) => {
      const g = new THREE.Group();
      const conifer = i % 2 === 0;
      if (conifer) {
        mesh(trunkGeo, trunkMat, g, [0, 1.1, 0]);
        for (let k = 0; k < 3; k++) {
          mesh(coneGeo, needleMat, g, [0, 2.1 + k * 1.5, 0]).scale.setScalar(1 - k * 0.22);
          const s = mesh(snowConeGeo, snowMat, g, [0, 2.55 + k * 1.5, 0]);
          s.scale.set((1 - k * 0.22) * 0.92, 0.42, (1 - k * 0.22) * 0.92);
        }
      } else {
        mesh(new THREE.CylinderGeometry(0.14, 0.3, 4.0, 7), trunkMat, g, [0, 2.0, 0]);
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          const b = mesh(branchGeo, trunkMat, g,
            [Math.cos(a) * 0.8, 3.0 + (k % 3) * 0.6, Math.sin(a) * 0.8],
            [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9]);
          b.scale.setScalar(0.8 + (k % 3) * 0.2);
        }
      }
      g.userData.conifer = conifer;
      return g;
    }, (o, z, idx) => {
      const side = hash(idx * 11.3) < 0.5 ? -1 : 1;
      o.position.set(side * (ROAD.halfWidth + 7 + hash(idx * 3.7) * 8), 0, z);
      o.scale.setScalar(0.8 + hash(idx * 1.9) * 0.6);
      o.rotation.y = hash(idx * 4.1) * 6.28;
    }, true);
  }

  _buildBuildings() {
    return this._buildBuildingsInner();
  }

  _buildBuildingsInner() {
    const texes = [0x8b93a0, 0xa89c90, 0x7d8896, 0x9c9184, 0x6f7a88].map((c, i) =>
      new THREE.MeshStandardMaterial({
        map: T.toTexture(T.buildingTexture(c, 4 + i), 1), roughness: 0.9, metalness: 0.0,
      }));
    const snowMat = this.M.snowPile;
    this._pool(13, 22, () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), texes[0]);
      body.castShadow = true; body.receiveShadow = true;
      g.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), snowMat);
      roof.castShadow = true;
      g.add(roof);
      g.userData.body = body; g.userData.roof = roof;
      return g;
    }, (o, z, idx) => {
      const side = hash(idx * 13.7) < 0.5 ? -1 : 1;
      const w = 7 + hash(idx * 2.3) * 9;
      const d = 8 + hash(idx * 5.1) * 8;
      const h = 6 + hash(idx * 8.9) * 16;
      let x = side * (ROAD.halfWidth + 13 + hash(idx * 6.7) * 12);
      // the dump lot is an open yard: no buildings standing in it
      if (this.siteActive && side < 0 && Math.abs(z - this.siteZ) < 24) x = -x - 6;
      o.userData.body.scale.set(w, h, d);
      o.userData.body.position.set(0, h / 2, 0);
      o.userData.roof.scale.set(w * 1.03, 0.5, d * 1.03);
      o.userData.roof.position.set(0, h + 0.2, 0);
      const k = Math.floor(hash(idx * 3.3) * texes.length) % texes.length;
      if (o.userData.k !== k) { o.userData.body.material = texes[k]; o.userData.k = k; }
      o.position.set(x, 0, z);
      o.rotation.y = (hash(idx * 9.1) - 0.5) * 0.3;
    });
  }

  _buildFarBank() {
    // continuous plowed bank on the truck side of the road
    const geo = new THREE.BoxGeometry(2.6, 1.0, 12);
    this._pool(10, 12, () => {
      const g = new THREE.Group();
      const m = mesh(geo, this.M.packedSnow, g, [0, 0.5, 0]);
      m.receiveShadow = true;
      // lumpy top
      for (let i = 0; i < 5; i++) {
        const l = mesh(lumpySphere(0.85, 1, 0.25, i), this.M.snowPile, g,
          [(Math.random() - 0.5) * 1.6, 0.95, -5 + i * 2.5]);
        l.scale.set(1.1, 0.55, 1.4);
      }
      return g;
    }, (o, z, idx) => {
      o.position.set(-(ROAD.halfWidth + 2.6), 0, z);
    }, true);
  }

  _buildMountains() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xa9bed4, fog: true });
    const g = new THREE.Group();
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const r = 420 + Math.random() * 140;
      const h = 55 + Math.random() * 80;
      const c = new THREE.Mesh(new THREE.ConeGeometry(70 + Math.random() * 80, h, 6), mat);
      c.position.set(Math.cos(a) * r, h / 2 - 6, Math.sin(a) * r);
      c.rotation.y = Math.random() * 3;
      g.add(c);
    }
    this.mountains = g;
    this.scene.add(g);
  }

  /* ------------ dump site (雪堆積場) ------------ */
  _buildDumpSite() {
    const M = this.M;
    const site = new THREE.Group();
    site.visible = false;
    this.scene.add(site);
    this.site = site;

    // cleared lot
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(30, 34), M.snowGround);
    lot.rotateX(-Math.PI / 2);
    lot.position.set(-16, 0.09, 0);
    lot.receiveShadow = true;
    site.add(lot);

    // the growing snow mountain
    this.sitePile = new THREE.Mesh(heapGeometry(7.0, 8.0, 6.2, 30, 9), M.snowPile);
    this.sitePile.position.set(-14.0, 0.1, 1.5);
    this.sitePile.castShadow = true;
    this.sitePile.receiveShadow = true;
    site.add(this.sitePile);
    // a few frozen boulders of snow around the base
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 7 + Math.random() * 3;
      const b = new THREE.Mesh(lumpySphere(0.8 + Math.random() * 0.7, 1, 0.3, i), M.snowPile);
      b.position.set(-14.0 + Math.cos(a) * r, 0.4, 1.5 + Math.sin(a) * r * 0.8);
      b.scale.y = 0.6;
      b.castShadow = true; b.receiveShadow = true;
      site.add(b);
    }

    // entrance gate + pictogram board (no text - a snow mountain icon)
    const postMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.6, metalness: 0.4 });
    for (const sz of [-19.0, -14.0]) {
      mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.2, 8), postMat, site, [-8.4, 2.1, sz]);
    }
    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = boardCanvas.height = 256;
    {
      const x = boardCanvas.getContext('2d');
      x.fillStyle = '#1d6fc0'; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = '#f2f6fa'; x.lineWidth = 12; x.strokeRect(14, 14, 228, 228);
      x.fillStyle = '#f2f6fa';
      x.beginPath();
      x.moveTo(40, 200); x.quadraticCurveTo(90, 70, 128, 78);
      x.quadraticCurveTo(168, 66, 216, 200); x.closePath(); x.fill();
      // falling snow dots
      for (let i = 0; i < 16; i++) {
        x.beginPath();
        x.arc(50 + Math.random() * 156, 40 + Math.random() * 40, 4 + Math.random() * 4, 0, 6.3);
        x.fill();
      }
    }
    const boardMat = new THREE.MeshStandardMaterial({
      map: T.toTexture(boardCanvas, 1), roughness: 0.5, side: THREE.DoubleSide,
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), boardMat);
    board.position.set(-8.4, 3.1, -16.5);
    board.rotation.y = Math.PI / 2;
    board.castShadow = true;
    site.add(board);

    // traffic cones marking the tipping spot
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xf05a1e, roughness: 0.7 });
    const coneWhite = new THREE.MeshStandardMaterial({ color: 0xf3f5f8, roughness: 0.7 });
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      mesh(new THREE.ConeGeometry(0.24, 0.75, 10), coneMat, g, [0, 0.38, 0]);
      mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.12, 10), coneWhite, g, [0, 0.42, 0]);
      mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), coneMat, g, [0, 0.03, 0]);
      g.position.set(-6.6 - (i % 3) * 0.25, 0.06, -9.5 + i * 1.6);
      site.add(g);
    }

    // a parked loader silhouette for scale
    const loader = new THREE.Group();
    loader.position.set(-21, 0, -10);
    loader.rotation.y = 1.15;
    site.add(loader);
    mesh(roundedBox(2.2, 1.2, 4.2, 0.12), M.yellowPaint, loader, [0, 1.4, 0]);
    mesh(roundedBox(1.6, 1.2, 1.5, 0.1), M.darkPaint, loader, [0, 2.5, -0.6]);
    mesh(roundedBox(2.6, 0.9, 1.0, 0.08), M.bareSteel, loader, [0, 0.6, 2.6], [0.3, 0, 0]);
    for (const sx of [-1, 1]) for (const z of [-1.4, 1.4]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 16), M.rubber);
      w.rotation.z = Math.PI / 2;
      w.position.set(sx * 1.15, 0.8, z);
      w.castShadow = true;
      loader.add(w);
    }

    this.pileCenter = new THREE.Vector3(-14.0, 0, 1.5);
    this.pileRadX = 7.0; this.pileRadZ = 8.0; this.pileH = 6.2;
    this.siteFill = 0.35;
    this.siteZ = 0;
    this.siteActive = false;
  }

  showSite(z) {
    this.siteZ = z;
    this.siteActive = true;
    if (this.buildingPool) for (const b of this.buildingPool.items) b.userData.idx = null;
    this.site.position.z = z;
    this.site.visible = true;
    this.siteActive = true;
    this.siteZ = z;
  }

  hideSite() {
    this.site.visible = false;
    this.siteActive = false;
    if (this.buildingPool) for (const b of this.buildingPool.items) b.userData.idx = null;
  }

  growSite(amount) {
    this.siteFill = Math.min(1.5, this.siteFill + amount);
  }

  /** ground height of the dump mountain, so tipped snow settles on its flank */
  pileHeightAt(x, z) {
    if (!this.siteActive) return 0.12;
    const f = this.siteFill;
    const rx = this.pileRadX * (0.55 + f * 0.45);
    const rz = this.pileRadZ * (0.55 + f * 0.45);
    const h = this.pileH * (0.4 + f * 0.6);
    const dx = (x - this.pileCenter.x) / rx;
    const dz = (z - (this.siteZ + this.pileCenter.z)) / rz;
    const r2 = dx * dx + dz * dz;
    if (r2 >= 1) return 0.12;
    return Math.max(0.12, h * Math.sqrt(1 - r2) * 0.92);
  }

  update(dt, focusZ) {
    // infinite ground/road: keep the planes under the action and slide the
    // textures the other way so the world looks nailed down
    this.ground.position.z = focusZ;
    this.ground.material.map.offset.y = -focusZ / this.groundTile;
    this.road.position.z = focusZ;
    this.road.material.map.offset.y = -focusZ / this.roadTile;
    this.road.material.roughnessMap.offset.y = -focusZ / this.roadTile;
    this.markings.position.z = focusZ;
    this.markings.material.map.offset.y = -focusZ / this.roadTile;
    for (const r of this.ruts) r.position.z = focusZ;
    for (const s of this.slush) s.position.z = focusZ;
    this.sky.position.z = focusZ;
    this.mountains.position.z = focusZ;

    // recycle pooled props
    for (const pool of this.pools) {
      const { items, spacing, place } = pool;
      const n = items.length;
      const back = spacing * 3;
      const base = Math.floor((focusZ - back) / spacing);
      for (let i = 0; i < n; i++) {
        const idx = base + i;
        const z = idx * spacing;
        const o = items[i];
        if (o.userData.idx !== idx) {
          o.userData.idx = idx;
          place(o, z, idx);
        }
        o.position.z = z;
      }
    }

    // dump-site mountain grows with every load tipped into it
    const f = this.siteFill;
    this.sitePile.scale.set(0.55 + f * 0.45, 0.4 + f * 0.6, 0.55 + f * 0.45);

    // sun follows the action so shadows stay crisp where it matters
    this.sun.position.set(-26, 13, focusZ + 34);
    this.sun.target.position.set(0, 0, focusZ + 2);
    this.sun.target.updateMatrixWorld();
  }
}
