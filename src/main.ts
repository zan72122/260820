import { Engine } from './core/engine';
import { readFlags } from './util/flags';

const container = document.getElementById('app');
if (!container) throw new Error('#app not found');

const flags = readFlags();
const engine = new Engine(container, flags);
engine.camera.position.set(0, 1.6, -2.5);
engine.camera.lookAt(0, 0.3, 10);
engine.start();

declare global {
  interface Window {
    __game?: unknown;
  }
}
window.__game = { ready: true, flags };
