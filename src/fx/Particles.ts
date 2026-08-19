import * as THREE from 'three';

/**
 * A pooled point sprite system.  Used twice: for the spray of chaff and
 * leaf ends that bursts off the header, and for the dry dust the wheels
 * and the falling bale kick out of the paddy.
 */
export class Particles {
  readonly points: THREE.Points;
  private geo = new THREE.BufferGeometry();
  private mat: THREE.ShaderMaterial;

  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private spin: Float32Array;
  private rot: Float32Array;
  private cursor = 0;
  private readonly max: number;
  private live = 0;

  constructor(
    scene: THREE.Scene,
    map: THREE.Texture,
    max: number,
    private gravity = -6.5,
    private drag = 1.4
  ) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.rot = new Float32Array(max);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -1000;

    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1));
    this.geo.setDrawRange(0, 0);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uScale: { value: 500 },
        uFog: { value: new THREE.Color(0xb9c3c6) },
        uFogNear: { value: 46 },
        uFogFar: { value: 300 },
      },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        attribute float aRot;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vRot;
        varying float vDepth;
        uniform float uScale;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vRot = aRot;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(0.001, -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vRot;
        varying float vDepth;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float s = sin(vRot), c = cos(vRot);
          uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c) + 0.5;
          vec4 t = texture2D(uMap, uv);
          float a = t.a * vAlpha;
          if (a < 0.01) discard;
          vec3 col = t.rgb * vColor;
          float f = smoothstep(uFogNear, uFogFar, vDepth);
          col = mix(col, uFog, f);
          gl_FragColor = vec4(col, a);
        }`,
    });

    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }

  emit(
    x: number, y: number, z: number,
    vx: number, vy: number, vz: number,
    size: number, life: number,
    r: number, g: number, b: number,
    spin = 0
  ) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    if (i + 1 > this.live) this.live = i + 1;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r;
    this.col[i * 3 + 1] = g;
    this.col[i * 3 + 2] = b;
    this.size[i] = size;
    this.alpha[i] = 1;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.spin[i] = spin;
    this.rot[i] = Math.random() * 6.28;
  }

  update(dt: number) {
    const n = this.live;
    if (n === 0) return;
    const dragK = Math.exp(-this.drag * dt);
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        this.pos[i * 3 + 1] = -1000;
        continue;
      }
      this.vel[i * 3] *= dragK;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dragK + this.gravity * dt;
      this.vel[i * 3 + 2] *= dragK;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02) {
        this.pos[i * 3 + 1] = 0.02;
        this.vel[i * 3 + 1] *= -0.15;
        this.vel[i * 3] *= 0.6;
        this.vel[i * 3 + 2] *= 0.6;
      }
      this.rot[i] += this.spin[i] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = t > 0.7 ? (1 - t) / 0.3 : t / 0.7;
    }
    this.geo.setDrawRange(0, n);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aRot as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }

  setPixelScale(heightPx: number) {
    this.mat.uniforms.uScale.value = heightPx * 0.9;
  }
}
