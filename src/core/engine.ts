import * as THREE from 'three';

/**
 * Headless CI runs software-rasterise WebGL, where full-resolution PBR costs
 * seconds per frame. `?fast=1` drops to a token resolution with no shadows so
 * a whole play-through can be driven in a test. It never affects real devices.
 */
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const FAST = params.get('fast') === '1';
const FAST_PX = Number(params.get('px') ?? '0.35');

export interface QualityLevel {
  pixelRatio: number;
  shadowMapSize: number;
  shadows: boolean;
  waterSegments: number;
  transmission: boolean;
}

const LEVELS: QualityLevel[] = [
  { pixelRatio: 2.0, shadowMapSize: 2048, shadows: true, waterSegments: 96, transmission: true },
  { pixelRatio: 1.5, shadowMapSize: 1536, shadows: true, waterSegments: 72, transmission: true },
  { pixelRatio: 1.15, shadowMapSize: 1024, shadows: true, waterSegments: 56, transmission: true },
  { pixelRatio: 0.9, shadowMapSize: 768, shadows: true, waterSegments: 40, transmission: false },
  { pixelRatio: 0.72, shadowMapSize: 512, shadows: false, waterSegments: 32, transmission: false },
];

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly clock = new THREE.Clock();
  environment!: THREE.Texture;

  qualityIndex = 1;
  private frameAccum = 0;
  private frameCount = 0;
  private lastAdjust = 0;
  private onQualityChange: ((q: QualityLevel) => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: dpr < 1.6,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x05070a, 1);

    // start conservatively on phones, generously on iPad-class hardware
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const big = Math.min(window.innerWidth, window.innerHeight) > 700;
    this.qualityIndex = coarse ? (big ? 1 : 2) : 0;

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.05, 400);
    this.scene.fog = new THREE.FogExp2(0xa6c0d2, 0.0058);
    this.applyQuality();
    this.resize();
  }

  /** Everything the real ladder offers, at a token resolution, for headless runs. */
  private readonly fastLevel: QualityLevel = {
    pixelRatio: FAST_PX,
    shadowMapSize: 1024,
    shadows: true,
    waterSegments: 72,
    transmission: true,
  };

  get quality(): QualityLevel {
    return FAST ? this.fastLevel : LEVELS[this.qualityIndex];
  }

  onQuality(fn: (q: QualityLevel) => void) {
    this.onQualityChange.push(fn);
    fn(this.quality);
  }

  private applyQuality() {
    const q = this.quality;
    const dpr = FAST ? q.pixelRatio : Math.min(window.devicePixelRatio || 1, q.pixelRatio);
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = q.shadows;
    for (const fn of this.onQualityChange) fn(q);
  }

  /** Cheap purpose-built IBL: cool daylight from the floor opening, warm plant lamps. */
  buildEnvironment() {
    const env = new THREE.Scene();
    const box = new THREE.BoxGeometry(1, 1, 1);
    const add = (color: number, intensity: number, pos: [number, number, number], scale: [number, number, number]) => {
      const m = new THREE.Mesh(
        box,
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.BackSide }),
      );
      m.position.set(...pos);
      m.scale.set(...scale);
      env.add(m);
    };
    // enclosing room — dark damp concrete
    add(0x1b2026, 0.55, [0, 0, 0], [22, 14, 22]);
    const panel = (color: number, intensity: number, pos: [number, number, number], scale: [number, number, number]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }));
      m.position.set(...pos);
      m.scale.set(...scale);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(0xbcd8f2, 9.0, [-2.4, 6.6, 2.2], [6, 6, 1]); // daylight shaft
    panel(0xffe0b4, 3.2, [4.5, 6.2, -3.5], [4, 2, 1]); // ceiling lamp bank
    panel(0xffd7a2, 2.4, [-5.0, 5.8, -4.0], [3, 1.6, 1]);
    panel(0x2c3d4c, 1.5, [0, -6.5, 0], [14, 14, 1]); // wet floor bounce
    panel(0x8fb6d4, 1.1, [6.5, 1.0, 5.0], [5, 6, 1]);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this.environment = pmrem.fromScene(env, 0.045).texture;
    pmrem.dispose();
    env.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.material) (m.material as THREE.Material).dispose();
    });
    box.dispose();
    return this.environment;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    // widen the vertical field in portrait so the shaft from basement to tower fits
    const portrait = h >= w;
    this.camera.fov = portrait ? 58 : 46;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /** Watches frame cost and walks the quality ladder to hold a steady rate. */
  sampleFrame(dt: number, now: number) {
    if (FAST) return;
    this.frameAccum += dt;
    this.frameCount++;
    if (now - this.lastAdjust < 2.2 || this.frameCount < 40) return;
    const avg = this.frameAccum / this.frameCount;
    this.frameAccum = 0;
    this.frameCount = 0;
    this.lastAdjust = now;
    const fps = 1 / avg;
    if (fps < 27 && this.qualityIndex < LEVELS.length - 1) {
      this.qualityIndex++;
      this.applyQuality();
    } else if (fps > 57 && this.qualityIndex > 0) {
      this.qualityIndex--;
      this.applyQuality();
    }
  }
}
