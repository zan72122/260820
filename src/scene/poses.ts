import type { PoseSet } from '../core/camera'

/**
 * Every shot is authored twice. Portrait is not a crop of landscape — the
 * camera actually stands somewhere else and the lens changes.
 */
export const POSES: Record<string, PoseSet> = {
  intro: {
    portrait: { pos: [0.3, 0.46, 0.78], target: [-0.05, 0.06, 0.0], fov: 46 },
    landscape: { pos: [0.34, 0.38, 0.6], target: [-0.06, 0.05, -0.02], fov: 46 },
  },
  mix: {
    portrait: { pos: [-0.13, 0.42, 0.5], target: [-0.16, 0.05, 0.1], fov: 43 },
    landscape: { pos: [-0.1, 0.3, 0.34], target: [-0.16, 0.045, 0.09], fov: 45 },
  },
  mixClose: {
    portrait: { pos: [-0.15, 0.19, 0.26], target: [-0.16, 0.055, 0.1], fov: 40 },
    landscape: { pos: [-0.14, 0.16, 0.21], target: [-0.16, 0.05, 0.1], fov: 42 },
  },
  pour: {
    portrait: { pos: [0.13, 0.38, 0.5], target: [0.0, 0.085, 0.06], fov: 45 },
    landscape: { pos: [0.12, 0.28, 0.36], target: [0.0, 0.075, 0.06], fov: 46 },
  },
  toOven: {
    portrait: { pos: [-0.1, 0.36, 0.56], target: [-0.2, 0.1, -0.1], fov: 50 },
    landscape: { pos: [-0.05, 0.3, 0.42], target: [-0.22, 0.1, -0.12], fov: 48 },
  },
  bake: {
    portrait: { pos: [-0.34, 0.2, 0.26], target: [-0.34, 0.155, -0.3], fov: 50 },
    landscape: { pos: [-0.34, 0.19, 0.06], target: [-0.34, 0.15, -0.3], fov: 43 },
  },
  bakeSection: {
    portrait: { pos: [-0.12, 0.19, 0.02], target: [-0.34, 0.15, -0.3], fov: 44 },
    landscape: { pos: [-0.14, 0.18, -0.05], target: [-0.34, 0.15, -0.3], fov: 40 },
  },
  takeout: {
    portrait: { pos: [-0.08, 0.34, 0.54], target: [-0.26, 0.17, -0.1], fov: 50 },
    landscape: { pos: [-0.04, 0.28, 0.38], target: [-0.26, 0.16, -0.1], fov: 47 },
  },
  flip: {
    portrait: { pos: [0.06, 0.31, 0.88], target: [0.0, 0.28, 0.14], fov: 52 },
    landscape: { pos: [0.03, 0.3, 0.48], target: [0.0, 0.28, 0.14], fov: 46 },
  },
  mount: {
    portrait: { pos: [0.14, 0.18, 0.5], target: [0.0, 0.16, 0.02], fov: 46 },
    landscape: { pos: [0.16, 0.19, 0.4], target: [0.0, 0.15, 0.02], fov: 44 },
  },
  cool: {
    portrait: { pos: [0.11, 0.13, 0.48], target: [0.0, 0.15, 0.02], fov: 47 },
    landscape: { pos: [0.14, 0.14, 0.38], target: [0.0, 0.145, 0.02], fov: 45 },
  },
  release: {
    portrait: { pos: [0.1, 0.23, 0.5], target: [0.0, 0.06, 0.06], fov: 51 },
    landscape: { pos: [0.06, 0.2, 0.38], target: [0.0, 0.055, 0.06], fov: 43 },
  },
  releaseTube: {
    portrait: { pos: [0.05, 0.29, 0.4], target: [0.0, 0.075, 0.06], fov: 48 },
    landscape: { pos: [0.04, 0.26, 0.32], target: [0.0, 0.07, 0.06], fov: 44 },
  },
  reveal: {
    portrait: { pos: [0.16, 0.17, 0.52], target: [0.0, 0.08, 0.06], fov: 48 },
    landscape: { pos: [0.2, 0.16, 0.4], target: [0.0, 0.075, 0.06], fov: 44 },
  },
  press: {
    portrait: { pos: [0.13, 0.22, 0.44], target: [0.0, 0.085, 0.06], fov: 46 },
    landscape: { pos: [0.16, 0.2, 0.36], target: [0.0, 0.08, 0.06], fov: 44 },
  },
  final: {
    portrait: { pos: [0.24, 0.3, 0.7], target: [0.0, 0.07, 0.04], fov: 46 },
    landscape: { pos: [0.28, 0.26, 0.56], target: [0.0, 0.065, 0.04], fov: 46 },
  },
}
