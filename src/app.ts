import { AudioEngine } from './core/audio';
import { CameraDirector } from './core/camera';
import { InputRouter } from './core/input';
import { Stage } from './core/renderer';
import { settings } from './core/settings';
import { Game } from './game/game';
import { World } from './game/world';
import { Hud } from './ui/hud';

/**
 * Wires the stage, the world, the controls and the run of play together and owns
 * the frame loop.
 */
export class App {
  private stage: Stage;
  private hud: Hud;
  private input: InputRouter;
  private audio = new AudioEngine();
  private director: CameraDirector;
  private world: World;
  private game: Game | null = null;
  private ready = false;
  private startRequested = false;
  private started = false;
  private last = 0;
  private wasPortrait = true;
  private veilTimer = 0;

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.stage = new Stage(canvas);
    this.hud = new Hud(hudRoot);
    this.input = new InputRouter(canvas);
    this.director = new CameraDirector(this.stage.camera);
    this.world = new World(this.stage);

    this.input.setLiftForViewport(this.stage.viewport.minEdge);
    this.hud.setLandscape(!this.stage.viewport.portrait);
    this.wasPortrait = this.stage.viewport.portrait;

    this.stage.onResize = (vp) => {
      this.input.setLiftForViewport(vp.minEdge);
      if (vp.portrait !== this.wasPortrait) {
        this.wasPortrait = vp.portrait;
        this.hud.setLandscape(!vp.portrait);
        // repair state is untouched; only the framing is re-derived
        this.hud.setVeil(true);
        this.veilTimer = 0.28;
      }
    };
    this.stage.onTierChange = (tier) => this.world.applyTier(tier);

    this.hud.onStart = () => {
      this.startRequested = true;
      void this.audio.unlock();
      if (this.ready) this.launch();
    };
  }

  async boot(): Promise<void> {
    this.hud.setLoading(0.05);
    await this.world.buildExterior((p) => this.hud.setLoading(p));
    await this.world.buildInterior((p) => this.hud.setLoading(p));
    this.world.applyTier(this.stage.tier);

    this.game = new Game(
      this.world,
      this.stage,
      this.director,
      this.hud,
      this.audio,
      this.input,
    );
    this.ready = true;
    this.hud.setLoading(1);

    if (settings.e2e) {
      (window as unknown as Record<string, unknown>).__sd = {
        state: () => this.game?.snapshot() ?? null,
        ready: () => this.ready,
        started: () => this.started,
        tier: () => this.stage.tier,
        viewport: () => this.stage.viewport,
        liftPx: () => this.input.liftPx,
      };
    }

    this.last = performance.now();
    requestAnimationFrame(this.frame);
    if (this.startRequested) this.launch();
  }

  private launch(): void {
    if (this.started || !this.game) return;
    this.started = true;
    this.hud.hideBoot();
    this.game.begin();
  }

  private frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    // An automated pass runs on a software rasteriser; letting the clock take
    // bigger steps there keeps game time roughly wall-clock instead of crawling.
    const dtMs = Math.min(settings.e2e ? 250 : 64, now - this.last);
    this.last = now;
    const dt = dtMs / 1000;

    if (this.veilTimer > 0) {
      this.veilTimer -= dt;
      if (this.veilTimer <= 0) this.hud.setVeil(false);
    }

    this.audio.update(dt);
    this.hud.update(dt);
    if (this.started) {
      this.game?.update(dt);
      this.world.update(dt);
    }
    this.director.update(dt, this.stage.viewport);
    this.stage.render();
    this.stage.sample(dtMs, now);
  };
}
