import './style.css';
import * as THREE from 'three';
import { Materials } from './gfx/materials';
import { Game } from './game/Game';

declare global {
  interface Window {
    __GAME__?: {
      ready: boolean;
      error?: string;
      debug: () => unknown;
      tap: () => void;
      steer: (m: number) => void;
      simulate: (seconds: number) => void;
    };
  }
}

const boot = document.getElementById('boot')!;
const fill = document.getElementById('boot-fill') as HTMLElement;
const note = document.getElementById('boot-note') as HTMLElement;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

function fatal(message: string) {
  note.textContent = message;
  fill.style.background = '#d86a4a';
  window.__GAME__ = {
    ready: false,
    error: message,
    debug: () => ({ error: message }),
    tap: () => undefined,
    steer: () => undefined,
    simulate: () => undefined,
  };
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function main() {
  // A throwaway context tells us the real anisotropy budget before we bake anything.
  let aniso = 4;
  try {
    const probe = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
    aniso = Math.min(8, probe.capabilities.getMaxAnisotropy());
    probe.dispose();
  } catch {
    fatal('この端末では WebGL を利用できません');
    return;
  }

  const mats = new Materials();
  const steps = mats.bakeSteps(aniso);
  for (let i = 0; i < steps.length; i++) {
    note.textContent = steps[i].label;
    fill.style.width = `${Math.round(((i + 0.15) / (steps.length + 1)) * 100)}%`;
    await nextFrame();
    steps[i].run();
    fill.style.width = `${Math.round(((i + 1) / (steps.length + 1)) * 100)}%`;
  }

  note.textContent = '収穫機を組み立てています';
  await nextFrame();

  let game: Game;
  try {
    game = new Game(canvas, mats, uiRoot);
  } catch (err) {
    console.error(err);
    fatal('3D の初期化に失敗しました');
    return;
  }

  fill.style.width = '100%';
  await nextFrame();
  game.start();
  await nextFrame();
  await nextFrame();

  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 700);

  window.__GAME__ = {
    ready: true,
    debug: () => game.debug(),
    tap: () => game.testTap(),
    steer: (m: number) => game.testSteer(m),
    simulate: (seconds: number) => game.simulate(seconds),
  };

  // iOS only unlocks audio inside a gesture; the first touch anywhere does it.
  const unlock = () => {
    game.audio.start();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
}

main().catch((err) => {
  console.error(err);
  fatal(String(err && (err as Error).message ? (err as Error).message : err));
});
