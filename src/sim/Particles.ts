import {
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three'

const vert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  #include <fog_pars_vertex>
  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vec4 world = m * vec4(position, 1.0);
    vW = world.xyz;
    vN = normalize(mat3(m) * normal);
    vec4 mvPosition = viewMatrix * world;
    #include <fog_vertex>
    gl_Position = projectionMatrix * mvPosition;
  }
`

const frag = /* glsl */ `
  precision highp float;
  varying vec3 vN;
  varying vec3 vW;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  #include <fog_pars_fragment>

  vec3 skyColor(vec3 d) {
    float t = clamp(d.y, 0.0, 1.0);
    vec3 c = mix(uHorizon, uZenith, pow(t, 0.42));
    c += uSunColor * pow(max(dot(d, uSunDir), 0.0), 7.0) * 0.30;
    return c;
  }

  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    float F = 0.05 + 0.95 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
    vec3 refl = skyColor(reflect(-V, N));
    vec3 thru = skyColor(refract(-V, N, 0.75)) * 0.85;
    vec3 H = normalize(V + uSunDir);
    float spec = pow(max(dot(N, H), 0.0), 220.0) * 9.0;
    vec3 col = mix(thru, refl, F) + uSunColor * spec;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

interface P {
  alive: boolean
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  r: number
  life: number
  maxLife: number
}

const _m = new Matrix4()
const _q = new Quaternion()
const _pos = new Vector3()
const _scale = new Vector3()
const _up = new Vector3(0, 1, 0)
const _dir = new Vector3()

/**
 * Water drops. Pooled and instanced: no allocation happens per frame, which
 * matters because drips fire in bursts every time a bundle leaves the water.
 */
export class Droplets {
  readonly mesh: InstancedMesh
  private items: P[] = []
  private cursor = 0
  readonly material: ShaderMaterial

  constructor(count = 200) {
    this.material = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      fog: true,
      transparent: true,
      depthWrite: false,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uSunDir: { value: new Vector3(0, 1, 0) },
          uSunColor: { value: new Color(1, 0.94, 0.8) },
          uZenith: { value: new Color(0.095, 0.225, 0.62) },
          uHorizon: { value: new Color(0.470, 0.545, 0.640) },
        },
      ]),
    })
    const geo = new IcosahedronGeometry(1, 1)
    this.mesh = new InstancedMesh(geo, this.material, count)
    this.mesh.frustumCulled = false
    this.mesh.count = count
    for (let i = 0; i < count; i++) {
      this.items.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, life: 0, maxLife: 1 })
      _m.makeScale(0, 0, 0)
      this.mesh.setMatrixAt(i, _m)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  applyLighting(sunDir: Vector3, sunColor: Color): void {
    ;(this.material.uniforms.uSunDir.value as Vector3).copy(sunDir)
    ;(this.material.uniforms.uSunColor.value as Color).copy(sunColor)
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, r: number, life = 1.4): void {
    const p = this.items[this.cursor]
    this.cursor = (this.cursor + 1) % this.items.length
    p.alive = true
    p.x = x
    p.y = y
    p.z = z
    p.vx = vx
    p.vy = vy
    p.vz = vz
    p.r = r
    p.life = 0
    p.maxLife = life
  }

  burst(x: number, y: number, z: number, n: number, power: number, rng: () => number): void {
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2
      const s = (0.25 + rng() * 0.9) * power
      this.emit(
        x + (rng() - 0.5) * 0.012,
        y + rng() * 0.006,
        z + (rng() - 0.5) * 0.012,
        Math.cos(a) * s * 0.5,
        (0.5 + rng() * 0.8) * power,
        Math.sin(a) * s * 0.5 + power * 0.25,
        0.0008 + rng() * 0.0014,
        0.7 + rng() * 0.6,
      )
    }
  }

  /**
   * `onSurfaceHit` fires when a drop crosses a water surface so the caller can
   * ring the water and play the sound.
   */
  update(
    dt: number,
    surfaceY: (x: number, z: number) => number | null,
    onSurfaceHit: (x: number, y: number, z: number, r: number) => void,
  ): void {
    const items = this.items
    for (let i = 0; i < items.length; i++) {
      const p = items[i]
      if (!p.alive) continue
      p.life += dt
      p.vy -= 9.81 * dt
      const drag = Math.exp(-dt * 0.6)
      p.vx *= drag
      p.vz *= drag
      const py = p.y
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt

      const sy = surfaceY(p.x, p.z)
      if (sy !== null && py >= sy && p.y < sy) {
        onSurfaceHit(p.x, sy, p.z, p.r)
        p.alive = false
        _m.makeScale(0, 0, 0)
        this.mesh.setMatrixAt(i, _m)
        continue
      }
      if (p.life > p.maxLife || p.y < -0.2) {
        p.alive = false
        _m.makeScale(0, 0, 0)
        this.mesh.setMatrixAt(i, _m)
        continue
      }

      // Stretch along the direction of travel — a falling drop is a teardrop.
      const sp = Math.hypot(p.vx, p.vy, p.vz)
      const stretch = 1 + Math.min(2.4, sp * 0.45)
      _dir.set(p.vx, p.vy, p.vz)
      if (_dir.lengthSq() < 1e-9) _dir.set(0, -1, 0)
      _dir.normalize()
      _q.setFromUnitVectors(_up, _dir)
      _pos.set(p.x, p.y, p.z)
      _scale.set(p.r, p.r * stretch, p.r)
      _m.compose(_pos, _q, _scale)
      this.mesh.setMatrixAt(i, _m)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
