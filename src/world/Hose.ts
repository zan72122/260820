import * as THREE from 'three'
import { noiseTexture } from './noise'
import { TubeMesh } from './TubeMesh'
import { applyMurk } from './murk'
import { NOISE_GLSL } from './shaders'

function ribbedTexture() {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#2b2f2c'
  g.fillRect(0, 0, 32, 128)
  for (let y = 0; y < 128; y += 8) {
    const v = 40 + Math.random() * 12
    g.fillStyle = `rgb(${v},${v + 3},${v})`
    g.fillRect(0, y, 32, 4)
    g.fillStyle = 'rgba(0,0,0,0.35)'
    g.fillRect(0, y + 4, 32, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, 26)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const JET_VERT = /* glsl */ `
attribute float aU;
attribute float aSide;
uniform float uTime;
uniform float uWidth;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uCtrl;
uniform vec3 uCam;
varying float vU;
varying float vSide;
void main(){
  float u = aU;
  vec3 p = mix(mix(uA,uCtrl,u), mix(uCtrl,uB,u), u);
  vec3 tangent = normalize(mix(uCtrl-uA, uB-uCtrl, u) + 1e-5);
  vec3 toCam = normalize(uCam - p);
  vec3 side = normalize(cross(tangent, toCam));
  float w = uWidth * mix(0.55, 1.9, pow(u, 1.4));
  p += side * aSide * w;
  vU = u;
  vSide = aSide;
  gl_Position = projectionMatrix * viewMatrix * vec4(p,1.0);
}
`

const JET_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying float vU;
varying float vSide;
${NOISE_GLSL}
void main(){
  float edge = 1.0 - abs(vSide);
  float body = smoothstep(0.0, 0.45, edge);
  float n = fbm(vec2(vU*7.0 - uTime*9.0, vSide*2.0));
  float breakup = mix(1.0, n*1.5, smoothstep(0.25,1.0,vU));
  float a = body * breakup * uOpacity * (1.0 - smoothstep(0.82,1.0,vU)*0.55);
  vec3 col = mix(vec3(0.80,0.84,0.86), vec3(0.93,0.95,0.95), edge);
  gl_FragColor = vec4(col, clamp(a,0.0,1.0)*0.8);
  #include <colorspace_fragment>
}
`

export class Hose {
  group = new THREE.Group()
  nozzle = new THREE.Group()
  private tube: TubeMesh
  private tubeMesh: THREE.Mesh
  private curve = new THREE.CatmullRomCurve3(
    Array.from({ length: 6 }, () => new THREE.Vector3()),
    false,
    'catmullrom',
    0.35,
  )
  private jetMesh: THREE.Mesh
  private jetUniforms: Record<string, THREE.IUniform>
  private spray: THREE.Points
  private sprayData: { life: number; pos: THREE.Vector3; vel: THREE.Vector3 }[] = []
  private sprayPos: Float32Array
  private sprayAlpha: Float32Array
  private anchor: THREE.Vector3

  constructor(anchor: THREE.Vector3, murkColor: THREE.Color) {
    this.anchor = anchor.clone()
    const tex = ribbedTexture()
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: 0x4e544d,
      roughness: 0.62,
      metalness: 0.0,
    })
    applyMurk(mat, murkColor, 0.25)
    this.tube = new TubeMesh(40, 10, 0.026)
    this.tubeMesh = new THREE.Mesh(this.tube.geometry, mat)
    this.tubeMesh.castShadow = true
    this.tubeMesh.frustumCulled = false
    this.group.add(this.tubeMesh)

    // brass-ish nozzle held in the glove
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x9a8f78, roughness: 0.32, metalness: 0.75 })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.026, 0.16, 12), nozzleMat)
    body.rotation.x = Math.PI / 2
    body.position.z = 0.02
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.019, 0.09, 12), nozzleMat)
    tip.rotation.x = Math.PI / 2
    tip.position.z = 0.14
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 6, 14), nozzleMat)
    collar.position.z = 0.095
    body.castShadow = tip.castShadow = true
    this.nozzle.add(body, tip, collar)
    this.group.add(this.nozzle)

    // ---- tapered ribbon jet
    const SEG = 26
    const g = new THREE.BufferGeometry()
    const aU: number[] = []
    const aSide: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= SEG; i++) {
      aU.push(i / SEG, i / SEG)
      aSide.push(-1, 1)
      if (i < SEG) {
        const a = i * 2
        idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3)
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3))
    g.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1))
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(aSide, 1))
    g.setIndex(idx)
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60)
    this.jetUniforms = {
      uNoise: { value: noiseTexture() },
      uTime: { value: 0 },
      uWidth: { value: 0.03 },
      uOpacity: { value: 0 },
      uA: { value: new THREE.Vector3() },
      uB: { value: new THREE.Vector3() },
      uCtrl: { value: new THREE.Vector3() },
      uCam: { value: new THREE.Vector3() },
    }
    this.jetMesh = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.jetUniforms,
        vertexShader: JET_VERT,
        fragmentShader: JET_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    this.jetMesh.renderOrder = 8
    this.jetMesh.frustumCulled = false
    this.jetMesh.visible = false
    this.group.add(this.jetMesh)

    // ---- spray droplets
    const MAX = 90
    this.sprayPos = new Float32Array(MAX * 3)
    this.sprayAlpha = new Float32Array(MAX)
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(this.sprayPos, 3))
    sg.setAttribute('aAlpha', new THREE.BufferAttribute(this.sprayAlpha, 1))
    sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60)
    this.spray = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({
        uniforms: { uSize: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute float aAlpha; varying float vA; uniform float uSize;
          void main(){ vA = aAlpha; vec4 mv = viewMatrix * vec4(position,1.0);
            gl_PointSize = uSize * 17.0 / max(0.3, -mv.z); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d);
            if(r > 0.25) discard; gl_FragColor = vec4(0.88,0.90,0.90, vA * (1.0 - r*4.0) * 0.55); }`,
        transparent: true,
        depthWrite: false,
      }),
    )
    this.spray.renderOrder = 9
    this.spray.frustumCulled = false
    this.group.add(this.spray)
    for (let i = 0; i < MAX; i++) this.sprayData.push({ life: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3() })
  }

  setAnchor(v: THREE.Vector3) {
    this.anchor.lerp(v, 0.08)
  }

  setSprayScale(s: number) {
    ;(this.spray.material as THREE.ShaderMaterial).uniforms.uSize.value = s
  }

  update(
    dt: number,
    t: number,
    o: {
      grip: THREE.Vector3
      impact: THREE.Vector3
      pressure: number
      active: boolean
      camPos: THREE.Vector3
      /** the hose reaches the glove from behind the worker, never across the dig */
      behind: THREE.Vector3
      particleBudget: number
    },
  ) {
    // hose: pump out on the water -> a slack loop -> past the worker -> the glove
    const pts = this.curve.points
    const run = new THREE.Vector3().subVectors(o.behind, this.anchor)
    pts[0].copy(this.anchor)
    pts[1].copy(this.anchor).addScaledVector(run, 0.34)
    pts[1].y = -0.08 + Math.sin(t * 0.5) * 0.01
    pts[2].copy(this.anchor).addScaledVector(run, 0.72)
    pts[2].y = -0.11
    pts[3].copy(o.behind)
    pts[3].y = -0.04 + Math.sin(t * 0.7 + 1.0) * 0.012
    const back = new THREE.Vector3().subVectors(o.grip, o.impact).setY(0).normalize()
    pts[4].copy(o.grip).addScaledVector(back, 0.26).setY(o.grip.y - 0.12)
    pts[5].copy(o.grip)
    this.curve.updateArcLengths()
    this.tube.update(this.curve)

    // nozzle sits in the glove, aimed at the impact point
    this.nozzle.position.copy(o.grip)
    this.nozzle.lookAt(o.impact)

    const aim = new THREE.Vector3().subVectors(o.impact, o.grip)
    const nozzleTip = o.grip.clone().addScaledVector(aim.clone().normalize(), 0.19)

    const on = o.active && o.pressure > 0.02
    this.jetMesh.visible = on
    if (on) {
      const u = this.jetUniforms
      ;(u.uA.value as THREE.Vector3).copy(nozzleTip)
      ;(u.uB.value as THREE.Vector3).copy(o.impact)
      const ctrl = nozzleTip.clone().lerp(o.impact, 0.5)
      ctrl.y += aim.length() * 0.09
      ;(u.uCtrl.value as THREE.Vector3).copy(ctrl)
      ;(u.uCam.value as THREE.Vector3).copy(o.camPos)
      u.uTime.value = t
      u.uWidth.value = 0.011 + 0.016 * o.pressure
      u.uOpacity.value = 0.55 + 0.45 * o.pressure

      const want = Math.min(6, Math.round(2 + o.pressure * 4))
      let spawned = 0
      const live = this.sprayData.reduce((a, s) => a + (s.life > 0 ? 1 : 0), 0)
      for (const s of this.sprayData) {
        if (spawned >= want || live > o.particleBudget) break
        if (s.life > 0) continue
        s.life = 0.22 + Math.random() * 0.3
        s.pos.copy(o.impact).add(
          new THREE.Vector3((Math.random() - 0.5) * 0.06, 0.005, (Math.random() - 0.5) * 0.06),
        )
        const a = Math.random() * Math.PI * 2
        const sp = (0.5 + Math.random()) * (0.5 + o.pressure)
        s.vel.set(Math.cos(a) * sp * 0.5, 0.7 + Math.random() * 0.9, Math.sin(a) * sp * 0.5)
        spawned++
      }
    } else {
      this.jetUniforms.uOpacity.value = 0
    }

    let n = 0
    for (const s of this.sprayData) {
      if (s.life > 0) {
        s.life -= dt
        s.vel.y -= dt * 5.2
        s.pos.addScaledVector(s.vel, dt)
        if (s.pos.y < 0) s.life = 0
      }
      const a = s.life > 0 ? Math.min(1, s.life * 4) : 0
      this.sprayPos[n * 3] = s.pos.x
      this.sprayPos[n * 3 + 1] = s.pos.y
      this.sprayPos[n * 3 + 2] = s.pos.z
      this.sprayAlpha[n] = a
      n++
    }
    ;(this.spray.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.spray.geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true
  }
}
