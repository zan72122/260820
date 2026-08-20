/* main.js - 進行、カメラ割り、操作 */
(function (g) {
  'use strict';
  var NB = g.NB, U = NB.U, W = NB.W, FX = NB.FX, R = NB.R, AU = NB.Audio;

  var cvs = document.getElementById('stage');
  var btn = document.getElementById('bigbtn');
  var titleEl = document.getElementById('titlecard');
  var rotEl = document.getElementById('rotate');
  var cueEl = document.getElementById('dragcue');
  var sndEl = document.getElementById('soundbtn');
  var flashEl = document.getElementById('flash');

  var cam = new NB.Camera();

  var S = {
    time: 0, dusk: 1, fire: 0, ign: new Float32Array(W.SEG),
    fuseX: W.X0, fuseV: 0, fuseOn: false,
    barrier: 0, cars: [], smokeA: 0, wind: 1.4, crowd: 0, bulb: 0,
    quality: 1, ignTotal: 0
  };

  var st = 'evening', stT = 0, waiting = true;
  var portrait = false;
  var carTimer = 0;

  /* ---------- カメラ割り ---------- */
  function shotEvening() {
    return {
      pos: [186, 4.4, 74], tgt: [560, 11, -14],
      pts: [[W.X0 + 150, 0.2, 0],
      [W.X0 + 660, W.DECK_Y + W.ARCH_H + 2, 0],
      [W.X0 + 660, 0.2, 0],
      [W.X0 + 150, W.DECK_Y + W.ARCH_H + 2, 0]],
      mx: 0.95, my: 0.86
    };
  }
  function shotClosing() {
    return {
      pos: [W.BAR_X - 88, 4.6, 30], tgt: [W.BAR_X + 70, 8.0, -1],
      pts: [[W.BAR_X - 14, W.roadY(W.BAR_X) - 2.2, 5],
      [W.X0 + 130, W.DECK_Y + W.ARCH_H + 2, 0],
      [W.X0 + 130, 0.5, 0],
      [W.BAR_X - 14, W.roadY(W.BAR_X) + 5.5, 5]],
      mx: 0.93, my: 0.84
    };
  }
  function shotReady() {
    return {
      pos: [-118, 8.5, 44], tgt: [330, 13.5, 0],
      pts: [[W.X0 - 60, W.GROUND, 3],
      [W.X0 + 420, W.DECK_Y + W.ARCH_H + 2, 0],
      [W.X0 + 420, 0.5, 0],
      [W.X0 - 60, W.DECK_Y + W.ARCH_H + 2, 3]],
      mx: 0.94, my: 0.88
    };
  }
  function shotFuse() {
    var f = S.fuseX;
    var z = portrait ? 96 : 122;
    return {
      pos: [f - 205, 18.5, z], tgt: [f + 130, 13, 0],
      pts: [[f - 130, 0.5, 0],
      [f + 190, W.DECK_Y + W.ARCH_H + 2, 0],
      [f + 190, 0.5, 0],
      [f - 130, W.DECK_Y + W.ARCH_H + 2, 0]],
      mx: 0.93, my: 0.86
    };
  }
  function shotWide() {
    if (portrait) {
      return {
        pos: [18, 21, 292], tgt: [W.MID, 5.5, 0],
        pts: [[W.X0 - 30, 0, 0], [W.X1 + 30, W.DECK_Y + W.ARCH_H + 4, 0],
        [W.X1 + 30, 0, 0], [W.X0 - 30, W.DECK_Y + W.ARCH_H + 4, 0]],
        mx: 0.93, my: 0.80
      };
    }
    return {
      pos: [168, 27, 552], tgt: [W.MID, 5.0, 0],
      pts: [[W.X0 - 40, 0, 0], [W.X1 + 40, W.DECK_Y + W.ARCH_H + 4, 0],
      [W.X1 + 40, 0, 0], [W.X0 - 40, W.DECK_Y + W.ARCH_H + 4, 0]],
      mx: 0.92, my: 0.74
    };
  }

  var shotA = shotEvening, shotB = shotEvening, bl = 1, blDur = 1;
  function goShot(fn, dur) {
    shotA = shotB; shotB = fn; bl = 0; blDur = dur;
    /* 切替時の起点を固定する */
    var s = shotA();
    frozen = s;
  }
  var frozen = null;

  function applyCamera(dt) {
    bl = Math.min(1, bl + dt / blDur);
    var t = U.smoother(bl);
    var A = (frozen && bl < 1) ? frozen : shotA();
    var B = shotB();
    var pos = [U.lerp(A.pos[0], B.pos[0], t), U.lerp(A.pos[1], B.pos[1], t), U.lerp(A.pos[2], B.pos[2], t)];
    var tgt = [U.lerp(A.tgt[0], B.tgt[0], t), U.lerp(A.tgt[1], B.tgt[1], t), U.lerp(A.tgt[2], B.tgt[2], t)];
    var pts = [];
    for (var i = 0; i < 4; i++) {
      pts.push([U.lerp(A.pts[i][0], B.pts[i][0], t),
      U.lerp(A.pts[i][1], B.pts[i][1], t),
      U.lerp(A.pts[i][2], B.pts[i][2], t)]);
    }
    /* 手持ちの微振動 */
    var sh = 0.55;
    tgt[0] += Math.sin(S.time * 0.53) * sh + Math.sin(S.time * 1.31) * sh * 0.4;
    tgt[1] += Math.sin(S.time * 0.41 + 2) * sh * 0.35;
    cam.pos = pos; cam.target = tgt;
    cam.fov = 44 * Math.PI / 180;
    cam.viewport(vw, vh);
    cam.autoFit(pts, U.lerp(A.mx, B.mx, t), U.lerp(A.my, B.my, t));
  }

  /* ---------- 表示サイズ ---------- */
  var vw = 1, vh = 1, scale = 1, rscale = 1;
  function resize() {
    var cw = cvs.clientWidth || window.innerWidth;
    var ch = cvs.clientHeight || window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = cw * dpr * rscale, py = ch * dpr * rscale;
    var maxPix = 2300000;
    var k = Math.sqrt(maxPix / Math.max(1, px * py));
    if (k < 1) { px *= k; py *= k; }
    vw = Math.max(2, Math.round(px)); vh = Math.max(2, Math.round(py));
    scale = vh / (ch || 1);
    R.resize(vw, vh, Math.max(0.75, scale));
    portrait = ch > cw * 1.04;
    updateRotate();
  }

  function updateRotate() {
    var show = portrait && (st === 'evening' || st === 'closing') && S.time < 9;
    rotEl.hidden = !show;
  }

  /* ---------- UI ---------- */
  function setBtn(ico, lab, cls) {
    btn.hidden = false;
    btn.querySelector('.ico').textContent = ico;
    btn.querySelector('.lab').textContent = lab;
    btn.className = cls || '';
  }
  function hideBtn() { btn.hidden = true; }

  function flash(a) {
    flashEl.style.opacity = a;
    flashEl.classList.add('on');
    setTimeout(function () { flashEl.classList.remove('on'); flashEl.style.opacity = 0; }, 60);
  }

  /* ---------- 進行 ---------- */
  function setState(s) {
    st = s; stT = 0;
    if (s === 'evening') {
      waiting = true;
      setBtn('🚧', 'はしを しめる', '');
      goShot(shotEvening, 0.01);
    } else if (s === 'closing') {
      waiting = false; hideBtn();
      goShot(shotClosing, 2.6);
      AU.clunk();
    } else if (s === 'ready') {
      waiting = true;
      goShot(shotReady, 2.2);
      setTimeout(function () { if (st === 'ready') setBtn('🔥', 'ひを はしらせる', 'fire'); }, 700);
    } else if (s === 'fuse') {
      waiting = false; hideBtn();
      S.fuseOn = true; S.fuseX = W.X0; S.fuseV = 118;
      goShot(shotFuse, 1.5);
      cueEl.hidden = false;
      AU.whoosh();
    } else if (s === 'niagara') {
      cueEl.hidden = true;
      goShot(shotWide, 3.4);
      flash(0.32);
    } else if (s === 'end') {
      setBtn('🔁', 'もういちど', 'again');
      waiting = true;
      AU.done();
    }
  }

  function advance() {
    AU.unlock();
    if (!waiting) {
      if (st === 'fuse') S.fuseV += 42;
      return;
    }
    if (st === 'evening') setState('closing');
    else if (st === 'ready') setState('fuse');
    else if (st === 'end') restart();
  }

  function restart() {
    FX.reset();
    for (var i = 0; i < W.SEG; i++) S.ign[i] = 0;
    S.dusk = 1; S.fire = 0; S.barrier = 0; S.fuseOn = false; S.fuseX = W.X0;
    S.smokeA = 0; S.crowd = 0; S.cars.length = 0; S.time = 0; carTimer = 0;
    AU.niagara(0); AU.fuse(0);
    titleEl.classList.add('on');
    setState('evening');
  }

  /* ---------- 車 ---------- */
  function updateCars(dt) {
    if (st === 'evening') {
      carTimer -= dt;
      if (carTimer <= 0 && S.cars.length < 7) {
        carTimer = 1.6 + Math.random() * 2.4;
        var dir = Math.random() < 0.5 ? 1 : -1;
        S.cars.push({ x: dir > 0 ? W.RX0 - 20 : W.RX1 + 20, dir: dir, v: 13 + Math.random() * 5 });
      }
    }
    for (var i = S.cars.length - 1; i >= 0; i--) {
      var c = S.cars[i];
      c.x += c.dir * c.v * dt;
      if (st !== 'evening') c.v = Math.min(26, c.v + 5 * dt);
      if (c.x < W.RX0 - 40 || c.x > W.RX1 + 40) S.cars.splice(i, 1);
    }
  }

  /* ---------- 状態更新 ---------- */
  function update(dt) {
    S.time += dt;
    stT += dt;
    S.bulb = Math.sin(S.time * 3.1) * 0.5 + 0.5;
    S.wind = 1.2 + Math.sin(S.time * 0.23) * 0.9;

    updateCars(dt);
    updateRotate();

    if (st === 'closing') {
      S.barrier = Math.min(1, S.barrier + dt / 0.85);
      S.dusk = Math.max(0, S.dusk - dt / 5.0);
      if (stT > 5.4) setState('ready');
    } else if (st === 'ready') {
      S.dusk = Math.max(0, S.dusk - dt / 5.0);
    } else if (st === 'fuse') {
      S.dusk = Math.max(0, S.dusk - dt / 3.0);
      S.fire = Math.min(1, S.fire + dt / 0.7);
      S.fuseV = U.lerp(S.fuseV, 118, 1 - Math.pow(0.2, dt));
      S.fuseX += S.fuseV * dt;
      FX.emitFuse(dt, S);
      AU.fuse(1);
      if (S.fuseX >= W.X1) { S.fuseX = W.X1; if (stT > 1.0) setState('niagara'); }
    } else if (st === 'niagara') {
      S.fuseOn = stT < 0.35;
      AU.fuse(0);
      S.crowd = Math.min(1, S.crowd + dt / 2.5);
      S.smokeA = Math.min(1, S.smokeA + dt / 3.0);
      if (stT > 15.5) S.fire = Math.max(0.16, S.fire - dt / 7.0);
      if (stT > 22.0) setState('end');
    } else if (st === 'end') {
      S.fire = Math.max(0, S.fire - dt / 3.2);
      S.smokeA = Math.max(0.35, S.smokeA - dt / 8.0);
    }

    /* 点火の伝わり */
    if (st === 'fuse' || st === 'niagara' || st === 'end') {
      for (var i = 0; i < W.SEG; i++) {
        var target = U.clamp((S.fuseX - W.segX(i)) / 58, 0, 1);
        if (target > S.ign[i]) S.ign[i] = target;
      }
      FX.emitNiagara(dt, S);
      AU.niagara(U.clamp(S.ignTotal * S.fire, 0, 1));
    }
    FX.update(dt, S);
    applyCamera(dt);
  }

  /* ---------- ループ ---------- */
  var last = 0, running = true, acc = 0, frames = 0, msSum = 0;
  function loop(t) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (!last) last = t;
    var dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    var t0 = U.now();
    update(dt);
    R.draw(cam, S);
    msSum += U.now() - t0; frames++;
    if (frames >= 45) {
      var avg = msSum / frames; frames = 0; msSum = 0;
      if (avg > 23 && FX.cap > 900) { FX.cap = Math.round(FX.cap * 0.78); S.quality = 0; }
      else if (avg > 30 && rscale > 0.62) { rscale = Math.max(0.62, rscale - 0.12); resize(); }
      else if (avg < 12 && FX.cap < 2800) FX.cap = Math.min(2800, Math.round(FX.cap * 1.12));
    }
  }

  /* ---------- 入力 ---------- */
  btn.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); advance(); });
  cvs.addEventListener('pointerdown', function (ev) { ev.preventDefault(); advance(); dragX = ev.clientX; });
  var dragX = null;
  cvs.addEventListener('pointermove', function (ev) {
    if (dragX === null) return;
    var d = ev.clientX - dragX;
    dragX = ev.clientX;
    if (st === 'fuse' && d > 0) S.fuseV = Math.min(360, S.fuseV + d * 1.5);
  });
  window.addEventListener('pointerup', function () { dragX = null; });
  window.addEventListener('pointercancel', function () { dragX = null; });
  cvs.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  sndEl.addEventListener('click', function (ev) {
    ev.preventDefault(); ev.stopPropagation();
    AU.unlock();
    AU.setMuted(!AU.muted);
    sndEl.textContent = AU.muted ? '🔇' : '🔊';
  });

  window.addEventListener('resize', function () { resize(); });
  window.addEventListener('orientationchange', function () { setTimeout(resize, 220); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { running = false; AU.suspend(); }
    else if (!running) { running = true; last = 0; AU.resume(); requestAnimationFrame(loop); }
  });

  /* ---------- 起動 ---------- */
  R.init(cvs);
  resize();
  restart();
  setTimeout(function () { titleEl.classList.add('on'); }, 260);
  requestAnimationFrame(loop);

  /* 検証用 */
  g.NBDEBUG = {
    S: S, cam: cam, state: function () { return st; },
    jump: function (name) {
      if (name === 'closing') { setState('closing'); }
      else if (name === 'ready') { S.dusk = 0; S.barrier = 1; setState('ready'); bl = 1; }
      else if (name === 'fuse') { S.dusk = 0; S.barrier = 1; setState('fuse'); bl = 1; }
      else if (name === 'niagara') {
        S.dusk = 0; S.barrier = 1; S.fire = 1; S.fuseX = W.X1;
        for (var i = 0; i < W.SEG; i++) S.ign[i] = 1;
        setState('niagara'); bl = 1; S.crowd = 1; S.smokeA = 1;
      }
    },
    step: function (n, dt) { for (var i = 0; i < n; i++) { update(dt); } R.draw(cam, S); }
  };
})(window);
