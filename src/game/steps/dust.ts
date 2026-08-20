import { Mesh, Vector3 } from 'three';
import { clamp, damp } from '../../core/Easing';
import { Spring3 } from '../../core/Spring';
import { SHOTS } from '../shots';
import type { Step } from '../types';

const _hit = new Vector3();
const _dir = new Vector3();
const _home = new Vector3();
const spring = new Spring3(150, 20);

let contactAmt = 0;
let sweepLevel = 0;
let done = false;
let doneT = 0;
let lastPuff = 0;
let settled = 0;

const DONE_POWDER = 0.16;
const SETTLE = 0.9;
const GIVE_UP_AFTER = 45;

/**
 * VERB: DUST.
 *
 * The crystals arrive dulled by rock flour. Brushing is the least dramatic
 * action in the game and the most satisfying: every stroke visibly upgrades
 * what is already there, which is exactly the loop that makes a child want
 * one more go.
 */
export const dustStep: Step = {
  name: 'dust',

  enter(ctx) {
    ctx.rig.to(SHOTS.dust);
    ctx.workshop.brush.visible = true;
    _home.copy(ctx.geode.root.position).add(new Vector3(0.42, 0.34, 0.36));
    ctx.workshop.brush.position.copy(_home);
    spring.set(_home);
    contactAmt = 0;
    sweepLevel = 0;
    done = false;
    doneT = 0;
    lastPuff = 0;
    settled = 0;
    ctx.audio.setAmbience(0.28);
  },

  update(ctx, dt) {
    const g = ctx.geode;
    const f = ctx.input.frame;
    const brush = ctx.workshop.brush;

    let touching = false;

    if (f.active) {
      // The ray enters over the rim, so the nearest hit is often the outside of
      // the rock. Walk the hits and take the first one that is actually inside.
      const hits = ctx.pickAll(ctx.shellMeshes());
      const hit = hits.find((h) => ctx.geode.isCavityPoint(h.point, h.object as Mesh))
        ?? null;
      if (hit) {
        touching = true;
        _hit.copy(hit.point);
        const mesh = hit.object as Mesh;
        const speed = Math.hypot(f.vx, f.vy);
        const sweep = clamp(speed * 0.85, 0, 1.4);
        g.dustAt(_hit, mesh, 0.085 + sweep * 0.030, 0.28 + sweep * 0.34);

        if (sweep > 0.06 && ctx.time - lastPuff > 0.045) {
          lastPuff = ctx.time;
          _dir.set(f.vx, 0.55, f.vy).normalize();
          ctx.powder.spawn(_hit, _dir,
            Math.round(1 + sweep * 3 * ctx.quality.particleMul), 0.20 + sweep * 0.22, 1.5);
        }
        sweepLevel = damp(sweepLevel, clamp(speed * 0.8, 0, 1), 12, dt);
        spring.target.copy(_hit).addScaledVector(hit.face?.normal ?? _dir.set(0, 1, 0), 0.055);
      }
    }

    if (!touching) {
      g.endStroke();
      sweepLevel = damp(sweepLevel, 0, 8, dt);
      if (!f.active) spring.target.copy(_home);
    }

    contactAmt = damp(contactAmt, touching ? 1 : 0, 10, dt);
    ctx.workshop.setBristleBend(contactAmt * (0.35 + sweepLevel * 0.65));
    ctx.audio.brush(sweepLevel * (0.3 + contactAmt * 0.7));

    spring.step(dt);
    brush.position.copy(spring.value);
    // Tilt into the stroke; a dragged brush trails its handle.
    brush.rotation.z = damp(brush.rotation.z, clamp(-spring.velocity.x * 0.12, -0.5, 0.5), 8, dt);
    brush.rotation.x = damp(brush.rotation.x, clamp(spring.velocity.z * 0.12, -0.5, 0.5), 8, dt);

    const clean = 1 - g.powderLeft;
    g.uCrystalGlow.value = damp(g.uCrystalGlow.value, 0.55 + clean * 0.3, 3, dt);
    g.uSparkle.value = damp(g.uSparkle.value, 0.45 + clean * 0.6, 2.5, dt);

    const clear = g.powderLeft <= DONE_POWDER
      || (ctx.stepTime > GIVE_UP_AFTER && g.powderLeft < 0.5);
    settled = clear && !f.active && !touching ? settled + dt : 0;
    if (!done && settled > SETTLE) {
      done = true;
      doneT = 0;
      ctx.session.dustQuality = clamp((1 - g.powderLeft) / 0.9);
      ctx.audio.chime(7, 0.10);
    }

    if (done) {
      doneT += dt;
      spring.target.copy(_home);
      ctx.workshop.setBristleBend(0);
      if (doneT > 0.9) ctx.go('hold');
      return;
    }

    if (ctx.input.idleFor > 1.6 && !f.active) {
      const s = ctx.toScreen(g.root.position);
      ctx.hint.show({ kind: 'scrub', x: s.x, y: s.y + 6, radius: 34 });
    } else {
      ctx.hint.hide();
    }
  },

  exit(ctx) {
    ctx.audio.setScrub(0, 0);
    ctx.geode.endStroke();
    ctx.workshop.setBristleBend(0);
    ctx.workshop.brush.visible = false;
    ctx.hint.hide();
  },
};
