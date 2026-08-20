import { Vector3 } from 'three';
import { clamp, damp, easeOutCubic } from '../../core/Easing';
import { addToCollection } from '../Collection';
import { STATION } from '../../world/Workshop';
import { SHOTS } from '../shots';
import type { Step } from '../types';

const _p = new Vector3();
let arced = false;
let shown = false;
let settle = 0;

/**
 * The pay-off. The room goes quiet and dark, one lamp finds the stone, and
 * everything the player did — how clean they got it, how well they dusted —
 * is visible in how it shines.
 */
export const displayStep: Step = {
  name: 'display',

  enter(ctx) {
    ctx.rig.to(SHOTS.display);
    ctx.rig.follow(null);
    arced = false;
    shown = false;
    settle = 0;
    ctx.audio.setAmbience(0.14);
    ctx.audio.finale();
    ctx.workshop.caustics.uIntensity.value = 0;

    if (!ctx.session.recorded) {
      ctx.session.recorded = true;
      addToCollection({
        variety: ctx.geode.variety.id,
        seed: ctx.session.seed,
        care: clamp((ctx.session.washQuality + ctx.session.dustQuality) * 0.5),
        at: Date.now(),
      });
    }
  },

  update(ctx, dt) {
    const g = ctx.geode;
    const ws = ctx.workshop;

    settle += dt;
    const t = clamp(settle / 0.9);
    _p.copy(STATION.pedestal);
    // A soft landing onto the cushion.
    _p.y += (1 - easeOutCubic(t)) * 0.05;
    g.root.position.lerp(_p, 1 - Math.exp(-9 * dt));
    g.carrier.rotation.x = damp(g.carrier.rotation.x, 0, 5, dt);
    g.carrier.rotation.z = damp(g.carrier.rotation.z, 0, 5, dt);
    // Slow turn so every facet gets its moment.
    g.carrier.rotation.y += dt * 0.16;

    // The room bows out; only the stone is lit.
    ws.mood = 0.16;
    ws.spot.intensity = damp(ws.spot.intensity, 3.6, 1.8, dt);

    const care = clamp((ctx.session.washQuality + ctx.session.dustQuality) * 0.5);
    g.uCrystalGlow.value = damp(g.uCrystalGlow.value, 1.5 + care * 1.1, 2, dt);
    g.uSparkle.value = damp(g.uSparkle.value, 1.4 + care * 1.0, 2, dt);
    g.uSeamGlow.value = damp(g.uSeamGlow.value, 0.08, 3, dt);

    if (!arced && settle > 1.6) {
      arced = true;
      ctx.rig.to(SHOTS.displayArc);
    }
    if (!shown && settle > 2.5) {
      shown = true;
      ctx.overlay.showChoices();
    }

    // An occasional twinkle chime while the choices are up; keeps the screen alive.
    if (shown && Math.random() < dt * 0.35) ctx.audio.chime(undefined, 0.045);
  },

  exit(ctx) {
    ctx.overlay.hideChoices();
    ctx.workshop.spot.intensity = 0;
    ctx.workshop.mood = 1;
  },
};
