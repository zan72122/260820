import * as THREE from 'three'
import { noiseTexture } from './noise'
import { NOISE_GLSL } from './shaders'

const MAX_RIPPLES = 10

const VERT = /* glsl */ `
uniform float uTime;
uniform vec4 uRipples[${MAX_RIPPLES}];   // xz center, w = strength, ripple age in uRippleAge
uniform float uRippleAge[${MAX_RIPPLES}];
uniform vec4 uJet;                        // xz, radius, strength
uniform float uCalm;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vFoamK;

float waveH(vec2 p, float t){
  float h = 0.0;
  h += sin(p.x*3.1 + t*1.35) * 0.0075;
  h += sin(p.y*2.35 - t*1.05) * 0.0062;
  h += sin((p.x*1.4 + p.y*1.9) + t*0.72) * 0.0042;
  h += sin((p.x*7.3 - p.y*6.1) + t*2.6) * 0.0016;
  return h * mix(1.0, 0.45, uCalm);
}

float rippleH(vec2 p, float t){
  float h = 0.0;
  for(int i=0;i<${MAX_RIPPLES};i++){
    vec4 r = uRipples[i];
    if(r.w <= 0.001) continue;
    float age = uRippleAge[i];
    float d = distance(p, r.xy);
    float front = age * 0.85;
    float w = exp(-abs(d - front) * 9.0) * exp(-age*1.7) * exp(-d*0.55);
    h += sin((d - front) * 26.0) * w * r.w * 0.02;
  }
  return h;
}

float jetH(vec2 p){
  if(uJet.w <= 0.001) return 0.0;
  float d = distance(p, uJet.xy) / max(0.02, uJet.z);
  return -exp(-d*d*1.6) * uJet.w * 0.085;
}

float surface(vec2 p, float t){
  return waveH(p,t) + rippleH(p,t) + jetH(p);
}

void main(){
  vec3 wp = (modelMatrix * vec4(position,1.0)).xyz;
  #ifdef NEARWATER
    float t = uTime;
    float h = surface(wp.xz, t);
    float e = 0.035;
    float hx = surface(wp.xz + vec2(e,0.0), t);
    float hz = surface(wp.xz + vec2(0.0,e), t);
    wp.y += h;
    vec3 n = normalize(vec3(-(hx-h)/e, 1.0, -(hz-h)/e));
    vFoamK = clamp(-jetH(wp.xz)*22.0, 0.0, 1.0);
  #else
    vec3 n = vec3(0.0,1.0,0.0);
    vFoamK = 0.0;
  #endif
  vWorld = wp;
  vNormalW = n;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uTurbid;
uniform vec4 uJet;
uniform float uCalm;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vFoamK;
${NOISE_GLSL}

void main(){
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormalW);

  // micro roughness of the surface, stronger close to the eye
  float dist = length(cameraPosition - vWorld);
  float micro = 1.0 - smoothstep(2.0, 26.0, dist);
  vec2 mp = vWorld.xz * 26.0 + vec2(uTime*0.35, -uTime*0.22);
  float n1 = fbm(mp) - 0.5;
  float n2 = fbm(mp.yx*1.7 + 11.0) - 0.5;
  N = normalize(N + vec3(n1, 0.0, n2) * (0.26 * micro * mix(1.0,0.5,uCalm)));

  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = 0.03 + 0.97 * pow(1.0 - ndv, 4.2);

  vec3 R = reflect(-V, N);
  float up = clamp(R.y, 0.0, 1.0);
  vec3 sky = mix(uSkyHorizon, uSkyTop, pow(up, 0.55));
  float spec = pow(max(dot(R, normalize(uSunDir)), 0.0), 420.0);
  sky += uSunColor * spec * 1.4 * (1.0 - uCalm*0.5);
  float gl = pow(max(dot(R, normalize(uSunDir)), 0.0), 46.0);
  sky += uSunColor * gl * 0.55;
  float sheen = pow(max(dot(R, normalize(uSunDir)), 0.0), 8.0);
  sky += uSunColor * sheen * 0.12;

  // the body of the water is silt, not blue
  // silt streaks drifting on the surface keep the flat water from reading dead
  float streak = fbm(vWorld.xz*vec2(0.9, 2.6) + vec2(uTime*0.03, 0.0));
  vec3 body = uTurbid * (0.80 + 0.40 * streak);
  body = mix(body, uSkyHorizon*0.5, 0.18*fres);

  // aeration where the jet lands
  float jd = uJet.w > 0.001 ? distance(vWorld.xz, uJet.xy) / max(0.02,uJet.z) : 99.0;
  float foam = clamp((1.0 - smoothstep(0.05, 1.05, jd)) * uJet.w * 0.5, 0.0, 1.0);
  foam *= 0.62 + 0.38 * fbm(vWorld.xz*55.0 + uTime*3.2);
  foam = clamp(foam + vFoamK*0.28, 0.0, 1.0);

  vec3 col = mix(body, sky, fres);
  col = mix(col, vec3(0.74,0.75,0.72), foam*0.75);

  float alpha = clamp(0.24 + 0.76*fres + foam*0.7, 0.0, 1.0);

  // aerial perspective, matched to the scene fog
  float fogF = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
  col = mix(col, uFogColor, clamp(fogF,0.0,1.0));
  alpha = mix(alpha, 1.0, clamp(fogF,0.0,1.0));

  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export class Water {
  group = new THREE.Group()
  near: THREE.Mesh
  far: THREE.Mesh
  uniforms: Record<string, THREE.IUniform>
  private ripples: { x: number; z: number; strength: number; age: number }[] = []
  private nearMat: THREE.ShaderMaterial
  private detail = 1

  constructor(sunDir: THREE.Vector3, fog: THREE.FogExp2) {
    this.uniforms = {
      uNoise: { value: noiseTexture() },
      uTime: { value: 0 },
      uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uRippleAge: { value: new Float32Array(MAX_RIPPLES) },
      uJet: { value: new THREE.Vector4(0, 0, 0.2, 0) },
      uCalm: { value: 0 },
      uSunDir: { value: sunDir.clone() },
      uSunColor: { value: new THREE.Color(0xffeccb) },
      uSkyTop: { value: new THREE.Color(0x5d7d9c) },
      uSkyHorizon: { value: new THREE.Color(0xc3c8c1) },
      uTurbid: { value: new THREE.Color(0x5f5849) },
      uFogColor: { value: new THREE.Color(fog.color.getHex()) },
      uFogDensity: { value: fog.density },
    }

    this.nearMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      defines: { NEARWATER: '' },
    })
    const farMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    })

    this.near = new THREE.Mesh(this.makeDisc(10, 128, 44), this.nearMat)
    this.near.renderOrder = 6
    this.near.frustumCulled = false
    this.far = new THREE.Mesh(new THREE.RingGeometry(9.98, 150, 72, 14), farMat)
    this.far.rotation.x = -Math.PI / 2
    this.far.renderOrder = 5
    this.far.frustumCulled = false

    this.group.add(this.near, this.far)
  }

  /** Radially graded disc: fine near the middle where the work happens. */
  private makeDisc(radius: number, theta: number, rings: number) {
    const g = new THREE.RingGeometry(0.0004, radius, theta, rings)
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const r = Math.hypot(x, y)
      if (r > 1e-5) {
        const nr = radius * Math.pow(r / radius, 1.85)
        pos.setXY(i, (x / r) * nr, (y / r) * nr)
      }
    }
    pos.needsUpdate = true
    g.rotateX(-Math.PI / 2)
    return g
  }

  setDetail(d: number) {
    if (Math.abs(d - this.detail) < 0.01) return
    this.detail = d
    const theta = Math.max(40, Math.round(128 * d))
    const rings = Math.max(16, Math.round(44 * d))
    this.near.geometry.dispose()
    this.near.geometry = this.makeDisc(10, theta, rings)
  }

  setCalm(calm: boolean) {
    this.uniforms.uCalm.value = calm ? 1 : 0
  }

  /** Move the fine-grained patch to follow the active work area. */
  setCenter(x: number, z: number) {
    this.near.position.set(x, 0, z)
    this.far.position.set(x, 0, z)
  }

  addRipple(x: number, z: number, strength = 1) {
    if (this.ripples.length >= MAX_RIPPLES) this.ripples.shift()
    this.ripples.push({ x, z, strength, age: 0 })
  }

  setJet(x: number, z: number, radius: number, strength: number) {
    ;(this.uniforms.uJet.value as THREE.Vector4).set(x, z, radius, strength)
  }

  update(dt: number, t: number) {
    this.uniforms.uTime.value = t
    const arr = this.uniforms.uRipples.value as THREE.Vector4[]
    const ages = this.uniforms.uRippleAge.value as Float32Array
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].age += dt
      if (this.ripples[i].age > 2.4) this.ripples.splice(i, 1)
    }
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const r = this.ripples[i]
      if (r) {
        arr[i].set(r.x, r.z, 0, r.strength)
        ages[i] = r.age
      } else {
        arr[i].w = 0
        ages[i] = 0
      }
    }
  }

  /** Surface height used by gameplay code (must match the vertex shader). */
  heightAt(x: number, z: number, t: number, calm: number) {
    let h = 0
    h += Math.sin(x * 3.1 + t * 1.35) * 0.0075
    h += Math.sin(z * 2.35 - t * 1.05) * 0.0062
    h += Math.sin(x * 1.4 + z * 1.9 + t * 0.72) * 0.0042
    return h * (1 - 0.55 * calm)
  }
}
