import { Engine } from './core/engine';
import { Audio } from './core/audio';
import { Input } from './core/input';
import { Observation } from './core/debug';
import { UI } from './ui/ui';
import { Game } from './game/game';

const canvas = document.getElementById('gl') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const engine = new Engine(canvas);
const ui = new UI(uiRoot);
const audio = new Audio();
const obs = new Observation();
const game = new Game(engine, ui, audio, obs);
const input = new Input(canvas);

engine.resize();
game.onResize(engine.portrait);

let ready = false;
let started = false;

game
  .init((p) => ui.setProgress(p))
  .then(() => {
    ready = true;
    ui.setProgress(1);
    game.onResize(engine.portrait);
    // Warm the pipeline before the first frame the child sees.
    engine.renderer.compile(engine.scene, engine.camera);
    engine.renderer.render(engine.scene, engine.camera);
  })
  .catch((err) => {
    console.error(err);
    ui.setProgress(1);
  });

game.bindInput(input);

if (obs.enabled) {
  // Local-only developer probe. Present only with ?debug=1.
  (window as unknown as { __probe: unknown }).__probe = {
    state: () => ({ ...game.probe(), ...game.layoutInfo }),
    handleScreen: () => game.handleScreen(),
    project: (u: number, v: number) => game.project(u, v),
  };
}

audio.setMuted(!ui.soundOn);
game.setHaptics(ui.hapticsOn);

ui.onStart = () => {
  if (!ready || started) return;
  started = true;
  void audio.unlock();
  ui.hideStart();
  game.begin();
  engine.start();
};

ui.onTool = (t) => game.setTool(t);
ui.onChoice = (c) => game.choose(c);
ui.onSound = (on) => audio.setMuted(!on);
ui.onHaptics = (on) => game.setHaptics(on);

engine.onFixed = (dt) => game.fixed(dt);
engine.onFrame = (dt, elapsed) => {
  input.tick();
  game.heldMs = input.heldMs;
  game.frame(dt, elapsed);
};
engine.onResize = (_w, _h, portrait) => game.onResize(portrait);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.suspend();
  else if (started) audio.resume();
});
