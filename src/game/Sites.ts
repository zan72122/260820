import * as THREE from 'three';
import { PipeSpec } from '../dig/Pipes';
import { SoilType } from '../dig/DigSite';

export interface MarkSpec {
  x: number;
  z: number;
  rot: number;
  length: number;
  color: string;
  dashed: boolean;
}

export interface SiteConfig {
  origin: THREE.Vector3;
  size: number;
  soil: SoilType;
  pipes: PipeSpec[];
  /** Half extents of the strip the locator can be swept over (site local). */
  scanHalf: THREE.Vector2;
  /** Where the locator starts, site local. */
  scanStart: THREE.Vector2;
  /** Faded existing marks left by an earlier survey — a hint, not the answer. */
  markings: MarkSpec[];
  /** Fraction of the run that must be bared before the job counts as done. */
  requiredExposure: number;
  /** Which side the operator works from, site local. */
  workerOffset: THREE.Vector2;
}

/**
 * Same rule every time, new wrinkle every time: a straight plastic main, then
 * a cast-iron tee, then two services crossing at different depths in gravel.
 */
export const SITES: SiteConfig[] = [
  {
    origin: new THREE.Vector3(0.2, 0, -0.5),
    size: 3.0,
    soil: 'sandy',
    pipes: [
      {
        kind: 'pe',
        a: new THREE.Vector3(-0.86, -0.5, -1.26),
        b: new THREE.Vector3(0.74, -0.5, 1.24),
        radius: 0.105,
        couplings: [0.66],
      },
    ],
    scanHalf: new THREE.Vector2(0.95, 0.72),
    scanStart: new THREE.Vector2(-0.78, 0.1),
    markings: [
      { x: -0.62, z: 0.55, rot: -0.55, length: 1.5, color: '#3f6f9c', dashed: false },
      { x: 0.85, z: -0.72, rot: -0.5, length: 0.9, color: '#3f6f9c', dashed: true },
    ],
    requiredExposure: 0.55,
    workerOffset: new THREE.Vector2(0.62, -0.46),
  },
  {
    origin: new THREE.Vector3(-3.6, 0, -1.15),
    size: 3.0,
    soil: 'clay',
    pipes: [
      {
        kind: 'castiron',
        a: new THREE.Vector3(-1.28, -0.45, 0.92),
        b: new THREE.Vector3(1.22, -0.45, -0.74),
        radius: 0.092,
        couplings: [0.28, 0.78],
      },
      {
        kind: 'castiron',
        a: new THREE.Vector3(0.03, -0.45, 0.06),
        b: new THREE.Vector3(0.42, -0.45, -1.24),
        radius: 0.062,
        couplings: [0.55],
      },
    ],
    scanHalf: new THREE.Vector2(0.98, 0.82),
    scanStart: new THREE.Vector2(0.82, 0.55),
    markings: [{ x: 0.2, z: 0.9, rot: 0.6, length: 1.2, color: '#8f8a3f', dashed: true }],
    requiredExposure: 0.5,
    workerOffset: new THREE.Vector2(0.58, -0.5),
  },
  {
    origin: new THREE.Vector3(3.7, 0, -1.7),
    size: 3.0,
    soil: 'gravel',
    pipes: [
      {
        kind: 'steel',
        a: new THREE.Vector3(-1.26, -0.4, -0.86),
        b: new THREE.Vector3(1.26, -0.4, 0.78),
        radius: 0.075,
        couplings: [0.5],
      },
      {
        kind: 'cableduct',
        a: new THREE.Vector3(0.92, -0.68, -1.24),
        b: new THREE.Vector3(-0.62, -0.68, 1.26),
        radius: 0.062,
      },
    ],
    scanHalf: new THREE.Vector2(0.98, 0.82),
    scanStart: new THREE.Vector2(-0.85, -0.5),
    markings: [
      { x: -0.9, z: 0.3, rot: 0.58, length: 1.0, color: '#9c5f3f', dashed: true },
      { x: 0.7, z: 0.9, rot: -0.6, length: 0.8, color: '#4a4a4a', dashed: false },
    ],
    requiredExposure: 0.42,
    workerOffset: new THREE.Vector2(0.64, -0.44),
  },
];
