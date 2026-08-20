import * as THREE from 'three'

/**
 * Silt clouds. Deliberately short-lived: the mud must obscure the find for
 * about a second and then drift off so the discovery stays visible.
 */
export class Turbidity {
  points: THREE.Points
  private max: number
  private pos: Float32Array
  private aData: Float32Array // alpha, size, seed
  private state: { life: number; max: number; p: THREE.Vector3; v: THREE.Vector3; size: number; seed: number }[] = []
  private budget: number
  private material: THREE.ShaderMaterial

  constructor(max = 220) {
    this.max = max
    this.budget = max
    this.pos = new Float32Array(max * 3)
    this.aData = new Float32Array(max * 3)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    g.setAttribute('aData', new THREE.BufferAttribute(this.aData, 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60)
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x6d6149) },
        uScale: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aData; varying float vA; varying float vSeed; uniform float uScale;
        void main(){
          vA = aData.x; vSeed = aData.z;
          vec4 mv = viewMatrix * vec4(position,1.0);
          gl_PointSize = uScale * aData.y * 260.0 / max(0.25, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA; varying float vSeed;
        float h(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453); }
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r2 = dot(d,d);
          if(r2 > 0.25) discard;
          float soft = 1.0 - smoothstep(0.02, 0.25, r2);
          float grain = 0.75 + 0.5*h(floor(gl_PointCoord*7.0) + vSeed);
          gl_FragColor = vec4(uColor*grain, soft*vA*0.5);
        }`,
      transparent: true,
      depthWrite: false,
    })
    this.points = new THREE.Points(g, this.material)
    this.points.renderOrder = 4
    this.points.frustumCulled = false
    for (let i = 0; i < max; i++)
      this.state.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), size: 1, seed: 0 })
  }

  setBudget(n: number) {
    this.budget = Math.min(this.max, n)
  }

  setCalm(calm: boolean) {
    this.material.uniforms.uScale.value = calm ? 0.7 : 1
  }

  /** current direction the silt drifts toward (downstream / away from the eye) */
  current = new THREE.Vector3(0.35, 0, -0.5)

  spawn(p: THREE.Vector3, amount: number, spread = 0.09, rise = 0.16) {
    let live = 0
    for (const s of this.state) if (s.life > 0) live++
    let n = Math.round(amount)
    for (const s of this.state) {
      if (n <= 0 || live >= this.budget) break
      if (s.life > 0) continue
      s.max = 0.85 + Math.random() * 0.45
      s.life = s.max
      s.p.set(p.x + (Math.random() - 0.5) * spread, p.y + Math.random() * 0.02, p.z + (Math.random() - 0.5) * spread)
      s.v.set(
        (Math.random() - 0.5) * 0.18 + this.current.x * 0.25,
        rise * (0.5 + Math.random()),
        (Math.random() - 0.5) * 0.18 + this.current.z * 0.25,
      )
      s.size = 0.085 + Math.random() * 0.13
      s.seed = Math.random() * 20
      n--
      live++
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      const s = this.state[i]
      if (s.life > 0) {
        s.life -= dt
        s.v.y -= dt * 0.10
        s.v.addScaledVector(this.current, dt * 0.55)
        s.v.multiplyScalar(1 - dt * 1.5)
        s.p.addScaledVector(s.v, dt)
        if (s.p.y > -0.02) s.p.y = -0.02
      }
      const f = Math.max(0, s.life / s.max)
      // quick bloom, then clears
      const a = s.life > 0 ? Math.min(1, (1 - f) * 6) * Math.pow(f, 0.65) : 0
      this.pos[i * 3] = s.p.x
      this.pos[i * 3 + 1] = s.p.y
      this.pos[i * 3 + 2] = s.p.z
      this.aData[i * 3] = a
      this.aData[i * 3 + 1] = s.size * (1 + (1 - f) * 1.4)
      this.aData[i * 3 + 2] = s.seed
    }
    ;(this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.points.geometry.attributes.aData as THREE.BufferAttribute).needsUpdate = true
  }
}
