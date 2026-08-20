import {
  BackSide,
  Color,
  Mesh,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Vector3,
  WebGLRenderer,
} from 'three'

const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`

const frag = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uSunDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGroundHaze;
  uniform vec3 uSunColor;
  uniform float uExposure;

  void main() {
    vec3 d = normalize(vDir);
    float up = d.y;

    // Sky gradient with a thick, bright summer haze pooled at the horizon.
    float t = clamp(up, 0.0, 1.0);
    vec3 sky = mix(uHorizon, uZenith, pow(t, 0.42));

    // Below the horizon fades into a warm bounce so the IBL lifts shadows.
    sky = mix(sky, uGroundHaze, smoothstep(0.0, -0.30, up));

    float sd = max(dot(d, uSunDir), 0.0);
    // Broad aureole + tight disc.
    sky += uSunColor * pow(sd, 7.0) * 0.30;
    sky += uSunColor * pow(sd, 900.0) * 14.0;
    // Forward scattered haze near the sun, strongest low in the sky.
    sky += uSunColor * pow(sd, 2.0) * 0.09 * (1.0 - t);

    gl_FragColor = vec4(sky * uExposure, 1.0);
    #include <colorspace_fragment>
  }
`

export class Sky {
  readonly mesh: Mesh
  readonly material: ShaderMaterial

  constructor(sunDir: Vector3) {
    this.material = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uSunDir: { value: sunDir.clone().normalize() },
        uZenith: { value: new Color(0.20, 0.42, 0.80) },
        uHorizon: { value: new Color(0.84, 0.88, 0.86) },
        uGroundHaze: { value: new Color(0.52, 0.55, 0.42) },
        uSunColor: { value: new Color(1.0, 0.94, 0.80) },
        uExposure: { value: 1.0 },
      },
    })
    this.mesh = new Mesh(new SphereGeometry(160, 32, 20), this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1000
  }

  /** Bake the sky (and a hint of warm ground bounce) into an IBL probe. */
  buildEnvironment(renderer: WebGLRenderer): Texture {
    const pmrem = new PMREMGenerator(renderer)
    pmrem.compileEquirectangularShader()
    const s = new Scene()
    const clone = new Mesh(this.mesh.geometry, this.material)
    clone.frustumCulled = false
    s.add(clone)
    const rt = pmrem.fromScene(s, 0.0, 0.1, 200)
    pmrem.dispose()
    return rt.texture
  }
}
