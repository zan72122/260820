/**
 * FONT PHYSICS LAB — flow direction.
 * Guided loop: O (weight) -> C (width) -> I (slant), then free
 * experimenting with the ball rack. One variable per trial: each station
 * has exactly one shape handle.
 */
import * as THREE from 'three';
import { createMaterials } from './core/materials';
import { LabAudio } from './core/audio';
import { CameraRig } from './core/cameraRig';
import { InputManager } from './core/input';
import { makeEnvironment, type Environment } from './lab/environment';
import { OStation } from './stations/oStation';
import { CStation } from './stations/cStation';
import { IStation } from './stations/iStation';
import type { StationBase, StationId } from './stations/base';
import { BALLS, type BallKind } from './glyph/spec';
import { damp } from './core/math';

const STATION_SPACING = 4;

interface RackEntry {
  kind: BallKind;
  mesh: THREE.Mesh;
  ghost: THREE.Mesh | null;
}

export class Game {
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  readonly audio = new LabAudio();
  readonly mats = createMaterials();
  readonly input: InputManager;
  private env: Environment;
  readonly stations: [OStation, CStation, IStation];
  current = 0;
  completed: Record<StationId, boolean> = { O: false, C: false, I: false };
  freeMode = false;
  private arrows: { mesh: THREE.Group; dir: 1 | -1; station: number }[] = [];
  private arrowPulse = 0;
  private idleTimer = 0;
  private operateTimer = -1;
  private iPredictionDone = false;
  private iBallOnTrackOnce = false;

  constructor(
    readonly renderer: THREE.WebGLRenderer,
    canvas: HTMLCanvasElement,
    shadowSize: number,
  ) {
    this.scene.background = new THREE.Color(0x17181a);
    this.scene.fog = new THREE.Fog(0x17181a, 9, 22);
    this.input = new InputManager(canvas, this.rig.camera);
    this.input.onAnyPointerDown = () => this.audio.unlock();

    this.env = makeEnvironment(this.mats, shadowSize);
    this.scene.add(this.env.group);

    const events = {
      onResult: (s: StationId, outcome: 'pass' | 'blocked' | 'left' | 'right' | 'center') =>
        this.handleResult(s, outcome),
      onBallSettled: () => {},
      onAxisInput: (s: StationId) => this.handleAxisInput(s),
      onLeverPulled: (s: StationId) => this.handleLever(s),
    };
    this.stations = [
      new OStation(-STATION_SPACING, this.mats, this.audio, this.input, events),
      new CStation(0, this.mats, this.audio, this.input, events),
      new IStation(STATION_SPACING, this.mats, this.audio, this.input, events),
    ];
    // guided order: O first — put the camera there
    this.current = 0;
    for (const st of this.stations) this.scene.add(st.group);

    this.buildArrows();
    this.buildRacks();

    this.env.focus(this.station.worldX);
    this.rig.goTo('front', this.station.views, true);
    this.station.setAttention('lever');
  }

  get station(): StationBase {
    return this.stations[this.current];
  }

  // ------------------------------------------------------------- flow ------

  private handleLever(_s: StationId) {
    this.idleTimer = 0;
    this.station.setAttention('none');
    if (this.station.ball) this.rig.follow(this.station.ball.mesh, 0.45);
  }

  private handleAxisInput(_s: StationId) {
    this.idleTimer = 0;
    this.operateTimer = 0;
    this.rig.follow(null);
    this.rig.goTo('operate', this.station.views);
    this.station.setAttention('none');
  }

