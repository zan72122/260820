import * as THREE from 'three';

/* ------------------------------------------------------------------
   Scripted camera.  The player never controls it: each phase of the
   loop gets the framing that explains what is happening.
------------------------------------------------------------------- */

const SHOTS = {
  // wide establishing shot of the street: the bank, the machines, the scale
  intro: {
    anchor: 'plow',
    pos: [-18, 9.0, -21], posP: [-6.0, 9.0, -30],
    look: [-2.2, 2.6, 10], lookP: [-2.2, 2.6, 10], fov: 48, speed: 0.9, push: [7, -3.0, 8],
  },
  // low and to the side: the machine's weight, the bank ending dead
  // against the head, and the spray coming off the cut
  bite: {
    anchor: 'plow',
    pos: [-6.0, 1.4, -4.5], posP: [-6.4, 2.0, -8.0],
    look: [-0.2, 1.5, 4.2], lookP: [-0.2, 1.7, 4.2], fov: 54, speed: 2.3,
  },
  // the main working shot: the head, the arc of snow, and the truck bed
  work: {
    anchor: 'plow',
    pos: [-9.6, 4.3, -8.6], posP: [-2.6, 5.7, -18.0],
    look: [-0.9, 2.0, 3.8], lookP: [-4.0, 3.5, 5.5], fov: 52, speed: 1.7,
  },
  // driving to the dump site
  toDump: {
    anchor: 'plow',
    pos: [-11.5, 7.4, -13.5], posP: [-4.6, 8.6, -22.0],
    look: [-4.0, 1.8, 10.0], lookP: [-3.4, 2.2, 9.0], fov: 54, speed: 1.4,
  },
  // tipping the load: pulled back so the growing mountain reads
  dump: {
    anchor: 'truck',
    pos: [9.0, 6.0, -9.0], posP: [7.7, 7.2, -4.5],
    look: [-6.0, 2.2, 1.0], lookP: [-3.8, 3.0, -1.0], fov: 50, speed: 1.5,
  },
};

export class CameraDirector {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(-17, 8.5, -19);
    this.look = new THREE.Vector3(0, 2, 0);
    this.shot = SHOTS.intro;
    this.shotName = 'intro';
    this.t = 0;
    this.fov = 48;
    this._p = new THREE.Vector3();
    this._l = new THREE.Vector3();
    this._snap = true;
    this.fit = 1;
  }

  set(name, snap = false) {
    if (this.shotName === name) return;
    this.shotName = name;
    this.shot = SHOTS[name];
    this.t = 0;
    if (snap) this._snap = true;
  }

  /** Portrait has far less horizontal room, so each shot has a taller,
      further-back variant and the two are blended by how tall the screen is. */
  setAspect(aspect) {
    this.k = THREE.MathUtils.clamp((1.25 - aspect) / 0.8, 0, 1);
    this.fit = 1;
    this.fovBoost = this.k * 10;
  }

  update(dt, anchors) {
    this.t += dt;
    const s = this.shot;
    const a = anchors[s.anchor];
    const push = s.push || [0, 0, 0];
    const k = s.push ? Math.min(1, this.t / 6) : 0;

    const kp = this.k || 0;
    const p0 = s.pos, p1 = s.posP || s.pos;
    const l0 = s.look, l1 = s.lookP || s.look;
    this._p.set(
      a.x + (p0[0] + (p1[0] - p0[0]) * kp) + push[0] * k,
      a.y + (p0[1] + (p1[1] - p0[1]) * kp) + push[1] * k,
      a.z + (p0[2] + (p1[2] - p0[2]) * kp) + push[2] * k,
    );
    this._l.set(
      a.x + l0[0] + (l1[0] - l0[0]) * kp,
      a.y + l0[1] + (l1[1] - l0[1]) * kp,
      a.z + l0[2] + (l1[2] - l0[2]) * kp,
    );

    if (this._snap) {
      this.pos.copy(this._p); this.look.copy(this._l);
      this.fov = s.fov + (this.fovBoost || 0);
      this._snap = false;
    } else {
      const e = 1 - Math.exp(-s.speed * dt * 1.9);
      this.pos.lerp(this._p, e);
      this.look.lerp(this._l, e);
      this.fov += ((s.fov + (this.fovBoost || 0)) - this.fov) * e;
    }

    // a whisper of handheld motion so the frame feels alive, never shaky
    const t = this.t;
    this.camera.position.set(
      this.pos.x + Math.sin(t * 0.7) * 0.07,
      this.pos.y + Math.sin(t * 0.53 + 1.2) * 0.05,
      this.pos.z + Math.sin(t * 0.61 + 2.4) * 0.06,
    );
    this.camera.lookAt(this.look);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
