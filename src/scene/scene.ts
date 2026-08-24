import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Rng } from '../core/rng';
import { buildWorkshop, WorkshopRefs } from './workshop';
import { Unicorn } from './unicorn';
import { Horn } from './horn';
import {
  Tool,
  makeBrush,
  makeCloth,
  RinseTool,
  ResinTool,
  MirrorTool,
  InspectionLamp,
  Prism,
} from './tools';
import { DewDrop, RinseWater, SunSpot, RootGlow, Beam, Spectrum, ResinBead } from './effects';

/**
 * Scene assembly: fixed authored layout, one sun with shadows, a movable
 * inspection lamp, and a camera rig of named shots (portrait-aware).
 */

export interface Shot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
  posPortrait?: THREE.Vector3;
  lookPortrait?: THREE.Vector3;
  fovPortrait?: number;
}

export const SHOTS: Record<string, Shot> = {
  intro: {
    pos: new THREE.Vector3(0.95, 1.22, 1.95),
    look: new THREE.Vector3(-0.05, 0.92, -0.25),
    fov: 50,
    posPortrait: new THREE.Vector3(0.8, 1.28, 2.55),
    fovPortrait: 58,
  },
  work: {
    pos: new THREE.Vector3(0.46, 1.11, 0.83),
    look: new THREE.Vector3(0.24, 1.0, 0.06),
    fov: 44,
    posPortrait: new THREE.Vector3(0.52, 1.16, 1.05),
    fovPortrait: 60,
  },
  cure: {
    pos: new THREE.Vector3(0.68, 1.1, 0.98),
    look: new THREE.Vector3(0.4, 0.98, -0.05),
    fov: 48,
    posPortrait: new THREE.Vector3(0.72, 1.18, 1.25),
    fovPortrait: 62,
  },
  test: {
    pos: new THREE.Vector3(0.62, 1.2, 2.35),
    look: new THREE.Vector3(0.72, 1.08, -0.05),
    fov: 50,
    posPortrait: new THREE.Vector3(0.8, 1.35, 4.0),
    lookPortrait: new THREE.Vector3(0.88, 1.0, -0.2),
    fovPortrait: 58,
  },
};

