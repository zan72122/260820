// ---------------------------------------------------------------------------
// Boot: renderer, quality tier, input plumbing and the frame loop.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Game } from './game.js';
import { clamp } from './util.js';

const QUALITY = {
  low:  { texBig: 256, shadowMap: 512,  groundSeg: 86,  snowflakes: 220, maxDpr: 1.5, shadows: true },
  mid:  { texBig: 512, shadowMap: 1024, groundSeg: 130, snowflakes: 380, maxDpr: 2.0, shadows: true },
  high: { texBig: 512, shadowMap: 2048, groundSeg: 172, snowflakes: 560, maxDpr: 2.0, shadows: true },
};

function pickQuality() {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const mobile = iOS || android;
  const mem = navigator.deviceMemory || (mobile ? 4 : 8);
  const cores = navigator.hardwareConcurrency || 4;
  let tier = 'high';
  if (mobile) tier = (mem >= 4 && cores >= 6) ? 'mid' : 'low';
  if (!mobile && (cores <= 4 || mem <= 4)) tier = 'mid';
  return { tier, ...QUALITY[tier], mobile, iOS };
}

function main() {
  const app = document.getElementById('app');
  const loader = document.getElementById('loader');

  const params = new URLSearchParams(location.search);
  const quality = pickQuality();
  const qOverride = params.get('q');
  if (qOverride && QUALITY[qOverride]) Object.assign(quality, QUALITY[qOverride], { tier: qOverride });

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: quality.tier !== 'low',
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    });
  } catch (e) {
    document.getElementById('fallback').style.display = 'flex';
    loader.style.display = 'none';
    return;
  }
  if (!renderer.getContext()) {
    document.getElementById('fallback').style.display = 'flex';
    loader.style.display = 'none';
    return;
  }

  const dprOverride = parseFloat(params.get('dpr'));
  let dpr = dprOverride > 0
    ? dprOverride
    : Math.min(window.devicePixelRatio || 1, quality.maxDpr);
  const lockDpr = dprOverride > 0;
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.90;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.id = 'view';
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.04, 620);

  // --- sizing -------------------------------------------------------------
  let game = null;
  let lastAspect = 0;
  function resize() {
    const w = app.clientWidth || window.innerWidth;
    const h = app.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    const a = w / h;
    camera.aspect = a;
    // portrait phones need a wider lens or the working shot feels claustrophobic
    camera.fov = a < 1 ? clamp(46 + (1 - a) * 20, 46, 62) : 46;
    camera.updateProjectionMatrix();
    if (game) {
      game.rig.fov = camera.fov;
      // shots are framed from the field of view, so re-derive them on rotation
      if (Math.abs(a - lastAspect) > 0.01) game.refreshPose();
    }
    lastAspect = a;
  }
  resize();

  game = new Game({ renderer, scene, camera, container: app, quality });
  game.rig.fov = camera.fov;

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  // --- input --------------------------------------------------------------
  const el = renderer.domElement;
  let activeId = null;
  const rel = (e) => {
    const r = el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  el.addEventListener('pointerdown', (e) => {
    // A new touch always takes over: if a pointerup was ever missed we must
    // not end up permanently deaf to input.
    if (activeId !== null && activeId !== e.pointerId) {
      try { el.releasePointerCapture(activeId); } catch (err) { /* already gone */ }
      game.onUp();
    }
    activeId = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
    const [x, y] = rel(e);
    game.onDown(x, y);
    e.preventDefault();
  }, { passive: false });
  el.addEventListener('pointermove', (e) => {
    if (activeId !== e.pointerId) return;
    const [x, y] = rel(e);
    game.onMove(x, y);
    e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    if (activeId !== e.pointerId) return;
    activeId = null;
    game.onUp();
    e.preventDefault();
  };
  el.addEventListener('pointerup', end, { passive: false });
  el.addEventListener('pointercancel', end, { passive: false });
  // belt and braces on iOS: stop rubber-band scrolling behind the canvas
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  // --- loop ---------------------------------------------------------------
  let last = performance.now();
  let acc = 0, frames = 0, slowRuns = 0;
  let running = true;

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    last = performance.now();
  });

  function frame() {
    requestAnimationFrame(frame);
    if (!running) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    game.update(dt);
    renderer.render(scene, camera);

    // adaptive resolution: keep the frame rate up on modest phones
    if (lockDpr) return;
    acc += dt; frames++;
    if (frames >= 45) {
      const avg = acc / frames;
      const ceiling = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
      if (avg > 0.0235 && dpr > 1.0) {
        slowRuns++;
        if (slowRuns >= 2) {
          dpr = Math.max(1.0, dpr - 0.25);
          renderer.setPixelRatio(dpr);
          resize();
          slowRuns = 0;
        }
      } else if (avg < 0.0142 && dpr < ceiling) {
        dpr = Math.min(ceiling, dpr + 0.25);
        renderer.setPixelRatio(dpr);
        resize();
        slowRuns = 0;
      } else {
        slowRuns = 0;
      }
      acc = 0; frames = 0;
    }
  }

  // one warm-up render so shaders compile before we reveal the scene
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  frame();

  loader.classList.add('gone');
  setTimeout(() => { loader.style.display = 'none'; }, 700);

  // Deterministic time stepping for automated tests: the software rasteriser
  // used in CI renders far slower than real time, so tests advance the
  // simulation directly instead of waiting on animation frames.
  window.__step = (dt = 1 / 60, n = 1) => {
    for (let i = 0; i < n; i++) game.update(dt);
    last = performance.now();
  };
  window.__render = () => renderer.render(scene, camera);

  window.__game = game;   // handy for automated smoke tests
  window.__renderer = renderer;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
