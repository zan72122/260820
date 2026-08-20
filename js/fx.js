/* fx.js - 落ちる火の粉・導火線・煙。描画予算はここに集中させる */
(function (g) {
  'use strict';
  var NB = g.NB, U = NB.U, W = NB.W;

  var MAX = 3400;
  var P = {
    x: new Float32Array(MAX), y: new Float32Array(MAX), z: new Float32Array(MAX),
    vx: new Float32Array(MAX), vy: new Float32Array(MAX), vz: new Float32Array(MAX),
    age: new Float32Array(MAX), life: new Float32Array(MAX),
    sz: new Float32Array(MAX), kind: new Uint8Array(MAX),
    n: 0
  };

  var SMAX = 110;
  var SM = {
    x: new Float32Array(SMAX), y: new Float32Array(SMAX), z: new Float32Array(SMAX),
    vx: new Float32Array(SMAX), vy: new Float32Array(SMAX), vz: new Float32Array(SMAX),
    age: new Float32Array(SMAX), life: new Float32Array(SMAX),
    sz: new Float32Array(SMAX), sp: new Uint8Array(SMAX),
    n: 0
  };

  var FX = NB.FX = {
    P: P, SM: SM, MAX: MAX,
    cap: 1500,
    sprites: null, smokes: null,
    splash: 0
  };

  FX.init = function () {
    FX.sprites = [];
    for (var i = 0; i < 6; i++) FX.sprites.push(U.fireSprite(i, 64));
    FX.smokes = [];
    for (i = 0; i < 4; i++) FX.smokes.push(U.smokeSprite(128, 991 + i * 37));
    FX.halo = U.glow(128, [
      [0, 'rgba(255,238,205,0.95)'], [0.18, 'rgba(255,206,120,0.55)'],
      [0.45, 'rgba(255,150,45,0.20)'], [1, 'rgba(255,120,20,0)']
    ]);
    FX.lampGlow = U.glow(96, [
      [0, 'rgba(255,241,214,0.90)'], [0.20, 'rgba(255,222,160,0.42)'],
      [0.55, 'rgba(255,196,110,0.11)'], [1, 'rgba(255,180,90,0)']
    ]);
    FX.coolGlow = U.glow(96, [
      [0, 'rgba(226,240,255,0.95)'], [0.22, 'rgba(180,214,255,0.40)'],
      [0.6, 'rgba(130,180,255,0.10)'], [1, 'rgba(120,170,255,0)']
    ]);
    FX.redGlow = U.glow(64, [
      [0, 'rgba(255,120,110,0.90)'], [0.3, 'rgba(255,60,50,0.35)'],
      [1, 'rgba(255,40,30,0)']
    ]);
  };

  FX.reset = function () { P.n = 0; SM.n = 0; FX.splash = 0; };

  function spawn(x, y, z, vx, vy, vz, life, sz, kind) {
    if (P.n >= FX.cap) return;
    var i = P.n++;
    P.x[i] = x; P.y[i] = y; P.z[i] = z;
    P.vx[i] = vx; P.vy[i] = vy; P.vz[i] = vz;
    P.age[i] = 0; P.life[i] = life; P.sz[i] = sz; P.kind[i] = kind;
  }
  FX.spawn = spawn;

  function smoke(x, y, z, sz, life) {
    if (SM.n >= SMAX) return;
    var i = SM.n++;
    SM.x[i] = x; SM.y[i] = y; SM.z[i] = z;
    SM.vx[i] = 0.6 + Math.random() * 1.4;
    SM.vy[i] = 0.7 + Math.random() * 1.1;
    SM.vz[i] = 1.2 + Math.random() * 2.0;
    SM.age[i] = 0; SM.life[i] = life; SM.sz[i] = sz;
    SM.sp[i] = (Math.random() * 4) | 0;
  }

  /* ---------- 発生 ---------- */
  var emitAcc = 0, smokeAcc = 0;

  FX.emitNiagara = function (dt, S) {
    var ign = S.ign, total = 0, i;
    for (i = 0; i < W.SEG; i++) total += ign[i];
    if (total <= 0.001) return;
    S.ignTotal = total / W.SEG;

    var rate = 2000 * (total / W.SEG) * S.fire;
    emitAcc += rate * dt;
    var count = emitAcc | 0; emitAcc -= count;
    if (count > 260) count = 260;

    for (var c = 0; c < count; c++) {
      /* 点火済みの区間から選ぶ */
      var seg = -1;
      for (var t = 0; t < 9; t++) {
        var r = (Math.random() * W.SEG) | 0;
        if (Math.random() < ign[r] * (S.segW[r] / S.segWMax)) { seg = r; break; }
      }
      if (seg < 0) continue;
      var x = W.segX(seg) + (Math.random() - 0.5) * W.SEG_L;
      var z = W.CURTAIN_Z + (Math.random() - 0.5) * 1.0;
      var big = Math.random() < 0.10;
      spawn(
        x, W.LOW_Y - 0.35 - Math.random() * 0.5, z,
        (Math.random() - 0.5) * 1.5,
        -(0.6 + Math.random() * 2.4),
        (Math.random() - 0.5) * 0.8,
        big ? (2.0 + Math.random() * 0.9) : (1.15 + Math.random() * 1.15),
        big ? (0.85 + Math.random() * 0.7) : (0.30 + Math.random() * 0.45),
        0
      );
    }

    /* 煙 */
    smokeAcc += 5.5 * (total / W.SEG) * S.fire * dt;
    while (smokeAcc >= 1) {
      smokeAcc -= 1;
      var sg = (Math.random() * W.SEG) | 0;
      if (Math.random() > ign[sg]) continue;
      smoke(W.segX(sg), W.LOW_Y - 1 - Math.random() * 5, W.CURTAIN_Z + 1 + Math.random() * 4,
        14 + Math.random() * 20, 7 + Math.random() * 6);
    }
  };

  FX.emitFuse = function (dt, S) {
    var n = Math.min(46, Math.round(620 * dt));
    for (var i = 0; i < n; i++) {
      var x = S.fuseX - Math.random() * 12;
      spawn(
        x, W.LOW_Y + 0.35 + (Math.random() - 0.5) * 0.8, W.CURTAIN_Z + (Math.random() - 0.5) * 0.8,
        -(2 + Math.random() * 16) + S.fuseV * 0.16,
        (Math.random() - 0.35) * 7,
        (Math.random() - 0.5) * 4,
        0.30 + Math.random() * 0.55,
        0.28 + Math.random() * 0.45,
        1
      );
    }
  };

  /* ---------- 更新 ---------- */
  FX.update = function (dt, S) {
    var i = 0, n = P.n;
    var wind = S.wind;
    while (i < n) {
      var k = P.kind[i];
      var gy = (k === 1) ? 5.5 : 8.6;
      var dr = (k === 1) ? 2.4 : 0.42;
      P.vy[i] -= gy * dt;
      P.vx[i] += (wind - P.vx[i]) * dr * dt * 0.6;
      P.vx[i] -= P.vx[i] * dr * dt * 0.35;
      P.vz[i] -= P.vz[i] * dr * dt;
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
      P.z[i] += P.vz[i] * dt;
      P.age[i] += dt;

      var dead = P.age[i] >= P.life[i];
      if (!dead && P.y[i] <= 0.12) {
        /* 水面に届いた火の粉 */
        if (k === 0 && P.sz[i] > 0.6) FX.splash = Math.min(1.2, FX.splash + 0.05);
        dead = true;
      }
      if (dead) {
        n--;
        P.x[i] = P.x[n]; P.y[i] = P.y[n]; P.z[i] = P.z[n];
        P.vx[i] = P.vx[n]; P.vy[i] = P.vy[n]; P.vz[i] = P.vz[n];
        P.age[i] = P.age[n]; P.life[i] = P.life[n];
        P.sz[i] = P.sz[n]; P.kind[i] = P.kind[n];
      } else i++;
    }
    P.n = n;
    FX.splash *= Math.pow(0.12, dt);

    i = 0; n = SM.n;
    while (i < n) {
      SM.x[i] += SM.vx[i] * dt; SM.y[i] += SM.vy[i] * dt; SM.z[i] += SM.vz[i] * dt;
      SM.vy[i] += 0.25 * dt;
      SM.age[i] += dt;
      SM.sz[i] += 4.2 * dt;
      if (SM.age[i] >= SM.life[i]) {
        n--;
        SM.x[i] = SM.x[n]; SM.y[i] = SM.y[n]; SM.z[i] = SM.z[n];
        SM.vx[i] = SM.vx[n]; SM.vy[i] = SM.vy[n]; SM.vz[i] = SM.vz[n];
        SM.age[i] = SM.age[n]; SM.life[i] = SM.life[n];
        SM.sz[i] = SM.sz[n]; SM.sp[i] = SM.sp[n];
      } else i++;
    }
    SM.n = n;
  };

  /* ---------- 描画 ---------- */
  var o = { x: 0, y: 0, s: 1, z: 1, vis: false };

  FX.draw = function (ctx, cam, mirror, stride, alphaMul) {
    var sp = FX.sprites, my = mirror ? -1 : 1;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < P.n; i += stride) {
      var r = P.age[i] / P.life[i];
      if (r >= 1) continue;
      cam.pr(P.x[i], P.y[i] * my, P.z[i], o);
      if (!o.vis) continue;
      if (o.x < -60 || o.x > cam.w + 60 || o.y < -60 || o.y > cam.h + 60) continue;

      var st = (r * 5.999) | 0;
      var fade = (1 - r * r) * alphaMul * (o.z > 420 ? Math.max(0.22, 1.28 - o.z / 1500) : 1);
      if (P.age[i] < 0.06) fade *= P.age[i] / 0.06;
      if (fade <= 0.012) continue;

      var w = P.sz[i] * o.s * (mirror ? 1.8 : 2.5);
      if (w < 2.0) w = 2.0; else if (w > 34) w = 34;
      /* 落下速度で縦に伸ばす = 火の筋に見える */
      var stretch = 1 + Math.min(3.1, Math.abs(P.vy[i]) * 0.115);
      var h = w * stretch;

      ctx.globalAlpha = fade > 1 ? 1 : fade;
      ctx.drawImage(sp[st], o.x - w * 0.5, o.y - h * 0.5, w, h);
    }
    ctx.globalAlpha = 1;
  };

  FX.drawSmoke = function (ctx, cam, S) {
    if (SM.n === 0) return;
    ctx.globalCompositeOperation = 'source-over';
    for (var i = 0; i < SM.n; i++) {
      var r = SM.age[i] / SM.life[i];
      cam.pr(SM.x[i], SM.y[i], SM.z[i], o);
      if (!o.vis) continue;
      var w = SM.sz[i] * o.s * 2.2;
      if (w < 8) continue;
      if (o.x < -w || o.x > cam.w + w) continue;
      var a = Math.sin(Math.PI * Math.min(1, r)) * 0.20 * S.smokeA;
      if (a <= 0.008) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(FX.smokes[SM.sp[i]], o.x - w * 0.5, o.y - w * 0.5, w, w);
    }
    /* 火に照らされた部分をうっすら足す */
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < SM.n; i++) {
      r = SM.age[i] / SM.life[i];
      if (r > 0.55) continue;
      cam.pr(SM.x[i], SM.y[i], SM.z[i], o);
      if (!o.vis) continue;
      w = SM.sz[i] * o.s * 2.0;
      if (w < 8) continue;
      a = (1 - r / 0.55) * 0.10 * S.fire * S.smokeA;
      if (a <= 0.006) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(FX.smokes[SM.sp[i]], o.x - w * 0.5, o.y - w * 0.5, w, w);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  FX.init();
})(window);
