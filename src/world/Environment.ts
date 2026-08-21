import * as THREE from 'three';
import { makeRng, soilAlbedo, soilRough } from '../gfx/textures';
import type { Quality } from '../gfx/quality';

/**
 * Sky, the single afternoon sun, the ground plane, the uncut field beyond the
 * working rows, the farm track and the low windbreak. Everything here is
 * background: it is built once, never animated except for a slow leaf sway.
 */
export class Environment {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private farGroups: THREE.Object3D[] = [];
  private envRT?: THREE.WebGLRenderTarget;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: Quality) {
    scene.add(this.group);

    // --- sky ------------------------------------------------------------
    const skyGeo = new THREE.SphereGeometry(420, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color('#6d9ac9') },
        uHorizon: { value: new THREE.Color('#dfd3bb') },
        uSunDir: { value: new THREE.Vector3(-0.62, 0.5, 0.68).normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir;
        void main() {
          float h = clamp(vDir.y * 1.6 + 0.12, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(h, 0.72));
          float d = max(dot(normalize(vDir), uSunDir), 0.0);
          col += vec3(1.0, 0.86, 0.62) * pow(d, 14.0) * 0.5;   // soft afternoon flare
          col += vec3(1.0, 0.92, 0.78) * pow(d, 3.0) * 0.06;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.frustumCulled = false;
    this.group.add(sky);

    scene.fog = new THREE.FogExp2(0xd5cab2, 0.0058);

    // --- the one sun ----------------------------------------------------
    this.sun = new THREE.DirectionalLight(0xffe6ba, 3.2);
    this.sun.position.set(-13, 11, 15);
    this.sun.castShadow = true;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 60;
    const s = 7.5;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    scene.add(this.sun);
    scene.add(this.sun.target);

    // sky + ground bounce
    this.hemi = new THREE.HemisphereLight(0xb4cce8, 0x8a7350, 0.5);
    scene.add(this.hemi);

    // --- image based lighting from a tiny procedural scene ---------------
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 8), skyMat.clone());
    envSky.material.side = THREE.BackSide;
    envScene.add(envSky);
    const envGround = new THREE.Mesh(
      new THREE.CircleGeometry(9.8, 16),
      new THREE.MeshBasicMaterial({ color: 0x9c8560 })
    );
    envGround.rotation.x = -Math.PI / 2;
    envGround.position.y = -0.5;
    envScene.add(envGround);
    try {
      this.envRT = pmrem.fromScene(envScene, 0.035);
      scene.environment = this.envRT.texture;
      scene.environmentIntensity = 0.62;
    } catch {
      /* IBL is a nicety: a device without float targets still plays fine */
    }
    pmrem.dispose();
    envSky.geometry.dispose();
    envGround.geometry.dispose();

    this.buildGround();
    this.buildDistantField(quality);
    this.buildWindbreak(quality);
    this.buildTrack();

    quality.onChange((t) => {
      this.sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
      const show = quality.farDensity;
      this.farGroups.forEach((g, i) => {
        g.visible = i / this.farGroups.length < show;
      });
      void t;
    });
  }

  private buildGround() {
    const albedo = soilAlbedo().clone();
    albedo.repeat.set(90, 90);
    albedo.needsUpdate = true;
    const rough = soilRough().clone();
    rough.repeat.set(90, 90);
    rough.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(400, 400, 40, 40);
    // Gentle undulation so the horizon is not a ruler line — but dead flat
    // across the worked field, or it would lift the plane above the ridges and
    // bury the whole row.
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const d = Math.hypot(x, y);
      const far = Math.min(1, Math.max(0, (d - 30) / 45));
      const roll = Math.sin(x * 0.02) * 0.5 + Math.cos(y * 0.017) * 0.4;
      pos.setZ(i, roll * far - Math.max(0, d - 70) * 0.004);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: albedo,
      roughnessMap: rough,
      roughness: 1,
      metalness: 0,
      color: 0xb59a72,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.09;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  /** Rows of peanuts still standing, out beyond the rows being worked. */
  private buildDistantField(quality: Quality) {
    const rng = makeRng(1337);
    const blob = new THREE.SphereGeometry(0.4, 7, 4);
    blob.scale(1.3, 0.5, 0.85);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6c8339, roughness: 0.94, flatShading: true });
    // clustered LOD: one instanced mesh per band of distance
    // bands on both sides of the worked rows, so the horizon is a field and
    // not a bare plain
    for (let band = 0; band < 9; band++) {
      const zStart = band < 6 ? -13 - band * 9 : 9 + (band - 6) * 9;
      const count = 300;
      const inst = new THREE.InstancedMesh(blob, mat, count);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const sc = new THREE.Vector3();
      const p = new THREE.Vector3();
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / 60);
        p.set(-34 + rng() * 110, 0.22 + rng() * 0.06, zStart - row * 1.55 - rng() * 0.2);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI);
        const k = 0.85 + rng() * 0.4;
        sc.set(k, k * (0.8 + rng() * 0.4), k);
        inst.setMatrixAt(i, m.compose(p, q, sc));
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = false;
      inst.receiveShadow = false;
      this.group.add(inst);
      this.farGroups.push(inst);
    }
    void quality;
  }

  private buildWindbreak(quality: Quality) {
    const rng = makeRng(4242);
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 3.2, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x53483a, roughness: 1 });
    const canopyGeo = new THREE.IcosahedronGeometry(1.9, 1);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x445629, roughness: 1, flatShading: true });
    const N = 46;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, N);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const x = -64 + (i / N) * 150 + rng() * 3;
      const z = -58 - rng() * 6;
      const h = 0.85 + rng() * 0.5;
      p.set(x, 1.6 * h, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 3.14);
      sc.set(1, h, 1);
      trunks.setMatrixAt(i, m.compose(p, q, sc));
      p.set(x, 3.2 * h + 0.9, z);
      const cs = 0.9 + rng() * 0.5;
      sc.set(cs, cs * 0.86, cs);
      canopies.setMatrixAt(i, m.compose(p, q, sc));
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    this.group.add(trunks, canopies);

    // a second belt across the far end of the rows, so the vista closes
    const N2 = 34;
    const trunks2 = new THREE.InstancedMesh(trunkGeo, trunkMat, N2);
    const canopies2 = new THREE.InstancedMesh(canopyGeo, canopyMat, N2);
    for (let i = 0; i < N2; i++) {
      const z = -62 + (i / N2) * 96 + rng() * 3;
      const x = 96 + rng() * 8;
      const h = 0.8 + rng() * 0.5;
      p.set(x, 1.6 * h, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 3.14);
      sc.set(1, h, 1);
      trunks2.setMatrixAt(i, m.compose(p, q, sc));
      p.set(x, 3.2 * h + 0.9, z);
      const cs2 = 0.9 + rng() * 0.5;
      sc.set(cs2, cs2 * 0.86, cs2);
      canopies2.setMatrixAt(i, m.compose(p, q, sc));
    }
    trunks2.instanceMatrix.needsUpdate = true;
    canopies2.instanceMatrix.needsUpdate = true;
    this.group.add(trunks2, canopies2);

    const extra = new THREE.InstancedMesh(canopyGeo, canopyMat, N2);
    for (let i = 0; i < N2; i++) {
      const z = -62 + (i / N2) * 96 + rng() * 3;
      const h = 0.8 + rng() * 0.5;
      p.set(96 + rng() * 8 + (rng() - 0.5) * 3, 3.2 * h + 1.7 + rng(), z + (rng() - 0.5) * 3);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 3.14);
      const cs3 = 0.6 + rng() * 0.5;
      sc.set(cs3, cs3 * 0.8, cs3);
      extra.setMatrixAt(i, m.compose(p, q, sc));
    }
    extra.instanceMatrix.needsUpdate = true;
    this.group.add(extra);

    // hazy tree line even further out, flat cards, no shadow work
    const hillGeo = new THREE.PlaneGeometry(300, 26, 40, 1);
    const hp = hillGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i);
      if (hp.getY(i) > 0) hp.setY(i, 6 + Math.sin(x * 0.06) * 3 + Math.cos(x * 0.021) * 4);
    }
    hillGeo.computeVertexNormals();
    const hills = new THREE.Mesh(
      hillGeo,
      new THREE.MeshBasicMaterial({ color: 0xa8b0a2, fog: true, transparent: true, opacity: 0.85 })
    );
    hills.position.set(0, 0, -120);
    this.group.add(hills);
    void quality;
  }

  /** The farm track along the headland, with wheel ruts. */
  private buildTrack() {
    const geo = new THREE.PlaneGeometry(160, 3.6, 1, 1);
    const tex = soilAlbedo().clone();
    tex.repeat.set(30, 1);
    tex.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xc4ae86, roughness: 1 });
    const road = new THREE.Mesh(geo, mat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, 14.5);
    road.receiveShadow = true;
    this.group.add(road);
    const rutMat = new THREE.MeshStandardMaterial({ color: 0x8b7551, roughness: 1 });
    for (const dz of [-0.75, 0.75]) {
      const rut = new THREE.Mesh(new THREE.PlaneGeometry(160, 0.42), rutMat);
      rut.rotation.x = -Math.PI / 2;
      rut.position.set(0, 0.02, 14.5 + dz);
      this.group.add(rut);
    }
  }

  /** Keep the shadow frustum tight around whatever is being worked on. */
  focusShadow(target: THREE.Vector3) {
    this.sun.target.position.copy(target);
    this.sun.position.set(target.x - 13, target.y + 11, target.z + 15);
    this.sun.target.updateMatrixWorld();
  }
}
