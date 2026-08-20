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
    origin: new THREE.Vector3(0.4, 0, -0.6),
    size: 2.6,
    soil: 'sandy',
    pipes: [
      {
        kind: 'pe',
        a: new THREE.Vector3(-0.72, -0.42, -1.03),
        b: new THREE.Vector3(0.62, -0.42, 1.01),
        radius: 0.135,
        couplings: [0.66],
      },
    ],
    scanHalf: new THREE.Vector2(0.82, 0.6),
    scanStart: new THREE.Vector2(-0.7, 0.08),
    markings: [
      { x: -0.55, z: 0.5, rot: -0.6, length: 1.25, color: '#3f6f9c', dashed: false },
      { x: 0.78, z: -0.62, rot: -0.52, length: 0.8, color: '#3f6f9c', dashed: true },
    ],
    requiredExposure: 0.5,
    workerOffset: new THREE.Vector2(0.6, 0.52),
  },
  {
    origin: new THREE.Vector3(-2.9, 0, -1.3),
    size: 2.6,
    soil: 'clay',
    pipes: [
      {
        kind: 'castiron',
        a: new THREE.Vector3(-1.06, -0.4, 0.76),
        b: new THREE.Vector3(1.02, -0.4, -0.62),
        radius: 0.105,
        couplings: [0.28, 0.78],
      },
      {
        kind: 'castiron',
        a: new THREE.Vector3(0.02, -0.4, 0.05),
        b: new THREE.Vector3(0.36, -0.4, -1.04),
        radius: 0.07,
        couplings: [0.55],
      },
    ],
    scanHalf: new THREE.Vector2(0.84, 0.66),
    scanStart: new THREE.Vector2(0.74, 0.46),
    markings: [{ x: 0.18, z: 0.78, rot: 0.6, length: 1.0, color: '#8f8a3f', dashed: true }],
    requiredExposure: 0.38,
    workerOffset: new THREE.Vector2(0.56, 0.54),
  },
  {
    origin: new THREE.Vector3(3.6, 0, -1.4),
    size: 2.6,
    soil: 'gravel',
    pipes: [
      {
        kind: 'steel',
        a: new THREE.Vector3(-1.04, -0.36, -0.72),
        b: new THREE.Vector3(1.04, -0.36, 0.66),
        radius: 0.09,
        couplings: [0.5],
      },
      {
        kind: 'cableduct',
        a: new THREE.Vector3(0.76, -0.6, -1.04),
        b: new THREE.Vector3(-0.5, -0.6, 1.04),
        radius: 0.062,
      },
    ],
    scanHalf: new THREE.Vector2(0.84, 0.66),
    scanStart: new THREE.Vector2(-0.74, -0.4),
    markings: [
      { x: -0.78, z: 0.26, rot: 0.58, length: 0.9, color: '#9c5f3f', dashed: true },
      { x: 0.6, z: 0.78, rot: -0.6, length: 0.7, color: '#4a4a4a', dashed: false },
    ],
    requiredExposure: 0.36,
    workerOffset: new THREE.Vector2(0.6, 0.5),
  },
];
