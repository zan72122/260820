import * as THREE from 'three';

export interface InputHandlers {
  /** A firm push forward on the raft: send it down the ramp. */
  onSwipeForward: () => void;
  /** Anything at all, used to unlock audio. */
  onFirstGesture: () => void;
  onDragStart: (ndc: THREE.Vector2) => boolean;
  onDragMove: (ndc: THREE.Vector2) => void;
  onDragEnd: () => void;
  onLeverChange: (pressed: boolean) => void;
  onReplay: () => void;
}

/**
 * Three gestures, and nothing else: swipe the raft away, hold the blast lever,
 * drag a ballast bag. The lever has its own generous DOM footprint so it can be
 * held with one thumb while the other hand does anything it likes.
 */
export class InputController {
  private readonly ndc = new THREE.Vector2();
  private readonly startPoint = new THREE.Vector2();
  private dragPointer = -1;
  private swipePointer = -1;
  private swiping = false;
  private leverPointers = new Set<number>();
  private leverSwiping = false;
  private gestureSeen = false;
  readonly leverZone: HTMLDivElement;
  readonly replayButton: HTMLButtonElement;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    ui: HTMLElement,
    private readonly handlers: InputHandlers,
  ) {
    this.leverZone = document.createElement('div');
    this.leverZone.className = 'lever-zone';
    ui.appendChild(this.leverZone);

    this.replayButton = document.createElement('button');
    this.replayButton.className = 'again';
    this.replayButton.setAttribute('aria-label', 'もう一度');
    this.replayButton.innerHTML =
      '<svg viewBox="0 0 48 48"><path d="M38 24a14 14 0 1 1-4.1-9.9"/><path d="M38 8v8h-8"/></svg>';
    ui.appendChild(this.replayButton);

    this.replayButton.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.firstGesture();
      this.handlers.onReplay();
    });

    const press = (e: PointerEvent) => {
      e.preventDefault();
      this.firstGesture();
      this.leverPointers.add(e.pointerId);
      this.leverZone.setPointerCapture(e.pointerId);
      // A finger that lands on the lever can still push the raft away: the
      // same gesture is watched here so the control never eats a swipe.
      this.startPoint.set(e.clientX, e.clientY);
      this.leverSwiping = false;
      if (this.leverPointers.size === 1) this.handlers.onLeverChange(true);
    };
    const release = (e: PointerEvent) => {
      if (!this.leverPointers.delete(e.pointerId)) return;
      if (this.leverPointers.size === 0) this.handlers.onLeverChange(false);
    };
    const leverMove = (e: PointerEvent) => {
      if (!this.leverPointers.has(e.pointerId) || this.leverSwiping) return;
      const dx = e.clientX - this.startPoint.x;
      const dy = e.clientY - this.startPoint.y;
      if (dx > 34 && Math.abs(dx) > Math.abs(dy) * 0.85) {
        this.leverSwiping = true;
        this.handlers.onSwipeForward();
      }
    };
    this.leverZone.addEventListener('pointerdown', press);
    this.leverZone.addEventListener('pointermove', leverMove);
    this.leverZone.addEventListener('pointerup', release);
    this.leverZone.addEventListener('pointercancel', release);
    this.leverZone.addEventListener('pointerleave', release);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private firstGesture(): void {
    if (this.gestureSeen) return;
    this.gestureSeen = true;
    this.handlers.onFirstGesture();
  }

  private toNdc(e: PointerEvent): THREE.Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    return this.ndc;
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.firstGesture();
    const ndc = this.toNdc(e);
    if (this.dragPointer < 0 && this.handlers.onDragStart(ndc)) {
      this.dragPointer = e.pointerId;
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (this.swipePointer < 0) {
      this.swipePointer = e.pointerId;
      this.startPoint.set(e.clientX, e.clientY);
      this.swiping = false;
      this.canvas.setPointerCapture(e.pointerId);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId === this.dragPointer) {
      this.handlers.onDragMove(this.toNdc(e));
      return;
    }
    if (e.pointerId !== this.swipePointer || this.swiping) return;
    const dx = e.clientX - this.startPoint.x;
    const dy = e.clientY - this.startPoint.y;
    // Forward means "along the slide": to the right of the screen, and more
    // sideways than up. Anything vaguely like a push counts.
    if (dx > 34 && Math.abs(dx) > Math.abs(dy) * 0.85) {
      this.swiping = true;
      this.handlers.onSwipeForward();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId === this.dragPointer) {
      this.dragPointer = -1;
      this.handlers.onDragEnd();
    }
    if (e.pointerId === this.swipePointer) {
      this.swipePointer = -1;
      this.swiping = false;
    }
  };

  showReplay(show: boolean): void {
    this.replayButton.classList.toggle('show', show);
  }
}
