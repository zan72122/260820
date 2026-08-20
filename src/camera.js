/**
 * Camera director.
 *
 * Deliberately calm: no hand-held shake, minimal head bob, no whip pans. The
 * only strong camera move in the whole game is the push-in onto the broken
 * fruit, and it is there to make the reveal land.
 *
 * Framing is aspect-aware so the same shot reads in portrait and in landscape;
 * the avatar's facing always drives the camera's forward vector, which keeps
 * "the voice is on my left" and "that side of the screen" in agreement.
 */
import * as THREE from 'three';

const damp = (cur, target, lambda, dt) => THREE.MathUtils.damp(cur, target, lambda, dt);
const UP_Y = new THREE.Vector3(0, 1, 0);

export class CameraDirector {
  constructor(camera) {
    this.camera = camera;
    this.shot = 'look';
    this.pos = new THREE.Vector3(0, 1.4, 6);
    this.look = new THREE.Vector3();
    this.fov = 55;
    this.shakeAmp = 0;
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this.time = 0;
    this.shotTime = 0;
  }

  setShot(name) {
    if (this.shot === name) return;
    this.shot = name;
    this.shotTime = 0;
  }

  shake(a) { this.shakeAmp = Math.max(this.shakeAmp, a); }

  /** Extra distance so portrait phones still see the whole tableau. */
  _wide(aspect) {
    return THREE.MathUtils.clamp(Math.sqrt(1.25 / Math.max(aspect, 0.35)), 1, 1.75);
  }

  update(dt, ctx) {
    this.time += dt;
    this.shotTime += dt;
    const { avatarPos, avatarYaw, headY, melonPos, bob = 0, aspect = 1.6, breakPoint } = ctx;
    const fwd = this._tmp.set(Math.sin(avatarYaw), 0, Math.cos(avatarYaw));
    const wide = this._wide(aspect);

    const targetPos = this._tmp2;
    const targetLook = new THREE.Vector3();
    let targetFov = 55;
    let lambda = 3.0;

    switch (this.shot) {
      case 'look': {
        // low, close-ish three-quarter view that puts the melon centre frame
        // and still shows the avatar and the sea behind it
        const dir = new THREE.Vector3().subVectors(melonPos, avatarPos).setY(0).normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        targetPos.copy(melonPos)
          .addScaledVector(dir, -1.55 * wide)
          .addScaledVector(side, 0.85 * wide);
        targetPos.y = melonPos.y + 0.58;
        // slow creeping dolly so the "remember where it is" beat feels alive
        const creep = Math.min(this.shotTime, 3.4);
        targetPos.addScaledVector(dir, creep * 0.09);
        targetLook.copy(melonPos).addScaledVector(dir, 0.10);
        targetLook.y = melonPos.y + 0.10;
        targetFov = 46;
        lambda = 1.6;
        break;
      }
      case 'blind': {
        // just behind and above the eyes: near first person, but the sliver of
        // the avatar's own shoulders keeps a four-year-old oriented
        // in front of the eyes, not behind the head: from behind, the avatar's
        // own skull fills the frame and the blindfold reads as "broken", not "blind"
        targetPos.copy(avatarPos)
          .addScaledVector(fwd, 0.12)
          .setY(headY + 0.03 + bob * 0.5);
        // tilted down a little so the gap under the hem really shows the sand
        // in front of the player's feet
        targetLook.copy(avatarPos)
          .addScaledVector(fwd, 2.6)
          .setY(headY - 0.62 + bob * 0.35);
        targetFov = 64;
        lambda = 6.5;
        break;
      }
      case 'ready': {
        // Tidied automatically in the half second of the wind-up. It stays close
        // to the blindfolded viewpoint — pulling out to a full third-person shot
        // here would hand back the sight the whole round has been withholding.
        const dir = new THREE.Vector3().subVectors(melonPos, avatarPos).setY(0).normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        targetPos.copy(avatarPos)
          .addScaledVector(dir, -0.52)
          .addScaledVector(side, 0.44)
          .setY(headY + 0.26);
        targetLook.copy(melonPos).setY(melonPos.y + 0.05);
        targetFov = 54;
        lambda = 5.5;
        break;
      }
      case 'hero': {
        // the payoff: hard in on the torn red interior
        const p = breakPoint || melonPos;
        // swing round to one side of the player, otherwise the avatar and the
        // stick sit between the lens and the thing we came here to look at
        const toAvatar = new THREE.Vector3().subVectors(avatarPos, p).setY(0).normalize();
        const dir = toAvatar.clone().applyAxisAngle(UP_Y, 0.95);
        const t = THREE.MathUtils.smoothstep(this.shotTime, 0, 1.5);
        targetPos.copy(p)
          .addScaledVector(dir, THREE.MathUtils.lerp(1.35, 0.58, t) * wide)
          .setY(p.y + THREE.MathUtils.lerp(0.78, 0.30, t));
        targetLook.copy(p).setY(p.y - 0.06);
        targetFov = THREE.MathUtils.lerp(52, 38, t);
        lambda = 2.2;
        break;
      }
      case 'wide': {
        // back out: the friends, the beach, the summer sea
        const dir = new THREE.Vector3().subVectors(melonPos, avatarPos).setY(0).normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        const t = THREE.MathUtils.smoothstep(this.shotTime, 0, 3.0);
        targetPos.copy(melonPos)
          .addScaledVector(dir, -(2.0 + t * 2.6) * wide)
          .addScaledVector(side, (0.9 + t * 1.1) * wide)
          .setY(melonPos.y + 1.15 + t * 0.75);
        targetLook.copy(melonPos).setY(melonPos.y + 0.35 + t * 0.5);
        targetFov = 55;
        lambda = 1.1;
        break;
      }
      default:
        targetPos.copy(this.pos);
        targetLook.copy(this.look);
    }

    this.pos.x = damp(this.pos.x, targetPos.x, lambda, dt);
    this.pos.y = damp(this.pos.y, targetPos.y, lambda, dt);
    this.pos.z = damp(this.pos.z, targetPos.z, lambda, dt);
    this.look.x = damp(this.look.x, targetLook.x, lambda * 1.25, dt);
    this.look.y = damp(this.look.y, targetLook.y, lambda * 1.25, dt);
    this.look.z = damp(this.look.z, targetLook.z, lambda * 1.25, dt);

    this.camera.position.copy(this.pos);
    if (this.shakeAmp > 0.0005) {
      const s = this.shakeAmp;
      this.camera.position.x += Math.sin(this.time * 61) * s * 0.05;
      this.camera.position.y += Math.sin(this.time * 47 + 1.1) * s * 0.05;
      this.shakeAmp = damp(this.shakeAmp, 0, 6, dt);
    }
    this.camera.lookAt(this.look);

    const nextFov = damp(this.camera.fov, targetFov, lambda, dt);
    if (Math.abs(nextFov - this.camera.fov) > 0.005) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Snap the smoothing straight to the target — used when a round restarts. */
  reset(ctx) {
    for (let i = 0; i < 40; i++) this.update(1 / 30, ctx);
  }
}
