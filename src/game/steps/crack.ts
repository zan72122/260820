import { Vector3 } from 'three';
import { clamp, damp, easeOutCubic, easeOutQuint, lerp } from '../../core/Easing';
import { SHOTS } from '../shots';
import type { Step } from '../types';

const _local = new Vector3();
const _out = new Vector3();
const _pos = new Vector3();

// Front-left of the stone: dead-on toward the camera would show the chisel
// end-on, which reads as a smudge rather than as a tool.
const FRONT = Math.PI * 0.62;
const ARC = 0.62;               // how far along the seam the wedge may travel
const NEEDED = 3;               // presses to a clean break

let wedgeLon = FRONT;
let stressLon = FRONT;
let strain = 0;
let press = 0;         // 0..1 within a single press animation
let pressing = false;
let approach = 0;
let shudder = 0;
let cracked = false;
let crackT = 0;
let queued = false;
let revealed = false;
let pulled = false;

/**
 * VERB: OPEN (first bite).
 *
 * This is the hinge of the whole game. Three presses, each one heavier than
 * the last, and then the stone gives — and for the first time colour comes
 * out of it instead of off it.
 *
 * It is not a mash: the wedge goes where you tap, and strain accumulates where
 * you keep working. Tapping the same spot is rewarded, which is what a person
 * splitting a rock actually learns to do.
 */
export const crackStep: Step = {
  name: 'crack',

  enter(ctx) {
    ctx.rig.to(SHOTS.wedge);
    ctx.workshop.wedge.visible = true;
    wedgeLon = FRONT;
    stressLon = FRONT;
    strain = 0;
    press = 0;
    pressing = false;
    approach = 0;
    shudder = 0;
    cracked = false;
    crackT = 0;
    revealed = false;
    pulled = false;
    queued = false;
    // The stone was turned about while being washed; set it square in the jaws.
    ctx.geode.carrier.rotation.set(0, 0, 0);
    ctx.session.presses = 0;
    ctx.geode.uStress.value = 0;
    ctx.geode.uStressLon.value = FRONT;
    ctx.audio.setAmbience(0.34);
  },

  update(ctx, dt) {
    const g = ctx.geode;
    const f = ctx.input.frame;

    if (!cracked) {
      // ---------- aim ----------
      if (f.justPressed || f.tapped) {
        const hit = ctx.pick(ctx.shellMeshes());
        if (hit) {
          _local.copy(hit.point);
          g.shellMeshes[0].worldToLocal(_local);
          const lon = Math.atan2(_local.z, _local.x);
          // Clamp to the arc the player can actually see.
          const rel = wrapPi(lon - FRONT);
          wedgeLon = FRONT + clamp(rel, -ARC, ARC);
        }
      }

      // ---------- press ----------
      // A tap during an in-flight press is remembered rather than dropped —
      // an impatient child taps faster than the animation, not slower.
      const wantsPress = f.tapped || (f.justReleased && Math.abs(f.flickY) > 0.3);
      if (wantsPress) {
        if (pressing) queued = true;
        else { pressing = true; press = 0; ctx.session.presses++; }
      }

      if (pressing) {
        press += dt / 0.42;
        // Resistance first, release after: the wedge stalls, then bites.
        approach = Math.sin(clamp(press) * Math.PI) * 0.055;
        ctx.audio.setCreak(Math.sin(clamp(press) * Math.PI));

        if (press >= 0.52 && shudder === 0) {
          // The bite.
          shudder = 1;
          // The first bite is wherever the player chose; only later ones are
          // judged against where the strain has already gathered.
          const first = ctx.session.presses <= 1;
          const near = first || Math.abs(wrapPi(wedgeLon - stressLon)) < 0.45;
          const gain = near ? 1 : 0.65;
          // Working a fresh spot drags the stress line toward it.
          stressLon = near ? (first ? wedgeLon : stressLon) : lerp(stressLon, wedgeLon, 0.7);
          strain = clamp(strain + gain / NEEDED);
          // A child must never be able to get stuck hammering a stone.
          if (ctx.session.presses >= NEEDED + 2) strain = 1;
          ctx.audio.knock(0.9 + strain * 0.5, 0.16 + strain * 0.12);
          ctx.rig.impulse(0.006 + strain * 0.010);

          _pos.copy(g.root.position);
          _out.set(Math.cos(wedgeLon), 0, Math.sin(wedgeLon));
          _pos.addScaledVector(_out, g.radius * 0.95).setY(g.root.position.y + g.seamYAt(wedgeLon));
          ctx.chips.spawn(_pos, _out.clone().setY(0.5).normalize(),
            Math.round(4 + strain * 8 * ctx.quality.particleMul), 0.7, 1.2);
          ctx.powder.spawn(_pos, _out.clone().setY(0.3).normalize(),
            Math.round(2 + strain * 4 * ctx.quality.particleMul), 0.25, 1.4);

          if (strain >= 0.999) startCrack(ctx);
        }
        if (press >= 1) {
          shudder = 0; approach = 0; ctx.audio.setCreak(0);
          if (queued) { queued = false; press = 0; ctx.session.presses++; }
          else { pressing = false; press = 0; }
        }
      } else {
        approach = damp(approach, 0, 8, dt);
        ctx.audio.setCreak(0);
      }

      // ---------- the stone answers ----------
      g.uStress.value = damp(g.uStress.value, strain * 0.85 + (pressing ? 0.25 : 0), 8, dt);
      g.uStressLon.value = stressLon;
      g.uSeamGlow.value = damp(g.uSeamGlow.value, 0.55 + strain * 0.45, 3, dt);
      // A hair of flex under the wedge, then it springs back.
      g.gap = damp(g.gap, pressing ? Math.sin(clamp(press) * Math.PI) * 0.010 : 0, 10, dt);
      g.carrier.rotation.z = damp(g.carrier.rotation.z,
        pressing ? Math.sin(press * 34) * 0.006 * (1 - press) : 0, 14, dt);

      // ---------- the wedge ----------
      placeWedge(ctx, wedgeLon, approach, ctx.time);

      if (ctx.input.idleFor > 1.5 && !f.active) {
        const s = ctx.toScreen(wedgeWorld(ctx, wedgeLon, 0.10, _pos));
        ctx.hint.show({ kind: 'tap', x: s.x, y: s.y });
      } else {
        ctx.hint.hide();
      }
      return;
    }

    // ---------------------------------------------------------------- crack
    crackT += dt;

    // Slow motion for the instant the light gets out, then back to real time.
    ctx.timeScale = crackT < 0.55 ? lerp(0.28, 1, easeOutCubic(crackT / 0.55)) : 1;

    const openT = easeOutQuint(clamp(crackT / 0.85));
    g.gap = lerp(0.008, g.radius * 0.135, openT);
    g.uSeamGlow.value = damp(g.uSeamGlow.value, 1.0, 9, dt);
    g.uCrystalGlow.value = damp(g.uCrystalGlow.value, 0.75, 4, dt);
    g.uSparkle.value = damp(g.uSparkle.value, 0.55, 3, dt);
    g.uStress.value = damp(g.uStress.value, 0, 5, dt);

    // Retract and fade the wedge — its job is done.
    placeWedge(ctx, wedgeLon, -clamp(crackT * 0.5) * 0.4, ctx.time);
    if (crackT > 0.7) ctx.workshop.wedge.visible = false;

    if (!revealed && crackT > 0.62) {
      revealed = true;
      ctx.audio.reveal();
    }
    if (!pulled && crackT > 1.55) {
      pulled = true;
      ctx.rig.to(SHOTS.reveal);
    }
    if (crackT > 2.5) ctx.go('open');
  },

  exit(ctx) {
    ctx.timeScale = 1;
    ctx.audio.setCreak(0);
    ctx.hint.hide();
    ctx.workshop.wedge.visible = false;
  },
};

