import * as THREE from 'three';
import type { Pose, ShotFn } from '../core/camera';
import type { Viewport } from '../core/renderer';
import { clamp, lerp } from '../core/util';
import type { World } from './world';

const A = new THREE.Vector3();
const B = new THREE.Vector3();

const rad = THREE.MathUtils.degToRad;

/** Camera distance that makes `width` metres fill `frac` of the screen width. */
function fit(width: number, frac: number, fov: number, aspect: number): number {
  return width / (2 * Math.tan(rad(fov) / 2) * Math.max(0.3, aspect) * frac);
}

/**
 * The shot chain.
 *
 * Wide park, then the mouth with the machine, then floor level travel, then a
 * raking macro of the joint, then the water, then all the way out again. Portrait
 * uses the depth of the pipe vertically; landscape opens out the seam and the
 * tool path.
 */
export function makeShots(world: World): Record<string, ShotFn> {
  const slide = world.slide;

  const establish: ShotFn = (t, vp, out) => {
    // Portrait looks down the length of the flume so its run reads vertically;
    // landscape swings out to the side where the whole structure fits across.
    const drift = Math.sin(t * 0.16) * 2.4;
    if (vp.portrait) {
      out.pos.set(-15 - drift * 0.4, 20.5, -20 + drift);
      slide.curve.getPointAt(0.38, out.look);
      out.look.y += 1.0;
      out.fov = 54;
    } else {
      out.pos.set(-31 - drift, 16, -2 + drift * 1.6);
      slide.curve.getPointAt(0.34, out.look);
      out.look.y -= 1.2;
      out.fov = 46;
    }
    out.roll = 0;
    out.pitch = 0;
  };

  const deck: ShotFn = (t, vp, out) => {
    const f = slide.frame(0);
    out.pos
      .copy(f.p)
      .addScaledVector(f.r, -4.4)
      .addScaledVector(f.t, -2.7 - Math.sin(t * 0.3) * 0.3);
    out.pos.y = f.p.y + 1.55;
    out.look.copy(f.p).addScaledVector(f.t, 1.1);
    out.look.y -= 0.75;
    out.fov = vp.portrait ? 56 : 44;
    out.roll = 0;
    out.pitch = vp.portrait ? -0.04 : 0;
  };

  /** Rides just behind the inspection droplet as it runs into the pipe. */
  const dropChase: ShotFn = (_t, vp, out) => {
    const u = world.droplet.u;
    slide.floorAt(clamp(u - slide.metersToU(1.15), 0, 1), 0.44, out.pos);
    slide.floorAt(clamp(u + slide.metersToU(3.2), 0, 1), 0.3, out.look);
    out.fov = vp.portrait ? 66 : 54;
    out.roll = 0;
    out.pitch = vp.portrait ? -0.06 : 0;
  };

  /** Holds on the stopped droplet with the exit light still visible beyond. */
  const snagWatch: ShotFn = (t, vp, out) => {
    const uS = slide.seams[world.activeIndex];
    slide.floorAt(clamp(uS - slide.metersToU(1.15), 0, 1), 0.3 + Math.sin(t * 0.5) * 0.02, out.pos);
    slide.floorAt(clamp(uS + slide.metersToU(0.55), 0, 1), 0.04, out.look);
    out.fov = vp.portrait ? 62 : 50;
    out.roll = 0;
    out.pitch = vp.portrait ? -0.08 : -0.02;
  };

  const driveFollow: ShotFn = (_t, vp, out) => {
    const u = world.crawler.u;
    slide.floorAt(clamp(u - slide.metersToU(1.9), 0, 1), 0.6, out.pos);
    slide.floorAt(clamp(u + slide.metersToU(3.4), 0, 1), 0.38, out.look);
    out.fov = vp.portrait ? 64 : 52;
    out.roll = 0;
    out.pitch = vp.portrait ? -0.05 : 0;
  };

  /**
   * Ahead of the machine, low and slightly off the centre line, while the lamp
   * is swept across the joint. Close enough to read the seam, wide enough to see
   * the beam arrive on it.
   */
  const inspect: ShotFn = (_t, vp, out) => {
    const uS = slide.seams[world.activeIndex];
    const f = slide.frame(uS);
    slide.floorAt(clamp(uS - slide.metersToU(2.2), 0, 1), 0.92, out.pos);
    out.pos.addScaledVector(f.r, vp.portrait ? 0.3 : 0.6);
    slide.floorAt(clamp(uS + slide.metersToU(3.2), 0, 1), 0.36, out.look);
    out.fov = vp.portrait ? 60 : 48;
    out.roll = 0;
    out.pitch = vp.portrait ? -0.12 : -0.03;
  };

  /** Raking macro used for every treatment step. */
  const rake: ShotFn = (_t, vp, out) => {
    const uS = slide.seams[world.activeIndex];
    const f = slide.frame(uS);
    slide.pointAt(uS, 0, 0, A);
    slide.normalAt(uS, 0, B);
    const fov = vp.portrait ? 62 : 46;
    const frac = vp.portrait ? 0.86 : 0.56;
    const d = clamp(fit(0.74, frac, fov, vp.aspect), 0.6, 2.9);
    const elev = rad(36);
    out.pos
      .copy(A)
      .addScaledVector(B, d * Math.sin(elev))
      .addScaledVector(f.t, -d * Math.cos(elev));
    out.look.copy(A).addScaledVector(B, 0.02);
    out.fov = fov;
    out.roll = 0;
    out.pitch = vp.portrait ? -0.15 : -0.11;
  };

  /** Low chase used for the proving droplet after the repair. */
  const waterTest: ShotFn = (_t, vp, out) => {
    const u = world.droplet.u;
    slide.floorAt(clamp(u - slide.metersToU(1.0), 0, 1), 0.32, out.pos);
    slide.floorAt(clamp(u + slide.metersToU(2.4), 0, 1), 0.12, out.look);
    out.fov = vp.portrait ? 64 : 52;
    out.roll = 0;
    out.pitch = vp.portrait ? -0.07 : -0.01;
  };

  /** Outside for the raft run: the whole flume, with the machine's work inside. */
  const raftOutside: ShotFn = (_t, vp, out) => {
    const u = world.raft?.running ? world.raft.u : slide.seams[world.activeIndex];
    const f = slide.frame(clamp(u, 0.05, 0.95));
    const side = f.r.clone().setY(0).normalize();
    const dist = vp.portrait ? 19 : 15;
    out.pos.copy(f.p).addScaledVector(side, -dist).addScaledVector(f.t, -3.5);
    out.pos.y = f.p.y + 5.6;
    out.look.copy(f.p).addScaledVector(f.t, 2.5);
    out.fov = vp.portrait ? 50 : 40;
    out.roll = 0;
    out.pitch = 0;
  };

  const finish: ShotFn = (t, vp, out) => {
    const a = 0.35 + t * 0.03;
    const R = lerp(20, vp.portrait ? 40 : 32, clamp(t / 4.5, 0, 1));
    out.pos.set(0.6 + Math.cos(a) * R, 9 + R * 0.28, 21 + Math.sin(a) * R * 0.6);
    slide.curve.getPointAt(0.5, out.look);
    out.look.y += 1.2;
    out.fov = vp.portrait ? 56 : 45;
    out.roll = 0;
    out.pitch = 0;
  };

  return {
    establish,
    deck,
    dropChase,
    snagWatch,
    driveFollow,
    inspect,
    rake,
    waterTest,
    raftOutside,
    finish,
  };
}

export type Shots = ReturnType<typeof makeShots>;
export type { Pose, Viewport };
