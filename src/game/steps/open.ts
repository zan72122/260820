import { Vector3 } from 'three';
import { clamp, damp, easeOutBack, smoothstep } from '../../core/Easing';
import { Spring } from '../../core/Spring';
import { SHOTS } from '../shots';
import type { Step } from '../types';

const _p = new Vector3();

const spring = new Spring(0, 130, 20);
let dragging = false;
let grabBase = 0;
let grabY = 0;
let snapped = false;
let sinceSnap = 0;
let creakLevel = 0;
let lastCreak = 0;

const SNAP_AT = 0.58;

/**
 * VERB: OPEN (wider).
 *
 * Now that the stone has given, opening it is a continuous, physical pull
 * rather than more tapping. The lid resists, the gap widens, more light gets
 * out, and past a point it swings the rest of the way on its own.
 */
export const openStep: Step = {
  name: 'open',

  enter(ctx) {
    ctx.rig.to(SHOTS.reveal);
    spring.set(ctx.geode.openAmount);
    dragging = false;
    snapped = false;
    sinceSnap = 0;
    creakLevel = 0;
    lastCreak = 0;
    ctx.geode.uSparkle.value = 0.5;
    ctx.audio.setAmbience(0.30);
  },

  update(ctx, dt) {
    const g = ctx.geode;
    const f = ctx.input.frame;

    if (!snapped) {
      if (f.justPressed) {
        // Grabbing anywhere works; the lid is the obvious target but a
        // four-year-old should not have to hit it.
        dragging = true;
        grabBase = spring.target;
        grabY = f.y;
        if (ctx.grabbedStone()) ctx.audio.knock(1.8, 0.06);
      }

      if (dragging && f.active) {
        // Upward drag opens. Resistance rises as the lid nears vertical.
        const raw = grabBase + (f.y - grabY) * 1.55;
        const resist = 1 - 0.35 * smoothstep(raw);
        spring.target = clamp(grabBase + (f.y - grabY) * 1.55 * resist);
        const rate = Math.abs(f.vy);
        creakLevel = damp(creakLevel, clamp(rate * 0.8, 0, 1) * (0.35 + spring.target * 0.65), 8, dt);
      } else {
        if (dragging) dragging = false;
        creakLevel = damp(creakLevel, 0, 5, dt);
        // Gravity: an un-held lid sags back a little, inviting another pull.
        spring.target = damp(spring.target, Math.max(0.04, spring.target - 0.35 * dt), 1.2, dt);
      }

      ctx.audio.setCreak(creakLevel * 0.7);
      if (creakLevel > 0.25 && ctx.time - lastCreak > 0.22) {
        lastCreak = ctx.time;
        ctx.audio.knock(2.4 + Math.random(), 0.035);
        _p.copy(g.root.position).setY(g.root.position.y + 0.02);
        ctx.powder.spawn(_p, new Vector3(0, 0.5, 0.6).normalize(),
          Math.round(2 * ctx.quality.particleMul) + 1, 0.28, 1.6);
      }

      if (spring.target >= SNAP_AT) {
        snapped = true;
        sinceSnap = 0;
        ctx.audio.setCreak(0);
        ctx.audio.crack(0.42);
        ctx.audio.chime(6, 0.10);
        ctx.rig.impulse(0.010);
        ctx.rig.to(SHOTS.reveal);
      }
    } else {
      sinceSnap += dt;
      spring.target = 1;
      // Overshoot then settle — the lid falls open with weight.
      const t = clamp(sinceSnap / 0.75);
      spring.value = clamp(spring.value + (easeOutBack(t) - spring.value) * (1 - Math.exp(-9 * dt)));
      spring.velocity = 0;
    }

    if (!snapped) spring.step(dt);
    g.openAmount = clamp(spring.value);

    // Light escapes in proportion to how far it is open, then the inside takes over.
    const a = g.openAmount;
    g.gap = clamp(g.radius * 0.135 + a * g.radius * 0.05);
    g.uSeamGlow.value = damp(g.uSeamGlow.value, 1.0 * (1 - a * 0.78), 4, dt);
    g.uCrystalGlow.value = damp(g.uCrystalGlow.value, 0.35 + a * 0.35, 3, dt);
    g.uSparkle.value = damp(g.uSparkle.value, 0.3 + a * 0.6, 2.5, dt);
    ctx.rig.setDolly(-0.10 + a * 0.16);

    if (ctx.input.idleFor > 1.5 && !f.active && !snapped) {
      const s = ctx.toScreen(g.root.position);
      ctx.hint.show({ kind: 'lift', x: s.x, y: s.y + 12, x2: s.x, y2: s.y - 92 });
    } else {
      ctx.hint.hide();
    }

    if (snapped && sinceSnap > 1.5) ctx.go('dust');
  },

  exit(ctx) {
    ctx.audio.setCreak(0);
    ctx.hint.hide();
    ctx.rig.setDolly(0);
    ctx.geode.openAmount = 1;
  },
};
