import * as THREE from 'three';
import { degrade, pickTier, probeDevice, type DeviceProfile, type QualitySettings } from './quality';

/**
 * Renderer, camera and lighting rig.
 *
 * Lighting is deliberately plain: one directional sun, a soft sky/ground
 * bounce, and a contact shadow. Exposure is set for a real tropical midday
 * rather than a blown-out white, and there is no colour grading pass, no rim
 * glow and no background bokeh.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly device: DeviceProfile;
  quality: QualitySettings;

  readonly sun: THREE.DirectionalLight;
  readonly sky: THREE.HemisphereLight;
  readonly bounce: THREE.DirectionalLight;

  private frameTimes: number[] = [];
  private lastDegradeAt = 0;
  private viewWidth = 1;
  private viewHeight = 1;

  constructor(container: HTMLElement) {
    this.device = probeDevice();
    this.quality = pickTier(this.device);

    this.renderer = new THREE.WebGLRenderer({
      antialias: this.quality.tier !== 'low',
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      // iOS Safari can drop the drawing buffer between frames without this.
      preserveDrawingBuffer: false,
    });
    this.renderer.setClearColor(0xc4cdc6, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Real midday exposure: highlights hold, no clipped white on the soil.
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.quality.softShadows
      ? THREE.PCFSoftShadowMap
      : THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.02, 260);
    this.camera.position.set(0, 0.9, 2.2);

    // Humid tropical haze: distance desaturates toward a pale warm grey.
    this.scene.fog = new THREE.Fog(0xccd3cb, 16, 110);

    this.sun = new THREE.DirectionalLight(0xfff4e4, 3.2);
    this.sun.position.set(3.6, 6.9, 2.4);
    this.sun.castShadow = true;
    this.configureSunShadow();
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Sky fill keeps shade readable and slightly cool against the warm sun.
    this.sky = new THREE.HemisphereLight(0xaecadd, 0x7d4e30, 1.05);
    this.scene.add(this.sky);

    // Weak fill from the sunlit soil opposite the sun; keeps shadow sides
    // readable without turning into a second key light.
    this.bounce = new THREE.DirectionalLight(0xdcb794, 0.30);
    this.bounce.position.set(-3.4, 1.2, -2.6);
    this.scene.add(this.bounce);

    this.buildEnvironment();
    this.resize();
  }

  /**
   * Sky-and-ground irradiance probe.
   *
   * Without one, a metal surface has nothing to reflect and renders black, so
   * the steel lifter would read as a silhouette instead of a worn tool. This
   * is a plain two-tone outdoor environment — bright hazy sky above, warm
   * reflected soil below — not a studio HDRI, so nothing gains a filmic rim.
   */
  private buildEnvironment(): void {
    const probe = new THREE.Scene();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(8, 16, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          sky: { value: new THREE.Color(0x9dbdd4) },
          haze: { value: new THREE.Color(0xdde2da) },
          soil: { value: new THREE.Color(0x8a5c40) },
        },
        vertexShader:
          'varying float vY; void main(){ vY = normalize(position).y;' +
          ' gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader:
          'uniform vec3 sky; uniform vec3 haze; uniform vec3 soil; varying float vY;' +
          'void main(){ vec3 c = vY > 0.0 ? mix(haze, sky, clamp(vY*1.6,0.0,1.0))' +
          ' : mix(haze, soil, clamp(-vY*2.2,0.0,1.0)); gl_FragColor = vec4(c,1.0); }',
      }),
    );
    probe.add(dome);
    // A small, bright patch standing in for the sun's disc, so highlights on
    // the tool have somewhere to come from.
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff3dd }),
    );
    sunDisc.position.set(3.0, 5.6, 2.0).setLength(6.5);
    probe.add(sunDisc);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const rt = pmrem.fromScene(probe, 0.04);
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.7;
    pmrem.dispose();
    dome.geometry.dispose();
    (dome.material as THREE.Material).dispose();
    sunDisc.geometry.dispose();
    (sunDisc.material as THREE.Material).dispose();
  }

  private configureSunShadow(): void {
    const s = this.sun.shadow;
    s.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
    const cam = s.camera as THREE.OrthographicCamera;
    cam.near = 0.2;
    cam.far = 24;
    cam.left = -2.6;
    cam.right = 2.6;
    cam.top = 2.6;
    cam.bottom = -2.6;
    cam.updateProjectionMatrix();
    s.bias = -0.0009;
    s.normalBias = 0.018;
    s.radius = this.quality.softShadows ? 2.4 : 1;
  }

  /** Keeps the sun's shadow frustum tight around the active plot. */
  focusShadows(target: THREE.Vector3): void {
    this.sun.target.position.copy(target);
    this.sun.position.set(target.x + 3.6, target.y + 6.9, target.z + 2.4);
    this.sun.target.updateMatrixWorld();
  }

  get aspect(): number {
    return this.viewWidth / Math.max(1, this.viewHeight);
  }

  get isPortrait(): boolean {
    return this.viewHeight >= this.viewWidth;
  }

  resize(): void {
    // visualViewport tracks the real drawable area on iOS when the URL bar
    // collapses or the on-screen keyboard is dismissed.
    const vv = window.visualViewport;
    const w = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
    const h = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
    this.viewWidth = w;
    this.viewHeight = h;

    const dpr = Math.min(this.device.dpr, this.quality.maxPixelRatio) * this.quality.renderScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, true);

    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Vertical FOV in radians. */
  get vFov(): number {
    return THREE.MathUtils.degToRad(this.camera.fov);
  }

  /** Horizontal FOV in radians (derived from aspect). */
  get hFov(): number {
    return 2 * Math.atan(Math.tan(this.vFov / 2) * this.camera.aspect);
  }

  /**
   * Distance at which a sphere of `radius` fits inside BOTH screen axes.
   * This is what guarantees the whole root cluster stays uncropped in
   * portrait and landscape alike.
   */
  distanceToFit(radius: number, margin = 1.14): number {
    const half = Math.min(this.vFov, this.hFov) / 2;
    return (radius * margin) / Math.max(0.08, Math.sin(half));
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Rolling frame-time watch. Sustained misses step the render scale and
   * particle budget down; geometry that carries the game's meaning is
   * never touched.
   */
  sampleFrame(dt: number, now: number): boolean {
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 90) this.frameTimes.shift();
    if (this.frameTimes.length < 90 || now - this.lastDegradeAt < 6) return false;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p80 = sorted[Math.floor(sorted.length * 0.8)]!;
    if (p80 <= 1 / 31) return false;
    const next = degrade(this.quality);
    if (!next) return false;
    this.quality = next;
    this.configureSunShadow();
    this.resize();
    this.frameTimes.length = 0;
    this.lastDegradeAt = now;
    return true;
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
