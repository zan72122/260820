import { App } from './core/app';

/**
 * はねかえり素材研究所 — bootstrap.
 *
 * Nothing here talks to a network. There is no login, no analytics, no ads and
 * no leaderboard; the only persistence is a session-scoped record of where the
 * child had got to, so a reload does not throw their work away.
 */

const canvas = document.getElementById('stage') as HTMLCanvasElement;

async function boot() {
  if (!canvas) return;
  const app = new App(canvas);
  try {
    await app.init();
  } catch (err) {
    console.error('[hanekaeri] failed to start', err);
    showFallback();
  }
}

function showFallback() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.remove('gone');
  boot.innerHTML =
    '<div style="width:120px;height:120px;border-radius:26px;background:' +
    'radial-gradient(circle at 34% 28%,#e9e4d8,#a8a094 60%,#6c6558);' +
    'box-shadow:0 18px 30px rgba(40,34,26,.3)"></div>';
}

// A WebGL2 context is the baseline. Everything the pavilion needs — the PBR
// surfaces, the ripple shader, the pooled particles — is WebGL2-level work.
const probe = document.createElement('canvas');
if (!probe.getContext('webgl2')) {
  showFallback();
} else {
  void boot();
}
