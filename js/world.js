/* The frozen lake: snow field with a real hole through the ice slab,
   the bore wall, the black water, and the world seen from underneath. */
import * as THREE from 'three';
import { SKY } from './sky.js';
import {
  snowTexture, snowNormalTexture, iceTexture, waterNormalTexture,
  fbm, softDot, flakeSprite, crackTexture,
} from './textures.js';

export const HOLE_R = 0.15;        // 30 cm auger — real gear, generous to read
export const ICE_T = 0.20;         // ice thickness in metres
export const WATER_Y = -0.028;     // ice floats: the water comes up near the top
export const LAKE_DEPTH = -4.6;

/* =====================================================================
   Snow surface — a polar grid so the hole is a genuine hole in the mesh
   and the tessellation is dense where the player is looking.
   ===================================================================== */
export function createIceSurface() {
  const RINGS = 100, SEGS = 96, R0 = HOLE_R, R1 = 300;
  const pos = [], uv = [], col = [], idx = [], nrm = [];
  const c = new THREE.Color();
  const heightAt = (x, z) => {
    const d = Math.hypot(x, z);
    // wind-packed sastrugi, flattening out toward the horizon
    let h = (fbm(x * 0.55 + 100, z * 0.16 + 100, 512, 4, 3) - 0.5) * 0.052;
    h += (fbm(x * 2.6 + 5, z * 2.6 + 5, 512, 3, 9) - 0.5) * 0.014;
    h += (fbm(x * 0.06, z * 0.06, 512, 3, 31) - 0.5) * 0.5 * Math.min(1, d / 40);
    // the ice is scraped bare right at the rim of the hole
    h *= THREE.MathUtils.smoothstep(d, R0, R0 + 0.5);
    return h;
  };
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;
    const r = R0 * Math.pow(R1 / R0, t);
    for (let j = 0; j <= SEGS; j++) {
      const a = j / SEGS * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = heightAt(x, z);
      pos.push(x, y, z);
      nrm.push(0, 1, 0);
      uv.push(x / 2.4, z / 2.4);
      // subtle blue shading in the hollows + a cold ring of shade at the hole
      const shade = 0.93 + (fbm(x * 0.5 + 60, z * 0.5 + 60, 512, 3, 77) - 0.5) * 0.16;
      const nearHole = 1 - THREE.MathUtils.smoothstep(r, R0, R0 + 0.22);
      c.setRGB(shade, shade * 0.995, shade * 1.005).lerp(new THREE.Color(0x9fc0d8), nearHole * 0.45);
      col.push(c.r, c.g, c.b);
    }
  }
  const stride = SEGS + 1;
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGS; j++) {
      const a = i * stride + j, b = a + 1, d = a + stride, e = d + 1;
      idx.push(a, b, d, b, e, d);   // wound to face up
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();

  const map = snowTexture(512);
  const nmap = snowNormalTexture(512);
  const mat = new THREE.MeshStandardMaterial({
    map, normalMap: nmap, normalScale: new THREE.Vector2(0.7, 0.7),
    vertexColors: true, roughness: 0.93, metalness: 0.0,
    color: 0xf3f8fc,
  });
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  m.name = 'snow';
  return m;
}

/* =====================================================================
   The ice slab around the hole: bore wall + underside
   ===================================================================== */
