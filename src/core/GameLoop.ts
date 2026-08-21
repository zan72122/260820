/**
 * Fixed-timestep loop: logic always advances in whole 60 Hz ticks, rendering
 * happens per animation frame. Under E2E_FAST real time never advances the
 * simulation — tests drive it synchronously through step() instead, which is
 * what makes headless runs deterministic.
 */
export class GameLoop {
  private accumulator = 0
  private lastTime: number | null = null
  private rafId = 0
  private running = false

  constructor(
    private readonly opts: {
      /** Advance the simulation by exactly one tick. */
      update: () => void
      render: () => void
      /** False under E2E_FAST: ticks only happen via step(). */
      autoTick: boolean
      tickSeconds: number
    },
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    const frame = (timeMs: number) => {
      if (!this.running) return
      if (this.opts.autoTick) {
        if (this.lastTime !== null) {
          // Cap catch-up work so a background tab doesn't fire a tick burst.
          this.accumulator = Math.min(
            this.accumulator + (timeMs - this.lastTime) / 1000,
            this.opts.tickSeconds * 5,
          )
          while (this.accumulator >= this.opts.tickSeconds) {
            this.accumulator -= this.opts.tickSeconds
            this.opts.update()
          }
        }
        this.lastTime = timeMs
      }
      this.opts.render()
      this.rafId = requestAnimationFrame(frame)
    }
    this.rafId = requestAnimationFrame(frame)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
    this.lastTime = null
    this.accumulator = 0
  }

  /** Advance n logical ticks synchronously (test seam), then render once. */
  step(n: number): void {
    for (let i = 0; i < n; i++) this.opts.update()
    this.opts.render()
  }
}
