import type { Intersection, Mesh, Object3D, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { CameraRig } from '../core/CameraRig';
import type { Input } from '../core/Input';
import type { GameAudio } from '../audio/Audio';
import type { Hint } from '../ui/Hint';
import type { Overlay } from '../ui/Overlay';
import type { Workshop } from '../world/Workshop';
import type { Geode } from '../world/Geode';
import type { ParticleSystem } from '../gfx/Particles';
import type { QualitySettings } from '../core/Quality';

export type StepName =
  | 'intro' | 'wash' | 'place' | 'crack' | 'open' | 'dust' | 'hold' | 'display';

export interface Session {
  seed: number;
  /** How thoroughly the player washed, 0..1. Feeds crystal clarity + gallery. */
  washQuality: number;
  /** How thoroughly the player dusted, 0..1. */
  dustQuality: number;
  /** Presses used to crack. Fewer, better-placed presses = a cleaner break. */
  presses: number;
  recorded: boolean;
}

export interface GameCtx {
  scene: Scene;
  camera: PerspectiveCamera;
  rig: CameraRig;
  input: Input;
  audio: GameAudio;
  hint: Hint;
  overlay: Overlay;
  workshop: Workshop;
  geode: Geode;
  quality: QualitySettings;
  session: Session;

  droplets: ParticleSystem;
  mudflecks: ParticleSystem;
  powder: ParticleSystem;
  chips: ParticleSystem;

  /** Seconds spent in the current step. */
  stepTime: number;
  /** Global clock, also fed to every shader. */
  time: number;
  /** 1 = normal, <1 = slow motion for the crack beat. */
  timeScale: number;

  go(step: StepName): void;
  /** Ray-cast the current pointer against `objects`. */
  pick(objects: Object3D[]): Intersection | null;
  /** Every hit along the pointer ray, nearest first. */
  pickAll(objects: Object3D[]): Intersection[];
  /** Where the pointer ray crosses a horizontal plane at `y`. */
  pickPlane(y: number, out: Vector3): Vector3 | null;
  /** World point -> CSS pixels inside the canvas, for placing the hint. */
  toScreen(world: Vector3): { x: number; y: number };
  /** Canvas size in CSS pixels. */
  viewport: { w: number; h: number };
  /**
   * True if the finger is on the stone, or near enough that it clearly meant
   * to be. Four-year-olds do not aim.
   */
  grabbedStone(): boolean;
  shellMeshes(): Mesh[];
  /** Ask the renderer for a brief exposure bump (the crack flash). */
  flash(amount: number): void;
}

export interface Step {
  name: StepName;
  enter(ctx: GameCtx): void;
  update(ctx: GameCtx, dt: number): void;
  exit?(ctx: GameCtx): void;
}
