import * as THREE from 'three';
import { World, ROAD } from './world.js';
import { Plow } from './plow.js';
import { Truck, BED } from './truck.js';
import { SnowWall } from './snowwall.js';
import { ChunkSystem, PuffSystem, Snowfall } from './effects.js';
import { CameraDirector } from './camera.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Marker } from './marker.js';
import * as Audio from './audio.js';

/* ==================================================================
   ロータリじょせつしゃ  -  a one-finger snow blower for 4 year olds
   ================================================================== */

const MAX_SPEED = 6.2;
const THROW_SPEED = 15.0;
const FILL_PER_CHUNK = 0.0062;
const SITE_AHEAD = 52;

class Game {
  constructor() {
    const canvas = document.getElementById('gl');
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance', alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 900);
    this.scene.add(this.camera);

    this.world = new World(this.scene, this.renderer);
    this.plow = new Plow(this.scene);
    this.truck = new Truck(this.scene);
    this.wall = new SnowWall(this.scene);
    this.marker = new Marker(this.scene);

    this.chunks = new ChunkSystem(this.scene, 260, 0.25);
    this.dumpChunks = new ChunkSystem(this.scene, 190, 0.26);
    this.snowDust = new PuffSystem(this.scene, 240, { color: '250,253,255', size: 0.55, opacity: 0.42, rise: 0.5, drag: 2.1 });
    this.smoke = new PuffSystem(this.scene, 80, { color: '206,209,214', size: 0.5, opacity: 0.34, rise: 1.5, drag: 0.9, hardness: 0.1 });
    this.snowfall = new Snowfall(this.scene, 600);

    this.dir = new CameraDirector(this.camera);
    this.input = new Input(canvas);
    this.ui = new UI();

    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    this.muzzle = new THREE.Vector3();
    this.mdir = new THREE.Vector3();
    this.aim = new THREE.Vector3();
    this.anchors = { plow: new THREE.Vector3(), truck: new THREE.Vector3() };

    /* --------- initial placement --------- */
    this.plow.root.position.set(ROAD.plowX, 0, 0);
    this.truck.root.position.set(ROAD.truckX, 0, 4.2);
    this.plow.chuteAngle = this.plow.chuteAngleCur = -1.5;

    /* --------- run state --------- */
    this.state = 'intro';
    this.stateT = 0;
    this.speed = 0;
    this.cutting = 0;
    this.intake = 0;
    this.emitAcc = 0;
    this.emitRate = 0;
    this.round = 0;
    this.taughtAim = false;
    this.siteZ = 0;
    this.tiltTarget = 0;
    this.dumpSpill = 0;
    this.smokeAcc = 0;
    this.dustAcc = 0;
    this.frames = 0;
    this.fpsAcc = 0;
    this.qualityStep = 0;

    this.chunks.onBedHit = (p) => this.onSnowInBed(p);
    this.chunks.onGround = (p) => this.onSnowOnGround(p);
    this.dumpChunks.onGround = (p) => this.onDumpDebrisLanded(p);
    this.dumpChunks.groundAt = (x, z) => this.world.pileHeightAt(x, z);
    this.ui.onHoldComplete = () => this.startDumping();

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 220));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.resize());
    }
    this.resize();

    this.input.onFirstTouch = () => Audio.start();

    // prime the scene so the first frame is not a stutter
    this.update(0.016);
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);

    this.ui.hideLoading();
    this.ui.showStart(() => this.begin());

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  begin() {
    Audio.start();
    this.state = 'intro';
    this.stateT = 0;
    this.dir.set('intro', true);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dir.setAspect(w / h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.qualityStep > 0 ? 1.2 : 2));
  }

  /* ================= gameplay events ================= */

  onSnowInBed(p) {
    this.truck.addSnow(FILL_PER_CHUNK, p, this.tmp2);
    this.ui.popGauge();
    Audio.thump(0.6 + this.truck.fill * 0.6);
    this.snowDust.spawn(
      p,
      this.tmp.set((Math.random() - 0.5) * 2.2, 1.2 + Math.random() * 1.6, (Math.random() - 0.5) * 2.2),
      { life: 0.7, size: 0.6, grow: 2.4, alpha: 0.8 },
    );
    if (this.truck.fill >= 1 && this.state === 'plow') this.onTruckFull();
  }

  onSnowOnGround(p) {
    this.snowDust.spawn(
      p,
      this.tmp.set((Math.random() - 0.5) * 2.4, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 2.4),
      { life: 0.6, size: 0.5, grow: 2.6, alpha: 0.55 },
    );
  }

  onDumpDebrisLanded(p) {
    this.world.growSite(0.0016);
    for (let i = 0; i < 2; i++) {
      this.snowDust.spawn(
        p,
        this.tmp.set((Math.random() - 0.5) * 3.4, 1.4 + Math.random() * 2.2, (Math.random() - 0.5) * 3.4),
        { life: 1.4, size: 1.0, grow: 3.2, alpha: 0.7 },
      );
    }
  }

  onTruckFull() {
    Audio.jingle();
    Audio.horn();
    this.ui.gaugeFullCheer(true);
    this.setState('toDump');
    this.siteZ = Math.round(this.plow.root.position.z + SITE_AHEAD);
    this.world.showSite(this.siteZ);
    this.wall.clearFrom(this.plow.root.position.z + 14);
    this.dir.set('toDump');
    this.ui.showHint('go');
    this.marker.show(-11.5, 6.5, this.siteZ + 1.5, 2.2);
  }

  startDumping() {
    if (this.state !== 'dumpReady') return;
    this.setState('dumping');
    this.ui.showLever(false);
    this.marker.hide();
    Audio.hydraulic(true);
    this.tiltTarget = 1;
    this.dumpSpill = this.truck.fill;
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  /* ================= per-frame ================= */

  frame() {
    let dt = this.clock.getDelta();
    if (dt > 0.06) dt = 0.06;          // survive a backgrounded tab
    this.update(dt);
    this.renderer.render(this.scene, this.camera);

    // very light adaptive quality: drop the pixel ratio if we cannot hold up
    this.frames++;
    this.fpsAcc += dt;
    if (this.fpsAcc > 2.5) {
      const fps = this.frames / this.fpsAcc;
      if (fps < 34 && this.qualityStep === 0) {
        this.qualityStep = 1;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
      } else if (fps < 26 && this.qualityStep === 1) {
        this.qualityStep = 2;
        this.renderer.shadowMap.enabled = false;
        this.renderer.setPixelRatio(1);
        this.scene.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      }
      this.frames = 0; this.fpsAcc = 0;
    }
  }

  update(dt) {
    this.stateT += dt;
    this.input.update(dt);
    this.ui.update(dt);

    const plowPos = this.plow.root.position;
    const playable = this.state === 'plow' || this.state === 'toDump';

    /* ---------- driving ---------- */
    let want = playable ? this.input.throttle * MAX_SPEED : 0;
    if (this.state === 'dumpReady' || this.state === 'dumping' || this.state === 'intro') want = 0;
    // creeping to a stop just short of the dump site
    if (this.state === 'toDump') {
      const d = this.siteZ - 14 - plowPos.z;
      if (d < 9) want = Math.min(want, Math.max(0, d) * 0.55);
      if (d <= 0.6) {
        this.arriveAtSite();
      }
    }
    const accel = want > this.speed ? 5.0 : 7.5;
    this.speed += THREE.MathUtils.clamp(want - this.speed, -accel * dt, accel * dt);
    if (this.speed < 0.02) this.speed = 0;
    plowPos.z += this.speed * dt;

    /* ---------- chute aiming ---------- */
    if (playable) {
      const d = this.input.takeChute();
      if (d !== 0) {
        this.plow.chuteAngle = THREE.MathUtils.clamp(this.plow.chuteAngle + d, -2.6, -0.30);
      }
    } else {
      this.input.takeChute();
    }

    /* ---------- the auger eating the wall ---------- */
    const cutZ = plowPos.z + 3.9;
    const wallLeft = this.wall.remainingAhead(plowPos.z + 1.0, 6);
    const engaged = this.state === 'plow' && this.speed > 0.25 && wallLeft > 0.02;
    const cutTarget = engaged ? THREE.MathUtils.clamp(this.speed / MAX_SPEED, 0.25, 1) : 0;
    this.cutting += (cutTarget - this.cutting) * Math.min(1, dt * 6);

    this.wall.update(dt, plowPos.z, cutZ, this.state === 'plow' && this.speed > 0.15);
    this.intake += this.wall.eaten;

    /* ---------- machines ---------- */
    this.plow.update(dt, { speed: this.speed, cutting: this.cutting, running: true });
    this.updateTruck(dt);

    /* ---------- snow out of the chute ---------- */
    this.emitSnow(dt);

    /* ---------- dust, exhaust ---------- */
    this.emitAtmosphere(dt);

    /* ---------- state machine ---------- */
    this.updateStates(dt);

    /* ---------- world + particles ---------- */
    this.world.update(dt, plowPos.z);
    this.chunks.update(dt, this.truck, this.tmp2);
    this.dumpChunks.update(dt, null, this.tmp2);
    this.snowDust.update(dt);
    this.smoke.update(dt);
    this.snowfall.update(dt, this.camera.position);
    this.marker.update(dt);

    /* ---------- camera ---------- */
    this.anchors.plow.copy(plowPos);
    this.anchors.truck.copy(this.truck.root.position);
    this.dir.update(dt, this.anchors);

    /* ---------- audio ---------- */
    Audio.setEngine(this.cutting, this.speed);
    Audio.setAuger(this.cutting * 0.85 + (this.state === 'plow' ? 0.15 : 0.05));
    Audio.setChute(Math.min(1, this.emitRate / 16));

    /* ---------- ui ---------- */
    this.ui.setFill(this.truck.fill);
  }

  /* ---------------- truck behaviour ---------------- */
  updateTruck(dt) {
    const t = this.truck.root;
    let tx, tz, trot;
    if (this.state === 'toDump' || this.state === 'dumpReady' || this.state === 'dumping' || this.state === 'leaving') {
      tx = -5.2; tz = this.siteZ + 1.5; trot = Math.PI / 2;
    } else {
      tx = ROAD.truckX;
      tz = this.plow.root.position.z + 4.2;
      trot = 0;
    }
    const prev = this.tmp.copy(t.position);
    const k = Math.min(1, dt * (this.state === 'toDump' ? 1.5 : 3.0));
    // match the plow's pace first, then correct - otherwise the truck
    // trails behind and the chute has to lead it awkwardly
    if (this.state === 'plow' || this.state === 'intro') t.position.z += this.speed * dt;
    t.position.x += (tx - t.position.x) * k;
    t.position.z += (tz - t.position.z) * k;
    let rd = trot - t.rotation.y;
    t.rotation.y += rd * Math.min(1, dt * 1.6);

    const moved = Math.hypot(t.position.x - prev.x, t.position.z - prev.z);
    const spd = dt > 0 ? moved / dt : 0;

    // bed tilt animation
    const tk = Math.min(1, dt * (this.tiltTarget > this.truck.tilt ? 1.35 : 1.9));
    this.truck.tilt += (this.tiltTarget - this.truck.tilt) * tk;

    this.truck.update(dt, { speed: spd, running: true });
  }

  arriveAtSite() {
    if (this.state !== 'toDump') return;
    this.setState('dumpReady');
    this.dir.set('dump');
    this.ui.showHint(null);
    this.ui.showLever(true);
    this.marker.show(-5.2, 4.6, this.siteZ + 1.5, 1.5);
  }

  /* ---------------- snow throwing ---------------- */
  emitSnow(dt) {
    const plow = this.plow;
    plow.muzzleWorld(this.muzzle);
    plow.muzzleDir(this.mdir);
    this.truck.aimWorld(this.aim);

    // the chute throws as hard as the auger is chewing, and keeps
    // spitting for a beat afterwards so the stream never snaps off
    const want = this.cutting * 34 * (this.wall.eaten > 0 || this.cutting > 0.1 ? 1 : 0);
    this.emitRate = Math.max(want, this.emitRate - dt * 46);
    if (this.truck.fill >= 1 || this.state !== 'plow') this.emitRate = Math.min(this.emitRate, want * 0.15);

    this.emitAcc += this.emitRate * dt;
    let n = Math.floor(this.emitAcc);
    this.emitAcc -= n;
    if (n > 6) n = 6;

    if (n > 0) {
      // how far off the truck is the chute pointing?
      const dx = this.aim.x - this.muzzle.x, dz = this.aim.z - this.muzzle.z;
      const aimAng = Math.atan2(dx, dz);
      const chuteAng = Math.atan2(this.mdir.x, this.mdir.z);
      let err = Math.abs(((aimAng - chuteAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      // very forgiving: near-perfect capture inside ~35 deg, still decent to ~80
      const assist = THREE.MathUtils.clamp(1.0 - (err - 0.35) / 1.1, 0.06, 1.0);

      // ballistic solution that actually lands in the bed
      const dist = Math.hypot(dx, dz);
      const tf = THREE.MathUtils.clamp(dist / 7.0, 0.85, 1.5);   // a lofted, readable arc
      const ball = this.tmp.set(
        dx / tf,
        (this.aim.y - this.muzzle.y) / tf + 0.5 * 17.0 * tf,
        dz / tf,
      );
      const straight = this.tmp2.copy(this.mdir).multiplyScalar(THROW_SPEED);

      for (let i = 0; i < n; i++) {
        const v = straight.clone().lerp(ball, assist * 0.82);
        const jitter = 1.1 * (1 - assist * 0.55);
        v.x += (Math.random() - 0.5) * jitter * 2;
        v.y += (Math.random() - 0.5) * jitter;
        v.z += (Math.random() - 0.5) * jitter * 2;
        const p = this.muzzle.clone();
        p.x += (Math.random() - 0.5) * 0.5;
        p.y += (Math.random() - 0.5) * 0.35;
        p.z += (Math.random() - 0.5) * 0.5;
        this.chunks.spawn(p, v, {
          life: 3.2, size: 0.8 + Math.random() * 1.0,
          target: this.aim, homing: assist * 0.9, kind: 0,
        });
      }

      // a plume that rides along the throw so the arc reads as a jet of snow
      this.dustAcc += this.emitRate * dt * 1.1;
      while (this.dustAcc >= 1) {
        this.dustAcc -= 1;
        const v = straight.clone().lerp(ball, assist * 0.82).multiplyScalar(0.55);
        v.x += (Math.random() - 0.5) * 2.2;
        v.y += (Math.random() - 0.5) * 1.4;
        v.z += (Math.random() - 0.5) * 2.2;
        const p = this.muzzle.clone();
        p.y += (Math.random() - 0.5) * 0.4;
        this.snowDust.spawn(p, v, { life: 1.0, size: 0.8, grow: 2.4, alpha: 0.45 });
      }
    }

    // spray thrown up where the auger bites the bank
    if (this.cutting > 0.08) {
      this.plow.intakeWorld(this.tmp);
      this.sprayAcc = (this.sprayAcc || 0) + dt * this.cutting * 26;
      while (this.sprayAcc >= 1) {
        this.sprayAcc -= 1;
        const p = this.tmp.clone();
        p.x += (Math.random() - 0.5) * 2.8;
        p.y += Math.random() * 1.2;
        p.z += (Math.random() - 0.5) * 0.7;
        this.snowDust.spawn(p, this.tmp2.set(
          (Math.random() - 0.5) * 3.0,
          1.6 + Math.random() * 2.4,
          -0.8 - Math.random() * 1.8,
        ), { life: 0.8, size: 0.75, grow: 2.6, alpha: 0.35 + 0.3 * this.cutting });
        // chunky bits kicked out of the cut
        if (Math.random() < 0.28) {
          const c = this.tmp.clone();
          c.x += (Math.random() - 0.5) * 2.4;
          c.y += 0.4 + Math.random() * 0.8;
          this.chunks.spawn(c, this.tmp2.set(
            (Math.random() - 0.5) * 4,
            3 + Math.random() * 4,
            1 + Math.random() * 3,
          ), { life: 1.6, size: 0.55 + Math.random() * 0.5, homing: 0, kind: 2 });
        }
      }
    }
  }

  emitAtmosphere(dt) {
    this.smokeAcc += dt * (7 + this.cutting * 16);
    while (this.smokeAcc >= 1) {
      this.smokeAcc -= 1;
      this.plow.exhaustWorld(this.tmp);
      this.smoke.spawn(this.tmp, this.tmp2.set(
        (Math.random() - 0.5) * 0.5, 1.6 + Math.random() * 1.4 + this.cutting * 2, -0.5 - this.speed * 0.35,
      ), { life: 1.9 + Math.random(), size: 0.45 + this.cutting * 0.4, grow: 4.0, alpha: 0.3 + this.cutting * 0.3 });
      if (Math.random() < 0.4) {
        this.truck.exhaustWorld(this.tmp);
        this.smoke.spawn(this.tmp, this.tmp2.set(0.2, 1.6, -0.4),
          { life: 1.7, size: 0.35, grow: 3.6, alpha: 0.26 });
      }
    }
  }

  /* ---------------- states ---------------- */
  updateStates(dt) {
    switch (this.state) {
      case 'intro': {
        if (this.stateT > 3.6) {
          this.setState('plow');
          this.dir.set('work');
          if (this.round === 0) {
            this.ui.showHint('go');
            // point at the wall the machine is about to eat
            this.marker.show(ROAD.wallX, 2.4, this.plow.root.position.z + 12, 1.25);
          }
        } else if (this.round === 0 && this.stateT > 1.4) {
          this.marker.show(ROAD.wallX, 2.4, this.plow.root.position.z + 16, 1.4);
        }
        break;
      }
      case 'plow': {
        if (this.round === 0) { this.teachRound0(dt); break; }
        // every round opens with a low shot of the auger biting in,
        // then eases back to the working view
        if (!this._biteShown && this.cutting > 0.4) {
          this._biteShown = true; this._biteT = 0;
          this.dir.set('bite');
        } else if (this._biteShown && this.dir.shotName === 'bite') {
          this._biteT += dt;
          if (this._biteT > 2.6) this.dir.set('work');
        }
        if (this.stateT > 1.2 && this.speed < 0.2) this.ui.showHint('go');
        else if (this.speed > 0.6) this.ui.showHint(null);
        break;
      }
      case 'toDump': {
        this.marker.moveTo(-11.5, 6.5 + Math.sin(this.stateT * 2) * 0.25, this.siteZ + 1.5);
        if (this.speed > 0.6) this.ui.showHint(null);
        else if (this.stateT > 1.0) this.ui.showHint('go');
        break;
      }
      case 'dumpReady': {
        break;
      }
      case 'dumping': {
        // snow slides out over the first part of the tilt
        if (this.truck.tilt > 0.28 && this.dumpSpill > 0) {
          const drop = Math.min(this.dumpSpill, dt * 0.75);
          this.dumpSpill -= drop;
          this.truck.fill = Math.max(0, this.truck.fill - drop);
          const n = Math.ceil(drop * 90);
          for (let i = 0; i < n; i++) {
            const p = this.tmp.set(
              this.truck.root.position.x - 3.3 - Math.random() * 0.8,
              2.5 + Math.random() * 1.5,
              this.truck.root.position.z + (Math.random() - 0.5) * 2.0,
            );
            this.dumpChunks.spawn(p, this.tmp2.set(
              -0.8 - Math.random() * 2.6,
              0.2 + Math.random() * 1.0,
              (Math.random() - 0.5) * 1.8,
            ), { life: 14, size: 0.9 + Math.random() * 1.0, kind: 1 });
          }
          if (!this._dumpRoar) { this._dumpRoar = true; Audio.bigDump(); }
        }
        if (this.truck.tilt > 0.8 && this.dumpSpill <= 0.001 && this.stateT > 2.6) {
          this.tiltTarget = 0;
          if (!this._downSound) { this._downSound = true; Audio.hydraulic(false); }
        }
        if (this.tiltTarget === 0 && this.truck.tilt < 0.02) {
          this.finishRound();
        }
        break;
      }
    }
  }

  teachRound0(dt) {
    const z = this.plow.root.position.z;
    if (!this._taught) this._taught = { step: 0, t: 0 };
    const s = this._taught;
    s.t += dt;
    switch (s.step) {
      case 0:                                   // "drive into the wall"
        this.ui.showHint('go');
        this.marker.moveTo(ROAD.wallX, 2.4, z + 11);
        if (this.cutting > 0.3) { s.step = 1; s.t = 0; this.dir.set('bite'); }
        break;
      case 1:                                   // look at the auger biting
        this.ui.showHint(null);
        this.marker.moveTo(ROAD.plowX, 2.6, z + 4.2);
        if (s.t > 2.4) { s.step = 2; s.t = 0; this.dir.set('work'); }
        break;
      case 2:                                   // the chute, then the bed
        this.marker.moveTo(ROAD.plowX, 4.3, z + 2.9);
        if (s.t > 1.6) { s.step = 3; s.t = 0; this.ui.showHint('aim'); }
        break;
      case 3:
        this.marker.moveTo(this.truck.root.position.x, 3.4, this.truck.root.position.z - 1.0);
        if (this.input.didSwipeSide || s.t > 5.0) { s.step = 4; s.t = 0; this.ui.showHint(null); }
        break;
      case 4:
        this.marker.moveTo(this.truck.root.position.x, 3.4, this.truck.root.position.z - 1.0);
        if (s.t > 3.0) { s.step = 5; this.marker.hide(); }
        break;
      default:
        if (this.speed < 0.15) this.ui.showHint('go'); else this.ui.showHint(null);
    }
  }

  finishRound() {
    this.round++;
    this._dumpRoar = false;
    this._downSound = false;
    this.truck.reset();
    this.ui.gaugeFullCheer(false);
    this.ui.setFill(0);
    this.world.hideSite();
    const z = this.plow.root.position.z;
    this.wall.refill(z + 10);
    this.setState('plow');
    this.dir.set('work');
    this._biteShown = false;
    this.ui.showHint('go');
    Audio.horn();
  }
}

function boot() {
  try {
    window.game = new Game();
  } catch (err) {
    console.error(err);
    const l = document.getElementById('loading');
    if (l) l.innerHTML = '<div style="color:#fff;font-size:16px;padding:24px;text-align:center">' +
      '⚠️<br>' + String(err && err.message || err) + '</div>';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