export function createBore() {
  const grp = new THREE.Group();
  const tex = iceTexture(512);
  tex.repeat.set(3, 1);
  const wallMat = new THREE.MeshStandardMaterial({
    map: tex, color: 0xffffff, roughness: 0.62, metalness: 0.0,
    side: THREE.DoubleSide, vertexColors: true,
  });
  // slightly conical: augers cut a touch wider at the top
  const wallGeo = new THREE.CylinderGeometry(HOLE_R * 1.04, HOLE_R * 0.98, ICE_T + 0.02, 64, 8, true);
  {
    const pos = wallGeo.attributes.position, col = [];
    const top = new THREE.Color(0x89a7ba), bot = new THREE.Color(0x2f4f63), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const k = THREE.MathUtils.clamp(pos.getY(i) / (ICE_T + 0.02) + 0.5, 0, 1);
      c.copy(bot).lerp(top, Math.pow(k, 1.5));
      col.push(c.r, c.g, c.b);
    }
    wallGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.y = -ICE_T / 2 + 0.005;
  grp.add(wall);

  // chewed, shaved lip where the blades came through the surface
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(HOLE_R * 1.03, 0.0065, 6, 56),
    new THREE.MeshStandardMaterial({ color: 0xdae9f3, roughness: 0.85, metalness: 0 }));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.003;
  grp.add(lip);

  // the underside of the ice, lit only by the hole above it
  const RINGS = 26, SEGS = 64, R1 = 46;
  const pos = [], col = [], idx = [];
  const c = new THREE.Color();
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;
    const r = HOLE_R * Math.pow(R1 / HOLE_R, t);
    for (let j = 0; j <= SEGS; j++) {
      const a = j / SEGS * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      // displace from world position, never from the angle: an angle wraps at
      // 2*PI and leaves a seam that reads as a crack across the whole ceiling
      pos.push(x, -ICE_T + (fbm(x * 1.6 + 11, z * 1.6 + 11, 256, 3, 5) - 0.5) * 0.022, z);
      // the world under the ice is dark; only the rim of the hole is lit
      let k = Math.pow(THREE.MathUtils.clamp(1 - (r - HOLE_R) / 0.40, 0, 1), 1.5);
      // patchy snow cover on top of the ice lets light through unevenly
      k *= 0.55 + 0.75 * fbm(x * 2.6 + 30, z * 2.6 + 30, 256, 3, 19);
      const mott = 0.78 + 0.44 * fbm(x * 1.1 + 70, z * 1.1 + 70, 256, 3, 23);
      c.setRGB(0.020 * mott, 0.052 * mott, 0.082 * mott)
        .lerp(new THREE.Color(0xc6e9ff), Math.min(0.95, k));
      col.push(c.r, c.g, c.b);
    }
  }
  const stride = SEGS + 1;
  for (let i = 0; i < RINGS; i++)
    for (let j = 0; j < SEGS; j++) {
      const a = i * stride + j, b = a + 1, d = a + stride, e = d + 1;
      idx.push(a, b, d, b, e, d);   // wound to face downward
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const under = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, fog: true,
  }));
  under.name = 'underIce';
  grp.add(under);
  return grp;
}

/* =====================================================================
   Black water in the hole, seen from above.  This surface is the payoff
   of the whole drilling sequence, so it gets its own shader: near-black
   depth, a fresnel sheen of sky, and slow ripples.
   ===================================================================== */
export function createWaterTop() {
  const nrm = waterNormalTexture(256);
  nrm.repeat.set(2, 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 }, uNormal: { value: nrm },
      uSky: { value: new THREE.Color(0xbdd8ea) },
      uSun: { value: SKY.sunDir.clone() },
      uSunCol: { value: new THREE.Color(0xfff3dd) },
      uDeep: { value: new THREE.Color(0x02060a) },
      uShallow: { value: new THREE.Color(0x061520) },
      uRipple: { value: 0 },     // kicked up when something breaks the surface
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vW;
      void main(){
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      precision mediump float;
      varying vec2 vUv; varying vec3 vW;
      uniform float uTime, uRipple, uOpacity;
      uniform sampler2D uNormal;
      uniform vec3 uSky, uSun, uSunCol, uDeep, uShallow;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float rr = length(p);
        if (rr > 1.0) discard;
        vec2 uv1 = vUv * 3.0 + vec2( uTime * 0.026, uTime * 0.017);
        vec2 uv2 = vUv * 5.4 + vec2(-uTime * 0.021, uTime * 0.031);
        vec3 n1 = texture2D(uNormal, uv1).rgb * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormal, uv2).rgb * 2.0 - 1.0;
        // rings racing outward after something breaks the surface
        float ring = sin(rr * 20.0 - uTime * 6.0) * uRipple * 0.30;
        vec2 slope = n1.xy * 0.30 + n2.xy * 0.22 + p * ring;
        vec3 N = normalize(vec3(slope.x, 1.0, slope.y));
        vec3 V = normalize(cameraPosition - vW);
        float cosT = clamp(dot(V, N), 0.0, 1.0);
        // Schlick, water F0 = 0.02 — at these angles the hole stays black
        float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
        vec3 col = mix(uDeep, uShallow, smoothstep(0.72, 1.0, rr));
        col = mix(col, uSky, clamp(F * 1.1, 0.0, 0.40));
        // a few hard glints where a ripple happens to face the low sun
        vec3 H = normalize(normalize(uSun) + V);
        col += uSunCol * pow(max(dot(N, H), 0.0), 420.0) * 1.6;
        col += uSky * 0.12 * smoothstep(0.93, 1.0, rr);   // slushy bright rim
        gl_FragColor = vec4(col, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(HOLE_R * 1.0, 64), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = WATER_Y;
  m.name = 'waterTop';
  return m;
}

/* The same surface from below — a bright window onto the sky. */
export function createSkyWindow() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(0xe4f3ff) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      precision mediump float; varying vec2 vUv; uniform vec3 uCol; uniform float uTime;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p);
        if (r > 1.0) discard;
        float wob = 0.045 * sin(p.x * 21.0 + uTime * 1.9) * sin(p.y * 17.0 - uTime * 1.5);
        float a = smoothstep(1.0, 0.72, r + wob);
        vec3 c = uCol * (1.25 - 0.35 * r);
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(HOLE_R * 1.02, 64), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = WATER_Y - 0.002;
  m.renderOrder = 3;
  return m;
}

