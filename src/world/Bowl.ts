import {
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  BoxGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
} from 'three'
import { BOWL, SUN_DIR } from '../config'
import { bakeWood } from '../gfx/textures'

const MAX_RIPPLES = 4

const tsuyuVert = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vLocal;
  uniform float uLevel;
  void main() {
    vLocal = position.xy;
    vec3 p = position;
    vec4 world = modelMatrix * vec4(p, 1.0);
    world.y += uLevel;
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const tsuyuFrag = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  varying vec2 vLocal;
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uLiquid;
  uniform float uRadius;
  uniform vec4 uRipples[${MAX_RIPPLES}];

  vec3 skyColor(vec3 d) {
    float t = clamp(d.y, 0.0, 1.0);
    vec3 c = mix(uHorizon, uZenith, pow(t, 0.42));
    float sd = max(dot(d, uSunDir), 0.0);
    c += uSunColor * pow(sd, 7.0) * 0.30;
    return c;
  }

  void main() {
    float r = length(vLocal);
    vec2 g = vec2(0.0);
    // Idle shimmer. Even still tsuyu is never a perfect mirror.
    g += vec2(cos(vLocal.x * 260.0 + uTime * 1.9), cos(vLocal.y * 230.0 - uTime * 1.5)) * 0.055;
    g += vec2(cos(vLocal.y * 91.0 - uTime * 0.9), cos(vLocal.x * 77.0 + uTime * 1.1)) * 0.028;
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 rp = uRipples[i];
      if (rp.w <= 0.0) continue;
      float age = uTime - rp.z;
      if (age < 0.0 || age > 2.2) continue;
      vec2 dv = vLocal - rp.xy;
      float d = length(dv) + 1e-5;
      float front = age * 0.16;
      float env = exp(-age * 1.5) * smoothstep(front + 0.01, front - 0.05, d);
      float k = 260.0;
      g += (dv / d) * cos(d * k - age * 26.0) * rp.w * 0.0009 * env * k;
    }
    // meniscus climbing the bowl wall
    float edge = smoothstep(uRadius * 0.80, uRadius, r);
    g += normalize(vLocal + 1e-5) * edge * 0.55;

    vec3 N = normalize(vec3(-g.x, 1.0, g.y));
    vec3 V = normalize(cameraPosition - vWorld);
    float F = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 refl = skyColor(reflect(-V, N));
    vec3 H = normalize(V + uSunDir);
    float spec = pow(max(dot(N, H), 0.0), 1600.0) * 3.2 + pow(max(dot(N, H), 0.0), 260.0) * 0.28;
    vec3 col = mix(uLiquid, refl, clamp(F, 0.0, 0.75)) + uSunColor * spec;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

export class Bowl {
  readonly group = new Group()
  readonly liquid: Mesh
  private mat: ShaderMaterial
  private ripples: Vector4[] = []
  private cursor = 0
  private levelTarget = 0
  private level = 0

  constructor() {
    for (let i = 0; i < MAX_RIPPLES; i++) this.ripples.push(new Vector4(0, 0, -99, 0))

    // ---- the stand --------------------------------------------------------
    const w = bakeWood()
    for (const t of [w.map, w.roughnessMap, w.normalMap]) {
      t.wrapS = t.wrapT = RepeatWrapping
      t.repeat.set(2.6, 2.6)
    }
    const woodMat = new MeshStandardMaterial({
      map: w.map,
      roughnessMap: w.roughnessMap,
      normalMap: w.normalMap,
      color: 0xc39a70,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.8,
    })
    const top = new Mesh(new BoxGeometry(0.34, 0.020, 0.34), woodMat)
    top.position.set(BOWL.x, BOWL.standY - 0.010, BOWL.z)
    top.castShadow = true
    top.receiveShadow = true
    this.group.add(top)
    for (const [dx, dz] of [
      [-0.145, -0.145],
      [0.145, -0.145],
      [-0.145, 0.145],
      [0.145, 0.145],
    ]) {
      const leg = new Mesh(new BoxGeometry(0.026, BOWL.standY - 0.020, 0.026), woodMat)
      leg.position.set(BOWL.x + dx, (BOWL.standY - 0.020) / 2, BOWL.z + dz)
      leg.castShadow = true
      this.group.add(leg)
    }

    // ---- glazed bowl ------------------------------------------------------
    const profile: [number, number][] = [
      [0.0012, 0.0],
      [0.028, 0.0],
      [0.0335, 0.0055],
      [0.040, 0.0125],
      [0.0515, 0.0225],
      [0.0635, 0.0345],
      [0.0735, 0.0465],
      [BOWL.rim, BOWL.height],
      [0.0742, 0.0505],
      [0.0675, 0.0405],
      [0.0555, 0.0285],
      [0.0425, 0.0175],
      [0.0325, 0.0105],
      [0.0255, 0.0075],
      [0.0012, 0.0068],
    ]
    const pts = profile.map(([x, y]) => new Vector2(x, y))
    const bowlGeo = new LatheGeometry(pts, 48)
    bowlGeo.computeVertexNormals()
    const porcelain = new MeshPhysicalMaterial({
      color: 0xe8eae6,
      roughness: 0.15,
      metalness: 0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      side: DoubleSide,
      envMapIntensity: 1.0,
      sheen: 0.2,
      sheenColor: new Color(0xdfe8ea),
    })
    const bowl = new Mesh(bowlGeo, porcelain)
    bowl.position.set(BOWL.x, BOWL.standY, BOWL.z)
    bowl.castShadow = true
    bowl.receiveShadow = true
    this.group.add(bowl)

    // ---- tsuyu ------------------------------------------------------------
    const liquidR = 0.0655
    this.mat = new ShaderMaterial({
      vertexShader: tsuyuVert,
      fragmentShader: tsuyuFrag,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize() },
        uSunColor: { value: new Color(1.0, 0.94, 0.8) },
        uZenith: { value: new Color(0.095, 0.225, 0.62) },
        uHorizon: { value: new Color(0.470, 0.545, 0.640) },
        uLiquid: { value: new Color(0.055, 0.030, 0.018) },
        uRadius: { value: liquidR },
        uLevel: { value: 0 },
        uRipples: { value: this.ripples },
      },
    })
    // The disc keeps its XY layout so the shader can use position.xy as the
    // liquid's own 2D frame; only the mesh is laid flat.
    const disc = new CircleGeometry(liquidR, 40)
    this.liquid = new Mesh(disc, this.mat)
    this.liquid.rotation.x = -Math.PI / 2
    this.liquid.position.set(BOWL.x, BOWL.liquidY, BOWL.z)
    this.liquid.renderOrder = 3
    this.group.add(this.liquid)
  }

  /** Match the tsuyu's lighting to the rest of the scene. */
  applyLighting(sunDir: Vector3, sunColor: Color): void {
    ;(this.mat.uniforms.uSunDir.value as Vector3).copy(sunDir)
    ;(this.mat.uniforms.uSunColor.value as Color).copy(sunColor)
  }

  /** World-space offset from the bowl centre, in metres. */
  splash(dx: number, dz: number, strength: number, time: number): void {
    const r = this.ripples[this.cursor]
    this.cursor = (this.cursor + 1) % MAX_RIPPLES
    r.set(dx, -dz, time, strength)
    this.levelTarget += 0.0016 * strength
  }

  get centre(): Vector3 {
    return new Vector3(BOWL.x, BOWL.liquidY, BOWL.z)
  }

  update(time: number, dt: number): void {
    this.levelTarget *= Math.exp(-dt * 0.9)
    this.level += (this.levelTarget - this.level) * Math.min(1, dt * 9)
    this.mat.uniforms.uTime.value = time
    this.mat.uniforms.uLevel.value = this.level
  }
}
