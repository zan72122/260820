import { Vector3 } from 'three';
import { STATION } from '../../world/Workshop';
import { SHOTS } from '../shots';
import type { Step } from '../types';

const HOLD = 2.4;
const _p = new Vector3();

/**
 * No verb yet — just a beat of "what is that?".
 *
 * The stone is a mud-covered lump sitting in a shallow stream. Nothing about
 * it promises anything. That ignorance is the whole point: it is what the
 * first wash will overturn.
 */
export const introStep: Step = {
  name: 'intro',

  enter(ctx) {
    ctx.geode.root.position.copy(STATION.wash);
    ctx.geode.root.rotation.set(0.06, ctx.session.seed * 0.001, -0.04);
    ctx.geode.carrier.position.set(0, 0, 0);
    ctx.geode.carrier.rotation.set(0, 0, 0);
    ctx.geode.openAmount = 0;
    ctx.geode.gap = 0;
    ctx.geode.uHint.value = 0;
    ctx.geode.uSeamGlow.value = 0;
    ctx.geode.uCrystalGlow.value = 0;
    ctx.geode.uSparkle.value = 0;
    ctx.workshop.mood = 1;
    ctx.workshop.wedge.visible = false;
    ctx.workshop.brush.visible = false;
    ctx.overlay.hideChoices();
    ctx.rig.follow(null);
    ctx.rig.cut(SHOTS.intro);
    ctx.audio.setAmbience(0.55);
    ctx.audio.resetChime();
  },

  update(ctx, dt) {
    // The stone bobs a hair in the current — alive, but inert.
    const t = ctx.time;
    ctx.geode.root.position.y = STATION.wash.y + Math.sin(t * 0.9) * 0.004;
    ctx.geode.root.rotation.z = -0.04 + Math.sin(t * 0.7) * 0.012;

    // Water keeps moving so the scene never looks like a still image.
    if (Math.random() < dt * 1.6) {
      _p.set(
        STATION.wash.x + (Math.random() - 0.5) * 0.9,
        0.09,
        STATION.wash.z + (Math.random() - 0.5) * 0.9,
      );
      ctx.workshop.touchWater(_p, 0.10);
      if (Math.random() < 0.25) ctx.audio.drip();
    }

    // Touching early skips straight to work — never make a child wait.
    if (ctx.stepTime > HOLD || ctx.input.frame.justPressed) ctx.go('wash');
  },
};