/* Shaft of daylight pouring down through the hole. */
export function createLightShaft() {
  const h = 4.4;
  const geo = new THREE.CylinderGeometry(HOLE_R * 0.95, HOLE_R * 5.0, h, 40, 1, true);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(0x9fd0f2) }, uStr: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN;
      void main(){ vUv = uv; vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      precision mediump float; varying vec2 vUv; varying vec3 vN;
      uniform vec3 uCol; uniform float uTime, uStr;
      void main(){
        float fade = pow(1.0 - vUv.y, 1.7);              // brightest at the ice
        float edge = pow(sin(vUv.x * 3.14159), 0.6);
        float shimmer = 0.82 + 0.18 * sin(vUv.x * 26.0 + uTime * 0.9)
                                   * sin(vUv.y * 9.0 - uTime * 0.6);
        gl_FragColor = vec4(uCol * fade * shimmer * uStr * 0.85, fade * edge * 0.95 * uStr);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = WATER_Y - h / 2;
  m.renderOrder = 2;
  return m;
}

/* =====================================================================
   The plug of ice the auger cuts out, and the cut it leaves behind
   ===================================================================== */
export function createPlug() {
  const grp = new THREE.Group();
  const snow = snowTexture(256);
  snow.repeat.set(0.35, 0.35);
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(HOLE_R * 1.0, HOLE_R * 0.92, ICE_T, 48, 1, false),
    [
      new THREE.MeshStandardMaterial({ map: iceTexture(256), color: 0xbcd9ea, roughness: 0.45 }),
      new THREE.MeshStandardMaterial({ map: snow, color: 0xe4eef5, roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: 0x8ab6cf, roughness: 0.4 }),
    ]);
  top.position.y = -ICE_T / 2 + 0.001;
  top.castShadow = true;
  grp.add(top);

  // the circular scar the blade grinds around the plug
  const scar = new THREE.Mesh(
    new THREE.RingGeometry(HOLE_R * 0.9, HOLE_R * 1.06, 64),
    new THREE.MeshStandardMaterial({
      color: 0x7fa8c2, roughness: 0.35, metalness: 0,
      transparent: true, opacity: 0, side: THREE.DoubleSide,
    }));
  scar.rotation.x = -Math.PI / 2;
  scar.position.y = 0.004;
  grp.add(scar);

  // cracks that spread across the plug as it is about to let go
  const cracks = new THREE.Mesh(
    new THREE.CircleGeometry(HOLE_R * 0.99, 48),
    new THREE.MeshBasicMaterial({
      map: crackTexture(512), transparent: true, opacity: 0,
      depthWrite: false, color: 0x8fc0da,
    }));
  cracks.rotation.x = -Math.PI / 2;
  cracks.position.y = 0.006;
  grp.add(cracks);

  grp.userData = { top, scar, cracks };
  return grp;
}

/* Bare, scraped ice ring exposed around the hole while drilling. */
export function createApron() {
  const t = iceTexture(256);
  t.repeat.set(2, 2);
  const geo = new THREE.RingGeometry(HOLE_R * 1.0, HOLE_R * 2.1, 64, 4);
  // fade the outer edge away so it blends into the snow instead of ending
  const col = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    const k = 1 - THREE.MathUtils.smoothstep(r, HOLE_R * 1.25, HOLE_R * 2.1);
    col.push(1, 1, 1, k);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  const m = new THREE.Mesh(geo,
    new THREE.MeshStandardMaterial({
      map: t, color: 0xdeeaf2, roughness: 0.72, metalness: 0,
      transparent: true, opacity: 0, vertexColors: true,
    }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  m.receiveShadow = true;
  return m;
}

/* =====================================================================
   Ice shavings thrown out by the auger, and the slush left floating
   ===================================================================== */
export function createShavings(count = 90) {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf4fbff, roughness: 0.95, metalness: 0, flatShading: true,
  });
  const inst = new THREE.InstancedMesh(g, mat, count);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.castShadow = true;
  inst.count = 0;
  inst.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const data = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = HOLE_R * 1.12 + Math.random() * HOLE_R * 1.15;
    const s = 0.0022 + Math.random() * 0.0048;
    data.push({
      a, r, s, x: Math.cos(a) * r, z: Math.sin(a) * r,
      rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      sy: 0.4 + Math.random() * 0.5,
    });
  }
  inst.userData = { data, dummy };
  return inst;
}

