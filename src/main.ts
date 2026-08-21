import { App } from './core/App';

const container = document.getElementById('app');
if (!container) throw new Error('#app missing');

const app = new App(container);
void app.init().then(() => {
  app.frame();
});

// keep the audio context alive across iOS backgrounding
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) app.audio.resume();
});

declare global {
  interface Window {
    __lightTunnel?: App;
  }
}
window.__lightTunnel = app;