  private handleResult(s: StationId, outcome: 'pass' | 'blocked' | 'left' | 'right' | 'center') {
    this.idleTimer = 0;
    this.rig.follow(null);
    if (s === 'O' || s === 'C') {
      if (outcome === 'pass') {
        this.audio.success();
        if (!this.completed[s]) {
          this.completed[s] = true;
          this.audio.stationDone();
          this.maybeEnterFree();
        }
        this.station.setAttention('none');
      } else if (outcome === 'blocked') {
        // the discovery beat: guide the hand to the shape handle
        if (!this.completed[s]) this.station.setAttention('handle');
      }
    }
    if (s === 'I') {
      if (outcome === 'center') {
        // prediction pause: let the child look before touching the lever
        this.iBallOnTrackOnce = true;
        this.iPredictionDone = false;
        this.station.setAttention('none');
      } else {
        this.audio.success();
        if (!this.completed.I) {
          this.completed.I = true;
          this.audio.stationDone();
          this.maybeEnterFree();
        }
      }
    }
    this.rig.goTo('front', this.station.views);
  }

  private maybeEnterFree() {
    if (this.completed.O && this.completed.C && this.completed.I && !this.freeMode) {
      this.freeMode = true;
      for (const r of this.racks) r.group.visible = true;
    }
  }

  // ------------------------------------------------------ navigation ------

