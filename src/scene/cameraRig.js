import * as THREE from 'three';

// Macro-photography discipline: the camera is a tripod that breathes.
//
// The subject is three millimetres across. A camera that chases it destroys the
// thing it is trying to show, so the rig works in terms of *framed height in
// metres* and moves between framings on long, critically damped springs. During
// the busiest stage it is deliberately locked.

const KEYS = [
  // Framing is authored as two numbers: the height of the frame in metres at
  // the sparkler, and where down that frame the bead should sit. Distance,
  // composition and how much hand you see all fall out of those two.
  { t: 0.0, h: 0.268, bead: 0.625 },
  { t: 0.1, h: 0.256, bead: 0.615 },
  { t: 0.22, h: 0.232, bead: 0.600 }, // it has grown: lean in
  { t: 0.4, h: 0.292, bead: 0.545 },  // the burst needs room, then we stop moving
  { t: 0.62, h: 0.300, bead: 0.540 },
  { t: 0.74, h: 0.274, bead: 0.552 },
  { t: 0.87, h: 0.234, bead: 0.560 },
  { t: 0.96, h: 0.194, bead: 0.560 }, // the bead is the subject again
  { t: 1.0, h: 0.186, bead: 0.560 },
];

function sampleKeys(t) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t < t) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const span = b.t - a.t;
  let k = span > 1e-6 ? (t - a.t) / span : 0;
  k = Math.min(1, Math.max(0, k));
  const s = k * k * (3 - 2 * k);
  return { h: a.h + (b.h - a.h) * s, bead: a.bead + (b.bead - a.bead) * s };
}

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.camera.fov = 31;
    this.camera.near = 0.012;
    this.camera.far = 120;

    this.aim = new THREE.Vector3(0, -0.06, 0);
    this.aimSmooth = new THREE.Vector3(0, -0.06, 0);
    this.frameHeightSmooth = KEYS[0].h;
    this.lateral = 0;
    this.lateralSmooth = 0;
    this.hangSmooth = 0.118;
    this.followSmooth = 0; // extra downward tilt during the fall
    this._tmp = new THREE.Vector3();
    this.landscape = false;
    this.breath = 0;
  }

  setViewport(w, h) {
    this.landscape = w > h;
    this.camera.aspect = w / h;
    // Landscape gets a slightly taller frame and an off-centre subject, which
    // is what buys the extra garden the brief asks for.
    this.lateral = this.landscape ? 0.19 : 0.0;
    this.camera.updateProjectionMatrix();
  }

  /**
   * @param dt       seconds
   * @param progress burn progress 0..1
   * @param pivot    where the fingers hold the cord
   * @param bead     world position of the fireball
   * @param falling  0..1 how far into the fall we are
   */
  update(dt, progress, pivot, bead, falling) {
    const k = sampleKeys(Math.min(1, Math.max(0, progress)));

    // How far the bead hangs below the fingers, smoothed: it swings, and the
    // framing must not swing with it. Once it has let go it is in free fall and
    // this stops tracking entirely, or the frame would chase it into the lawn.
    if (falling <= 0) {
      const hang = Math.min(0.2, Math.max(0.02, pivot.y - bead.y));
      this.hangSmooth += (hang - this.hangSmooth) * (1 - Math.exp(-dt * 0.7));
    }

    // Place the frame so the bead lands where the keyframe says it should. The
    // frame hangs off the fingers rather than tracking the bead -- if it
    // tracked the bead, the bead could never appear to move, and the fall at
    // the end would read as nothing happening.
    const drop = this.hangSmooth - this.frameHeightSmooth * (k.bead - 0.5);
    this._tmp.set(pivot.x * 0.4 + bead.x * 0.18, pivot.y * 0.42 - drop, pivot.z * 0.5);

    // Through matsuba the aim is nearly frozen: 0.4..0.7 is the one stretch
    // where the camera must not react to anything at all.
    const busy = progress > 0.38 && progress < 0.72 ? 0.16 : 1.0;
    const aimRate = 1 - Math.exp(-dt * 0.95 * busy);
    this.aim.lerp(this._tmp, aimRate);

    let targetH = k.h;
    if (falling > 0) targetH = k.h * (1 + falling * 0.30);
    this.frameHeightSmooth += (targetH - this.frameHeightSmooth) * (1 - Math.exp(-dt * 0.55));

    // Follow the fall a little way down and no further. The brief asks for a
    // slight tilt, and it is right: if the camera keeps up with the bead, the
    // bead never appears to fall.
    const followTarget =
      falling > 0 ? Math.max(-0.052, Math.min(0, bead.y - this.aim.y + 0.03)) * 0.9 : 0;
    this.followSmooth += (followTarget - this.followSmooth) * (1 - Math.exp(-dt * 1.7));

    this.lateralSmooth += (this.lateral - this.lateralSmooth) * (1 - Math.exp(-dt * 1.6));

    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = this.frameHeightSmooth / 2 / Math.tan(vfov / 2);

    // A real camera is never perfectly still, even on a tripod.
    this.breath += dt;
    const bx = Math.sin(this.breath * 0.37) * 0.00042 + Math.sin(this.breath * 0.91 + 1.3) * 0.00018;
    const by = Math.sin(this.breath * 0.29 + 2.1) * 0.00036 + Math.sin(this.breath * 1.13) * 0.00014;

    const lateralOffset = this.lateralSmooth * this.frameHeightSmooth * this.camera.aspect * 0.5;

    this.aimSmooth.set(
      this.aim.x - lateralOffset + bx,
      this.aim.y + this.followSmooth + by,
      this.aim.z
    );

    this.camera.position.set(
      this.aimSmooth.x + bx * 0.5,
      this.aimSmooth.y + by * 0.5,
      this.aim.z + dist
    );
    this.camera.lookAt(this.aimSmooth.x, this.aimSmooth.y, this.aim.z);
    this.camera.updateMatrixWorld();
  }

  reset(pivot, hang = 0.118) {
    this.hangSmooth = hang;
    const drop = hang - KEYS[0].h * (KEYS[0].bead - 0.5);
    this.aim.set(pivot.x * 0.4, pivot.y * 0.42 - drop, pivot.z * 0.5);
    this.aimSmooth.copy(this.aim);
    this.frameHeightSmooth = KEYS[0].h;
    this.followSmooth = 0;
  }
}
