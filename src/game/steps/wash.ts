import { Mesh, Vector3 } from 'three';
import { clamp, damp, smoothstep } from '../../core/Easing';
import { STATION } from '../../world/Workshop';
import { SHOTS } from '../shots';
import type { Step } from '../types';

const _hit = new Vector3();
const _n = new Vector3();
const _tmp = new Vector3();

const DONE_MUD = 0.15;
const GIVE_UP_AFTER = 55;

let rock = 0;
let rockVel = 0;
let scrubLevel = 0;
let celebrated = 0;
let lastDripAt = 0;

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

        // Scrubbing hard removes mud; resting a finger only wets the stone.
        const rub = clamp(speed * 0.9, 0, 1.6);
        const strength = 0.10 + rub * 0.42;
        const radius = 0.055 + rub * 0.018;
        g.washAt(_hit, mesh, radius, strength * (0.35 + 0.65 * Math.min(1, rub * 2)));

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

        ctx.workshop.touchWater(_hit, dt * 1.4 * (0.4 + rub));
        if (ctx.time - lastDripAt > 0.34 && rub > 0.35) {
          lastDripAt = ctx.time;
          ctx.audio.drip();
        }
      }
    }

    scrubLevel = damp(scrubLevel, contact ? clamp(speed * 0.75, 0, 1) : 0, 12, dt);
    ctx.audio.setScrub(scrubLevel, 1 - g.mudLeft);

    rockVel = damp(rockVel, 0, 3.2, dt);
    rock = damp(rock + rockVel * dt, 0, 2.6, dt);
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

    const done = g.mudLeft <= DONE_MUD || (ctx.stepTime > GIVE_UP_AFTER && g.mudLeft < 0.45);
    if (done && !f.active) {
      ctx.session.washQuality = clamp(1 - g.mudLeft * 1.6);
      ctx.audio.setScrub(0, 0);
      ctx.audio.chime(5, 0.09);
      ctx.go('place');
    }
  },

  exit(ctx) {
    ctx.audio.setScrub(0, 0);
    ctx.rig.setDolly(0);
    ctx.hint.hide();
  },
};