export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly workshop: WorkshopRefs;
  readonly unicorn: Unicorn;
  readonly horn: Horn;
  readonly hornProxy: THREE.Mesh; // fat invisible touch target around the horn
  readonly lamp: InspectionLamp;
  readonly brush: Tool;
  readonly rinse: RinseTool;
  readonly resin: ResinTool;
  readonly cloth: Tool;
  readonly mirror: MirrorTool;
  readonly prism: Prism;
  readonly dew: DewDrop;
  readonly water: RinseWater;
  readonly sunSpot: SunSpot;
  readonly rootGlow: RootGlow;
  readonly beam: Beam;
  readonly sunBeamIn: Beam; // window → mirror during curing
  readonly sunBeamOut: Beam; // mirror → resin spot
  readonly spectrum: Spectrum;
  readonly resinBead: ResinBead;
  readonly sun: THREE.DirectionalLight;

  // camera rig
  private curShot: Shot = SHOTS.intro;
  private fromPos = new THREE.Vector3();
  private fromLook = new THREE.Vector3();
  private fromFov = 50;
  private lookCur = new THREE.Vector3();
  private shotBlend = 1;
  private shotDur = 1.6;
  /** small user-driven horn yaw during free play */
  hornYaw = 0;
  /** free-play light power via mirror (0.7..1.3) */
  freeLight = 1;

  private dprCap: number;
  private frameTimes: number[] = [];

  constructor(canvasParent: HTMLElement, rng: Rng, lowFx: boolean) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.dprCap = lowFx ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dprCap);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasParent.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 30);

    // environment reflections (quartz, resin, water, metal)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.background = new THREE.Color(0x342e26);

    // ---------- static workshop
    this.workshop = buildWorkshop();
    this.scene.add(this.workshop.group);

    // ---------- unicorn + horn
    this.unicorn = new Unicorn();
    this.unicorn.headGroup.position.set(0.12, 0.79, 0.1);
    this.scene.add(this.unicorn.group);
    this.unicorn.group.updateMatrixWorld(true);

    // horn faces camera side (+z): compute which u faces +z at the anchor
    this.horn = new Horn(rng, this.computeFacingU());
    this.unicorn.hornAnchor.add(this.horn.mesh);

    // forgiving touch proxy: widened cone around the horn
    this.hornProxy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.13, 0.62, 10, 1),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hornProxy.position.y = 0.29;
    this.hornProxy.name = 'horn-proxy';
    this.horn.mesh.add(this.hornProxy);

    // ---------- lights
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
    this.sun.position.set(-1.7, 2.5, -3.1);
    this.sun.target.position.set(0.35, 0.7, 0.35);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 8;
    this.sun.shadow.camera.left = -1.6;
    this.sun.shadow.camera.right = 1.6;
    this.sun.shadow.camera.top = 1.6;
    this.sun.shadow.camera.bottom = -1.6;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun, this.sun.target);

    const hemi = new THREE.HemisphereLight(0xb2c4ce, 0x6b573f, 0.5);
    this.scene.add(hemi);
    // cool fill from the window direction (no shadow)
    const fill = new THREE.DirectionalLight(0xcfe0e6, 0.5);
    fill.position.set(-0.9, 1.6, -2);
    fill.target.position.set(0.3, 0.8, 0.4);
    this.scene.add(fill, fill.target);
    // faint warm bounce from the floor
    const bounce = new THREE.DirectionalLight(0xc9a87c, 0.25);
    bounce.position.set(0.4, 0.1, 1.2);
    bounce.target.position.set(0.2, 1.1, 0);
    this.scene.add(bounce, bounce.target);

    // ---------- tools
    this.lamp = new InspectionLamp();
    this.lamp.group.position.set(0.5, 0.72, -0.32);
    this.scene.add(this.lamp.group);

    this.brush = makeBrush();
    this.brush.setRest(new THREE.Vector3(0.62, 0.75, -0.5), new THREE.Euler(0, 0.4, Math.PI / 2 + 0.3));
    this.scene.add(this.brush.group);

    this.rinse = new RinseTool();
    this.rinse.setRest(new THREE.Vector3(0.72, 0.76, -0.42), new THREE.Euler(0, 0, Math.PI / 2 - 0.2));
    this.scene.add(this.rinse.group);
    this.rinse.buildFlask(this.scene, new THREE.Vector3(1.0, 0.745, -0.55));

    this.resin = new ResinTool();
    this.resin.setRest(new THREE.Vector3(0.88, 0.77, -0.36), new THREE.Euler(0.1, 0, Math.PI / 2 - 0.4));
    this.scene.add(this.resin.group);

    this.cloth = makeCloth();
    this.cloth.setRest(new THREE.Vector3(0.55, 0.75, -0.68), new THREE.Euler(0, -0.5, 0));
    this.scene.add(this.cloth.group);

    this.mirror = new MirrorTool();
    this.mirror.group.position.set(0.78, 0.745, -0.33);
    this.scene.add(this.mirror.group);

    this.prism = new Prism();
    this.prism.group.position.set(
      this.workshop.prismRail.x,
      this.workshop.prismRail.y,
      this.prism.z.value
    );
    this.scene.add(this.prism.group);

    // ---------- effects
    this.dew = new DewDrop();
    this.water = new RinseWater();
    this.sunSpot = new SunSpot();
    this.rootGlow = new RootGlow();
    this.beam = new Beam();
    this.sunBeamIn = new Beam();
    this.sunBeamOut = new Beam();
    this.spectrum = new Spectrum(this.workshop.spectrumWall);
    this.resinBead = new ResinBead();
    this.scene.add(
      this.dew.mesh,
      this.water.group,
      this.sunSpot.sprite,
      this.rootGlow.sprite,
      this.beam.mesh,
      this.sunBeamIn.mesh,
      this.sunBeamOut.mesh,
      this.resinBead.mesh
    );

    // initial camera
    this.jumpTo('intro');
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
  }

  private computeFacingU(): number {
    // world +z (camera side) in horn local space → circumference u that faces the player
    this.unicorn.hornAnchor.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(this.unicorn.hornAnchor.matrixWorld).invert();
    const dir = new THREE.Vector3(0, 0, 1).transformDirection(inv);
    const ang = Math.atan2(dir.z, dir.x);
    return ((ang / (Math.PI * 2)) % 1 + 1) % 1;
  }

  get portrait(): boolean {
    return window.innerHeight > window.innerWidth;
  }

  private shotPos(s: Shot): THREE.Vector3 {
    return this.portrait && s.posPortrait ? s.posPortrait : s.pos;
  }
  private shotLook(s: Shot): THREE.Vector3 {
    return this.portrait && s.lookPortrait ? s.lookPortrait : s.look;
  }
  private shotFov(s: Shot): number {
    return this.portrait && s.fovPortrait ? s.fovPortrait : s.fov;
  }

  jumpTo(name: keyof typeof SHOTS) {
    const s = SHOTS[name];
    this.curShot = s;
    this.shotBlend = 1;
    this.camera.position.copy(this.shotPos(s));
    this.lookCur.copy(this.shotLook(s));
    this.camera.fov = this.shotFov(s);
    this.camera.lookAt(this.shotLook(s));
    this.camera.updateProjectionMatrix();
  }

  transitionTo(name: keyof typeof SHOTS, dur = 1.6) {
    const s = SHOTS[name];
    if (s === this.curShot) return;
    this.fromPos.copy(this.camera.position);
    this.fromLook.copy(this.lookCur);
    this.fromFov = this.camera.fov;
    this.curShot = s;
    this.shotBlend = 0;
    this.shotDur = dur;
  }

  updateCamera(dt: number) {
    if (this.shotBlend < 1) {
      this.shotBlend = Math.min(1, this.shotBlend + dt / this.shotDur);
      const k = this.shotBlend * this.shotBlend * (3 - 2 * this.shotBlend);
      this.camera.position.lerpVectors(this.fromPos, this.shotPos(this.curShot), k);
      this.lookCur.lerpVectors(this.fromLook, this.shotLook(this.curShot), k);
      this.camera.fov = THREE.MathUtils.lerp(this.fromFov, this.shotFov(this.curShot), k);
      this.camera.updateProjectionMatrix();
    } else {
      // settle exactly (also adapts on orientation change)
      this.camera.position.lerp(this.shotPos(this.curShot), 1 - Math.pow(0.05, dt));
      this.lookCur.lerp(this.shotLook(this.curShot), 1 - Math.pow(0.05, dt));
      const targetFov = this.shotFov(this.curShot);
      if (Math.abs(this.camera.fov - targetFov) > 0.01) {
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.pow(0.05, dt));
        this.camera.updateProjectionMatrix();
      }
    }
    this.camera.lookAt(this.lookCur);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /** Dynamic resolution: back off DPR when frames run long (mobile safety). */
  trackPerformance(frameMs: number) {
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length >= 90) {
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.frameTimes.length = 0;
      const cur = this.renderer.getPixelRatio();
      if (avg > 30 && cur > 0.75) {
        this.renderer.setPixelRatio(Math.max(0.75, cur * 0.85));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      } else if (avg < 15 && cur < this.dprCap) {
        this.renderer.setPixelRatio(Math.min(this.dprCap, cur * 1.1));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    }
  }

  /** World position of the horn tip. */
  hornTip(out = new THREE.Vector3()): THREE.Vector3 {
    out.set(0, 0.558, 0);
    return this.horn.mesh.localToWorld(out);
  }

  hornBase(out = new THREE.Vector3()): THREE.Vector3 {
    out.set(0, 0.01, 0);
    return this.horn.mesh.localToWorld(out);
  }

  /** Point along the horn axis at t, world. */
  hornAxisPoint(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    out.set(0, t * 0.56, 0);
    return this.horn.mesh.localToWorld(out);
  }

  prismWorld(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.prism.group.position);
  }

  /** Convert prism z + horn yaw to spectrum uv params on the wall plane. */
  spectrumParams(): { center: THREE.Vector2; dir: THREE.Vector2 } {
    const pz = this.prism.group.position.z;
    const wallZ = 0.1;
    const u = 0.5 - (pz - wallZ) / 2.6;
    const v = 0.5 + (this.workshop.prismRail.y - 1.25) / 2.0 - 0.03;
    // band leans away from the beam's incoming side; horn yaw skews it
    const lean = THREE.MathUtils.clamp((pz - 0.06) * 1.1 + this.hornYaw * 2.2, -0.5, 0.5);
    return {
      center: new THREE.Vector2(u, v),
      dir: new THREE.Vector2(lean, -1).normalize(),
    };
  }
}
