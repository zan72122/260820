/**
 * Shared station plumbing: bench, feeder lever, axis handle wiring,
 * attention cues, ball lifecycle, result reporting.
 */
import * as THREE from 'three';
import type { LabMaterials } from '../core/materials';
import type { LabAudio } from '../core/audio';
import type { InputManager } from '../core/input';
import type { StationViews } from '../core/cameraRig';
import { Ball } from '../physics/ball';
import type { BallKind } from '../glyph/spec';
import { makeBench, makeFence } from '../lab/parts';
import { clamp, damp } from '../core/math';

export type StationId = 'O' | 'C' | 'I';
export type BallStatus =
  | 'none'
  | 'inFeeder'
  | 'moving'
  | 'passed'
  | 'blocked'
  | 'restLeft'
  | 'restRight'
  | 'restCenter';

export type AttentionSpot = 'none' | 'handle' | 'lever';

export interface StationEvents {
  onResult(station: StationId, outcome: 'pass' | 'blocked' | 'left' | 'right' | 'center'): void;
  onBallSettled(station: StationId): void;
  onAxisInput(station: StationId): void;
  onLeverPulled(station: StationId): void;
}

export abstract class StationBase {
  readonly group = new THREE.Group();
  abstract readonly id: StationId;
  abstract readonly views: StationViews;
  ball: Ball | null = null;
  ballStatus: BallStatus = 'none';
  completed = false;
  attention: AttentionSpot = 'none';
  protected attentionPhase = 0;
  protected attentionLights: Partial<Record<Exclude<AttentionSpot, 'none'>, THREE.PointLight>> = {};
  /** kind currently in / destined for the feeder */
  protected loadedKind: BallKind = 'rubber';
  protected settleTimer = 0;

  constructor(
    public worldX: number,
    protected mats: LabMaterials,
    protected audio: LabAudio,
    protected input: InputManager,
    protected events: StationEvents,
  ) {
    this.group.position.x = worldX;
    this.group.add(makeBench(mats));
    this.group.add(makeFence(mats));
  }

  /** normalized axis: O,C in [0,1]; I in [-1,1] */
  abstract getAxis(): number;
  abstract setAxis(v: number): void;
  abstract loadBall(kind: BallKind): void;
  abstract pullLever(): boolean;
  abstract update(dt: number): void;
  abstract measure(): Record<string, number>;
  /** world position of the feeder mouth (for drag-to-load) */
  abstract feederWorldPos(): THREE.Vector3;
  /** world position of a physical control (for driving real input in tests) */
  abstract controlWorldPos(kind: 'handle' | 'lever'): THREE.Vector3;

  setAttention(spot: AttentionSpot) {
    this.attention = spot;
  }

  protected updateAttention(dt: number) {
    this.attentionPhase += dt * 3.4;
    for (const key of ['handle', 'lever'] as const) {
      const light = this.attentionLights[key];
      if (!light) continue;
      const want = this.attention === key ? 0.22 + Math.sin(this.attentionPhase) * 0.12 : 0;
      light.intensity = damp(light.intensity, want, 8, dt);
    }
  }

  protected newBall(kind: BallKind): Ball {
    if (this.ball) this.group.remove(this.ball.mesh);
    const b = new Ball(kind, this.mats, this.audio);
    this.group.add(b.mesh);
    this.ball = b;
    return b;
  }

  protected clampAxis01(v: number) {
    return clamp(v, 0, 1);
  }
}
