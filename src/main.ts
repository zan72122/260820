import * as THREE from 'three';
import './ui/style.css';
import { Game } from './game/Game';
import { Hud } from './ui/Hud';
import { Audio } from './core/Audio';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const hud = new Hud(uiRoot);
const audio = new Audio();
const game = new Game(canvas, hud, audio);

// The finger marker follows the touch wherever it is on screen.
window.addEventListener('pointerdown', (e) => hud.touch(true, e.clientX, e.clientY), { passive: true });
window.addEventListener('pointermove', (e) => {
  if (e.buttons || e.pointerType === 'touch') hud.touch(true, e.clientX, e.clientY);
}, { passive: true });
window.addEventListener('pointerup', () => hud.touch(false), { passive: true });
window.addEventListener('pointercancel', () => hud.touch(false), { passive: true });

hud.onStart = () => {
  audio.unlock();
  game.begin();
};
hud.onSoundToggle = (muted) => audio.setMuted(muted);

hud.setFill(0);
hud.setCount(0);
game.blockInput(true);
game.start();

// iOS Safari sometimes suspends the context when returning from the background.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) audio.unlock();
});

// Test / debug surface used by the Playwright smoke run.
(window as unknown as { __game: Game }).__game = game;

// Debug hook for the automated visual checks.
(window as unknown as { __THREE: typeof THREE }).__THREE = THREE;
