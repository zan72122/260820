import { Vector3 } from 'three';
import { clamp, damp, smoothstep } from '../../core/Easing';
import { Spring3 } from '../../core/Spring';
import { STATION } from '../../world/Workshop';
import { SHOTS } from '../shots';
import type { Step } from '../types';

const _plane = new Vector3();
const _grab = new Vector3();
const _follow = new Vector3();
const spring = new Spring3(72, 13);

let held = false;
let lifted = 0;
let spinVel = 0;
let spin = 0;
let dropping = false;
let dropT = 0;
let nudged = false;

const LIFT_Y = 1.06;
const REST = new Vector3();

/**
 * VERB: HOLD UP TO THE LIGHT.
 *
 * The stone is heavy: it trails the finger, swings past, and settles. Raising
 * it into the window beam throws coloured caustics onto the bench and the
 * wall, and turning it sweeps them around the room. This is the step that
 * exists purely to be enjoyed.
 */
export const holdStep: Step = {
  name: 'hold',

  enter(ctx) {
    ctx.rig.to(SHOTS.hold);
    REST.copy(STATION.cradle);
    spring.set(ctx.geode.root.position);
    held = false;
    lifted = 0;
    spin = 0;
    spinVel = 0;
    dropping = false;
    dropT = 0;
    nudged = false;
    ctx.geode.uSparkle.value = 1;
    ctx.audio.setAmbience(0.26);
    ctx.workshop.caustics.uColor.value.copy(ctx.geode.variety.hue);
  },

  update(ctx, dt) {
    const g = ctx.geode;
    const f = ctx.input.frame;
    const ws = ctx.workshop;

    if (dropping) {
      dropT += dt;
      const t = clamp(dropT / 0.7);
      g.root.position.lerpVectors(spring.value, STATION.pedestal, smoothstep(t));
      g.carrier.rotation.z = damp(g.carrier.rotation.z, 0, 5, dt);
      g.carrier.rotation.y = damp(g.carrier.rotation.y, 0, 5, dt);
      ws.caustics.uIntensity.value = damp(ws.caustics.uIntensity.value, 0, 4, dt);
      if (dropT > 0.75) ctx.go('display');
      return;
    }

    if (f.justPressed) {
      const hit = ctx.pick(ctx.shellMeshes());
      if (hit) {
        held = true;
        _grab.copy(hit.point).sub(g.root.position);
        _grab.y = 0;
      }
    }

    if (held && f.active) {
      lifted = damp(lifted, 1, 4.5, dt);
      const y = REST.y + (LIFT_Y - REST.y) * lifted;
      if (ctx.pickPlane(y, _plane)) {
        _plane.sub(_grab);
        _plane.x = clamp(_plane.x, -0.7, 1.6);
        _plane.z = clamp(_plane.z, -0.55, 0.8);
        _plane.y = y;
        spring.target.copy(_plane);
      }
      // Horizontal drag also spins the stone, sweeping the caustics.
      spinVel += f.dx * 5.2;
    } else if (held) {
      held = false;
      const p = spring.value;
      const midX = (STATION.cradle.x + STATION.pedestal.x) * 0.5;
      if (p.x > midX || f.flickX > 0.4) {
        dropping = true;
        dropT = 0;
        ctx.audio.knock(0.7, 0.20);
        return;
      }
    }

    if (!held) {
      lifted = damp(lifted, 0, 2.4, dt);
      spring.target.copy(REST).setY(REST.y + (LIFT_Y - REST.y) * lifted);
    }

    spinVel = damp(spinVel, 0, 2.6, dt);
    spin += spinVel * dt;
    spring.step(dt);
    g.root.position.copy(spring.value);
    g.carrier.rotation.y = spin;
    // Swing under its own weight.
    g.carrier.rotation.z = damp(g.carrier.rotation.z,
      clamp(-spring.velocity.x * 0.16, -0.35, 0.35), 6, dt);
    g.carrier.rotation.x = damp(g.carrier.rotation.x,
      clamp(spring.velocity.z * 0.14, -0.3, 0.3), 6, dt);

    // --- light show ---
    const height = clamp((g.root.position.y - REST.y) / (LIFT_Y - REST.y));
    const inBeam = smoothstep((height - 0.28) / 0.55);
    ws.caustics.uIntensity.value = damp(ws.caustics.uIntensity.value, inBeam * 0.95, 4, dt);
    ws.caustics.uSweep.value = spin * 0.5 + g.root.position.x * 0.7;
    ws.caustics.bench.position.x = damp(ws.caustics.bench.position.x, g.root.position.x, 5, dt);
    ws.caustics.wall.position.x = damp(ws.caustics.wall.position.x, g.root.position.x * 0.7 + 0.1, 4, dt);
    ws.mood = 1 - inBeam * 0.42;

    g.uCrystalGlow.value = damp(g.uCrystalGlow.value, 1.1 + inBeam * 0.9, 3, dt);
    g.uSparkle.value = damp(g.uSparkle.value, 0.9 + inBeam * 1.1, 3, dt);
    g.uSeamGlow.value = damp(g.uSeamGlow.value, 0.15, 3, dt);

    // Keep the stone in frame while it is being carried around.
    _follow.copy(g.root.position).setY(g.root.position.y - 0.05);
    ctx.rig.follow(held || lifted > 0.05 ? _follow : null);

    // The velvet starts asking for it once the player has had their look.
    const invite = smoothstep((ctx.stepTime - 7) / 6);
    ws.pedestal.scale.setScalar(1 + invite * (0.5 + 0.5 * Math.sin(ctx.time * 2.4)) * 0.02);
    ws.spot.intensity = damp(ws.spot.intensity, invite * 1.4, 2, dt);

    if (!nudged && ctx.stepTime > 9) {
      nudged = true;
      ctx.audio.chime(8, 0.06);
    }

    if (ctx.input.idleFor > 1.8 && !f.active) {
      const s = ctx.toScreen(g.root.position);
      if (ctx.stepTime < 9) {
        ctx.hint.show({ kind: 'lift', x: s.x, y: s.y + 10, x2: s.x, y2: s.y - 96 });
      } else {
        const p = ctx.toScreen(STATION.pedestal);
        ctx.hint.show({ kind: 'drag', x: s.x, y: s.y, x2: p.x, y2: p.y - 16 });
      }
    } else {
      ctx.hint.hide();
    }
  },

  exit(ctx) {
    ctx.hint.hide();
    ctx.rig.follow(null);
    ctx.workshop.pedestal.scale.setScalar(1);
  },
};
