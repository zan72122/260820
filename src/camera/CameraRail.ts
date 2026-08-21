import * as THREE from 'three';
import { CourseMarks, CourseSpline } from '../course/CourseSpline';
import { CAMERA } from '../core/Config';
import { approach, clamp } from '../core/Rng';

const UP = new THREE.Vector3(0, 1, 0);

export type ShotName =
  | 'overview'
  | 'staging'
  | 'sideMid'
  | 'valleyLow'
  | 'nozzleClose'
  | 'tracking'
  | 'crestBack'
  | 'finishWide'
  | 'review';

export interface RailContext {
  raftPosition: THREE.Vector3;
  raftS: number;
  speed: number;
  portrait: boolean;
  aspect: number;
  /** 0..1 how hard the pumps are running, for the floor tremble. */
  pumpLevel: number;
  reduceMotion: boolean;
}

interface Shot {
  /** Where the camera wants to be, and what it looks at. */
  solve(ctx: RailContext, rail: CameraRail): { position: THREE.Vector3; target: THREE.Vector3 };
  positionLag: number;
  targetLag: number;
  fov?: (ctx: RailContext) => number;
}

/**
 * A rail, never a free camera. Eight framings, one after another, all with the
 * horizon level so the child can always read the slope of the ground and where
 * the raft is on it.
 */
