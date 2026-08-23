import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Phase } from './state';
import { getGlyph, GlyphDef } from './glyphs';
import { buildMoldField, MoldField } from './moldField';
import { SandBed, FLASK_W, PRESS_DEPTH } from './sand';
import { buildPatternMesh, buildCastMesh, buildFinishedMesh, CastResult, PATTERN_THICK } from './letterMeshes';
import { buildFoundry, FoundryRefs, SAND_Y, CARRIAGE_HOME_X, TABLE_Y } from './foundry';
import { CameraDirector } from './camera';
import { Particles } from './particles';
import { Foley } from './audio';
import { TouchHint } from '../ui/hints';
import { Overlay } from '../ui/overlay';

const RAISED_LETTER_BOTTOM = 1.245;
const APPROACH_END = 0.7;      // lever fraction spent approaching the sand

interface Clump {
  mesh: THREE.Mesh;
  alive: boolean;
}

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  director: CameraDirector;
  foundry: FoundryRefs;
  sand: SandBed;
  particles = new Particles();
  foley = new Foley();
  hint: TouchHint;
  overlay: Overlay;

  phase: Phase = Phase.TITLE;
  letter = 'O';
  glyph: GlyphDef = getGlyph('O');
  field: MoldField;
  patternMesh: THREE.Mesh;
  cast: CastResult;
  private castPivot = new THREE.Group();

  // per-phase progress
  lever = 0;            // 0 up .. 1 down
  carriageX = CARRIAGE_HOME_X;
  fill = 0;
  temp = 1;
  flaskOpen = 0;
  crumbleT = -1;        // -1 = not started
  private pressedOnce = false;
  private contactPlayed = false;
  private phaseT = 0;
  private idleT = 0;
  private revealStage = 0;
  private revealT = 0;
  private coolTickAt = 0;
  private brushMesh: THREE.Group;
  private clumps: Clump[] = [];
  private brushSoundAt = 0;
  private trophies: THREE.Mesh[] = [];
  private completed = new Set<string>();
  private carriageReturnT = -1;
  private lastBrushPos: THREE.Vector3 | null = null;

  // pour stream
  private stream: THREE.Mesh;
  private streamMat: THREE.MeshStandardMaterial;
  private pourHeld = false;
  private tilt = 0;

  // input
  private activePointer = -1;
  private lastPX = 0; private lastPY = 0;
  private raycaster = new THREE.Raycaster();

  // timing profile (E2E fast mode shortens observation-only waits)
  fast: boolean;
  private durCool: number;
  private durPour: number;
  private durReveal: number;

  // quality
  private tier = 0;
  private fpsAcc = 0; private fpsN = 0; private fpsT = 0;
  private dirLight: THREE.DirectionalLight;

  errors: string[] = [];

  private clock = new THREE.Clock();

  constructor(private container: HTMLElement, uiRoot: HTMLElement) {
    this.fast = new URLSearchParams(location.search).has('e2e');
    this.durCool = this.fast ? 1.0 : 7.0;
    this.durPour = this.fast ? 0.9 : 4.2;
    this.durReveal = this.fast ? 0.6 : 2.6;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.fast ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x1b1712);
    this.scene.fog = new THREE.Fog(0x1b1712, 4.5, 9.5);

    // image-based ambient so metals and glass read as materials
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();

    // lights
    const hemi = new THREE.HemisphereLight(0xcfd4d8, 0x54452f, 0.5);
    this.scene.add(hemi);
    this.dirLight = new THREE.DirectionalLight(0xfff1de, 2.7);
    this.dirLight.position.set(0.9, 3.4, 0.9);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.left = -1.7;
    this.dirLight.shadow.camera.right = 1.7;
    this.dirLight.shadow.camera.top = 2.4;
    this.dirLight.shadow.camera.bottom = -1.2;
    this.dirLight.shadow.camera.far = 9;
    this.dirLight.shadow.bias = -0.0006;
    this.dirLight.shadow.normalBias = 0.01;
    this.scene.add(this.dirLight);
    const bench = new THREE.PointLight(0xffe4bb, 0.5, 3.5, 2);
    bench.position.set(0.1, 2.3, 0.5);
    this.scene.add(bench);

    this.foundry = buildFoundry();
    this.scene.add(this.foundry.group);

    this.sand = new SandBed(this.fast ? 96 : 128);
    this.sand.mesh.position.y = SAND_Y;
    this.scene.add(this.sand.mesh);

    this.field = buildMoldField(this.glyph);
    this.sand.setField(this.field);
    this.sand.rebuild();

    this.patternMesh = buildPatternMesh(this.glyph);
    this.patternMesh.position.y = -PATTERN_THICK;
    this.foundry.patternSocket.add(this.patternMesh);

    this.cast = buildCastMesh(this.glyph, this.field);
    this.castPivot.position.y = SAND_Y;
    this.castPivot.add(this.cast.mesh, this.cast.runner);
    this.scene.add(this.castPivot);
    this.syncCastEnv();

    this.scene.add(this.particles.points);

    this.director = new CameraDirector(container.clientWidth / container.clientHeight);

    this.brushMesh = this.buildBrush();
    this.brushMesh.position.set(0.52, TABLE_Y + 0.05, 0.42);
    this.brushMesh.rotation.z = 0.1;
    this.scene.add(this.brushMesh);

    // pour stream
    const sGeo = new THREE.CylinderGeometry(0.011, 0.016, 1, 10, 1, true);
    sGeo.translate(0, -0.5, 0);
    this.streamMat = new THREE.MeshStandardMaterial({
      color: 0x351505, emissive: 0xff5a10, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.2,
    });
    this.stream = new THREE.Mesh(sGeo, this.streamMat);
    this.stream.visible = false;
    this.scene.add(this.stream);

    this.hint = new TouchHint(uiRoot);
    this.overlay = new Overlay(uiRoot);
    this.overlay.onPick = (l) => this.startCycle(l);

    this.bindInput();
    this.bindErrors();
    window.addEventListener('resize', () => this.onResize());

    this.setPhase(Phase.TITLE);
  }

  /* ------------------------------------------------------------ utils */

  private buildBrush(): THREE.Group {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.017, 0.16, 10),
      new THREE.MeshStandardMaterial({ color: 0x7a5b39, roughness: 0.8 })
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.09, 0.035, 0);
    handle.castShadow = true;
    g.add(handle);
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.025, 0.045),
      new THREE.MeshStandardMaterial({ color: 0x6b4e30, roughness: 0.85 })
    );
    block.position.y = 0.035;
    block.castShadow = true;
    g.add(block);
    const bristles = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.028, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xcbb88a, roughness: 1 })
    );
    bristles.position.y = 0.012;
    g.add(bristles);
    return g;
  }

  private worldToNdc(p: THREE.Vector3): THREE.Vector2 {
    const v = p.clone().project(this.director.camera);
    return new THREE.Vector2(v.x, v.y);
  }

  private portrait(): boolean {
    return this.container.clientHeight > this.container.clientWidth;
  }

  private hintDelay(): number {
    if (this.letter === 'O') return 2.5;
    if (this.letter === 'A') return 5.5;
    return 9;
  }

  private bindErrors() {
    window.addEventListener('error', (e) => this.errors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) =>
      this.errors.push(String(e.reason)));
  }

  /* ----------------------------------------------------------- phases */

  setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    this.idleT = 0;
    this.hint.hide();
    this.director.moveTo(p, this.portrait(), p === Phase.TITLE ? 0.1 : 1.7);

    if (p === Phase.BRUSH) this.spawnClumps();
    if (p === Phase.POUR) { /* crucible ready */ }
    if (p === Phase.COOL) { this.foley.sizzle(); }
    if (p === Phase.REVEAL) { this.revealStage = 0; this.revealT = 0; }
    if (p === Phase.DONE) {
      this.overlay.markDone(this.letter);
      this.completed.add(this.letter);
      this.overlay.show();
    } else {
      this.overlay.hide();
    }
  }

  /** start (or restart) a full cycle with a letter */
  startCycle(letter: string) {
    // retire the previous cast as a bench trophy (uses the OLD glyph)
    if (this.completed.size > 0 && this.cast.mesh.parent) {
      this.placeTrophy();
    }

    this.letter = letter;
    this.glyph = getGlyph(letter);
    this.field = buildMoldField(this.glyph);

    // fresh sand
    this.sand.setField(this.field);
    this.sand.rebuild();

    // fresh pattern
    this.foundry.patternSocket.remove(this.patternMesh);
    this.patternMesh.geometry.dispose();
    this.patternMesh = buildPatternMesh(this.glyph);
    this.patternMesh.position.y = -PATTERN_THICK;
    this.foundry.patternSocket.add(this.patternMesh);

    // fresh cast
    this.castPivot.clear();
    this.castPivot.position.set(0, SAND_Y, 0);
    this.castPivot.rotation.set(0, 0, 0);
    if (this.castPivot.parent !== this.scene) this.scene.add(this.castPivot);
    this.cast = buildCastMesh(this.glyph, this.field);
    this.castPivot.add(this.cast.mesh, this.cast.runner);
    this.syncCastEnv();

    // rig reset
    this.lever = 0;
    this.carriageX = CARRIAGE_HOME_X;
    this.fill = 0;
    this.temp = 1;
    this.flaskOpen = 0;
    this.crumbleT = -1;
    this.pressedOnce = false;
    this.contactPlayed = false;
    this.carriageReturnT = -1;
    this.cast.uniforms.uFill.value = 0;
    this.cast.uniforms.uTemp.value = 1;
    this.foundry.flaskFront.rotation.y = 0;
    this.foundry.gripper.position.set(0, 2.6, 0);
    for (const c of this.clumps) this.scene.remove(c.mesh);
    this.clumps = [];
    this.brushMesh.position.set(0.52, TABLE_Y + 0.05, 0.42);
    this.brushMesh.rotation.set(0, 0, 0.1);

    this.setPhase(Phase.ALIGN);
  }

  private placeTrophy() {
    // bench space is finite - after that, old casts just leave the shot
    if (this.trophies.length >= 5) {
      this.castPivot.parent?.remove(this.castPivot);
      this.foundry.gripper.remove(this.castPivot);
      return;
    }
    const m = buildFinishedMesh(this.glyph);
    const s = 0.42;
    m.scale.setScalar(s);
    m.rotation.x = Math.PI / 2;
    const idx = this.trophies.length;
    m.position.set(-0.58 + idx * 0.24, TABLE_Y + (0.62 * FLASK_W * s) / 2 + 0.01, -0.42);
    m.rotation.z = (idx % 2 ? -1 : 1) * 0.06;
    this.scene.add(m);
    this.trophies.push(m);
    // remove the lifted cast
    this.castPivot.parent?.remove(this.castPivot);
    this.foundry.gripper.remove(this.castPivot);
  }

  /* ------------------------------------------------------------ input */

  private bindInput() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      this.foley.unlock();
      if (this.activePointer !== -1) return;
      this.activePointer = e.pointerId;
      this.lastPX = e.clientX; this.lastPY = e.clientY;
      this.idleT = 0;
      if (this.phase === Phase.POUR) this.setPourHeld(true);
      if (this.phase === Phase.BRUSH) this.brushAt(e.clientX, e.clientY, true);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activePointer) return;
      const dx = e.clientX - this.lastPX;
      const dy = e.clientY - this.lastPY;
      this.lastPX = e.clientX; this.lastPY = e.clientY;
      this.idleT = 0;
      this.onDrag(dx, dy, e.clientX, e.clientY);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointer) return;
      this.activePointer = -1;
      if (this.phase === Phase.POUR) this.setPourHeld(false);
      this.lastBrushPos = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  private onDrag(dx: number, dy: number, px: number, py: number) {
    const h = this.container.clientHeight;
    const w = this.container.clientWidth;
    switch (this.phase) {
      case Phase.ALIGN: {
        // slide the carriage: any horizontal drag, generous mapping
        this.setCarriage(this.carriageX + dx / w * 1.5);
        break;
      }
      case Phase.PRESS: {
        this.setLever(this.lever + dy / (h * 0.4));
        break;
      }
      case Phase.RAISE: {
        this.setLever(this.lever + dy / (h * 0.4));
        break;
      }
      case Phase.BRUSH: {
        this.brushAt(px, py, false);
        break;
      }
      case Phase.BREAK: {
        // pull the front wall open: rightward / downward drag
        this.setFlaskOpen(this.flaskOpen + (dx + dy) / (w * 0.5));
        break;
      }
      default: break;
    }
  }

  /* -------- control setters (shared by touch input and the E2E driver) */

  setCarriage(x: number) {
    if (this.phase !== Phase.ALIGN) return;
    this.carriageX = Math.min(CARRIAGE_HOME_X + 0.05, Math.max(-0.12, x));
    if (Math.abs(this.carriageX) < 0.055) {
      this.carriageX = 0;
      this.foley.slideClick();
      this.setPhase(Phase.PRESS);
    }
  }

  setLever(v: number) {
    if (this.phase !== Phase.PRESS && this.phase !== Phase.RAISE) return;
    const prev = this.lever;
    this.lever = Math.min(1, Math.max(0, v));
    if (Math.abs(this.lever - prev) > 0.01 && Math.random() < 0.2) this.foley.leverCreak();

    // sand compaction follows the pattern bottom
    const bottom = this.letterBottomY();
    if (bottom < SAND_Y) {
      const press = (SAND_Y - bottom) / PRESS_DEPTH;
      if (!this.contactPlayed && press > 0.02) {
        this.contactPlayed = true;
        this.foley.pressCrunch();
        this.puffSand(0.35);
      }
      this.sand.setPress(press);
    }

    if (this.phase === Phase.PRESS && this.lever >= 0.985) {
      this.pressedOnce = true;
      this.foley.latchClink();
      this.setPhase(Phase.RAISE);
    } else if (this.phase === Phase.RAISE && this.pressedOnce && this.lever <= 0.02) {
      this.lever = 0;
      this.foley.patternRelease();
      this.puffSand(0.15);
      this.carriageReturnT = 0;
      this.setPhase(Phase.BRUSH);
    }
  }

  private letterBottomY(): number {
    const p = this.lever;
    let y: number;
    if (p < APPROACH_END) {
      y = RAISED_LETTER_BOTTOM + (SAND_Y - RAISED_LETTER_BOTTOM) * (p / APPROACH_END);
    } else {
      y = SAND_Y - PRESS_DEPTH * ((p - APPROACH_END) / (1 - APPROACH_END));
    }
    return y;
  }

  private puffSand(strength: number) {
    const c = new THREE.Color(0x9a815e);
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.18 + Math.random() * 0.16;
      this.particles.spawn(
        new THREE.Vector3(Math.cos(a) * r, SAND_Y + 0.02, Math.sin(a) * r),
        new THREE.Vector3(Math.cos(a) * 0.2 * strength, 0.25 * strength, Math.sin(a) * 0.2 * strength),
        0.05, 10, c, 0.01, 0.7);
    }
  }

  private spawnClumps() {
    // loose sand left on the mold face - a couple sit right on the islands
    const spots: [number, number][] = [];
    const n = this.field.n;
    const want = 6;
    let guard = 0;
    while (spots.length < want && guard++ < 4000) {
      const i = 8 + Math.floor(Math.random() * (n - 16));
      const j = 8 + Math.floor(Math.random() * (n - 16));
      const idx = j * n + i;
      const d = this.field.depress[idx];
      const isIsland = this.field.island[idx] > 0;
      const nearEdge = d < 0.15 && (
        this.field.depress[idx + 4] > 0.5 || this.field.depress[idx - 4] > 0.5 ||
        this.field.depress[idx + 4 * n] > 0.5 || this.field.depress[idx - 4 * n] > 0.5);
      const wantIsland = spots.length < 2 && this.glyph.counterCount > 0;
      if ((wantIsland && isIsland) || (!wantIsland && nearEdge)) {
        spots.push([(i / n - 0.5) * FLASK_W, (j / n - 0.5) * FLASK_W]);
      }
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0x8d7554, roughness: 1 });
    for (const [x, z] of spots) {
      const g = new THREE.SphereGeometry(0.02 + Math.random() * 0.012, 8, 6);
      g.scale(1, 0.45, 1);
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, SAND_Y + this.sand.heightAt(x, z) + 0.006, z);
      m.castShadow = true;
      this.scene.add(m);
      this.clumps.push({ mesh: m, alive: true });
    }
  }

  private brushAt(px: number, py: number, start: boolean) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((px - rect.left) / rect.width) * 2 - 1,
      -((py - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.director.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SAND_Y);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, hit)) return;
    hit.x = Math.min(0.5, Math.max(-0.5, hit.x));
    hit.z = Math.min(0.5, Math.max(-0.5, hit.z));
    this.brushMesh.position.set(hit.x, SAND_Y + 0.012, hit.z);
    this.brushMesh.rotation.set(0, Math.atan2(hit.x, hit.z), 0);

    const now = performance.now();
    if (!start && this.lastBrushPos) {
      const dist = this.lastBrushPos.distanceTo(hit);
      if (dist > 0.01 && now - this.brushSoundAt > 260) {
        this.brushSoundAt = now;
        this.foley.brushSwish();
      }
      // sweep grains along the stroke
      if (dist > 0.008) {
        this.particles.spawn(hit.clone().setY(SAND_Y + 0.01),
          hit.clone().sub(this.lastBrushPos).normalize().multiplyScalar(0.3).setY(0.12),
          0.03, 3, new THREE.Color(0x9a815e), 0.008, 0.5);
      }
    }
    this.lastBrushPos = hit.clone();

    let left = 0;
    for (const c of this.clumps) {
      if (!c.alive) continue;
      if (c.mesh.position.distanceTo(hit) < 0.1) {
        c.alive = false;
        this.scene.remove(c.mesh);
        this.particles.spawn(c.mesh.position,
          new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.3, (Math.random() - 0.5) * 0.5),
          0.04, 14, new THREE.Color(0x9a815e), 0.01, 0.8);
      } else left++;
    }
    if (left === 0 && this.clumps.length > 0 && this.phase === Phase.BRUSH) {
      this.setPhase(Phase.POUR);
    }
  }

  /** E2E convenience: sweep every clump */
  sweepAll() {
    if (this.phase !== Phase.BRUSH) return;
    for (const c of this.clumps) {
      if (c.alive) { c.alive = false; this.scene.remove(c.mesh); }
    }
    this.setPhase(Phase.POUR);
  }

  setPourHeld(held: boolean) {
    if (this.phase !== Phase.POUR) { this.pourHeld = false; return; }
    if (held && !this.pourHeld) this.foley.pourStart();
    if (!held && this.pourHeld) this.foley.pourStop();
    this.pourHeld = held;
  }

  setFlaskOpen(v: number) {
    if (this.phase !== Phase.BREAK || this.crumbleT >= 0) return;
    const prev = this.flaskOpen;
    this.flaskOpen = Math.min(1, Math.max(0, v));
    if (this.flaskOpen > 0.05 && prev <= 0.05) this.foley.latchClink();
    if (this.flaskOpen >= 0.85) {
      this.flaskOpen = 1;
      this.crumbleT = 0;
      this.foley.crumble();
    }
  }

  /* ------------------------------------------------------------ frame */

  start() {
    // the dt clamp guards against tab-switch spikes; test mode allows big
    // steps so logical time does not dilate under slow software rendering
    const maxDt = this.fast ? 0.34 : 0.05;
    this.renderer.setAnimationLoop(() => {
      try {
        this.update(Math.min(maxDt, this.clock.getDelta()));
      } catch (err) {
        this.errors.push(String(err));
        throw err;
      }
    });
  }

  private update(dt: number) {
    this.phaseT += dt;
    this.idleT += dt;

    // rig positions from state
    this.foundry.carriage.position.x = this.carriageX;
    const bottom = this.letterBottomY();
    this.foundry.ram.position.y = bottom - (RAISED_LETTER_BOTTOM);
    this.foundry.pressLever.rotation.z = 0.5 - this.lever * 1.05
      + (this.phase === Phase.TITLE || this.phase === Phase.ALIGN
        ? Math.sin(this.phaseT * 1.9) * 0.022 : 0); // self-weight rock

    // carriage motors back home after the press
    if (this.carriageReturnT >= 0) {
      this.carriageReturnT += dt;
      const k = Math.min(1, this.carriageReturnT / 1.2);
      this.foundry.carriage.position.x = (CARRIAGE_HOME_X) * (k * k * (3 - 2 * k));
      if (k >= 1) this.carriageReturnT = -1;
    } else if (this.phase !== Phase.ALIGN && this.phase !== Phase.PRESS && this.phase !== Phase.RAISE) {
      this.foundry.carriage.position.x = CARRIAGE_HOME_X;
    }

    this.sand.rebuild();

    switch (this.phase) {
      case Phase.TITLE:
        if (this.phaseT > 1.1) this.setPhase(Phase.ALIGN);
        break;
      case Phase.POUR: this.updatePour(dt); break;
      case Phase.COOL: this.updateCool(dt); break;
      case Phase.BREAK: this.updateBreak(dt); break;
      case Phase.REVEAL: this.updateReveal(dt); break;
      default: break;
    }

    // cast visibility: nothing to see before pouring
    const showCast = this.fill > 0.001;
    this.cast.mesh.visible = showCast;
    this.cast.runner.visible = showCast && this.crumbleT < 0.5;

    // flask front wall
    this.foundry.flaskFront.rotation.y = -this.flaskOpen * 1.25;

    // crucible
    const wantTilt = (this.phase === Phase.POUR && this.pourHeld) ? 1 : 0;
    this.tilt += (wantTilt - this.tilt) * Math.min(1, dt * 3.5);
    this.foundry.crucibleTilt.rotation.z = -this.tilt * 0.85;
    this.foundry.crucibleLever.rotation.x = 0.35 + this.tilt * 0.6;
    this.updateStream();

    // ambient motion: robot head scanning, melt surface shimmer
    this.foundry.robotHead.rotation.y = Math.sin(this.clock.elapsedTime * 0.4) * 0.5;
    const ms = this.foundry.meltSurface.material as THREE.MeshStandardMaterial;
    ms.emissiveIntensity = 1.4 + Math.sin(this.clock.elapsedTime * 2.3) * 0.2;
    this.foundry.furnaceGlow.intensity = 1.5 + Math.sin(this.clock.elapsedTime * 3.1) * 0.18;

    this.particles.update(dt, SAND_Y + 0.004);
    this.updateHint();
    this.director.update(dt);
    this.renderer.render(this.scene, this.director.camera);
    this.trackFps(dt);
  }

  /** hot metal barely mirrors the (bright) shop - fade reflections in as it cools */
  private syncCastEnv() {
    const t = this.cast.uniforms.uTemp.value;
    const m = this.cast.mesh.material as THREE.MeshStandardMaterial;
    m.envMapIntensity = 1 - t * 0.92;
  }

  private updatePour(dt: number) {
    if (this.pourHeld && this.tilt > 0.5) {
      this.fill = Math.min(1, this.fill + dt / this.durPour);
      this.cast.uniforms.uFill.value = this.fill * 1.06;
      this.foley.setPourLevel(1);
      // splash at the basin
      if (Math.random() < 0.6) {
        this.particles.spawn(this.basinPoint(), new THREE.Vector3(0.05, 0.25, 0),
          0.02, 2, new THREE.Color(0xffa040), 0.008, 0.35, true);
      }
    } else {
      this.foley.setPourLevel(this.tilt > 0.5 ? 0.4 : 0);
    }
    if (this.fill >= 1 && this.tilt < 0.15) {
      this.setPourHeld(false);
      this.setPhase(Phase.COOL);
    } else if (this.fill >= 1) {
      // metal is in - let go happens naturally as tilt returns
      this.pourHeld = false;
      this.foley.pourStop();
    }
  }

  private basinPoint(): THREE.Vector3 {
    const zGate = (this.field.gateUv[1] - 0.5) * FLASK_W;
    return new THREE.Vector3(-FLASK_W / 2 + 0.02, SAND_Y + 0.03, zGate);
  }

  private updateStream() {
    const show = this.tilt > 0.55;
    this.stream.visible = show;
    if (!show) return;
    const tip = new THREE.Vector3();
    this.foundry.spoutTip.getWorldPosition(tip);
    const target = this.basinPoint();
    const dir = target.clone().sub(tip);
    const len = dir.length();
    this.stream.position.copy(tip);
    this.stream.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
    this.stream.scale.set(1, len, 1);
    const w = 0.75 + Math.sin(this.clock.elapsedTime * 21) * 0.18;
    this.streamMat.emissiveIntensity = 1.1 * w + 0.5;
  }

  private updateCool(dt: number) {
    this.temp = Math.max(0, this.temp - dt / this.durCool);
    const eased = this.temp * this.temp * (3 - 2 * this.temp);
    this.cast.uniforms.uTemp.value = eased;
    this.syncCastEnv();
    this.streamMat.emissiveIntensity = 0;
    if (this.phaseT > this.coolTickAt) {
      this.foley.coolTick();
      this.coolTickAt = this.phaseT + 0.4 + Math.random() * 0.9;
    }
    if (this.temp <= 0) {
      this.foley.latchClink();
      this.setPhase(Phase.BREAK);
    }
  }

  private updateBreak(dt: number) {
    if (this.crumbleT >= 0 && this.crumbleT < 10) {
      this.crumbleT += dt;
      const k = Math.min(1, this.crumbleT / 1.3);
      this.sand.setCrumble(k);
      if (Math.random() < 0.7 && k < 1) {
        const a = Math.random() * Math.PI * 2, r = 0.1 + Math.random() * 0.24;
        this.particles.spawn(
          new THREE.Vector3(Math.cos(a) * r, SAND_Y + 0.03, Math.sin(a) * r),
          new THREE.Vector3(Math.cos(a) * 0.3, 0.15, Math.sin(a) * 0.35),
          0.06, 6, new THREE.Color(0x8d7554), 0.011, 0.9);
      }
      if (k >= 1 && this.crumbleT > 1.8) {
        this.crumbleT = 20; // done
        this.setPhase(Phase.REVEAL);
      }
    }
  }

  private updateReveal(dt: number) {
    this.revealT += dt;
    const g = this.foundry.gripper;
    const fast = this.fast ? 2.6 : 1;
    if (this.revealStage === 0) {
      // descend over the letter
      const k = Math.min(1, this.revealT * 0.9 * fast);
      const s = k * k * (3 - 2 * k);
      g.position.set(0, 2.6 - s * (2.6 - (SAND_Y + 0.42)), 0);
      for (const f of this.foundry.gripperFingers) {
        f.position.x = Math.sign(f.position.x) * (0.09 - s * 0.0);
      }
      if (k >= 1) { this.revealStage = 1; this.revealT = 0; }
    } else if (this.revealStage === 1) {
      // close fingers, grab
      const k = Math.min(1, this.revealT * 2.2 * fast);
      for (const f of this.foundry.gripperFingers) {
        f.position.x = Math.sign(f.position.x) * (0.09 - k * 0.045);
      }
      if (k >= 1) {
        this.revealStage = 2; this.revealT = 0;
        // hand the cast to the gripper
        this.castPivot.position.set(0, -0.42 - 0.02, 0);
        this.cast.runner.visible = false;
        this.foundry.gripper.add(this.castPivot);
        this.foley.slideClick();
      }
    } else if (this.revealStage === 2) {
      // lift + turn the letter to face the child
      const k = Math.min(1, this.revealT * 0.55 * fast);
      const s = k * k * (3 - 2 * k);
      g.position.set(0, (SAND_Y + 0.42) + s * (1.62 - (SAND_Y + 0.42)), -0.2 * s);
      this.castPivot.rotation.x = s * Math.PI / 2;
      this.castPivot.position.set(0, -0.42 + s * 0.14, s * 0.05);
      if (k >= 1) {
        this.revealStage = 3; this.revealT = 0;
        this.foley.chime();
        this.foley.sayLetter(this.glyph.nameJa);
      }
    } else if (this.revealStage === 3) {
      // hold: silhouette + holes read against the shop
      if (this.revealT > this.durReveal) this.setPhase(Phase.DONE);
    }
  }

  /* ------------------------------------------------------------ hints */

  private updateHint() {
    const delay = this.hintDelay();
    const needsInput =
      this.phase === Phase.ALIGN || this.phase === Phase.PRESS ||
      this.phase === Phase.RAISE || this.phase === Phase.BRUSH ||
      this.phase === Phase.POUR || (this.phase === Phase.BREAK && this.crumbleT < 0);
    if (!needsInput || this.idleT < delay || this.activePointer !== -1) {
      this.hint.hide();
      return;
    }
    const t = ((this.idleT - delay) % 2.2) / 2.2;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    let from: THREE.Vector2, to: THREE.Vector2;
    const grip = new THREE.Vector3();
    switch (this.phase) {
      case Phase.ALIGN: {
        this.foundry.carriage.getWorldPosition(grip);
        grip.y -= 0.5;
        from = this.worldToNdc(grip);
        to = this.worldToNdc(new THREE.Vector3(0, grip.y, 0));
        break;
      }
      case Phase.PRESS: case Phase.RAISE: {
        this.foundry.pressLever.getWorldPosition(grip);
        grip.y += 0.5 - this.lever * 0.5;
        from = this.worldToNdc(grip);
        to = from.clone().add(new THREE.Vector2(0, this.phase === Phase.PRESS ? -0.42 : 0.42));
        break;
      }
      case Phase.BRUSH: {
        from = this.worldToNdc(new THREE.Vector3(-0.22, SAND_Y + 0.02, 0.1));
        to = this.worldToNdc(new THREE.Vector3(0.24, SAND_Y + 0.02, -0.08));
        break;
      }
      case Phase.POUR: {
        this.foundry.crucibleLever.getWorldPosition(grip);
        grip.y += 0.4;
        from = this.worldToNdc(grip);
        to = from.clone();
        break;
      }
      case Phase.BREAK: {
        this.foundry.flaskLatch.getWorldPosition(grip);
        from = this.worldToNdc(grip);
        to = this.worldToNdc(grip.clone().add(new THREE.Vector3(0.3, -0.05, 0.25)));
        break;
      }
      default: return;
    }
    this.hint.show(from, to, t, w, h);
  }

  /* ---------------------------------------------------------- quality */

  private trackFps(dt: number) {
    if (this.fast) return;
    this.fpsAcc += dt; this.fpsN++; this.fpsT += dt;
    if (this.fpsT > 2.5 && this.fpsN > 10) {
      const avg = this.fpsN / this.fpsAcc;
      this.fpsAcc = 0; this.fpsN = 0; this.fpsT = 0;
      if (avg < 28 && this.tier < 2) {
        this.tier++;
        if (this.tier === 1) {
          this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
          this.dirLight.shadow.mapSize.set(1024, 1024);
          this.dirLight.shadow.map?.dispose();
          (this.dirLight.shadow as any).map = null;
        } else {
          this.renderer.setPixelRatio(1);
          this.dirLight.shadow.mapSize.set(512, 512);
          this.dirLight.shadow.map?.dispose();
          (this.dirLight.shadow as any).map = null;
          this.particles.setBudget(220);
        }
      }
    }
  }

  private onResize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.director.setAspect(w / h);
    this.director.reframe(this.phase, this.portrait());
  }
}
