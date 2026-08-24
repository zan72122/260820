/**
 * 一指だけの入力。
 * ・短い上下スワイプ（誘い）…軌跡が多少曲がっても上下運動として認識する
 * ・指を離す（静止させる）
 * ・短い上スワイプ（合わせ）
 * ・長押し（電動リール）
 * ピンチ、二指回転、細い糸の直接ドラッグは要求しない。
 */
export interface InputCallbacks {
  onFirstTouch(): void;
  onTap(): void;
  /** 誘い操作の開始 */
  onJigStart(): void;
  /** 進行中の指の縦オフセット（-1..1、上が正） */
  onJigDrive(offset: number): void;
  /** 一回の「トン」（方向反転で1ストローク） */
  onJigStroke(): void;
  /** 指が離れた（strokes: その間のストローク数） */
  onRelease(strokes: number): void;
  /** 短い上向きスワイプ（合わせ） */
  onSwipeUp(): void;
  /** 長押し状態の変化 */
  onHold(down: boolean): void;
}

export class InputSystem {
  private el: HTMLElement;
  private cb: InputCallbacks;
  private activeId: number | null = null;
  private startY = 0;
  private startX = 0;
  private startT = 0;
  private lastY = 0;
  private lastExtremeY = 0;
  private dir = 0;
  private strokes = 0;
  private touchedOnce = false;
  private moved = false;
  /** 直近の急な上方向移動検出用 */
  private recent: { y: number; t: number }[] = [];
  holding = false;

  constructor(el: HTMLElement, cb: InputCallbacks) {
    this.el = el;
    this.cb = cb;
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('pointercancel', this.onUp, { passive: false });
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  }

  private strokeThreshold() {
    return Math.min(this.el.clientHeight, this.el.clientWidth) * 0.035 + 10;
  }

  private onDown = (e: PointerEvent) => {
    if (this.activeId !== null) return; // 二本目以降の指は無視
    this.activeId = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
    this.startY = this.lastY = this.lastExtremeY = e.clientY;
    this.startX = e.clientX;
    this.startT = performance.now();
    this.dir = 0;
    this.strokes = 0;
    this.moved = false;
    this.recent = [{ y: e.clientY, t: performance.now() }];
    if (!this.touchedOnce) {
      this.touchedOnce = true;
      this.cb.onFirstTouch();
    }
    this.holding = true;
    this.cb.onHold(true);
    this.cb.onJigStart();
    e.preventDefault();
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.activeId) return;
    const now = performance.now();
    const dy = e.clientY - this.lastY;
    this.lastY = e.clientY;
    this.recent.push({ y: e.clientY, t: now });
    while (this.recent.length > 2 && now - this.recent[0].t > 260) this.recent.shift();

    if (Math.abs(e.clientY - this.startY) > 8 || Math.abs(e.clientX - this.startX) > 8) this.moved = true;

    // 縦オフセット（上が正）
    const h = this.el.clientHeight;
    const offset = Math.max(-1, Math.min(1, (this.startY - e.clientY) / (h * 0.09)));
    this.cb.onJigDrive(offset);

    // ストローク検出：進行方向が反転し、反転幅がしきい値を超えたら1ストローク
    const th = this.strokeThreshold();
    if (this.dir === 0) {
      if (Math.abs(e.clientY - this.startY) > th) {
        this.dir = Math.sign(e.clientY - this.startY);
        this.lastExtremeY = e.clientY;
        this.strokes++;
        this.cb.onJigStroke();
      }
    } else {
      if (this.dir > 0) {
        if (e.clientY > this.lastExtremeY) this.lastExtremeY = e.clientY;
        else if (this.lastExtremeY - e.clientY > th) {
          this.dir = -1;
          this.lastExtremeY = e.clientY;
          this.strokes++;
          this.cb.onJigStroke();
        }
      } else {
        if (e.clientY < this.lastExtremeY) this.lastExtremeY = e.clientY;
        else if (e.clientY - this.lastExtremeY > th) {
          this.dir = 1;
          this.lastExtremeY = e.clientY;
          this.strokes++;
          this.cb.onJigStroke();
        }
      }
    }

    // 素早い上方向移動（合わせ）：直近260ms内で上へ大きく動いた
    const oldest = this.recent[0];
    if (oldest.y - e.clientY > Math.min(h * 0.05, 55) && now - oldest.t < 260) {
      this.cb.onSwipeUp();
      this.recent = [{ y: e.clientY, t: now }];
    }
    e.preventDefault();
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.activeId) return;
    this.activeId = null;
    this.holding = false;
    this.cb.onHold(false);
    const dt = performance.now() - this.startT;
    const dyTotal = this.startY - this.lastY;
    if (!this.moved && dt < 350) {
      this.cb.onTap();
    }
    // 離す瞬間までの素早い上スワイプも合わせとして扱う
    if (dyTotal > 40 && dt < 320) {
      this.cb.onSwipeUp();
    }
    this.cb.onRelease(this.strokes);
    e.preventDefault();
  };
}
