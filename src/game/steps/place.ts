import { Vector3 } from 'three';
import { Spring3 } from '../../core/Spring';
import { clamp, damp, easeOutBack } from '../../core/Easing';
import { STATION } from '../../world/Workshop';
import { SHOTS } from '../shots';
import type { Step } from '../types';

const _plane = new Vector3();
const _grab = new Vector3();
const spring = new Spring3(95, 15);

let held = false;
let settling = 0;
let dropped = false;
let liftOffset = 0;

const CARRY_HEIGHT = 0.30;

/**
 * VERB: PLACE.
 *
 * A short carry from the water to the cradle. Deliberately forgiving: the
 * stone is heavy and lags behind the finger, but the cradle catches anything
 * let go on its side of the bench. No precision, ever.
 */
export const placeStep: Step = {
  name: 'place',

  enter(ctx) {
    ctx.rig.to(SHOTS.place);
    spring.set(ctx.geode.root.position);
    held = false;
    settling = 0;
    dropped = false;
    liftOffset = 0;
    ctx.audio.setAmbience(0.42);
  },

  update(ctx, dt) {
    const f = ctx.input.frame;
    const g = ctx.geode;

    if (dropped) {
      // Settle into the cradle with a little bounce, then move on.
      settling += dt;
      const t = clamp(settling / 0.55);
      g.root.position.lerpVectors(spring.value, STATION.cradle, easeOutBack(t));
      g.root.rotation.x = damp(g.root.rotation.x, 0, 6, dt);
      g.root.rotation.z = damp(g.root.rotation.z, 0, 6, dt);
      g.root.rotation.y = damp(g.root.rotation.y, 0, 6, dt);
      if (settling > 0.85) ctx.go('crack');
      return;
    }

    if (f.justPressed && ctx.grabbedStone()) {
      held = true;
      const hit = ctx.pick(ctx.shellMeshes());
      if (hit) _grab.copy(hit.point).sub(g.root.position);
      else _grab.set(0, 0, 0);
      ctx.audio.knock(1.6, 0.10);
    }

    if (held && f.active) {
      // Drag on a plane a little above the bench: lifting is implied, not asked for.
      liftOffset = damp(liftOffset, CARRY_HEIGHT, 6, dt);
      if (ctx.pickPlane(STATION.wash.y + liftOffset, _plane)) {
        _plane.sub(_grab);
        _plane.x = clamp(_plane.x, -1.5, 1.5);
        _plane.z = clamp(_plane.z, -0.8, 0.9);
        _plane.y = STATION.wash.y + liftOffset;
        spring.target.copy(_plane);
      }
    } else if (held) {
      held = false;
      const p = spring.value;
      const midX = (STATION.wash.x + STATION.cradle.x) * 0.5;
      // Anything let go past halfway, or flicked rightward, lands in the cradle.
      if (p.x > midX || f.flickX > 0.35) {
        dropped = true;
        settling = 0;
        ctx.audio.knock(0.85, 0.30);
        ctx.workshop.mood = 1;
        return;
      }
      spring.target.copy(STATION.wash);
    } else {
      spring.target.copy(STATION.wash);
      liftOffset = damp(liftOffset, 0, 5, dt);
    }

    spring.step(dt);
    g.root.position.copy(spring.value);

    // Swing the stone against the direction of travel — it has mass.
    const vel = spring.velocity;
    g.root.rotation.z = damp(g.root.rotation.z, clamp(-vel.x * 0.10, -0.28, 0.28), 7, dt);
    g.root.rotation.x = damp(g.root.rotation.x, clamp(vel.z * 0.10, -0.28, 0.28), 7, dt);
    g.root.rotation.y = damp(g.root.rotation.y, clamp(-vel.x * 0.05, -0.2, 0.2), 5, dt);

    // The cradle asks for the stone by breathing light, not by a label.
    const pulse = 0.5 + 0.5 * Math.sin(ctx.time * 2.6);
    ctx.workshop.cradle.scale.setScalar(1 + pulse * 0.012);

    if (ctx.input.idleFor > 1.4 && !f.active) {
      const from = ctx.toScreen(g.root.position);
      const to = ctx.toScreen(STATION.cradle);
      ctx.hint.show({ kind: 'drag', x: from.x, y: from.y, x2: to.x, y2: to.y - 12 });
    } else {
      ctx.hint.hide();
    }
  },

  exit(ctx) {
    ctx.hint.hide();
    ctx.geode.carrier.rotation.set(0, 0, 0);
    ctx.workshop.cradle.scale.setScalar(1);
    ctx.geode.root.position.copy(STATION.cradle);
    ctx.geode.root.rotation.set(0, 0, 0);
  },
};
