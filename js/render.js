/* render.js - 夜の信濃川と長生橋を描く */
(function (g) {
  'use strict';
  var NB = g.NB, U = NB.U, W = NB.W, FX = NB.FX;

  var R = NB.R = {};
  R.off = {};
  var ctx, cvs, fireC, fireX, glowC, glowX, reflC, reflX, darkC, darkX;
  var Wp = 1, Hp = 1, S_ = 1;
  var noise = null, noiseFull = null;

  /* 再利用する射影結果 */
  var a = { x: 0, y: 0, s: 1, z: 1, vis: false }, b = { x: 0, y: 0, s: 1, z: 1, vis: false },
    c = { x: 0, y: 0, s: 1, z: 1, vis: false }, d = { x: 0, y: 0, s: 1, z: 1, vis: false },
    e = { x: 0, y: 0, s: 1, z: 1, vis: false };

  /* ---------- 色 ---------- */
  var SKY_DUSK = [
    [0.00, [14, 22, 48]], [0.34, [36, 52, 88]], [0.62, [92, 92, 112]],
    [0.84, [166, 116, 84]], [1.00, [206, 148, 92]]
  ];
  var SKY_NIGHT = [
    [0.00, [3, 5, 12]], [0.34, [6, 9, 20]], [0.62, [12, 16, 30]],
    [0.84, [24, 25, 38]], [1.00, [46, 38, 40]]
  ];
  var tmpc = [0, 0, 0];

  /* ---------- 線のバッチ描画 ---------- */
  var LB = {
    keys: [], map: Object.create(null),
    add: function (x1, y1, x2, y2, ci, wpx) {
      if (wpx > 26 * S_) wpx = 26 * S_;
      var wi = Math.round(Math.log(Math.max(wpx, 0.45)) / Math.LN2 * 2);
      if (wi < -2) wi = -2; else if (wi > 11) wi = 11;
      var key = ci * 100 + (wi + 10);
      var bkt = this.map[key];
      if (!bkt) { bkt = this.map[key] = { ci: ci, w: Math.pow(2, wi / 2), p: [] }; this.keys.push(key); }
      var p = bkt.p; p.push(x1, y1, x2, y2);
    },
    flush: function (cx, pal) {
      cx.lineCap = 'butt';
      for (var i = 0; i < this.keys.length; i++) {
        var bkt = this.map[this.keys[i]], p = bkt.p;
        if (!p.length) continue;
        cx.strokeStyle = pal[bkt.ci];
        cx.lineWidth = bkt.w;
        cx.beginPath();
        for (var j = 0; j < p.length; j += 4) {
          cx.moveTo(p[j], p[j + 1]); cx.lineTo(p[j + 2], p[j + 3]);
        }
        cx.stroke();
        p.length = 0;
      }
    }
  };

  /* ---------- 初期化 ---------- */
  R.init = function (canvas) {
    cvs = canvas;
    ctx = cvs.getContext('2d', { alpha: false });
    fireC = U.canvas(2, 2); fireX = fireC.getContext('2d');
    glowC = U.canvas(2, 2); glowX = glowC.getContext('2d');
    reflC = U.canvas(2, 2); reflX = reflC.getContext('2d');
    darkC = U.canvas(2, 2); darkX = darkC.getContext('2d');
    noise = U.noiseTile(160, 4242);
    /* 部材に「手前／奥」のタグを付ける */
    for (var k = 0; k < W.spans.length; k++) {
      var sp = W.spans[k];
      tag(sp.main); tag(sp.det);
    }
    function tag(list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i], zs = m.a[2] + m.b[2];
        m.side = zs > 0.5 ? 1 : (zs < -0.5 ? -1 : 0);
      }
    }
    R.stars = [];
    var rnd = U.rng(77);
    for (var i = 0; i < 260; i++) R.stars.push([rnd(), rnd() * 0.72, 0.25 + rnd() * 0.75]);
    R.tree = [];
    rnd = U.rng(313);
    for (i = 0; i <= 90; i++) R.tree.push(rnd());
    R.town = [];
    rnd = U.rng(515);
    for (i = 0; i < 90; i++) R.town.push([rnd(), rnd(), rnd()]);
    R.gravel = [];
    rnd = U.rng(808);
    for (i = 0; i < 420; i++) R.gravel.push([rnd(), rnd(), rnd()]);
    R.clouds = [];
    rnd = U.rng(2027);
    for (i = 0; i < 7; i++) R.clouds.push([rnd(), 0.03 + rnd() * 0.20, 0.34 + rnd() * 0.5, 0.05 + rnd() * 0.05, rnd()]);
    R.cloudSp = [];
    R.cloudDark = U.tint(U.smokeSprite(160, 61), '#1a1c28');
    R.cloudLit = U.tint(U.smokeSprite(160, 62), '#ffb877');
    R.cloudSp = [R.cloudDark];
    R.crowd = [];
    rnd = U.rng(1234);
    for (i = 0; i < 42; i++) R.crowd.push([rnd(), rnd(), rnd(), rnd()]);
  };

  R.resize = function (wpx, hpx, scale) {
    Wp = wpx; Hp = hpx; S_ = scale;
    cvs.width = wpx; cvs.height = hpx;
    var fw = Math.max(2, Math.round(wpx * 0.5)), fh = Math.max(2, Math.round(hpx * 0.5));
    fireC.width = fw; fireC.height = fh;
    reflC.width = fw; reflC.height = fh;
    darkC.width = fw; darkC.height = fh;
    glowC.width = Math.max(2, Math.round(wpx * 0.12));
    glowC.height = Math.max(2, Math.round(hpx * 0.12));
    /* 粒子は一枚絵にしておく */
    var nw = Math.max(2, Math.round(wpx * 0.5)), nh = Math.max(2, Math.round(hpx * 0.5));
    noiseFull = U.canvas(nw, nh);
    var nx = noiseFull.getContext('2d');
    for (var x = 0; x < nw; x += noise.width) {
      for (var y = 0; y < nh; y += noise.height) nx.drawImage(noise, x, y);
    }
  };

  /* ---------- 小物 ---------- */
  function skyColor(stops, t, out) {
    for (var i = 1; i < stops.length; i++) {
      if (t <= stops[i][0] || i === stops.length - 1) {
        var t0 = stops[i - 1][0], t1 = stops[i][0];
        return U.mix3(stops[i - 1][1], stops[i][1], U.clamp((t - t0) / (t1 - t0), 0, 1), out);
      }
    }
    return out;
  }
  var mixA = [0, 0, 0], mixB = [0, 0, 0];
  function skyAt(t, dusk, out) {
    skyColor(SKY_NIGHT, t, mixA);
    skyColor(SKY_DUSK, t, mixB);
    return U.mix3(mixA, mixB, dusk, out);
  }

  function quad(cx, cam, p1, p2, p3, p4, fill) {
    cam.pr(p1[0], p1[1], p1[2], a); if (!a.vis) return false;
    cam.pr(p2[0], p2[1], p2[2], b); if (!b.vis) return false;
    cam.pr(p3[0], p3[1], p3[2], c); if (!c.vis) return false;
    cam.pr(p4[0], p4[1], p4[2], d); if (!d.vis) return false;
    cx.beginPath();
    cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.lineTo(c.x, c.y); cx.lineTo(d.x, d.y);
    cx.closePath();
    cx.fillStyle = fill; cx.fill();
    return true;
  }

  /* ---------- 空 ---------- */
  function drawSky(cam, S) {
    var hz = cam.horizonY();
    var top = -Hp * 0.15, bot = hz;
    var gr = ctx.createLinearGradient(0, top, 0, bot);
    for (var i = 0; i <= 10; i++) {
      var t = i / 10;
      skyAt(t, S.dusk, tmpc);
      gr.addColorStop(t, U.css(tmpc));
    }
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, Wp, Math.max(1, bot));

    /* 星 */
    var sa = (1 - S.dusk);
    if (sa > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < R.stars.length; i++) {
        var st = R.stars[i];
        var sy = st[1] * Math.max(1, hz);
        if (sy > hz - 6) continue;
        var tw = 0.62 + 0.38 * Math.sin(S.time * (1.2 + st[2] * 2.4) + i);
        ctx.fillStyle = 'rgba(214,228,255,' + (sa * st[2] * 0.62 * tw).toFixed(3) + ')';
        var sz = st[2] * 1.7 * S_;
        ctx.fillRect(st[0] * Wp, sy, sz, sz);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    /* 雲 */
    ctx.globalCompositeOperation = 'source-over';
    for (i = 0; i < R.clouds.length; i++) {
      var cl = R.clouds[i];
      var cy = hz - Hp * cl[1];
      var cw = Wp * cl[2];
      var ch = cw * cl[3];
      var cx0 = (cl[0] + S.time * 0.0016 * (0.4 + cl[4])) % 1.3 - 0.15;
      skyAt(0.92 - cl[1] * 0.5, S.dusk, tmpc);
      var dark = U.lerp(0.42, 0.62, S.dusk);
      var sp = R.cloudSp[i % R.cloudSp.length];
      ctx.globalAlpha = (0.30 + cl[4] * 0.26) * (0.35 + S.dusk * 0.65);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.drawImage(R.cloudDark, cx0 * Wp - cw * 0.5, cy - ch * 0.5, cw, ch);
      /* 下端の照り返し */
      if (S.dusk > 0.05) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.16 * S.dusk * (0.5 + cl[4]);
        ctx.drawImage(R.cloudLit, cx0 * Wp - cw * 0.5, cy - ch * 0.32, cw, ch * 0.8);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- 対岸の木立と街あかり ---------- */
  function drawFarShore(cam, S) {
    var hz = cam.horizonY();
    if (hz < -Hp || hz > Hp * 1.5) return;
    var glowH = Hp * 0.075;
    var gg = ctx.createLinearGradient(0, hz - glowH, 0, hz);
    var ga = U.lerp(0.30, 0.16, S.dusk);
    gg.addColorStop(0, 'rgba(120,86,58,0)');
    gg.addColorStop(1, 'rgba(150,104,66,' + ga.toFixed(3) + ')');
    ctx.fillStyle = gg;
    ctx.fillRect(0, hz - glowH, Wp, glowH);

    /* 街あかり */
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < R.town.length; i++) {
      var t = R.town[i];
      var x = t[0] * Wp, y = hz - t[1] * Hp * 0.012 - Hp * 0.002;
      var al = (0.16 + t[2] * 0.4) * (1 - S.dusk * 0.55);
      ctx.fillStyle = 'rgba(255,206,146,' + al.toFixed(3) + ')';
      ctx.fillRect(x, y, 1.5 * S_, 1.5 * S_);
    }
    ctx.globalCompositeOperation = 'source-over';

    /* 木立 */
    var th = Hp * 0.016;
    ctx.beginPath();
    ctx.moveTo(0, hz + 2);
    for (i = 0; i <= 90; i++) {
      var xx = i / 90 * Wp;
      var hh = th * (0.35 + R.tree[i] * 0.65 + 0.25 * Math.sin(i * 0.7));
      ctx.lineTo(xx, hz - hh);
    }
    ctx.lineTo(Wp, hz + 2);
    ctx.closePath();
    skyAt(1, S.dusk, tmpc);
    ctx.fillStyle = U.css([tmpc[0] * 0.16, tmpc[1] * 0.17, tmpc[2] * 0.22]);
    ctx.fill();
  }

  /* ---------- 地面と川 ---------- */
  /* 岸のきわ: 草むらと濡れぎわ。ここが無いと川が「板」に見える */
  function bankSamples(cam) {
    var zs = [], z;
    for (z = -2600; z < -200; z += 300) zs.push(z);
    for (z = -200; z < cam.pos[2] + 700; z += 26) zs.push(z);
    return zs;
  }

  /* 手前でカメラの後ろに回り込む線を near 面で切って画面外まで伸ばす */
  var _pv = [0, 0, 0];
  function viewZ(cam, x, y, z) {
    var p = cam.pos, f = cam.f;
    return (x - p[0]) * f[0] + (y - p[1]) * f[1] + (z - p[2]) * f[2];
  }
  function bankPoly(cam, fn, y, out) {
    out.length = 0;
    var zs = bankSamples(cam), i;
    var px = 0, py = 0, pz = 0, pv = 0, has = false;
    for (i = 0; i < zs.length; i++) {
      var z = zs[i], x = fn(z);
      var v = viewZ(cam, x, y, z);
      if (v >= 1) {
        if (has && pv < 1) {
          var t = (1 - pv) / (v - pv);
          cam.pr(px + (x - px) * t, y, pz + (z - pz) * t, a);
          if (a.vis) out.push(a.x, a.y);
        }
        cam.pr(x, y, z, a);
        if (a.vis) out.push(a.x, a.y);
      } else if (has && pv >= 1) {
        var t2 = (pv - 1) / (pv - v);
        cam.pr(px + (x - px) * t2, y, pz + (z - pz) * t2, a);
        if (a.vis) out.push(a.x, a.y);
      }
      px = x; py = y; pz = z; pv = v; has = true;
    }
    return out;
  }

  var _sa = [], _sb = [];
  function drawShore(cam, S) {
    var col = U.css([9 + 13 * S.dusk, 11 + 14 * S.dusk, 10 + 11 * S.dusk]);
    for (var side = 0; side < 2; side++) {
      var fn = side === 0 ? W.bankL : W.bankR;
      var top = bankPoly(cam, fn, 3.4, _sa);
      var bot = bankPoly(cam, fn, -0.3, _sb);
      if (top.length < 4 || bot.length < 4) continue;
      ctx.beginPath();
      ctx.moveTo(top[0], top[1]);
      var i;
      for (i = 2; i < top.length; i += 2) ctx.lineTo(top[i], top[i + 1]);
      for (i = bot.length - 2; i >= 0; i -= 2) ctx.lineTo(bot[i], bot[i + 1]);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      /* 濡れぎわ */
      var edge = bankPoly(cam, fn, 0, _sb);
      if (edge.length >= 4) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(150,160,180,' + (0.035 + 0.10 * S.dusk).toFixed(3) + ')';
        ctx.lineWidth = Math.max(1, 1.2 * S_);
        ctx.beginPath();
        ctx.moveTo(edge[0], edge[1]);
        for (i = 2; i < edge.length; i += 2) ctx.lineTo(edge[i], edge[i + 1]);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  var _wl = [], _wr = [], _waterPath = null;
  function buildWater(cam) {
    var L = bankPoly(cam, W.bankL, 0, _wl);
    var Rr = bankPoly(cam, W.bankR, 0, _wr);
    if (L.length < 4 || Rr.length < 4) { _waterPath = null; return; }
    var pth = new Path2D();
    pth.moveTo(L[0], L[1]);
    var i;
    for (i = 2; i < L.length; i += 2) pth.lineTo(L[i], L[i + 1]);
    for (i = Rr.length - 2; i >= 0; i -= 2) pth.lineTo(Rr[i], Rr[i + 1]);
    pth.closePath();
    _waterPath = pth;
  }
  function waterPath() { return !!_waterPath; }

  function drawGroundAndWater(cam, S) {
    var hz = cam.horizonY();
    var y0 = Math.max(0, hz);
    /* 河川敷 */
    var lg = ctx.createLinearGradient(0, y0, 0, Hp);
    skyAt(1, S.dusk, tmpc);
    lg.addColorStop(0, U.css([tmpc[0] * 0.20 + 4, tmpc[1] * 0.21 + 5, tmpc[2] * 0.20 + 5]));
    lg.addColorStop(0.35, U.css([6 + 5 * S.dusk, 7 + 6 * S.dusk, 8 + 5 * S.dusk]));
    lg.addColorStop(1, 'rgb(3,4,5)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, y0 - 1, Wp, Hp - y0 + 1);

    /* 川面 */
    ctx.save();
    if (_waterPath) {
      ctx.clip(_waterPath);
      var span = (Hp - hz) * U.clamp(11 / Math.max(2, cam.pos[1]), 0.30, 1.05);
      var wg = ctx.createLinearGradient(0, hz, 0, hz + Math.max(24, span));
      skyAt(0.985, S.dusk, tmpc);
      wg.addColorStop(0, U.css([tmpc[0] * 0.72, tmpc[1] * 0.70, tmpc[2] * 0.74]));
      wg.addColorStop(0.09, U.css([tmpc[0] * 0.40, tmpc[1] * 0.40, tmpc[2] * 0.47]));
      wg.addColorStop(0.30, U.css([tmpc[0] * 0.16, tmpc[1] * 0.17, tmpc[2] * 0.25]));
      wg.addColorStop(0.62, U.css([4 + 6 * S.dusk, 6 + 6 * S.dusk, 10 + 7 * S.dusk]));
      wg.addColorStop(1, 'rgb(2,3,6)');
      ctx.fillStyle = wg;
      ctx.fillRect(0, Math.max(0, hz) - 2, Wp, Hp);
      /* 流れの陰影 */
      var rr2 = U.rng(31);
      ctx.globalCompositeOperation = 'source-over';
      for (var q = 0; q < 26; q++) {
        var qy = hz + Math.pow(rr2(), 1.5) * (Hp - hz);
        var qh = (2 + rr2() * 9) * S_ * (0.3 + (qy - hz) / Math.max(1, Hp - hz) * 2.2);
        ctx.fillStyle = 'rgba(0,0,0,' + (0.05 + rr2() * 0.07).toFixed(3) + ')';
        ctx.fillRect(0, qy, Wp, qh);
      }
      /* 岸のきわの暗がり */
      ctx.globalCompositeOperation = 'source-over';
      R.waterClipped = true;
    } else R.waterClipped = false;
    ctx.restore();
  }

  /* 奥ほど薄くなるよう映り込みバッファを削る */
  function fadeBuffer(bx, buf, cam, strength) {
    var hz = Math.max(0, cam.horizonY()) * 0.5, bh = buf.height;
    if (hz >= bh) return;
    bx.setTransform(1, 0, 0, 1, 0, 0);
    bx.globalCompositeOperation = 'destination-out';
    var gr = bx.createLinearGradient(0, hz, 0, bh);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(0.35, 'rgba(0,0,0,' + (strength * 0.45).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(0,0,0,' + strength.toFixed(3) + ')');
    bx.fillStyle = gr;
    bx.fillRect(0, hz, buf.width, bh - hz);
    bx.globalCompositeOperation = 'source-over';
  }

  /* 縦に滲ませて水面に置く */
  function smear(buf, S, alpha, mode, spread) {
    if (alpha < 0.02 || R.off.smear) return;
    ctx.globalCompositeOperation = mode;
    var steps = 4;
    for (var k = 0; k < steps; k++) {
      var f = k / (steps - 1);
      var yo = f * spread * 9 * S_;
      var xo = Math.sin(S.time * 1.5 + k * 1.3) * (1.2 + k * 1.5) * S_
        + Math.sin(S.time * 0.63 + k * 2.7) * (0.8 + k * 0.9) * S_;
      ctx.globalAlpha = alpha * (1 - f * 0.62) / steps * 1.75;
      ctx.drawImage(buf, xo, yo, Wp, Hp);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* 水面の映り込み */
  function drawReflection(cam, S) {
    var hz = cam.horizonY();
    var top = Math.max(0, hz);
    if (top >= Hp) return;
    ctx.save();
    if (!_waterPath) { ctx.restore(); return; }
    ctx.clip(_waterPath);
    smear(reflC, S, 0.52 * (0.6 + 0.4 * (1 - S.dusk)), 'lighter', 0.85);
    ctx.globalAlpha = 1;
    /* さざなみ */
    ctx.globalCompositeOperation = 'lighter';
    var rr = U.rng(9);
    for (var i = 0; i < 70; i++) {
      var t = rr();
      var yy = top + Math.pow(rr(), 1.7) * (Hp - top);
      var ln = (6 + rr() * 46) * S_ * (0.4 + (yy - top) / Math.max(1, Hp - top));
      var al2 = 0.035 * (1 - S.dusk * 0.4) * (0.3 + 0.7 * Math.abs(Math.sin(S.time * 0.9 + i)));
      ctx.fillStyle = 'rgba(180,200,230,' + al2.toFixed(3) + ')';
      ctx.fillRect(t * Wp, yy, ln, Math.max(1, 1.1 * S_));
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /* ---------- 鋼材の色 ---------- */
  var PAL = [];
  function buildPalette(S) {
    var base = [
      U.lerp(23, 74, S.dusk), U.lerp(26, 82, S.dusk), U.lerp(33, 94, S.dusk)
    ];
    for (var i = 0; i < 14; i++) {
      var L = i / 13;
      var r = base[0] + 258 * Math.pow(L, 0.72);
      var gg = base[1] + 148 * Math.pow(L, 0.98);
      var bb = base[2] + 54 * Math.pow(L, 1.5);
      PAL[i] = U.css([Math.min(255, r), Math.min(255, gg), Math.min(255, bb)]);
    }
  }
  function lightAt(S, x, y) {
    var si = ((x - W.X0) / W.SEG_L) | 0;
    var ig = (si >= 0 && si < W.SEG) ? S.ign[si] : 0;
    var vert = 1.0 / (1 + Math.max(0, y - W.LOW_Y + 1.5) * 0.088);
    var L = ig * S.fire * vert * 0.92;
    if (S.fuseOn) {
      var dd = Math.abs(x - S.fuseX);
      if (dd < 90) L += 1.25 * Math.exp(-dd / 26) * vert;
    }
    /* 街灯のわずかな照り返し */
    L += (1 - S.dusk) * 0.055 * U.clamp(1 - Math.abs(y - W.DECK_Y) * 0.13, 0, 1);
    return U.clamp(L, 0, 1);
  }

  function drawMembers(cam, S, list, side, lod) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.side !== side) continue;
      cam.pr(m.a[0], m.a[1], m.a[2], a); if (!a.vis) continue;
      cam.pr(m.b[0], m.b[1], m.b[2], b); if (!b.vis) continue;
      if ((a.x < -80 && b.x < -80) || (a.x > Wp + 80 && b.x > Wp + 80)) continue;
      if ((a.y < -80 && b.y < -80) || (a.y > Hp + 80 && b.y > Hp + 80)) continue;
      var mx = (m.a[0] + m.b[0]) * 0.5, my = (m.a[1] + m.b[1]) * 0.5;
      var ci = Math.round(lightAt(S, mx, my) * 13) | 0;
      var wpx = m.th * (a.s + b.s) * 0.5;
      if (wpx < 0.5 * S_) wpx = 0.5 * S_;
      LB.add(a.x, a.y, b.x, b.y, ci, wpx);
    }
  }

  /* ---------- 橋 ---------- */
  function drawPiers(cam, S) {
    var all = W.piers;
    for (var i = 0; i < all.length; i++) {
      var p = all[i];
      var L = lightAt(S, p.x, p.top - 4) * 0.5;
      var f = 24 + 190 * L, f2 = 26 + 118 * L, f3 = 30 + 46 * L;
      var base = [f * 0.30 + 14 * S.dusk, f2 * 0.30 + 15 * S.dusk, f3 * 0.32 + 17 * S.dusk];
      var front = U.css(base);
      var sideC = U.css([base[0] * 0.62, base[1] * 0.62, base[2] * 0.64]);
      var hw = p.hw, hz = p.hz;
      /* 手前の面 */
      quad(ctx, cam,
        [p.x - hw, p.base, hz], [p.x + hw, p.base, hz],
        [p.x + hw * 0.72, p.top, hz], [p.x - hw * 0.72, p.top, hz], front);
      /* 天端 */
      quad(ctx, cam,
        [p.x - hw * 0.86, p.top - 0.9, hz + 0.35], [p.x + hw * 0.86, p.top - 0.9, hz + 0.35],
        [p.x + hw * 0.86, p.top, hz + 0.35], [p.x - hw * 0.86, p.top, hz + 0.35],
        U.css([base[0] * 1.5 + 6, base[1] * 1.5 + 6, base[2] * 1.5 + 7]));
      /* 側面 (カメラ側) */
      var sx = cam.pos[0] < p.x ? -1 : 1;
      quad(ctx, cam,
        [p.x + hw * sx, p.base, hz], [p.x + hw * sx, p.base, -hz],
        [p.x + hw * 0.72 * sx, p.top, -hz], [p.x + hw * 0.72 * sx, p.top, hz], sideC);
      /* 稜線 */
      cam.pr(p.x + hw * sx, p.base, hz, a);
      cam.pr(p.x + hw * 0.72 * sx, p.top, hz, b);
      if (a.vis && b.vis) {
        ctx.strokeStyle = U.css([base[0] * 1.8 + 8, base[1] * 1.8 + 8, base[2] * 1.8 + 9], 0.75);
        ctx.lineWidth = Math.max(1, 0.16 * a.s);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      /* 水際の暗がり */
      if (p.water) {
        cam.pr(p.x, 0, hz, a);
        if (a.vis) {
          var ww = hw * 2.4 * a.s;
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.beginPath();
          ctx.ellipse(a.x, a.y, ww * 0.55, Math.max(1, ww * 0.10), 0, 0, 6.284);
          ctx.fill();
        }
      }
    }
    for (i = 0; i < W.abut.length; i++) {
      var ab = W.abut[i];
      var Lb = lightAt(S, ab.x, ab.top - 3) * 0.4;
      var cb = U.css([16 + 90 * Lb + 8 * S.dusk, 17 + 58 * Lb + 9 * S.dusk, 20 + 26 * Lb + 10 * S.dusk]);
      quad(ctx, cam,
        [ab.x - ab.hw, ab.base, ab.hz], [ab.x + ab.hw, ab.base, ab.hz],
        [ab.x + ab.hw, ab.top, ab.hz], [ab.x - ab.hw, ab.top, ab.hz], cb);
    }
  }

  /* 取付道路の盛土 */
  function drawEmbankment(cam, S) {
    var cs = U.css([9 + 12 * S.dusk, 11 + 13 * S.dusk, 10 + 12 * S.dusk]);
    var steps = 10;
    for (var side = 0; side < 2; side++) {
      var xa = side === 0 ? W.RX0 : W.X1, xb = side === 0 ? W.X0 : W.RX1;
      for (var i = 0; i < steps; i++) {
        var x1 = U.lerp(xa, xb, i / steps), x2 = U.lerp(xa, xb, (i + 1) / steps);
        var y1 = W.roadY(x1), y2 = W.roadY(x2);
        var w1 = 6 + (y1 - W.GROUND) * 1.5, w2 = 6 + (y2 - W.GROUND) * 1.5;
        quad(ctx, cam,
          [x1, W.GROUND - 0.4, w1], [x2, W.GROUND - 0.4, w2],
          [x2, y2, 5.2], [x1, y1, 5.2], cs);
      }
    }
  }

  function drawDeck(cam, S) {
    var RN = 6;
    for (var k = 0; k < W.SPAN_N + RN * 2; k++) {
      var x0, x1;
      if (k < RN) { x0 = W.RX0 + k * (W.RAMP / RN); x1 = x0 + W.RAMP / RN; }
      else if (k >= W.SPAN_N + RN) {
        x0 = W.X1 + (k - W.SPAN_N - RN) * (W.RAMP / RN); x1 = x0 + W.RAMP / RN;
      } else { x0 = W.X0 + (k - RN) * W.SPAN_L; x1 = x0 + W.SPAN_L; }
      var y0 = W.roadY(x0), y1 = W.roadY(x1);
      var below = cam.pos[1] < (y0 + y1) * 0.5 + 0.6;
      var L = lightAt(S, (x0 + x1) * 0.5, W.DECK_Y - 1);
      var roadC;
      if (below) roadC = U.css([8 + 110 * L, 9 + 66 * L, 11 + 26 * L]);
      else roadC = U.css([23 + 26 * S.dusk + 90 * L, 24 + 27 * S.dusk + 56 * L, 28 + 30 * S.dusk + 24 * L]);
      quad(ctx, cam,
        [x0, y0, -W.ROAD_HW], [x1, y1, -W.ROAD_HW],
        [x1, y1, W.ROAD_HW], [x0, y0, W.ROAD_HW], roadC);
      /* 下流側の桁面: ここから火が落ちる */
      var fc = U.css([10 + 230 * Math.pow(L, 0.7), 11 + 130 * L, 13 + 40 * L]);
      quad(ctx, cam,
        [x0, y0 - 1.15, W.HW], [x1, y1 - 1.15, W.HW],
        [x1, y1, W.HW], [x0, y0, W.HW], fc);
      var fc2 = U.css([8 + 80 * L, 9 + 48 * L, 11 + 20 * L]);
      quad(ctx, cam,
        [x0, y0 - 1.15, -W.HW], [x1, y1 - 1.15, -W.HW],
        [x1, y1, -W.HW], [x0, y0, -W.HW], fc2);
    }
    /* センターライン */
    {
      ctx.globalAlpha = 0.5;
      for (k = 0; k < 40; k++) {
        var xx = W.RX0 + k * 42, xe = xx + 20;
        if (xx > W.RX1) break;
        if (cam.pos[1] < W.roadY(xx) + 0.6) continue;
        quad(ctx, cam, [xx, W.roadY(xx) + 0.02, -0.16], [xe, W.roadY(xe) + 0.02, -0.16],
          [xe, W.roadY(xe) + 0.02, 0.16], [xx, W.roadY(xx) + 0.02, 0.16], 'rgba(200,196,180,0.55)');
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawRails(cam, S) {
    for (var i = 0; i < W.rails.length; i++) {
      var r = W.rails[i];
      for (var s = 0; s < 2; s++) {
        var z = s === 0 ? -W.ROAD_HW - 0.2 : W.ROAD_HW + 0.2;
        for (var h = 0; h < 2; h++) {
          var dy = h === 0 ? 0.45 : 1.05;
          cam.pr(r.x0, r.y0 + dy, z, a); if (!a.vis) continue;
          cam.pr(r.x1, r.y1 + dy, z, b); if (!b.vis) continue;
          var ci = Math.round(lightAt(S, (r.x0 + r.x1) * 0.5, W.DECK_Y + 1) * 13) | 0;
          LB.add(a.x, a.y, b.x, b.y, ci, Math.max(0.5 * S_, 0.09 * (a.s + b.s)));
        }
      }
    }
  }

  function drawLamps(cam, S) {
    var on = (1 - S.dusk * 0.55);
    for (var i = 0; i < W.lamps.length; i++) {
      var lp = W.lamps[i];
      cam.pr(lp.x, lp.y, lp.z, a); if (!a.vis) continue;
      cam.pr(lp.x, lp.y + lp.h, lp.z, b); if (!b.vis) continue;
      if (b.x < -40 || b.x > Wp + 40) continue;
      var ci = Math.round(lightAt(S, lp.x, W.DECK_Y + 2) * 13) | 0;
      LB.add(a.x, a.y, b.x, b.y, ci, Math.max(0.5 * S_, 0.12 * a.s));
      LB.add(b.x, b.y, b.x + 1.1 * b.s, b.y - 0.15 * b.s, ci, Math.max(0.5 * S_, 0.11 * b.s));
      /* あかり */
      var gw = Math.min(Math.max(11 * S_, 5.4 * b.s), 62 * S_) * (1 + S.bulb * 0.06);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.80 * on;
      ctx.drawImage(FX.lampGlow, b.x + 1.1 * b.s - gw * 0.5, b.y - gw * 0.5, gw, gw);
      cam.pr(lp.x, lp.y + 0.06, lp.z + 3.0, c);
      if (c.vis) {
        var pw = Math.min(Math.max(10 * S_, 2.6 * c.s), 90 * S_);
        ctx.globalAlpha = 0.30 * on;
        ctx.drawImage(FX.lampGlow, c.x - pw * 0.9, c.y - pw * 0.16, pw * 1.8, pw * 0.32);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawCars(cam, S) {
    var cars = S.cars;
    for (var i = 0; i < cars.length; i++) {
      var cr = cars[i];
      var y = W.roadY(cr.x);
      var z = cr.dir > 0 ? 1.7 : -1.7;
      /* 車体 */
      quad(ctx, cam,
        [cr.x - 2.1, y, z - 0.85], [cr.x + 2.1, y, z - 0.85],
        [cr.x + 2.1, y + 1.35, z - 0.85], [cr.x - 2.1, y + 1.35, z - 0.85], 'rgba(16,17,22,0.95)');
      /* 前照灯・尾灯 */
      cam.pr(cr.x + cr.dir * 2.2, y + 0.65, z, a);
      if (a.vis) {
        var gw = Math.max(7 * S_, 2.3 * a.s);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.9;
        ctx.drawImage(cr.dir > 0 ? FX.coolGlow : FX.redGlow, a.x - gw * 0.5, a.y - gw * 0.5, gw, gw);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      cam.pr(cr.x - cr.dir * 2.2, y + 0.65, z, a);
      if (a.vis) {
        gw = Math.max(5 * S_, 1.6 * a.s);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8;
        ctx.drawImage(cr.dir > 0 ? FX.redGlow : FX.coolGlow, a.x - gw * 0.5, a.y - gw * 0.5, gw, gw);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  /* 通行止め */
  function drawBarrier(cam, S) {
    if (S.barrier <= 0.001) return;
    var t = U.easeOut(S.barrier);
    for (var side = 0; side < 2; side++) {
      var bx = side === 0 ? W.BAR_X : (W.RX1 - (W.X0 - W.BAR_X));
      var by = W.roadY(bx);
      var drop = (1 - t) * 3.2;
      for (var i = 0; i < 3; i++) {
        var z0 = -3.6 + i * 2.4, z1 = z0 + 2.15;
        var yy = by + 0.95 - drop;
        /* 板 */
        quad(ctx, cam, [bx, yy, z0], [bx, yy, z1], [bx, yy + 0.42, z1], [bx, yy + 0.42, z0], '#e8e2d6');
        quad(ctx, cam, [bx, yy - 0.5, z0], [bx, yy - 0.5, z1], [bx, yy - 0.08, z1], [bx, yy - 0.08, z0], '#e8e2d6');
        /* 斜め縞 */
        for (var s2 = 0; s2 < 4; s2++) {
          var za = z0 + s2 * 0.54, zb = za + 0.28;
          quad(ctx, cam, [bx - 0.02, yy, za], [bx - 0.02, yy, zb], [bx - 0.02, yy + 0.42, zb + 0.16], [bx - 0.02, yy + 0.42, za + 0.16], '#e8631d');
          quad(ctx, cam, [bx - 0.02, yy - 0.5, za], [bx - 0.02, yy - 0.5, zb], [bx - 0.02, yy - 0.08, zb + 0.16], [bx - 0.02, yy - 0.08, za + 0.16], '#e8631d');
        }
        /* 脚 */
        cam.pr(bx, by, z0 + 0.2, a); cam.pr(bx, yy + 0.42, z0 + 0.9, b);
        if (a.vis && b.vis) LB.add(a.x, a.y, b.x, b.y, 9, Math.max(1 * S_, 0.1 * a.s));
        cam.pr(bx, by, z1 - 0.2, a); cam.pr(bx, yy + 0.42, z1 - 0.9, b);
        if (a.vis && b.vis) LB.add(a.x, a.y, b.x, b.y, 9, Math.max(1 * S_, 0.1 * a.s));
        /* 点滅灯 */
        var blink = (Math.sin(S.time * 6.0 + i * 2.1) > 0.1) ? 1 : 0.06;
        cam.pr(bx, yy + 0.62, (z0 + z1) * 0.5, a);
        if (a.vis) {
          var gw = Math.max(10 * S_, 2.6 * a.s) * t;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.95 * blink * t;
          ctx.drawImage(FX.halo, a.x - gw * 0.5, a.y - gw * 0.5, gw, gw);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      /* 通行止めの標識 */
      var sy = by + 1.0 - drop;
      cam.pr(bx + 0.4, sy + 1.5, 4.6, a);
      if (a.vis) {
        var rr = Math.max(4 * S_, 0.62 * a.s);
        ctx.beginPath(); ctx.arc(a.x, a.y, rr, 0, 6.284);
        ctx.fillStyle = '#c8302a'; ctx.fill();
        ctx.lineWidth = Math.max(1, rr * 0.16); ctx.strokeStyle = '#f2ece0'; ctx.stroke();
        ctx.fillStyle = '#f2ece0';
        ctx.fillRect(a.x - rr * 0.62, a.y - rr * 0.16, rr * 1.24, rr * 0.32);
        cam.pr(bx + 0.4, by, 4.6, b);
        if (b.vis) LB.add(a.x, a.y + rr, b.x, b.y, 8, Math.max(1 * S_, 0.08 * a.s));
      }
    }
  }

  /* 水に映る橋の影 */
  function drawSilhouette(cx, cam, S) {
    var col = 'rgba(0,0,0,1)';
    var i, k, sp;
    for (i = 0; i < W.piers.length; i++) {
      var p = W.piers[i];
      if (!p.water) continue;
      quad(cx, cam, [p.x - p.hw, -p.base, p.hz], [p.x + p.hw, -p.base, p.hz],
        [p.x + p.hw * 0.72, -p.top, p.hz], [p.x - p.hw * 0.72, -p.top, p.hz], col);
    }
    for (k = 0; k < W.SPAN_N; k++) {
      sp = W.spans[k];
      quad(cx, cam, [sp.x0, -(W.LOW_Y - 1.3), W.HW], [sp.x1, -(W.LOW_Y - 1.3), W.HW],
        [sp.x1, -(W.DECK_Y + 0.4), W.HW], [sp.x0, -(W.DECK_Y + 0.4), W.HW], col);
    }
    cx.strokeStyle = col;
    for (k = 0; k < W.SPAN_N; k++) {
      sp = W.spans[k];
      var list = sp.main;
      for (i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.side !== 1) continue;
        cam.pr(m.a[0], -m.a[1], m.a[2], a); if (!a.vis) continue;
        cam.pr(m.b[0], -m.b[1], m.b[2], b); if (!b.vis) continue;
        cx.lineWidth = Math.max(1, m.th * (a.s + b.s) * 0.5);
        cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
      }
    }
  }

  function compositeDark(cam, S) {
    var hz = cam.horizonY();
    var top = Math.max(0, hz);
    if (top >= Hp) return;
    ctx.save();
    if (!_waterPath) { ctx.restore(); return; }
    ctx.clip(_waterPath);
    smear(darkC, S, 0.72 * (1 - 0.82 * U.clamp(S.fire * S.ignTotal, 0, 1)), 'source-over', 0.7);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ---------- 火のカーテン ---------- */
  function drawCurtain(cx, cam, S, mirror, alphaMul) {
    var my = mirror ? -1 : 1;
    cx.globalCompositeOperation = 'lighter';
    var step = 8;
    for (var i = 0; i < W.SEG; i += step) {
      var ig = 0;
      for (var j = 0; j < step && i + j < W.SEG; j++) ig = Math.max(ig, S.ign[i + j]);
      ig *= S.fire;
      if (ig < 0.02) continue;
      var x0 = W.segX(i) - W.SEG_L * 0.55, x1 = W.segX(Math.min(W.SEG - 1, i + step - 1)) + W.SEG_L * 0.55;
      var yTop = W.LOW_Y - 0.3, yBot = 0.4;
      cam.pr(x0, yTop * my, W.CURTAIN_Z, a); if (!a.vis) continue;
      cam.pr(x1, yTop * my, W.CURTAIN_Z, b); if (!b.vis) continue;
      cam.pr(x1, yBot * my, W.CURTAIN_Z, c); if (!c.vis) continue;
      cam.pr(x0, yBot * my, W.CURTAIN_Z, d); if (!d.vis) continue;
      if ((a.x < -40 && b.x < -40) || (a.x > cam.w + 40 && b.x > cam.w + 40)) continue;
      var gr = cx.createLinearGradient((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (c.x + d.x) * 0.5, (c.y + d.y) * 0.5);
      var pw = Math.abs(b.x - a.x);
      if (pw < 2.5 * S_) continue;
      var A = ig * alphaMul * U.clamp(pw / (14 * S_), 0, 1) * (a.z > 380 ? Math.max(0.20, 1.24 - a.z / 1200) : 1);
      gr.addColorStop(0, 'rgba(255,236,190,' + (0.30 * A).toFixed(3) + ')');
      gr.addColorStop(0.16, 'rgba(255,199,112,' + (0.22 * A).toFixed(3) + ')');
      gr.addColorStop(0.48, 'rgba(255,154,56,' + (0.13 * A).toFixed(3) + ')');
      gr.addColorStop(0.86, 'rgba(255,118,30,' + (0.05 * A).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(255,110,26,0)');
      cx.beginPath();
      cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.lineTo(c.x, c.y); cx.lineTo(d.x, d.y);
      cx.closePath();
      cx.fillStyle = gr; cx.fill();
      /* 滝つぼの光 */
      var wx = (c.x + d.x) * 0.5, wy = (c.y + d.y) * 0.5;
      var ww = Math.abs(c.x - d.x) * 2.2 + 12;
      cx.globalAlpha = 0.16 * A;
      cx.drawImage(FX.halo, wx - ww * 0.5, wy - ww * 0.16, ww, ww * 0.32);
      cx.globalAlpha = 1;
      /* 桁の下端の光の線 */
      cx.strokeStyle = 'rgba(255,242,214,' + (0.55 * A).toFixed(3) + ')';
      cx.lineWidth = Math.max(1, 0.30 * a.s);
      cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
    }
    cx.globalCompositeOperation = 'source-over';
  }

  function drawFuseHead(cx, cam, S, mirror, alphaMul) {
    if (!S.fuseOn) return;
    var my = mirror ? -1 : 1;
    cam.pr(S.fuseX, (W.LOW_Y + 0.2) * my, W.CURTAIN_Z, a);
    if (!a.vis) return;
    var gw = Math.max(64, 26 * a.s) * (0.88 + 0.12 * Math.sin(S.time * 30));
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = 0.9 * alphaMul;
    cx.drawImage(FX.halo, a.x - gw * 0.5, a.y - gw * 0.5, gw, gw);
    cx.globalAlpha = 0.75 * alphaMul;
    cx.drawImage(FX.halo, a.x - gw * 0.22, a.y - gw * 0.22, gw * 0.44, gw * 0.44);
    /* 尾を引く */
    cx.globalAlpha = 0.42 * alphaMul;
    cx.drawImage(FX.halo, a.x - gw * 2.6, a.y - gw * 0.30, gw * 3.1, gw * 0.60);
    cx.globalAlpha = 0.30 * alphaMul;
    cx.drawImage(FX.halo, a.x - gw * 0.55, a.y - gw * 1.5, gw * 1.1, gw * 3.0);
    cx.globalAlpha = 1;
    cx.globalCompositeOperation = 'source-over';
  }

  /* 水面にのびる光の道。ここが夜景の主役になる */
  function drawGlitter(cam, S) {
    if (S.fire < 0.02 || R.off.glitter) return;
    var hz = cam.horizonY();
    cam.pr(W.MID, 0, 0, e);
    var y0 = e.vis ? e.y : hz;
    if (y0 > Hp) return;
    cam.pr(W.X0, 0, 0, a); cam.pr(W.X1, 0, 0, b);
    var xa = a.vis ? a.x : 0, xb = b.vis ? b.x : Wp;
    if (xa > xb) { var t0 = xa; xa = xb; xb = t0; }
    var amt = U.clamp(S.ignTotal, 0, 1) * S.fire;
    ctx.save();
    if (!_waterPath) { ctx.restore(); return; }
    ctx.clip(_waterPath);
    ctx.globalCompositeOperation = 'lighter';
    /* 広がる光の帯 */
    var gr = ctx.createLinearGradient(0, y0, 0, Hp);
    gr.addColorStop(0, 'rgba(255,206,124,0)');
    gr.addColorStop(0.06, 'rgba(255,196,110,' + (0.085 * amt).toFixed(3) + ')');
    gr.addColorStop(0.32, 'rgba(255,166,74,' + (0.046 * amt).toFixed(3) + ')');
    gr.addColorStop(0.74, 'rgba(255,140,50,' + (0.016 * amt).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(255,130,40,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, y0, Wp, Hp - y0);
    /* きらめき */
    var rr = U.rng(4711);
    var n = S.quality > 0 ? 220 : 120;
    for (var i = 0; i < n; i++) {
      var u = rr(), v = rr(), w0 = rr(), ph = rr();
      var yy = y0 + Math.pow(v, 1.35) * (Hp - y0);
      var depth = (yy - y0) / Math.max(1, Hp - y0);
      var xx = U.lerp(xa - Wp * 0.25, xb + Wp * 0.25, u) + (w0 - 0.5) * Wp * 0.22 * depth;
      var fl = 0.5 + 0.5 * Math.sin(S.time * (2.2 + ph * 5) + i * 1.7);
      var al = amt * fl * (0.5 - depth * 0.34);
      if (al <= 0.01) continue;
      var lw = (2 + w0 * 16) * S_ * (0.35 + depth * 2.2);
      ctx.fillStyle = 'rgba(255,' + (190 - (depth * 55) | 0) + ',' + (110 - (depth * 55) | 0) + ',' + al.toFixed(3) + ')';
      ctx.fillRect(xx - lw * 0.5, yy, lw, Math.max(1, 1.3 * S_ * (0.5 + depth)));
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /* ---------- 前景 ---------- */
  function drawForeground(cam, S) {
    var hz = cam.horizonY();
    var y0 = Math.max(0, hz);
    /* 砂利 */
    ctx.globalAlpha = 0.5;
    for (var i = 0; i < R.gravel.length; i++) {
      var gv = R.gravel[i];
      var yy = y0 + Math.pow(gv[1], 0.55) * (Hp - y0);
      if (yy < Hp * 0.72) continue;
      var sz = (0.6 + gv[2] * 1.8) * S_ * (0.4 + (yy - y0) / Hp);
      ctx.fillStyle = 'rgba(150,148,140,' + (0.05 + gv[2] * 0.07).toFixed(3) + ')';
      ctx.fillRect(gv[0] * Wp, yy, sz, sz * 0.7);
    }
    ctx.globalAlpha = 1;
    /* 火が河川敷を照らす */
    if (S.fire > 0.02) {
      var lg2 = ctx.createLinearGradient(0, Math.max(0, hz), 0, Hp);
      var la = 0.075 * S.fire * U.clamp(S.ignTotal, 0, 1);
      lg2.addColorStop(0, 'rgba(255,168,86,' + la.toFixed(3) + ')');
      lg2.addColorStop(0.45, 'rgba(255,140,60,' + (la * 0.45).toFixed(3) + ')');
      lg2.addColorStop(1, 'rgba(255,120,50,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = lg2;
      ctx.fillRect(0, Math.max(0, hz), Wp, Hp - Math.max(0, hz));
      ctx.globalCompositeOperation = 'source-over';
    }

    /* 手前の草むら */
    if (cam.pos[1] < 14) {
      var bh = Hp * (0.055 + 0.05 * U.clamp(1 - cam.pos[1] / 14, 0, 1));
      ctx.beginPath();
      ctx.moveTo(0, Hp + 2);
      var n = 64;
      for (i = 0; i <= n; i++) {
        var gx = i / n;
        var gy = Hp - bh * (0.35 + 0.65 * Math.abs(Math.sin(gx * 21.7 + 1.2) * Math.sin(gx * 6.3)))
          - bh * 0.25 * Math.sin(gx * 3.1 + S.time * 0.25);
        ctx.lineTo(gx * Wp, gy);
      }
      ctx.lineTo(Wp, Hp + 2);
      ctx.closePath();
      ctx.fillStyle = 'rgb(2,2,3)';
      ctx.fill();
    }

    /* 見物人のシルエット */
    if (S.crowd > 0.01) {
      for (i = 0; i < R.crowd.length; i++) {
        var cw = R.crowd[i];
        /* 岸に沿って並ぶ */
        var z = cam.pos[2] + 18 - cw[1] * 330;
        var x = W.bankL(z) - 2 - cw[0] * 52 - cw[3] * 18;
        if (x > W.bankL(z)) continue;
        cam.pr(x, 0, z, a); if (!a.vis) continue;
        var hgt = (1.15 + cw[2] * 0.62) * a.s;
        var wd = hgt * 0.30;
        if (a.y - hgt > Hp || a.x < -wd * 2 || a.x > Wp + wd * 2) continue;
        ctx.globalAlpha = S.crowd;
        ctx.fillStyle = 'rgb(2,2,4)';
        /* 頭 */
        ctx.beginPath();
        ctx.ellipse(a.x, a.y - hgt * 0.88, wd * 0.30, hgt * 0.115, 0, 0, 6.284);
        ctx.fill();
        /* 肩から下 */
        ctx.beginPath();
        ctx.moveTo(a.x - wd * 0.30, a.y - hgt * 0.78);
        ctx.quadraticCurveTo(a.x - wd * 0.62, a.y - hgt * 0.70, a.x - wd * 0.56, a.y - hgt * 0.40);
        ctx.lineTo(a.x - wd * 0.48, a.y);
        ctx.lineTo(a.x + wd * 0.48, a.y);
        ctx.lineTo(a.x + wd * 0.56, a.y - hgt * 0.40);
        ctx.quadraticCurveTo(a.x + wd * 0.62, a.y - hgt * 0.70, a.x + wd * 0.30, a.y - hgt * 0.78);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawGrade(cam, S) {
    /* 周辺減光 */
    var vg = ctx.createRadialGradient(Wp * 0.5, Hp * 0.52, Math.min(Wp, Hp) * 0.28,
      Wp * 0.5, Hp * 0.52, Math.max(Wp, Hp) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.65, 'rgba(0,0,0,0.20)');
    vg.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, Wp, Hp);
    /* 粒子 */
    if (S.quality > 0 && !R.off.grain) {
      ctx.globalAlpha = 0.045;
      ctx.globalCompositeOperation = 'overlay';
      var t = (S.time * 7) | 0;
      var ox = (t % 5) * 23, oy = (t % 7) * 17;
      ctx.drawImage(noiseFull, -ox, -oy, Wp + 40, Hp + 40);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- 1 フレーム ---------- */
  R.draw = function (cam, S) {
    cam.viewport(Wp, Hp);
    buildPalette(S);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#04060b';
    ctx.fillRect(0, 0, Wp, Hp);

    buildWater(cam);
    drawSky(cam, S);
    drawFarShore(cam, S);
    drawGroundAndWater(cam, S);
    drawShore(cam, S);

    /* 水に映る橋の影 */
    var darkA = 0.72 * (1 - 0.82 * U.clamp(S.fire * S.ignTotal, 0, 1));
    if (darkA > 0.03) {
    darkX.setTransform(1, 0, 0, 1, 0, 0);
    darkX.clearRect(0, 0, darkC.width, darkC.height);
    darkX.save();
    darkX.scale(0.5, 0.5);
    drawSilhouette(darkX, cam, S);
    darkX.restore();
    fadeBuffer(darkX, darkC, cam, 0.92);
    compositeDark(cam, S);
    }

    /* 映り込み用のバッファ */
    reflX.setTransform(1, 0, 0, 1, 0, 0);
    reflX.clearRect(0, 0, reflC.width, reflC.height);
    reflX.save();
    reflX.scale(0.5, 0.5);
    drawCurtain(reflX, cam, S, true, 1.0);
    FX.draw(reflX, cam, true, 3, 1.15);
    drawFuseHead(reflX, cam, S, true, 0.7);
    reflectLights(reflX, cam, S);
    reflX.restore();
    fadeBuffer(reflX, reflC, cam, 0.88);
    drawReflection(cam, S);

    /* 橋 */
    drawEmbankment(cam, S);
    drawPiers(cam, S);
    var lods = [];
    for (var k = 0; k < W.SPAN_N; k++) {
      var sp = W.spans[k];
      cam.pr(sp.x0, W.DECK_Y, 0, a); cam.pr(sp.x1, W.DECK_Y, 0, b);
      lods[k] = (a.vis && b.vis) ? Math.abs(b.x - a.x) : 0;
    }
    if (!R.off.truss) for (k = 0; k < W.SPAN_N; k++) {
      if (lods[k] > 26) drawMembers(cam, S, W.spans[k].det, -1, lods[k]);
      drawMembers(cam, S, W.spans[k].main, -1, lods[k]);
    }
    LB.flush(ctx, PAL);
    drawDeck(cam, S);
    if (!R.off.truss) for (k = 0; k < W.SPAN_N; k++) {
      if (lods[k] > 26) {
        drawMembers(cam, S, W.spans[k].det, 1, lods[k]);
        drawMembers(cam, S, W.spans[k].det, 0, lods[k]);
      }
      drawMembers(cam, S, W.spans[k].main, 1, lods[k]);
      drawMembers(cam, S, W.spans[k].main, 0, lods[k]);
    }
    drawRails(cam, S);
    drawBarrier(cam, S);
    LB.flush(ctx, PAL);
    drawLamps(cam, S);
    drawCars(cam, S);

    /* 火 */
    fireX.setTransform(1, 0, 0, 1, 0, 0);
    fireX.clearRect(0, 0, fireC.width, fireC.height);
    if (!R.off.fire) {
      fireX.save();
      fireX.scale(0.5, 0.5);
      drawCurtain(fireX, cam, S, false, 1);
      FX.draw(fireX, cam, false, 1, 1);
      drawFuseHead(fireX, cam, S, false, 1);
      fireX.restore();
    }

    ctx.globalCompositeOperation = 'lighter';
    if (!R.off.fire) ctx.drawImage(fireC, 0, 0, Wp, Hp);

    /* にじみ */
    if (!R.off.bloom) {
    glowX.setTransform(1, 0, 0, 1, 0, 0);
    glowX.clearRect(0, 0, glowC.width, glowC.height);
    glowX.drawImage(fireC, 0, 0, glowC.width, glowC.height);
    ctx.globalAlpha = 0.78;
    ctx.drawImage(glowC, -Wp * 0.018, -Hp * 0.018, Wp * 1.036, Hp * 1.036);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    drawGlitter(cam, S);
    FX.drawSmoke(ctx, cam, S);
    drawForeground(cam, S);
    drawGrade(cam, S);
  };

  /* 水に映る灯り (街灯・車) */
  function reflectLights(cx, cam, S) {
    var on = (1 - S.dusk * 0.55) * 0.9;
    cx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < W.lamps.length; i++) {
      var lp = W.lamps[i];
      if (lp.x < W.BANK_L - 20 || lp.x > W.BANK_R + 20) continue;
      cam.pr(lp.x, -(lp.y + lp.h), lp.z, a); if (!a.vis) continue;
      var gw = Math.max(6, 3.0 * a.s);
      cx.globalAlpha = 0.5 * on;
      cx.drawImage(FX.lampGlow, a.x - gw * 0.5, a.y - gw * 0.5, gw, gw);
    }
    cx.globalAlpha = 1;
    cx.globalCompositeOperation = 'source-over';
  }

  R.size = function () { return [Wp, Hp]; };
})(window);
