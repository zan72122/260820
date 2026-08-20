import * as THREE from 'three'

/** Small bubbles that rise beside the next petiole. The only "come here" cue. */
export class Bubbles {
  points: THREE.Points
  private n = 26
  private pos: Float32Array
  private a: Float32Array
  private state: { life: number; p: THREE.Vector3; v: number }[] = []
  private origin = new THREE.Vector3()
  private active = false
  private acc = 0

  constructor() {
    this.pos = new Float32Array(this.n * 3)
    this.a = new Float32Array(this.n)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.a, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60)
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: `attribute float aAlpha; varying float vA;
          void main(){ vA=aAlpha; vec4 mv=viewMatrix*vec4(position,1.0);
          gl_PointSize = 34.0/max(0.25,-mv.z); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `varying float vA;
          void main(){ vec2 d=gl_PointCoord-0.5; float r=dot(d,d); if(r>0.25) discard;
          float ring = smoothstep(0.25,0.12,r)*0.5 + smoothstep(0.06,0.02,r)*0.6;
          gl_FragColor = vec4(0.86,0.88,0.86, vA*ring*0.55); }`,
        transparent: true,
        depthWrite: false,
      }),
    )
    this.points.renderOrder = 7
    this.points.frustumCulled = false
    for (let i = 0; i < this.n; i++) this.state.push({ life: 0, p: new THREE.Vector3(), v: 0 })
  }

  setOrigin(p: THREE.Vector3) {
    this.origin.copy(p)
  }
  start() {
    this.active = true
  }
  stop() {
    this.active = false
  }

  update(dt: number, depth: number) {
    this.acc += dt
    if (this.active && this.acc > 0.13) {
      this.acc = 0
      for (const s of this.state) {
        if (s.life > 0) continue
        s.life = 1.4
        s.p.set(this.origin.x + (Math.random() - 0.5) * 0.09, -depth * (0.5 + Math.random() * 0.4), this.origin.z + (Math.random() - 0.5) * 0.09)
        s.v = 0.12 + Math.random() * 0.14
        break
      }
    }
    for (let i = 0; i < this.n; i++) {
      const s = this.state[i]
      if (s.life > 0) {
        s.life -= dt
        s.p.y += s.v * dt
        s.p.x += Math.sin(s.life * 6 + i) * 0.004
        if (s.p.y > -0.006) s.life = 0
      }
      this.pos[i * 3] = s.p.x
      this.pos[i * 3 + 1] = s.p.y
      this.pos[i * 3 + 2] = s.p.z
      this.a[i] = s.life > 0 ? Math.min(1, s.life * 3) : 0
    }
    ;(this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.points.geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true
  }
}
