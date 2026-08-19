/* Winter sky dome, low sun, layered mountains and a far shoreline of trees.
   All real geometry in a perspective scene, so it parallaxes correctly. */
import * as THREE from 'three';
import { fbm } from './textures.js';

export const SKY = {
  zenith:  new THREE.Color(0x2e6ea8),
  mid:     new THREE.Color(0x9dc6de),
  horizon: new THREE.Color(0xe8dcc9),
  ground:  new THREE.Color(0xcddced),
  sunDir:  new THREE.Vector3(-0.52, 0.42, -0.75).normalize(),    // low winter sun
  sunCol:  new THREE.Color(0xfff0d2),
  fog:     new THREE.Color(0xc7d9e6),
};

export function createSky() {
  const geo = new THREE.SphereGeometry(900, 40, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uZenith: { value: SKY.zenith }, uMid: { value: SKY.mid },
      uHorizon: { value: SKY.horizon }, uGround: { value: SKY.ground },
      uSunDir: { value: SKY.sunDir.clone() }, uSunCol: { value: SKY.sunCol },
      uUnder: { value: 0 }, uDeep: { value: new THREE.Color(0x06283f) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      precision mediump float;
      varying vec3 vDir;
      uniform vec3 uZenith, uMid, uHorizon, uGround, uSunDir, uSunCol, uDeep;
      uniform float uUnder;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col;
        if (h >= 0.0){
          float t = pow(clamp(h, 0.0, 1.0), 0.62);
          col = mix(uHorizon, uMid, smoothstep(0.0, 0.34, t));
          col = mix(col, uZenith, smoothstep(0.26, 1.0, t));
        } else {
          col = mix(uHorizon, uGround, smoothstep(0.0, 0.22, -h));
        }
        // low sun: tight disc, wide warm bloom, and a long horizon glow
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunCol * pow(sd, 2600.0) * 9.0;
        col += uSunCol * pow(sd, 60.0)   * 0.55;
        col += uSunCol * pow(sd, 10.0)   * 0.20;
        col += uSunCol * pow(sd, 2.6)    * 0.05;
        // thin high cirrus so the sky is not a flat gradient
        float band = sin(d.y * 26.0 + d.x * 3.4) * 0.5 + 0.5;
        col += vec3(0.045) * band * smoothstep(0.04, 0.5, h) * (1.0 - smoothstep(0.55, 1.0, h));
        col = mix(col, uDeep, uUnder);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -1000;
  m.frustumCulled = false;
  return m;
}

/* ---- mountain range: jagged silhouettes at two distances ------------- */
const HAZE = new THREE.Color(0xdfe7ee);

function mountainLayer({ radius, height, jag, seed, near, far, base }) {
  const N = 320;
  const pos = [], col = [];
  const cTop = new THREE.Color(0xffffff).lerp(near, 0.12);
  const hz = far;
  const heights = [];
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2;
    const x = Math.cos(a) * 4.2, z = Math.sin(a) * 4.2;
    let h = (fbm(x * jag + seed, z * jag + seed, 64, 5, seed) - 0.27) * 3.3;
    h += (fbm(x * jag * 3.4 + 9, z * jag * 3.4 + 9, 64, 3, seed + 3) - 0.5) * 0.8;
    heights.push(Math.min(1.35, Math.max(0.08, h)) * height);
  }
  const snowLine = height * 0.34;
  for (let i = 0; i < N; i++) {
    const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2;
    const x0 = Math.cos(a0) * radius, z0 = Math.sin(a0) * radius;
    const x1 = Math.cos(a1) * radius, z1 = Math.sin(a1) * radius;
    const h0 = heights[i], h1 = heights[i + 1];
    // two triangles making a quad from base to ridge
    const quad = [
      [x0, base, z0, 0], [x1, base, z1, 0], [x0, base + h0, z0, h0],
      [x1, base, z1, 0], [x1, base + h1, z1, h1], [x0, base + h0, z0, h0],
    ];
    for (const [x, y, z, hh] of quad) {
      pos.push(x, y, z);
      const t = Math.min(1, Math.max(0, (hh - snowLine * 0.55) / (height * 0.62)));
      const c = hz.clone().lerp(cTop, Math.pow(t, 0.85));
      // aerial perspective: the lower a point is, the more air is in front of it
      c.lerp(HAZE, 0.55 * (1 - Math.min(1, (y - base) / (height * 0.8))));
      // slight facing variation so ridges read as 3D volume
      const shade = 0.84 + 0.16 * Math.cos(a0 * 7.0 + hh * 0.08);
      col.push(c.r * shade, c.g * shade, c.b * shade);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, fog: false, depthWrite: true,
  }));
  m.frustumCulled = false;
  return m;
}

export function createMountains() {
  const grp = new THREE.Group();
  // far range: pale, hazy, tall
  // three ranges, each nearer one a little lower and a little bluer:
  // that difference is the whole depth cue at this distance
  grp.add(mountainLayer({
    radius: 1150, height: 250, jag: 1.05, seed: 7, base: -10,
    near: new THREE.Color(0xf6fafd), far: new THREE.Color(0xcfdeeb),
  }));
  // mid range: a touch darker and lower — gives the horizon real depth
  const mid = mountainLayer({
    radius: 560, height: 152, jag: 2.15, seed: 23, base: -6,
    near: new THREE.Color(0xe4eef6), far: new THREE.Color(0x8fabc4),
  });
  grp.add(mountainLayer({
    radius: 430, height: 78, jag: 3.6, seed: 51, base: -5,
    near: new THREE.Color(0xcfdeea), far: new THREE.Color(0x7d9ab4),
  }));
  grp.add(mid);
  grp.children.forEach((c, i) => { c.renderOrder = -900 + i; });
  return grp;
}

/* ---- shoreline: a dark band of snow-loaded conifers ------------------ */
export function createShoreline() {
  const N = 560, radius = 330;
  const pos = [], col = [];
  const dark = new THREE.Color(0x3a5568), pale = new THREE.Color(0x9db5c9);
  for (let i = 0; i < N; i++) {
    const a0 = i / N * Math.PI * 2, a1 = (i + 1.35) / N * Math.PI * 2;
    const r0 = radius * (0.96 + fbm(i * 0.09, 3, 64, 3, 41) * 0.08);
    const h = 3 + Math.pow(fbm(i * 0.63, 7, 64, 4, 17), 1.6) * 14;
    const am = (a0 + a1) / 2;
    const x0 = Math.cos(a0) * r0, z0 = Math.sin(a0) * r0;
    const x1 = Math.cos(a1) * r0, z1 = Math.sin(a1) * r0;
    // a spike per cluster of conifers, plus the low band they stand on
    const tri = [
      [x0, -1, z0, 0], [x1, -1, z1, 0], [Math.cos(am) * r0, h, Math.sin(am) * r0, 1],
    ];
    for (const [x, y, z, t] of tri) {
      pos.push(x, y, z);
      const c = dark.clone().lerp(pale, t * 0.45 + fbm(i * 0.8, t * 3, 64, 2, 5) * 0.4);
      col.push(c.r, c.g, c.b);
    }
    const band = [
      [x0, -1, z0, 0], [x1, -1, z1, 0], [x0, 3.2, z0, 0.5],
      [x1, -1, z1, 0], [x1, 3.2, z1, 0.5], [x0, 3.2, z0, 0.5],
    ];
    for (const [x, y, z, t] of band) {
      pos.push(x, y, z);
      const c = dark.clone().lerp(pale, t * 0.5 + 0.2);
      col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, fog: true,
  }));
  m.frustumCulled = false;
  m.renderOrder = -880;
  return m;
}