  private buildArrows() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.09);
    shape.lineTo(0.16, 0);
    shape.lineTo(0, -0.09);
    shape.lineTo(0.05, 0);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    for (let si = 0; si < 3; si++) {
      for (const dir of [1, -1] as const) {
        const target = si + dir;
        if (target < 0 || target > 2) continue;
        const g = new THREE.Group();
        const plate = new THREE.Mesh(geo, this.mats.brass);
        plate.rotation.x = -Math.PI / 2;
        plate.position.y = 0.26;
        if (dir < 0) plate.rotation.z = Math.PI;
        g.add(plate);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.25, 10), this.mats.aluminumDark);
        post.position.y = 0.125;
        g.add(post);
        const hit = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.6, 0.5),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        hit.position.y = 0.25;
        g.add(hit);
        g.position.set((si - 1) * STATION_SPACING + dir * 0.98, 0, 0.3);
        g.visible = false;
        this.scene.add(g);
        const entry = { mesh: g, dir, station: si };
        this.arrows.push(entry);
        this.input.register({
          hitMesh: hit,
          enabled: () => g.visible,
          onUp: (_p, wasTap) => {
            if (wasTap) this.goToStation(target);
          },
        });
      }
    }
  }

  goToStation(i: number) {
    if (i < 0 || i > 2 || i === this.current) return;
    this.current = i;
    this.idleTimer = 0;
    this.rig.follow(null);
    this.env.focus(this.station.worldX);
    this.rig.goTo('front', this.station.views);
    if (!this.completed[this.station.id]) {
      this.station.setAttention(this.station.ballStatus === 'inFeeder' ? 'lever' : 'none');
    }
  }

  private arrowVisible(a: { dir: 1 | -1; station: number }): boolean {
    if (a.station !== this.current) return false;
    if (this.freeMode) return true;
    // guided: show the forward arrow once this station is complete
    const id = this.stations[a.station].id;
    return a.dir === 1 && this.completed[id];
  }

  // ------------------------------------------------------- ball rack ------

  private racks: { group: THREE.Group; entries: RackEntry[]; station: StationBase }[] = [];

  private buildRacks() {
    const rackSpots: [StationBase, number, number, number, boolean][] = [
      [this.stations[0], -0.92, 0.02, 0, false],
      [this.stations[1], -0.45, -1.08, Math.PI / 2, true],
    ];
    for (const [st, rx, rz, ry, cart] of rackSpots) {
      const group = new THREE.Group();
      group.position.set(st.worldX + rx, 0, rz);
      group.rotation.y = ry;
      if (cart) {
        // a wheeled supply cart parked behind the bench
        const cartTop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 1.1), this.mats.aluminumDark);
        cartTop.position.y = -0.028;
        cartTop.castShadow = true;
        group.add(cartTop);
        const cartFrame = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.72, 1.0), this.mats.castIron);
        cartFrame.position.y = -0.42;
        group.add(cartFrame);
        const wheelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12);
        for (const wx of [-1, 1]) {
          for (const wz of [-1, 1]) {
            const wheel = new THREE.Mesh(wheelGeo, this.mats.epdm);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(wx * 0.2, -0.85, wz * 0.44);
            group.add(wheel);
          }
        }
      }
      group.visible = false;
      const entries: RackEntry[] = [];
      const kinds: BallKind[] = ['rubber', 'wood', 'steel'];
      kinds.forEach((kind, i) => {
        const spec = BALLS[kind];
        const cradle = new THREE.Mesh(
          new THREE.CylinderGeometry(spec.diameter * 0.42, spec.diameter * 0.5, 0.05, 16),
          this.mats.castIron,
        );
        cradle.position.set(0, 0.025, (i - 1) * 0.3);
        cradle.castShadow = true;
        group.add(cradle);
        const mat =
          kind === 'rubber'
            ? this.mats.rubberBall
            : kind === 'wood'
              ? this.mats.woodBall
              : this.mats.steelBall;
        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(spec.diameter / 2, 22, 16),
          mat,
        );
        ball.position.set(0, 0.05 + spec.diameter / 2, (i - 1) * 0.3);
        ball.castShadow = true;
        group.add(ball);
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(0.16, spec.diameter * 0.75), 8, 6),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        hit.position.copy(ball.position);
        group.add(hit);
        const entry: RackEntry = { kind, mesh: ball, ghost: null };
        entries.push(entry);
        this.input.register({
          hitMesh: hit,
          enabled: () => group.visible && st === this.station,
          onDown: () => {
            const ghost = ball.clone();
            this.scene.add(ghost);
            entry.ghost = ghost;
          },
          onDrag: (p) => {
            if (!entry.ghost) return;
            // carry on a horizontal plane at a comfortable height
            const t = (1.05 - p.ray.origin.y) / p.ray.direction.y;
            if (t > 0) {
              entry.ghost.position.copy(p.ray.origin).addScaledVector(p.ray.direction, t);
            }
          },
          onUp: (p, wasTap) => {
            const feeder = st.feederWorldPos();
            let load = wasTap;
            if (entry.ghost) {
              if (entry.ghost.position.distanceTo(feeder) < 0.55) load = true;
              this.scene.remove(entry.ghost);
              entry.ghost = null;
            }
            if (load) {
              st.loadBall(entry.kind);
              this.audio.gate();
            }
          },
        });
      });
      this.scene.add(group);
      this.racks.push({ group, entries, station: st });
    }
  }

  // ----------------------------------------------------------- update -----

  update(dt: number) {
    for (const st of this.stations) st.update(dt);
    this.rig.update(dt);

    // rolling loop follows the active station's ball
    const b = this.station.ball;
    if (b && this.station.ballStatus === 'moving') {
      const horiz = Math.hypot(b.vel.x, b.vel.z);
      this.audio.setRolling(horiz, b.kind);
    } else {
      this.audio.setRolling(0);
    }

    // camera returns to front a moment after handle input stops
    if (this.operateTimer >= 0) {
      this.operateTimer += dt;
      if (this.operateTimer > 2.2) {
        this.operateTimer = -1;
        this.rig.goTo('front', this.station.views);
      }
    }

    // attention nudges when the child is idle
    this.idleTimer += dt;
    const st = this.station;
    if (!this.completed[st.id]) {
      if (st.id === 'I' && this.iBallOnTrackOnce && !this.iPredictionDone) {
        // hold the quiet beat, then point at the slant lever
        if (this.idleTimer > 1.6) {
          this.iPredictionDone = true;
          st.setAttention('handle');
        }
      } else if (this.idleTimer > 5 && st.attention === 'none') {
        st.setAttention(st.ballStatus === 'inFeeder' ? 'lever' : 'handle');
      }
    }

    // arrows
    this.arrowPulse += dt * 2.2;
    for (const a of this.arrows) {
      const vis = this.arrowVisible(a);
      a.mesh.visible = vis;
      if (vis) {
        const s = 1 + Math.sin(this.arrowPulse) * 0.06;
        a.mesh.scale.setScalar(s);
        a.mesh.position.y = damp(a.mesh.position.y, 0, 4, dt);
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.rig.camera);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.rig.setAspect(w / h);
  }
}