function startCrack(ctx: Parameters<Step['update']>[0]): void {
  cracked = true;
  crackT = 0;
  const g = ctx.geode;
  ctx.audio.crack(1);
  ctx.audio.setCreak(0);
  ctx.rig.cut(SHOTS.crack);
  ctx.rig.impulse(0.030);
  ctx.flash(0.20);

  _pos.copy(g.root.position);
  _out.set(Math.cos(wedgeLon), 0, Math.sin(wedgeLon));
  _pos.addScaledVector(_out, g.seamRadiusAt(wedgeLon));
  ctx.chips.spawn(_pos, _out.clone().setY(0.7).normalize(),
    Math.round(16 * ctx.quality.particleMul) + 6, 1.4, 1.5);
  ctx.powder.spawn(_pos, _out.clone().setY(0.4).normalize(),
    Math.round(14 * ctx.quality.particleMul) + 6, 0.5, 1.8);
}

function wrapPi(a: number): number {
  return ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

function wedgeWorld(
  ctx: Parameters<Step['update']>[0], lon: number, extra: number, out: Vector3,
): Vector3 {
  const g = ctx.geode;
  out.set(Math.cos(lon), 0, Math.sin(lon)).multiplyScalar(g.radius * 1.02 + extra);
  out.y = g.seamYAt(lon);
  return out.add(g.root.position);
}

function placeWedge(
  ctx: Parameters<Step['update']>[0], lon: number, approachAmt: number, time: number,
): void {
  const w = ctx.workshop.wedge;
  const g = ctx.geode;
  // Measure the stone rather than guessing: a crag can stick out far enough to
  // swallow the blade, and a hollow can leave it floating in mid-air.
  const BLADE = 0.19;
  const idle = Math.sin(time * 2.4) * 0.004;
  const d = g.seamRadiusAt(lon) + BLADE - approachAmt + 0.008 + idle;
  w.position.set(
    g.root.position.x + Math.cos(lon) * d,
    g.root.position.y + g.seamYAt(lon) + 0.012,
    g.root.position.z + Math.sin(lon) * d,
  );
  w.rotation.set(0, -lon, 0.42);
}
