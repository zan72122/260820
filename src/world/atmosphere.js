// 朝の湿った空気、木漏れ日、ほこり。奥行きの読み取りやすさはここで決まる。
import * as THREE from 'three';
import { shaftTexture, radialTexture } from './textures.js';

export const SUN_DIR = new THREE.Vector3(-0.42, 0.78, 0.46).normalize();
export const FOG_COLOR = new THREE.Color(0xadbcab);

export function setupLighting(scene, { fast = false } = {}) {
  scene.fog = new THREE.FogExp2(FOG_COLOR.getHex(), 0.031);
  scene.background = FOG_COLOR.clone();

  const hemi = new THREE.HemisphereLight(0xd2e0cd, 0x342a1e, 1.0);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d2, 2.15);
  sun.position.copy(SUN_DIR).multiplyScalar(26);
  sun.castShadow = !fast;
  if (!fast) {
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 6;
    sun.shadow.camera.far = 46;
    const S = 9;
    sun.shadow.camera.left = -S;
    sun.shadow.camera.right = S;
    sun.shadow.camera.top = S;
    sun.shadow.camera.bottom = -S;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.035;
    // 竹の影が地面を塗りつぶさないように、影そのものを薄くする。
    // 木漏れ日のまだらとして読める濃さがちょうどよい。
    if ('intensity' in sun.shadow) sun.shadow.intensity = 0.5;
  }
  scene.add(sun);
  scene.add(sun.target);

  // 竹林の反射光(下からの弱い緑)
  const fill = new THREE.DirectionalLight(0xa9c48f, 0.35);
  fill.position.set(6, 3, -9);
  scene.add(fill);

  return { hemi, sun, fill };
}

export function createSky() {
  const geo = new THREE.SphereGeometry(120, 16, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0xd4e0cd) },
      bottom: { value: new THREE.Color(0x9dad9b) },
    },
    vertexShader: `varying float vY;
      void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying float vY; uniform vec3 top; uniform vec3 bottom;
      void main(){ float t = smoothstep(-0.15, 0.55, vY); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'sky';
  sky.frustumCulled = false;
  return sky;
}

export class Atmosphere {
  constructor(rng, { fast = false } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'atmosphere';
    this.fast = fast;
    this.shafts = [];
    this.time = 0;

    if (!fast) {
      // 木漏れ日: 太陽方向に沿った半透明の板。毎フレーム軸まわりにカメラへ向ける
      // 地面と交差すると硬い線が出るので、光の筋は空中で終わらせる
      const geo = new THREE.PlaneGeometry(2.2, 9);
      geo.translate(0, -4.5, 0); // 上端を原点に
      const mat = new THREE.MeshBasicMaterial({
        map: shaftTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.5,
        fog: false,
        side: THREE.DoubleSide,
      });
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(geo, mat.clone());
        const a = rng.range(0, Math.PI * 2);
        const r = rng.range(3, 14);
        m.position.set(Math.cos(a) * r, rng.range(11.5, 14.5), Math.sin(a) * r - 2);
        m.scale.set(rng.range(0.7, 1.9), rng.range(0.85, 1.1), 1);
        m.material.opacity = rng.range(0.16, 0.34);
        m.renderOrder = 6;
        m.userData.phase = rng.range(0, 6.28);
        m.userData.baseOpacity = m.material.opacity;
        this.shafts.push(m);
        this.group.add(m);
      }

      // ほこり / 花粉
      const count = 260;
      const pos = new Float32Array(count * 3);
      this.dustSeed = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const a = rng.range(0, Math.PI * 2);
        const r = rng.range(0.5, 11);
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = rng.range(0.15, 4.2);
        pos[i * 3 + 2] = Math.sin(a) * r - 2;
        this.dustSeed[i * 3] = rng.range(0, 6.28);
        this.dustSeed[i * 3 + 1] = rng.range(0.05, 0.22);
        this.dustSeed[i * 3 + 2] = rng.range(0.3, 1.1);
      }
      const dgeo = new THREE.BufferGeometry();
      dgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const dmat = new THREE.PointsMaterial({
        size: 0.035,
        map: radialTexture('rgba(255,252,230,1)', 'rgba(255,250,210,0)', 1.4),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.75,
        sizeAttenuation: true,
        fog: false,
      });
      this.dust = new THREE.Points(dgeo, dmat);
      this.dust.frustumCulled = false;
      this.group.add(this.dust);
      this.dustBase = pos.slice();
    }
  }

  update(dt, camera) {
    this.time += dt;
    for (const s of this.shafts) {
      // 軸(太陽方向)まわりにカメラへ向ける
      const toCam = camera.position.clone().sub(s.position);
      const up = SUN_DIR;
      const right = new THREE.Vector3().crossVectors(up, toCam).normalize();
      const fwd = new THREE.Vector3().crossVectors(right, up).normalize();
      const m = new THREE.Matrix4().makeBasis(right, up, fwd);
      s.quaternion.setFromRotationMatrix(m);
      s.material.opacity =
        s.userData.baseOpacity * (0.72 + 0.28 * Math.sin(this.time * 0.35 + s.userData.phase));
    }
    if (this.dust) {
      const p = this.dust.geometry.attributes.position;
      const arr = p.array;
      for (let i = 0; i < arr.length / 3; i++) {
        const ph = this.dustSeed[i * 3];
        const spd = this.dustSeed[i * 3 + 1];
        const amp = this.dustSeed[i * 3 + 2];
        arr[i * 3] = this.dustBase[i * 3] + Math.sin(this.time * spd + ph) * amp * 0.35;
        arr[i * 3 + 1] =
          this.dustBase[i * 3 + 1] + Math.sin(this.time * spd * 0.7 + ph * 1.7) * amp * 0.22;
        arr[i * 3 + 2] =
          this.dustBase[i * 3 + 2] + Math.cos(this.time * spd * 0.8 + ph) * amp * 0.35;
      }
      p.needsUpdate = true;
    }
  }
}
