import * as THREE from 'three';

/* ------------------------------------------------------------------
   Scripted camera.  The player never controls it: each phase of the
   loop gets the framing that explains what is happening.
------------------------------------------------------------------- */

const SHOTS = {
  // wide establishing shot of the street: wall on the right, machines small
  intro: {
    anchor: 'plow',
    pos: [-18, 9.0, -21], look: [-2.2, 2.6, 10], fov: 48, speed: 0.9, push: [7, -3.0, 8],
  },
  // low, close on the auger biting into the bank
  bite: {
    anchor: 'plow',
    pos: [7.6, 3.3, 7.2], look: [0.5, 1.45, 3.0], fov: 54, speed: 2.4,
  },
  // the main working shot: auger, the arc of snow, and the truck bed
  work: {
    anchor: 'plow',
    pos: [-9.6, 4.3, -8.6], look: [-0.9, 2.0, 3.8], fov: 52, speed: 1.7,
  },
  // driving to the dump site
  toDump: {
    anchor: 'plow',
    pos: [-11.5, 7.4, -13.5], look: [-4.0, 1.8, 10.0], fov: 54, speed: 1.4,
  },
  // tipping the load: pulled back so the growing mountain reads
  dump: {
    anchor: 'truck',
    pos: [9.0, 6.0, -9.0], look: [-6.0, 2.2, 1.0], fov: 50, speed: 1.5,
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

  /** portrait phones need the camera further out to frame the same action */
  setAspect(aspect) {
    // 0.46 (tall phone) -> 1.55 ; 2.2 (landscape pad) -> 1.0
    const k = THREE.MathUtils.clamp((1.25 - aspect) / 0.85, 0, 1);
    this.fit = 1 + k * 0.62;
    this.fovBoost = k * 6;
  }

  update(dt, anchors) {
    this.t += dt;
    const s = this.shot;
    const a = anchors[s.anchor];
    const push = s.push || [0, 0, 0];
    const k = s.push ? Math.min(1, this.t / 6) : 0;

    const f = this.fit;
    this._p.set(
      a.x + (s.pos[0] + push[0] * k) * f,
      a.y + (s.pos[1] + push[1] * k) * (0.55 + 0.45 * f),
      a.z + (s.pos[2] + push[2] * k) * f,
    );
    this._l.set(a.x + s.look[0], a.y + s.look[1], a.z + s.look[2]);

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
