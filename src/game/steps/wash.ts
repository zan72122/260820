import { Mesh, Vector3 } from 'three';
import { clamp, damp, smoothstep } from '../../core/Easing';
import { STATION } from '../../world/Workshop';
import { SHOTS } from '../shots';
import type { Step } from '../types';

const _hit = new Vector3();
const _n = new Vector3();
const _tmp = new Vector3();

/** The underside sits in the water and never gets scrubbed, so "clean" can
 *  never mean zero. Past this the stone reads as washed. */
const CLEAN_ENOUGH = 0.28;
/** After it looks clean, wait for the player to stop before moving on — so the
 *  scene ends when they are done enjoying it, not the instant a number trips. */
const SETTLE = 1.1;
const GIVE_UP_AFTER = 70;

let rock = 0;
let rockVel = 0;
let spin = 0;
let spinVel = 0;
let tilt = 0;
let tiltVel = 0;
let scrubLevel = 0;
let celebrated = 0;
let lastDripAt = 0;
let settled = 0;

/**
 * VERB: WASH.
 *
 * The turn from "rock" to "something". Mud comes off exactly where the finger
 * goes, the wet stone starts answering the light, a break line appears, and a
 * colour that was not there before starts bleeding out of the crack. All of it
 * is a consequence of rubbing — nothing is announced.
 */
export const washStep: Step = {
  name: 'wash',

  enter(ctx) {
    ctx.rig.to(SHOTS.wash);
    ctx.audio.setAmbience(0.5);
    rock = 0; rockVel = 0; scrubLevel = 0; celebrated = 0; lastDripAt = 0;
    spin = ctx.geode.carrier.rotation.y;
    spinVel = 0; tilt = 0; tiltVel = 0;
    settled = 0;
  },

  update(ctx, dt) {
    const f = ctx.input.frame;
    const g = ctx.geode;

    const speed = Math.hypot(f.vx, f.vy);
    let contact = false;

    if (f.active) {
      const hit = ctx.pick(ctx.shellMeshes());
      if (hit) {
        contact = true;
        _hit.copy(hit.point);
        const mesh = hit.object as Mesh;

        // Scrubbing removes mud; resting a finger only wets the stone. The
        // stroke itself is interpolated inside washAt, so a slow deliberate rub
        // cleans just as reliably as a fast one.
        const rub = clamp(speed * 0.9, 0, 1.6);
        const radius = 0.105 + rub * 0.045;
        g.washAt(_hit, mesh, radius, 0.30 + rub * 0.40);

        // Spray: droplets fly off along the surface tangent, mud falls.
        _n.copy(hit.face?.normal ?? _n.set(0, 1, 0));
        const flying = Math.min(1, rub);
        if (flying > 0.05) {
          ctx.droplets.spawn(_hit, _tmp.set(f.vx * 0.25, 0.55, f.vy * 0.25).normalize(),
            Math.round(1 + flying * 3 * ctx.quality.particleMul), 0.55 + flying * 0.6, 0.9);
          if (g.mudLeft > 0.08) {
            ctx.mudflecks.spawn(_hit, _tmp.set(f.vx * 0.3, 0.2, f.vy * 0.3).normalize(),
              Math.round(flying * 2 * ctx.quality.particleMul), 0.4, 1.1);
          }
        }

        // The stone rocks against the finger — it has weight.
        rockVel += (f.dx * 2.6 - rock * 5.0) * dt * 12;
        // ...and it turns under it, like a trackball. This is what makes the
        // far side reachable: rubbing sideways brings fresh mud to the finger,
        // so "keep rubbing" is all a child ever has to work out.
        spinVel += f.dx * 34;
        tiltVel += f.dy * 16;

        ctx.workshop.touchWater(_hit, dt * 1.4 * (0.4 + rub));
        if (ctx.time - lastDripAt > 0.34 && rub > 0.35) {
          lastDripAt = ctx.time;
          ctx.audio.drip();
        }
      }
    }

    if (!contact) g.endStroke();
    scrubLevel = damp(scrubLevel, contact ? clamp(speed * 0.75, 0, 1) : 0, 12, dt);
    ctx.audio.setScrub(scrubLevel, 1 - g.mudLeft);

    rockVel = damp(rockVel, 0, 3.2, dt);
    rock = damp(rock + rockVel * dt, 0, 2.6, dt);

    spinVel = damp(spinVel, 0, 3.4, dt);
    spin += spinVel * dt;
    tiltVel = damp(tiltVel, 0, 4.0, dt);
    tilt = clamp(tilt + tiltVel * dt, -0.42, 0.42);
    if (!f.active) tilt = damp(tilt, 0, 1.6, dt);
    g.carrier.rotation.y = spin;
    g.carrier.rotation.x = tilt;
    g.root.rotation.z = -0.04 + Math.sin(ctx.time * 0.7) * 0.012 - clamp(rock, -0.16, 0.16);
    g.root.rotation.x = 0.06 + clamp(rockVel * 0.02, -0.08, 0.08);
    g.root.position.y = STATION.wash.y + Math.sin(ctx.time * 0.9) * 0.004;

    // --- the promise emerges ---
    const clean = 1 - g.mudLeft;
    // Colour only starts showing once real progress has been made, so it reads
    // as a discovery rather than as decoration that was always there.
    g.uHint.value = damp(g.uHint.value, smoothstep((clean - 0.34) / 0.5), 3.2, dt);
    g.uSeamGlow.value = damp(g.uSeamGlow.value, smoothstep((clean - 0.55) / 0.4) * 0.55, 2.4, dt);
    g.uCrystalGlow.value = damp(g.uCrystalGlow.value, 0.25, 2, dt);

    // Push in slightly as the stone becomes interesting.
    ctx.rig.setDolly(-0.12 * smoothstep((clean - 0.3) / 0.6));

    // A single chime the first time the colour is unmistakable.
    if (celebrated === 0 && clean > 0.62) {
      celebrated = 1;
      ctx.audio.chime(3, 0.075);
    }

    // --- hint ---
    if (ctx.input.idleFor > 1.6 && !f.active) {
      const s = ctx.toScreen(g.root.position);
      ctx.hint.show({ kind: 'scrub', x: s.x, y: s.y, radius: 40 });
    } else {
      ctx.hint.hide();
    }

    const looksClean = g.mudLeft <= CLEAN_ENOUGH
      || (ctx.stepTime > GIVE_UP_AFTER && g.mudLeft < 0.5);
    settled = looksClean && !f.active && !contact ? settled + dt : 0;
    // Last resort: never let enthusiasm become a dead end.
    const stranded = looksClean && ctx.stepTime > GIVE_UP_AFTER + 50;
    if (settled > SETTLE || stranded) {
      ctx.session.washQuality = clamp((1 - g.mudLeft) / 0.78);
      ctx.audio.setScrub(0, 0);
      ctx.audio.chime(5, 0.09);
      ctx.go('place');
    }
  },

  exit(ctx) {
    ctx.audio.setScrub(0, 0);
    ctx.rig.setDolly(0);
    ctx.hint.hide();
    ctx.geode.endStroke();
  },
};