export class CameraRail {
  private readonly position = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly desiredPos = new THREE.Vector3();
  private readonly desiredTarget = new THREE.Vector3();
  private readonly shots: Record<ShotName, Shot>;
  private current: ShotName = 'overview';
  private fov: number = CAMERA.FOV_LANDSCAPE;
  private shake = 0;
  private time = 0;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly spline: CourseSpline,
    private readonly marks: CourseMarks,
  ) {
    camera.up.set(0, 1, 0);
    this.shots = this.defineShots();
    const first = this.shots.overview.solve(
      {
        raftPosition: new THREE.Vector3(),
        raftS: 0,
        speed: 0,
        portrait: false,
        aspect: 1.6,
        pumpLevel: 0,
        reduceMotion: false,
      },
      this,
    );
    this.position.copy(first.position);
    this.target.copy(first.target);
    this.apply();
  }

  get shot(): ShotName {
    return this.current;
  }

  setShot(name: ShotName, cut = false): void {
    if (this.current === name) return;
    this.current = name;
    if (cut) {
      // Only ever used on a hard scene change, never mid-run.
      const solved = this.shots[name].solve(this.lastCtx, this);
      this.position.copy(solved.position);
      this.target.copy(solved.target);
    }
  }

  private lastCtx: RailContext = {
    raftPosition: new THREE.Vector3(),
    raftS: 0,
    speed: 0,
    portrait: false,
    aspect: 1.6,
    pumpLevel: 0,
    reduceMotion: false,
  };

  /**
   * Distance at which every one of these points is inside the frame, solved
   * separately for width and height so a tall portrait screen and a wide
   * landscape one both end up with the whole test section in view.
   */
  fitDistance(
    points: THREE.Vector3[],
    ctx: RailContext,
    dir: THREE.Vector3,
    centre: THREE.Vector3,
    margin = 1.1,
  ): number {
    const vFov = THREE.MathUtils.degToRad(this.fovFor(ctx));
    const tanV = Math.tan(vFov / 2);
    const tanH = tanV * ctx.aspect;
    const forward = dir.clone().negate().normalize();
    const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    let need = 0;
    const rel = new THREE.Vector3();
    for (const p of points) {
      rel.copy(p).sub(centre);
      // Distance from the camera to this point along the view axis is
      // (D + depth), so a point beyond the centre needs less pull-back.
      const depth = rel.dot(forward);
      const x = Math.abs(rel.dot(right));
      const y = Math.abs(rel.dot(up));
      need = Math.max(need, x / tanH - depth, y / tanV - depth);
    }
    return Math.max(4, need * margin);
  }

  private fovFor(ctx: RailContext): number {
    return ctx.portrait ? CAMERA.FOV_PORTRAIT : CAMERA.FOV_LANDSCAPE;
  }

  private defineShots(): Record<ShotName, Shot> {
    const s = this.spline;
    const m = this.marks;

    const point = (x: number, dy = 0): THREE.Vector3 => {
      const p = s.positionAt(s.sAtX(x)).clone();
      p.y += dy;
      return p;
    };

    /** Wide framings solve for distance; the direction never changes. */
    const wide = (
      pts: THREE.Vector3[],
      centre: THREE.Vector3,
      dir: THREE.Vector3,
      margin: number,
    ) => (ctx: RailContext, rail: CameraRail) => {
      const d = dir.clone().normalize();
      const dist = rail.fitDistance(pts, ctx, d, centre, margin);
      return { position: centre.clone().addScaledVector(d, dist), target: centre.clone() };
    };

    /**
     * Close framings keep a fixed look-down angle: on a narrow screen the
     * camera simply steps back along the same line, so the shot reads the same
     * either way up and the near wall of the flume never hides the raft.
     */
    const rig = (ctx: RailContext, dx: number, dy: number, dz: number) => {
      const k = ctx.portrait ? 1.55 : 1;
      return new THREE.Vector3(dx, dy * k, dz * k);
    };

    return {
      // 1. The whole test section from up high.
      overview: {
        positionLag: 1.1,
        targetLag: 1.1,
        solve: wide(
          [point(-8, 2.4), point(19.8, -0.4), point(42.4, 2.6), point(70, 1)],
          new THREE.Vector3(31, 4.2, 0),
          new THREE.Vector3(0.1, 0.36, 1),
          1.06,
        ),
      },

      // Setting up a run: raft on the ramp, ballast bench beside it.
      staging: {
        positionLag: 0.7,
        targetLag: 0.7,
        solve: wide(
          [
            new THREE.Vector3(-8.4, 5.7, 2.8),
            new THREE.Vector3(2.5, 7.6, -1.8),
            new THREE.Vector3(-3, 6.0, 0),
          ],
          new THREE.Vector3(-3.0, 6.7, 0.2),
          new THREE.Vector3(0.5, 0.3, 1),
          1.16,
        ),
      },

      // 2. Close to a side elevation as the raft is let go.
      sideMid: {
        positionLag: 0.6,
        targetLag: 0.5,
        solve: (ctx) => {
          const p = ctx.raftPosition;
          const o = rig(ctx, 3.4, 4.6, 15);
          return {
            position: new THREE.Vector3(p.x + o.x, p.y + o.y, o.z),
            target: new THREE.Vector3(p.x + 1.6, p.y + 0.5, 0),
          };
        },
      },

      // 3. Low three-quarter view as it drops into the valley.
      valleyLow: {
        positionLag: 0.45,
        targetLag: 0.4,
        solve: (ctx) => {
          const p = ctx.raftPosition;
          const o = rig(ctx, 3.6, 2.9, 8.4);
          return {
            position: new THREE.Vector3(p.x + o.x, p.y + o.y, o.z),
            target: new THREE.Vector3(p.x + 0.8, p.y + 0.35, 0),
          };
        },
      },

      // 4. Nozzles and the raft's tail in the same frame. This is the shot the
      //    whole game turns on, so it is the tightest one in the chain.
      nozzleClose: {
        positionLag: 0.5,
        targetLag: 0.45,
        solve: (ctx) => {
          const p = ctx.raftPosition;
          const o = rig(ctx, -0.25, 1.7, 4.3);
          return {
            position: new THREE.Vector3(p.x + o.x, p.y + o.y, o.z),
            target: new THREE.Vector3(p.x - 0.75, p.y + 0.3, 0),
          };
        },
      },

      // 5. Running alongside while the water pushes.
      tracking: {
        positionLag: 0.32,
        targetLag: 0.28,
        solve: (ctx) => {
          const p = ctx.raftPosition;
          const lead = clamp(ctx.speed * 0.2, 0, 2.2);
          const o = rig(ctx, 1.2 + lead, 2.5, 7.4);
          return {
            position: new THREE.Vector3(p.x + o.x, p.y + o.y, o.z),
            target: new THREE.Vector3(p.x + lead * 0.5, p.y + 0.6, 0),
          };
        },
      },

      // 6. Ease back at the top so the climb reads as height gained.
      crestBack: {
        positionLag: 0.8,
        targetLag: 0.65,
        solve: (ctx) => {
          const p = ctx.raftPosition;
          const o = rig(ctx, -1.0, 5.4, 19);
          const valley = s.positionAt(m.restPool);
          return {
            position: new THREE.Vector3(p.x + o.x, p.y + o.y, o.z),
            target: new THREE.Vector3(p.x - 3.4, (p.y + valley.y) * 0.5 + 0.9, 0),
          };
        },
      },

      // 7. The next drop and the landing, from a distance.
      finishWide: {
        positionLag: 0.9,
        targetLag: 0.8,
        solve: wide(
          [point(43, 2.4), point(54), point(70, 1)],
          new THREE.Vector3(58, 3.4, 0),
          new THREE.Vector3(0.1, 0.3, 1),
          1.14,
        ),
      },

      // 8. One look back down the line the raft drew.
      review: {
        positionLag: 1.5,
        targetLag: 1.5,
        solve: wide(
          [point(4, 1.5), point(19.8), point(42.4, 2.4), point(62, 1)],
          new THREE.Vector3(31, 4.4, 0),
          new THREE.Vector3(-0.08, 0.28, 1),
          1.08,
        ),
      },
    };
  }

  update(dt: number, ctx: RailContext): void {
    this.lastCtx = ctx;
    this.time += dt;
    const shot = this.shots[this.current];
    const solved = shot.solve(ctx, this);
    this.desiredPos.copy(solved.position);
    this.desiredTarget.copy(solved.target);

    this.position.x = approach(this.position.x, this.desiredPos.x, shot.positionLag, dt);
    this.position.y = approach(this.position.y, this.desiredPos.y, shot.positionLag, dt);
    this.position.z = approach(this.position.z, this.desiredPos.z, shot.positionLag, dt);
    this.target.x = approach(this.target.x, this.desiredTarget.x, shot.targetLag, dt);
    this.target.y = approach(this.target.y, this.desiredTarget.y, shot.targetLag, dt);
    this.target.z = approach(this.target.z, this.desiredTarget.z, shot.targetLag, dt);

    const wantFov = shot.fov ? shot.fov(ctx) : this.fovFor(ctx);
    this.fov = approach(this.fov, wantFov, 0.4, dt);

    // Pumps running shake the deck a little. It is never enough to fight the
    // horizon, and it is off entirely in reduced-motion runs.
    this.shake = approach(this.shake, ctx.reduceMotion ? 0 : ctx.pumpLevel, 0.25, dt);
    this.apply();
  }

  private apply(): void {
    const a = this.shake * 0.035;
    this.camera.position.set(
      this.position.x + Math.sin(this.time * 34.1) * a,
      this.position.y + Math.sin(this.time * 41.7) * a * 0.7,
      this.position.z,
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Snap the framing after an orientation change without losing the shot. */
  reframe(ctx: RailContext): void {
    const solved = this.shots[this.current].solve(ctx, this);
    this.position.copy(solved.position);
    this.target.copy(solved.target);
    this.fov = this.fovFor(ctx);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.apply();
  }
}
