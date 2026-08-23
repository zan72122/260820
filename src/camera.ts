import * as THREE from 'three';

// One continuous camera. No cuts during operation: the rig blends between
// authored poses (per orientation) and plays authored moves for the solve
// sequence and the dolly ride to the next machine.

export interface Pose {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

interface SeqKey extends Pose {
  dur: number; // seconds from previous key
  hold?: number;
}

function pose(px: number, py: number, pz: number, lx: number, ly: number, lz: number, fov: number): Pose {
  return { pos: new THREE.Vector3(px, py, pz), look: new THREE.Vector3(lx, ly, lz), fov };
}

function smoother(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  mode: 'intro' | 'operate' | 'sequence' | 'transit' | 'hold' = 'intro';
  private curPos = new THREE.Vector3();
  private curLook = new THREE.Vector3();
  private curFov = 58;
  private seq: SeqKey[] = [];
  private seqT = 0;
  private seqIdx = 0;
  private onSeqDone: (() => void) | null = null;
  private introT = 0;
  private introDone: (() => void) | null = null;
  private portrait = true;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.05, 60);
    this.portrait = aspect < 1;
    const o = this.overviewPose(0);
    this.curPos.copy(o.pos);
    this.curLook.copy(o.look);
    this.curFov = o.fov;
    this.apply();
  }

  setAspect(aspect: number): void {
    this.portrait = aspect < 1;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  overviewPose(sx: number): Pose {
    return this.portrait
      ? pose(sx + 2.7, 2.2, 6.6, sx + 0.1, 1.15, 1.3, 60)
      : pose(sx + 3.4, 2.0, 6.1, sx + 0.3, 1.2, 1.1, 52);
  }

  operatePose(sx: number): Pose {
    return this.portrait
      // high over the machine: parts low in frame, screen above them —
      // the line of sight to the screen clears the parts, and the handwheel
      // sits clearly in the bottom third
      ? pose(sx + 0.5, 2.72, 5.75, sx + 0.0, 1.26, 1.1, 64)
      // machine left, screen right; the handwheel rides the lower left corner
      : pose(sx + 2.35, 2.05, 5.15, sx - 0.78, 1.28, 0.9, 55);
  }

  nearPose(sx: number): Pose {
    return this.portrait
      ? pose(sx + 0.35, 2.56, 4.9, sx + 0.0, 1.32, 0.8, 58)
      : pose(sx + 1.72, 1.95, 4.5, sx - 0.6, 1.34, 0.7, 50);
  }

  frontPose(sx: number): Pose {
    // between the parts and the screen (every part sits at z >= 2.06),
    // dead-on at letter height: nothing blocks the finished letter
    return this.portrait
      ? pose(sx + 0.05, 1.42, 1.95, sx + 0.05, 1.46, 0, 58)
      : pose(sx + 0.0, 1.42, 1.95, sx + 0.0, 1.46, 0, 44);
  }

  revealPose(sx: number): Pose {
    // from beside the screen looking back down the optical axis: the matte
    // parts (clearly NOT letter-shaped from here), the lamp head, its rail
    // cart and the turntable all share the frame — the whole causal chain
    return this.portrait
      ? pose(sx + 3.6, 1.75, 0.4, sx - 0.2, 1.32, 3.5, 62)
      : pose(sx + 3.7, 1.75, 0.6, sx + 0.0, 1.28, 3.3, 50);
  }

  playIntro(sx: number, onDone: () => void): void {
    this.mode = 'intro';
    this.introT = 0;
    this.introDone = onDone;
    const o = this.overviewPose(sx);
    this.curPos.copy(o.pos);
    this.curLook.copy(o.look);
    this.curFov = o.fov;
  }

  skipIntro(): void {
    if (this.mode === 'intro') this.introT = Math.max(this.introT, 1.6);
  }

  /** slow dolly from overview into the operating position */
  private updateIntro(dt: number, sx: number): void {
    this.introT += dt;
    const t0 = 1.6, t1 = 4.6;
    const o = this.overviewPose(sx);
    const op = this.operatePose(sx);
    const t = this.introT < t0 ? 0 : Math.min(1, (this.introT - t0) / (t1 - t0));
    const e = smoother(t);
    this.curPos.lerpVectors(o.pos, op.pos, e);
    this.curLook.lerpVectors(o.look, op.look, e);
    this.curFov = o.fov + (op.fov - o.fov) * e;
    if (t >= 1) {
      this.mode = 'operate';
      this.introDone?.();
      this.introDone = null;
    }
  }

  /** operating view; drifts closer to the screen as the shadow converges */
  private updateOperate(dt: number, sx: number, closeness: number): void {
    const op = this.operatePose(sx);
    const np = this.nearPose(sx);
    const c = Math.max(0, (closeness - 0.68) / 0.32);
    const e = smoother(Math.min(1, c));
    const tp = new THREE.Vector3().lerpVectors(op.pos, np.pos, e);
    const tl = new THREE.Vector3().lerpVectors(op.look, np.look, e);
    const tf = op.fov + (np.fov - op.fov) * e;
    const k = Math.min(1, dt * 2.2);
    this.curPos.lerp(tp, k);
    this.curLook.lerp(tl, k);
    this.curFov += (tf - this.curFov) * k;
  }

  playSolveSequence(sx: number, onDone: () => void): void {
    // continuous: front -> hold -> oblique reveal of the parts -> back to front
    const fp = this.frontPose(sx);
    const rp = this.revealPose(sx);
    this.seq = [
      { ...fp, dur: 2.6, hold: 2.2 },
      { ...rp, dur: 2.4, hold: 1.6 },
      { ...fp, dur: 2.2, hold: 0.9 },
    ];
    this.startSeq(onDone);
  }

  playTransit(fromX: number, toX: number, onDone: () => void): void {
    const mid = pose(
      (fromX + toX) / 2, this.portrait ? 1.5 : 1.6, this.portrait ? 6.6 : 6.4,
      (fromX + toX) / 2, 1.3, 1.6, this.portrait ? 62 : 54,
    );
    const op = this.operatePose(toX);
    this.seq = [
      { ...mid, dur: 1.7 },
      { pos: op.pos, look: op.look, fov: op.fov, dur: 1.9 },
    ];
    this.mode = 'transit';
    this.seqT = 0;
    this.seqIdx = 0;
    this.onSeqDone = onDone;
    this.seqFrom = { pos: this.curPos.clone(), look: this.curLook.clone(), fov: this.curFov };
  }

  private seqFrom: Pose = pose(0, 0, 0, 0, 0, 0, 58);

  private startSeq(onDone: () => void): void {
    this.mode = 'sequence';
    this.seqT = 0;
    this.seqIdx = 0;
    this.onSeqDone = onDone;
    this.seqFrom = { pos: this.curPos.clone(), look: this.curLook.clone(), fov: this.curFov };
  }

  private updateSeq(dt: number): void {
    if (this.seqIdx >= this.seq.length) return;
    const key = this.seq[this.seqIdx];
    this.seqT += dt;
    const t = Math.min(1, this.seqT / key.dur);
    const e = smoother(t);
    this.curPos.lerpVectors(this.seqFrom.pos, key.pos, e);
    this.curLook.lerpVectors(this.seqFrom.look, key.look, e);
    this.curFov = this.seqFrom.fov + (key.fov - this.seqFrom.fov) * e;
    if (t >= 1 && this.seqT >= key.dur + (key.hold ?? 0)) {
      this.seqFrom = { pos: key.pos.clone(), look: key.look.clone(), fov: key.fov };
      this.seqIdx++;
      this.seqT = 0;
      if (this.seqIdx >= this.seq.length) {
        const cb = this.onSeqDone;
        this.onSeqDone = null;
        // sequences park where they end; transit hands control back to operate
        this.mode = this.mode === 'transit' ? 'operate' : 'hold';
        cb?.();
      }
    }
  }

  update(dt: number, sx: number, closeness: number): void {
    switch (this.mode) {
      case 'intro': this.updateIntro(dt, sx); break;
      case 'operate': this.updateOperate(dt, sx, closeness); break;
      case 'sequence':
      case 'transit': this.updateSeq(dt); break;
      case 'hold': break;
    }
    this.apply();
  }

  /** jump instantly to the screen-front pose (E2E verification) */
  snapToFront(sx: number): void {
    const fp = this.frontPose(sx);
    this.curPos.copy(fp.pos);
    this.curLook.copy(fp.look);
    this.curFov = fp.fov;
    this.mode = 'hold';
    this.apply();
  }

  /** jump instantly to the oblique parts-reveal pose (E2E verification) */
  snapToReveal(sx: number): void {
    const rp = this.revealPose(sx);
    this.curPos.copy(rp.pos);
    this.curLook.copy(rp.look);
    this.curFov = rp.fov;
    this.mode = 'hold';
    this.apply();
  }

  private apply(): void {
    this.camera.position.copy(this.curPos);
    this.camera.lookAt(this.curLook);
    if (Math.abs(this.camera.fov - this.curFov) > 0.01) {
      this.camera.fov = this.curFov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** jump instantly to the operate pose (used on replay reset and E2E) */
  snapToOperate(sx: number): void {
    const op = this.operatePose(sx);
    this.curPos.copy(op.pos);
    this.curLook.copy(op.look);
    this.curFov = op.fov;
    this.mode = 'operate';
    this.apply();
  }
}
