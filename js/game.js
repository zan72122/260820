/* 長岡花火 正三尺玉 : 進行・カメラ・入力
   ながれ: 導入(河川敷) → サイレン → 点火 → 上昇 → 間 → 大開花 → 余韻(川面) → もういちど */
(function () {
  'use strict';

  var canvas = document.getElementById('view');
  var g = canvas.getContext('2d', { alpha: false });
  var elCap = document.getElementById('caption');
  var elFire = document.getElementById('fire');
  var elOpen = document.getElementById('open');
  var elReplay = document.getElementById('replay');
  var elSound = document.getElementById('sound');
  var elBoot = document.getElementById('boot');
  var elRotate = document.getElementById('rotate');

  var W = 0, H = 0, dpr = 1, quality = 1;

  /* ---------------- 玉の諸元 ---------------- */
  var APEX = 1750, RISE_T = 2.6, BURST_R = 640;
  var V0 = 2 * (APEX - NFScene.LAUNCH.y) / RISE_T, GRAV = V0 / RISE_T;
  /* 開花のときに河川敷が画面の下端に残るよう、到達高度を画面比に合わせる */
  function setApex(h) {
    APEX = Math.max(900, Math.min(1750, h));
    V0 = 2 * (APEX - NFScene.LAUNCH.y) / RISE_T;
    GRAV = V0 / RISE_T;
  }

  /* ---------------- カメラ ----------------
     縦の気持ちよさが主役。上昇中は「玉の画面上の高さ」と「引き」を同時に動かし、
     河川敷を画面下に残したまま、玉だけがぐんぐん上がって見えるようにする。 */
  var cam = {
    W: 0, H: 0, x: 500, y: 400, zoom: 1, s: 1, shake: 0, shx: 0, shy: 0,
    sx: function (wx) { return this.W * 0.5 + (wx - this.x) * this.s + this.shx; },
    sy: function (wy) { return this.H * 0.5 - (wy - this.y) * this.s + this.shy; }
  };
  var zApex = 0.7, aApex = 0.28;                     // 引きと、開花時に玉を置く画面上の高さ
  function sOf(z) { return z * (W / 1000); }
  function camYForHorizon(z, frac) { return (frac - 0.5) * H / sOf(z); }
  function camYForShell(z, wy, frac) { return wy + (frac - 0.5) * H / sOf(z); }

  var camTarget = { y: 400, zoom: 1 }, camEase = 2.0;

  /* ---------------- 状態 ---------------- */
  var S = { BOOT: 0, INTRO: 1, READY: 2, IGNITE: 3, RISE: 4, HANG: 5, BURST: 6, AFTER: 7, DONE: 8 };
  var phase = S.BOOT, pt = 0;
  var field = new NFFire.Field(1);
  var palIndex = 0, pal = NFFire.PALETTES[0];
  var shell = { x: 500, y: 18, py: 18, vy: 0, glow: 1, alive: false };
  var burstY = APEX;

  var flash = 0;
  var wash = { i: 0, x: 0, y: 0, color: [255, 200, 120] };
  var waterLight = { x: 500, i: 0, target: 0, r: 480, color: [255, 200, 120] };
  var boomAt = -1, sirenAt = 0;
  var HANG_AUTO = 1.25;

  /* ---------------- 画面サイズ ---------------- */
  var resizeTimer = null;
  function resize() {
    var cssW = window.innerWidth, cssH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = cssW * cssH * dpr * dpr;
    if (px > 3.2e6) dpr = Math.max(1, dpr * Math.sqrt(3.2e6 / px));
    W = cssW; H = cssH;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cam.W = W; cam.H = H;

    // 開花が縦にも横にも収まる引きを求めておく
    // 大輪が収まる引きと、そのときの玉の画面上の高さ（横画面でも成立させる）
    zApex = (Math.min(W * 0.47, H * 0.40) / BURST_R) / (W / 1000);
    zApex = Math.max(0.12, Math.min(0.95, zApex));
    aApex = Math.max(0.26, Math.min(0.46, (BURST_R * 0.92 * (zApex * W / 1000)) / H + 0.05));
    if (!shell.alive) setApex(H * (0.94 - aApex) / (zApex * 0.92 * (W / 1000)));

    NFScene.build(cssW, cssH, dpr, quality);
    aim(true);
    if (cssW > cssH * 1.15) {
      elRotate.classList.add('show');
      setTimeout(function () { elRotate.classList.remove('show'); }, 3400);
    }
  }
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 180); });
  window.addEventListener('orientationchange', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 280); });

  function caption(text, small) {
    if (!text) { elCap.classList.remove('show'); return; }
    if (elCap.textContent !== text) elCap.textContent = text;
    elCap.classList.toggle('small', !!small);
    elCap.classList.add('show');
  }

  /* ---------------- カメラの狙い ---------------- */
  function aim(instant) {
    var z, u, e;
    switch (phase) {
      case S.BOOT:
      case S.INTRO:                                  // 導入: 河川敷の広さと位置感
        camTarget.zoom = 1.02;
        camTarget.y = camYForHorizon(1.02, 0.745);
        camEase = 0.45;
        if (instant) { cam.zoom = 1.16; cam.s = sOf(1.16); cam.y = camYForHorizon(1.16, 0.70); return; }
        break;
      case S.READY:                                  // 中景: 中州の筒を正面に
      case S.IGNITE:
        camTarget.zoom = 1.32;
        camTarget.y = camYForHorizon(1.32, 0.60);
        camEase = phase === S.READY ? 1.6 : 2.6;
        break;
      case S.RISE:                                   // 上昇に追随しつつ、少しずつ引く
      case S.HANG:
        u = Math.max(0, Math.min(1, shell.y / APEX));
        e = Math.pow(u, 0.6);
        z = 1.0 + (zApex - 1.0) * e;
        camTarget.zoom = z;
        camTarget.y = camYForShell(z, shell.y, 0.73 + (aApex - 0.73) * e);
        camEase = 3.6;
        break;
      case S.BURST:                                  // 大輪を受け止める引き
        camTarget.zoom = zApex * 0.92;
        camTarget.y = camYForShell(zApex * 0.92, burstY, aApex + 0.06);
        camEase = 3.0;
        break;
      case S.AFTER:
        if (pt < 1.5) {                              // まずは大輪の余韻を受け止める
          camTarget.zoom = zApex * 0.90;
          camTarget.y = camYForHorizon(zApex * 0.90, 0.90);
          camEase = 0.75;
        } else {                                     // そして川面に返る光を一枚
          camTarget.zoom = 1.38;
          camTarget.y = camYForHorizon(1.38, 0.40);
          camEase = 0.55;
        }
        break;
      case S.DONE:
        camTarget.zoom = 1.10;
        camTarget.y = camYForHorizon(1.10, 0.62);
        camEase = 0.7;
        break;
    }
    if (instant) { cam.zoom = camTarget.zoom; cam.s = sOf(cam.zoom); cam.y = camTarget.y; }
  }

  /* ---------------- フェーズ ---------------- */
  function setPhase(p) {
    phase = p; pt = 0;
    switch (p) {
      case S.INTRO:
        caption('しなのがわの かわらだよ', true);
        NFAudio.ambience();
        break;
      case S.READY:
        caption('サイレンが なるよ');
        elFire.classList.add('hidden');
        NFAudio.siren(3.0); sirenAt = 0;
        break;
      case S.IGNITE:
        caption('てんか！');
        elFire.classList.add('hidden');
        NFAudio.launch();
        NFAudio.rise(RISE_T + 0.2);
        shell.x = NFScene.LAUNCH.x; shell.y = NFScene.LAUNCH.y; shell.py = NFScene.LAUNCH.y;
        shell.vy = V0; shell.glow = 1; shell.alive = true;
        flash = 0.35;
        wash.i = 0.55; wash.color = [255, 186, 108];
        wash.x = W * 0.5; wash.y = cam.sy(NFScene.LAUNCH.y);
        waterLight.x = shell.x; waterLight.color = [255, 178, 98]; waterLight.r = 260; waterLight.target = 1;
        field.addTrail(shell.x, shell.y, shell.x, shell.y, 260, 34);   // 筒からあふれる火の粉
        break;
      case S.RISE:
        caption('ぐんぐん のぼる…', true);
        break;
      case S.HANG:
        caption('……');
        break;
      case S.BURST:
        burstY = shell.y;
        elOpen.classList.add('hidden');
        caption('どーん！ おおきい！');
        shell.alive = false;
        field.burst(shell.x, shell.y, pal, 1);
        flash = 0.9;
        wash.i = 1; wash.color = pal.wash;
        wash.x = cam.sx(shell.x); wash.y = cam.sy(shell.y);
        waterLight.x = shell.x; waterLight.color = pal.wash; waterLight.r = BURST_R; waterLight.target = 1;
        boomAt = 0.62;                               // 光より遅れて音が届く（距離感）
        NFAudio.boom(0.62);
        NFAudio.crackle(1.05, 2.0);
        NFAudio.crowd(1.2);
        break;
      case S.AFTER:
        caption('せい さんじゃくだま！');
        break;
      case S.DONE:
        caption('もういちど できるよ', true);
        elReplay.classList.remove('hidden');
        break;
    }
    aim(false);
  }

  /* ---------------- 入力 ---------------- */
  function ignite() { if (phase === S.READY) { NFAudio.unlock(); setPhase(S.IGNITE); } }
  function openIt() { if (phase === S.HANG) setPhase(S.BURST); }
  function restart() {
    if (phase !== S.DONE && phase !== S.AFTER) return;
    NFAudio.stopAll(); NFAudio.ambience();
    field.reset();
    flash = 0; wash.i = 0; waterLight.i = 0; waterLight.target = 0;
    shell.alive = false;
    elReplay.classList.add('hidden'); elOpen.classList.add('hidden');
    palIndex = (palIndex + 1) % NFFire.PALETTES.length;
    pal = NFFire.PALETTES[palIndex];
    phase = S.INTRO; aim(true);
    setPhase(S.READY);
    elFire.classList.remove('hidden');
  }
  function startGame() {
    NFAudio.unlock(); NFAudio.ambience();
    elBoot.classList.add('gone');
    setTimeout(function () { elBoot.classList.add('hidden'); }, 620);
    setPhase(S.INTRO);
  }

  function onTap(e) {
    if (e.target === elSound) return;
    e.preventDefault();
    if (phase === S.BOOT) startGame();
    else if (phase === S.READY) ignite();
    else if (phase === S.HANG) openIt();
    else if (phase === S.DONE) restart();
  }
  document.getElementById('stage').addEventListener('pointerdown', onTap, { passive: false });
  elFire.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); ignite(); });
  elOpen.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); openIt(); });
  elReplay.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); restart(); });
  elSound.addEventListener('pointerdown', function (e) {
    e.preventDefault(); e.stopPropagation();
    NFAudio.unlock();
    var m = !NFAudio.isMuted();
    NFAudio.setMuted(m);
    elSound.textContent = m ? '🔇' : '🔊';
  });

  /* ---------------- 更新 ---------------- */
  function update(dt) {
    pt += dt;

    switch (phase) {
      case S.INTRO:
        if (pt > 1.8) caption('よぞらを みあげて…', true);
        if (pt > 3.6) setPhase(S.READY);
        break;
      case S.READY:
        sirenAt += dt;
        if (pt > 0.8) elFire.classList.remove('hidden');
        if (pt > 1.2) caption('ボタンを ポン！');
        if (sirenAt > 9) { NFAudio.siren(3.0); sirenAt = 0; caption('サイレンが なるよ'); }
        break;
      case S.IGNITE:
        if (pt > 0.4) setPhase(S.RISE);
        break;
      case S.RISE:
        if (shell.vy <= 6 || pt > RISE_T) setPhase(S.HANG);
        break;
      case S.HANG:
        if (pt > 0.28) { elOpen.classList.remove('hidden'); caption('ひらけ！'); }
        if (pt > HANG_AUTO) setPhase(S.BURST);        // 押さなくても必ず開く
        break;
      case S.BURST:
        if (boomAt >= 0 && pt >= boomAt) { cam.shake = 20; boomAt = -1; }
        if (pt > 1.7) setPhase(S.AFTER);
        break;
      case S.AFTER:
        if (pt > 1.5 && pt - dt <= 1.5) { caption('かわに ひかりが うつってる', true); aim(false); }
        if (pt > 5.0) setPhase(S.DONE);
        break;
    }

    /* 玉の運動 */
    if (shell.alive) {
      shell.py = shell.y;
      shell.vy -= (phase === S.HANG ? 60 : GRAV) * dt;
      shell.y += shell.vy * dt;
      shell.glow = 0.78 + 0.22 * Math.sin(pt * 26);
      var n = Math.max(1, Math.round((phase === S.HANG ? 18 : 230) * dt));
      field.addTrail(shell.x, shell.y, shell.x, shell.py, shell.vy, n);
      if (phase !== S.IGNITE) {
        waterLight.x = shell.x;
        waterLight.target = phase === S.HANG ? 0.06 : Math.max(0.06, 0.55 - shell.y / APEX * 0.5);
      }
    }
    field.update(dt);

    /* カメラ */
    if (phase === S.RISE || phase === S.HANG) aim(false);
    var k = 1 - Math.exp(-camEase * dt);
    cam.zoom += (camTarget.zoom - cam.zoom) * k;
    cam.y += (camTarget.y - cam.y) * k;
    cam.s = sOf(cam.zoom);

    if (cam.shake > 0.05) {
      cam.shake *= Math.pow(0.05, dt);
      cam.shx = (Math.random() - 0.5) * cam.shake;
      cam.shy = (Math.random() - 0.5) * cam.shake;
    } else { cam.shake = 0; cam.shx = cam.shy = 0; }

    /* 光。水面は少し遅れて明るくなり、ゆっくり冷める */
    flash *= Math.pow(0.02, dt);
    wash.i *= Math.pow((phase === S.BURST || phase === S.AFTER) ? 0.38 : 0.05, dt);
    if (phase === S.BURST || phase === S.AFTER) waterLight.target *= Math.pow(0.80, dt);
    else if (!shell.alive) waterLight.target *= Math.pow(0.3, dt);
    waterLight.i += (waterLight.target - waterLight.i) * (1 - Math.exp(-dt / 0.3));
    if (wash.i > 0.004 && phase >= S.BURST) { wash.x = cam.sx(shell.x); wash.y = cam.sy(burstY); }
  }

  /* ---------------- 描画 ---------------- */
  function render(t) {
    NFScene.drawSky(g, cam, W, H, t);
    NFScene.drawClouds(g, cam, t);
    NFScene.drawFar(g, cam);

    field.draw(g, cam);
    if (shell.alive) field.drawShell(g, cam, shell);

    waterLight.color = (phase >= S.BURST) ? pal.wash : [255, 178, 98];
    NFScene.drawWater(g, cam, t, waterLight);
    NFScene.drawFore(g, cam);
    NFScene.drawGrade(g, W, H, t, wash, quality);

    if (flash > 0.004) {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,246,232,' + Math.min(0.9, flash).toFixed(3) + ')';
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }
  }

  /* ---------------- ループ ---------------- */
  var last = 0, acc = 0, frames = 0, running = true, warm = 0, slowRuns = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!running) { last = now; return; }
    if (!last) last = now;
    var dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;

    // 起動直後の焼き付けを除いて計測し、続けて重いときだけ静かに軽くする
    if (warm < 90) { warm++; }
    else {
      acc += dt; frames++;
      if (frames >= 60) {
        if (frames / acc < 45) { slowRuns++; } else { slowRuns = 0; }
        if (slowRuns >= 2 && quality > 0.5) { quality = Math.max(0.5, quality - 0.15); field.q = quality; slowRuns = 0; }
        frames = 0; acc = 0;
      }
    }
    update(dt);
    render(now / 1000);
  }
  document.addEventListener('visibilitychange', function () { running = !document.hidden; last = 0; });

  resize();
  phase = S.BOOT; aim(true);
  requestAnimationFrame(loop);

  window.NFGame = {
    S: S, cam: cam, field: field,
    get phase() { return phase; }, get pt() { return pt; },
    start: startGame, ignite: ignite, openIt: openIt, restart: restart,
    debug: function (p) { setPhase(p); },
    get quality() { return quality; },
    frame: function (dt, t) { update(dt); render(t); }   // 計測用
  };
})();