/* Slush floating in the newly opened hole — the child scoops this out. */
export function createSlush(count = 20) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe6f4ff, roughness: 0.35, metalness: 0,
    transparent: true, opacity: 0.94, flatShading: true,
    emissive: 0x2c556e, emissiveIntensity: 0.3,
  });
  for (let i = 0; i < count; i++) {
    const s = 0.0095 + Math.random() * 0.0125;
    const geo = new THREE.IcosahedronGeometry(s, 0);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, p.getY(k) * 0.42);   // flat floes
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * HOLE_R * 0.78;
    m.position.set(Math.cos(a) * r, WATER_Y + 0.004, Math.sin(a) * r);
    m.rotation.y = Math.random() * 6;
    m.userData = {
      home: m.position.clone(), phase: Math.random() * 6,
      drift: (Math.random() - 0.5) * 0.25, alive: true,
    };
    grp.add(m);
  }
  return grp;
}

/* =====================================================================
   Particles
   ===================================================================== */
function pointsMaterial(tex, size, color, opacity, extra = {}) {
  return new THREE.PointsMaterial({
    map: tex, size, color, transparent: true, opacity,
    depthWrite: false, sizeAttenuation: true,
    blending: THREE.NormalBlending, ...extra,
  });
}

export function createSnowfall(count = 900) {
  const pos = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 26;
    pos[i * 3 + 1] = Math.random() * 9;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 26;
    vel.push({ y: 0.14 + Math.random() * 0.3, ph: Math.random() * 6, sp: 0.4 + Math.random() });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, pointsMaterial(flakeSprite(64), 0.021, 0xffffff, 0.78));
  p.userData = { vel };
  p.frustumCulled = false;
  p.renderOrder = 8;
  return p;
}

export function createPlankton(count = 460) {
  const pos = new Float32Array(count * 3);
  const ph = [];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 6.5;
    pos[i * 3 + 1] = WATER_Y - 0.15 - Math.random() * 4.2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 6.5;
    ph.push({ a: Math.random() * 6, b: Math.random() * 6, s: 0.3 + Math.random() * 0.8 });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, pointsMaterial(softDot(32), 0.019, 0xd8f0ff, 0.5,
    { blending: THREE.AdditiveBlending }));
  p.userData = { ph };
  p.frustumCulled = false;
  p.renderOrder = 6;
  return p;
}

/* The lake floor, only just visible in the gloom. */
export function createLakeBed() {
  const g = new THREE.PlaneGeometry(80, 80, 40, 40);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, (fbm(x * 0.13 + 3, y * 0.13 + 3, 128, 4, 61) - 0.5) * 1.5);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    color: 0x0c2231, roughness: 1, metalness: 0,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = LAKE_DEPTH;
  return m;
}

/* Breath in the cold air — a few soft puffs near the camera. */
export class Breath {
  constructor(scene) {
    this.pool = [];
    const tex = softDot(64);
    for (let i = 0; i < 22; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: 0xffffff, transparent: true, opacity: 0,
        depthWrite: false, fog: false,
      }));
      s.renderOrder = 20;
      s.visible = false;
      scene.add(s);
      this.pool.push({ s, life: 0, ttl: 1, vel: new THREE.Vector3(), gr: 1 });
    }
    this.i = 0;
    this.timer = 2.2;
  }
  puff(origin, dir) {
    for (let k = 0; k < 7; k++) {
      const p = this.pool[this.i++ % this.pool.length];
      p.s.visible = true;
      p.life = 0; p.ttl = 1.5 + Math.random() * 1.1;
      p.gr = 0.05 + Math.random() * 0.05;
      p.s.position.copy(origin).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05));
      p.vel.copy(dir).multiplyScalar(0.22 + Math.random() * 0.2)
        .add(new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.1 + Math.random() * 0.09, (Math.random() - 0.5) * 0.1));
      p.s.scale.setScalar(0.035);
    }
  }
  update(dt, camera, active) {
    if (active) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 3.4 + Math.random() * 2.4;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const o = camera.position.clone().add(dir.clone().multiplyScalar(0.42))
          .add(new THREE.Vector3(0, -0.1, 0));
        this.puff(o, dir);
      }
    }
    for (const p of this.pool) {
      if (!p.s.visible) continue;
      p.life += dt;
      const t = p.life / p.ttl;
      if (t >= 1) { p.s.visible = false; continue; }
      p.s.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - 1.1 * dt);
      p.vel.y += 0.16 * dt;
      p.s.scale.setScalar(0.035 + p.gr * t * 5.5);
      p.s.material.opacity = 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.05)) * (1 - t * 0.3);
    }
  }
}
