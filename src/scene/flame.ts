import * as THREE from 'three';
import { clamp, damp } from '../core/rng';
import { glowTexture } from './textures';

const CONE_VERT = /* glsl */ `
uniform float uTime;
uniform float uWobble;
uniform float uLen;
varying float vT;
varying vec3 vNrm;
varying vec3 vView;

void main() {
  vT = clamp( position.y / uLen, 0.0, 1.0 );
  vec3 p = position;
  float k = vT * vT;
  // Small, fast, always-on flicker: a torch flame is steady but never still.
  p.x += ( sin( uTime * 13.0 + vT * 8.0 ) * 0.6 + sin( uTime * 21.0 + vT * 15.0 ) * 0.4 ) * uWobble * k;
  p.z += ( cos( uTime * 11.0 + vT * 9.0 ) * 0.6 + cos( uTime * 19.0 + vT * 14.0 ) * 0.4 ) * uWobble * k;
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  vNrm = normalize( normalMatrix * normal );
  vView = normalize( -mv.xyz );
  gl_Position = projectionMatrix * mv;
}
`;

const CONE_FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uTip;
uniform float uIntensity;
uniform float uSoft;
varying float vT;
varying vec3 vNrm;
varying vec3 vView;

void main() {
  vec3 col = mix( uBase, uTip, smoothstep( 0.05, 0.85, vT ) );
  // brighter where the line of sight grazes the cone wall
  float edge = pow( 1.0 - abs( dot( normalize( vNrm ), normalize( vView ) ) ), 1.4 );
  float a = uIntensity * pow( 1.0 - vT, 0.75 ) * mix( 0.45, 1.0, edge );
  a *= smoothstep( 0.0, 0.10, vT );
  gl_FragColor = vec4( col * a * uSoft, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function cone(radius: number, len: number, seg: number): THREE.ConeGeometry {
  const g = new THREE.ConeGeometry(radius, len, seg, 6, true);
  g.translate(0, len / 2, 0);
  return g;
}

/**
 * A short kitchen-torch flame: a tight blue-white inner cone inside a thin
 * blue outer cone, plus a small local glow. No bonfire, no full-screen bloom,
 * no strobing — everything the flame lights, it lights locally.
 */
export class Flame {
  readonly group = new THREE.Group();
  /** local-space position of the flame tip — used for the heat falloff */
  readonly tipLocal: THREE.Vector3;

  private inner: THREE.Mesh<THREE.ConeGeometry, THREE.ShaderMaterial>;
  private outer: THREE.Mesh<THREE.ConeGeometry, THREE.ShaderMaterial>;
  private glow: THREE.Sprite;
  private sparks: THREE.Points | null = null;
  private sparkVel: Float32Array | null = null;
  private time = 0;
  private intensity = 0;
  private targetIntensity = 0;
  softLight = false;

  constructor(extras: boolean) {
    const outerLen = 0.62;
    const innerLen = 0.3;
    this.tipLocal = new THREE.Vector3(0, outerLen, 0);

    const mk = (
      radius: number,
      len: number,
      base: number,
      tip: number,
      wobble: number,
      soft: number,
    ) =>
      new THREE.Mesh(
        cone(radius, len, 14),
        new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uWobble: { value: wobble },
            uLen: { value: len },
            uBase: { value: new THREE.Color(base) },
            uTip: { value: new THREE.Color(tip) },
            uIntensity: { value: 0 },
            uSoft: { value: soft },
          },
          vertexShader: CONE_VERT,
          fragmentShader: CONE_FRAG,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );

    this.outer = mk(0.085, outerLen, 0x1c47a8, 0x5f9bff, 0.05, 0.55);
    this.inner = mk(0.038, innerLen, 0xbfe2ff, 0xf2f8ff, 0.022, 1.0);
    this.outer.renderOrder = 6;
    this.inner.renderOrder = 7;
    this.group.add(this.outer, this.inner);

    const glowMat = new THREE.SpriteMaterial({
      map: glowTexture(96, 0.7),
      color: 0x7fb6ff,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    });
    this.glow = new THREE.Sprite(glowMat);
    this.glow.scale.setScalar(0.6);
    this.glow.position.y = 0.16;
    this.glow.renderOrder = 5;
    this.group.add(this.glow);

    if (extras) {
      const n = 18;
      const pos = new Float32Array(n * 3);
      const vel = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3 + 1] = Math.random() * 0.4;
        vel[i * 3] = (Math.random() - 0.5) * 0.12;
        vel[i * 3 + 1] = 0.5 + Math.random() * 0.5;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.sparkVel = vel;
      this.sparks = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size: 0.022,
          color: 0xffd9a0,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true,
        }),
      );
      this.sparks.renderOrder = 6;
      this.group.add(this.sparks);
    }

    this.group.visible = false;
  }

  get lit(): boolean {
    return this.targetIntensity > 0.01;
  }

  get level(): number {
    return this.intensity;
  }

  setLit(on: boolean): void {
    this.targetIntensity = on ? 1 : 0;
  }

  update(dt: number): void {
    this.time += dt;
    this.intensity = damp(this.intensity, this.targetIntensity, 11, dt);
    if (this.intensity < 0.005 && this.targetIntensity === 0) {
      this.intensity = 0;
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    const soft = this.softLight ? 0.62 : 1;
    for (const m of [this.inner, this.outer]) {
      m.material.uniforms.uTime.value = this.time;
      m.material.uniforms.uIntensity.value = this.intensity;
    }
    // steady flame with a barely-there breath, never a strobe
    const breathe = 1 + Math.sin(this.time * 7.3) * 0.035 + Math.sin(this.time * 12.9) * 0.02;
    this.inner.scale.set(1, breathe, 1);
    this.outer.scale.set(1, breathe * 1.01, 1);
    (this.glow.material as THREE.SpriteMaterial).opacity = this.intensity * 0.5 * soft;
    this.glow.scale.setScalar(0.52 + 0.08 * breathe);

    if (this.sparks && this.sparkVel) {
      const attr = this.sparks.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < arr.length / 3; i++) {
        arr[i * 3] += this.sparkVel[i * 3] * dt;
        arr[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt;
        arr[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt;
        if (arr[i * 3 + 1] > 0.85) {
          arr[i * 3] = (Math.random() - 0.5) * 0.05;
          arr[i * 3 + 1] = 0.1;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
        }
      }
      attr.needsUpdate = true;
      (this.sparks.material as THREE.PointsMaterial).opacity = this.intensity * 0.28 * soft;
    }
  }

  dispose(): void {
    this.inner.geometry.dispose();
    this.outer.geometry.dispose();
    this.inner.material.dispose();
    this.outer.material.dispose();
    (this.glow.material as THREE.SpriteMaterial).map?.dispose();
    (this.glow.material as THREE.SpriteMaterial).dispose();
    this.sparks?.geometry.dispose();
    (this.sparks?.material as THREE.Material | undefined)?.dispose();
  }
}

const HAZE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying vec2 vUvH;

float n( vec2 p ) {
  return sin( p.x * 9.0 + uTime * 3.1 ) * sin( p.y * 11.0 - uTime * 4.3 );
}

void main() {
  vec2 c = vUvH - 0.5;
  float r = length( c );
  float mask = smoothstep( 0.5, 0.06, r );
  // barely-there ripple; the point is that the air is *moving*, not visible
  float w = 0.5 + 0.5 * n( vUvH * 2.0 + vec2( 0.0, -uTime * 0.6 ) );
  float a = uOpacity * mask * ( 0.35 + 0.65 * w );
  gl_FragColor = vec4( vec3( 1.0, 0.94, 0.86 ) * a, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const HAZE_VERT = /* glsl */ `
varying vec2 vUvH;
void main() {
  vUvH = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

/** The glow and shimmer where the flame meets the meringue. */
export class ContactFx {
  readonly group = new THREE.Group();
  private glow: THREE.Sprite;
  private haze: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private time = 0;
  private level = 0;
  softLight = false;

  constructor(extras: boolean) {
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(128, 0.85),
        color: 0xffc98a,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      }),
    );
    this.glow.scale.setScalar(0.7);
    this.glow.renderOrder = 4;
    this.group.add(this.glow);

    this.haze = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.85),
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
        vertexShader: HAZE_VERT,
        fragmentShader: HAZE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.haze.renderOrder = 4;
    this.haze.visible = extras;
    this.group.add(this.haze);
    this.group.visible = false;
  }

  set(pos: THREE.Vector3 | null, strength: number, camera: THREE.Camera, dt: number): void {
    this.time += dt;
    this.level = damp(this.level, pos ? clamp(strength, 0, 1) : 0, 9, dt);
    if (this.level < 0.004) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    if (pos) this.group.position.copy(pos);
    const soft = this.softLight ? 0.55 : 1;
    (this.glow.material as THREE.SpriteMaterial).opacity = this.level * 0.52 * soft;
    this.glow.scale.setScalar(0.5 + 0.28 * this.level);
    this.haze.material.uniforms.uTime.value = this.time;
    this.haze.material.uniforms.uOpacity.value = this.level * 0.12 * soft;
    this.haze.position.y = 0.32;
    this.haze.quaternion.copy(camera.quaternion);
  }

  dispose(): void {
    (this.glow.material as THREE.SpriteMaterial).map?.dispose();
    (this.glow.material as THREE.SpriteMaterial).dispose();
    this.haze.geometry.dispose();
    this.haze.material.dispose();
  }
}
