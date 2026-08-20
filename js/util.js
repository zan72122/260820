/* util.js - 数学・スプライト生成などの小物 */
(function (g) {
  'use strict';
  var NB = g.NB = g.NB || {};

  var U = NB.U = {};

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.smooth = function (t) { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  U.smoother = function (t) { t = U.clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
  U.easeOut = function (t) { t = U.clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
  U.easeInOut = function (t) { return U.smoother(t); };
  U.map = function (v, a, b, c, d) { return c + (d - c) * U.clamp((v - a) / (b - a), 0, 1); };

  /* 決定論的な乱数 (景色の再現性のため) */
  U.rng = function (seed) {
    var s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.mix3 = function (a, b, t, out) {
    out = out || [0, 0, 0];
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  };
  U.css = function (c, a) {
    var r = c[0] | 0, gg = c[1] | 0, b = c[2] | 0;
    if (a === undefined) return 'rgb(' + r + ',' + gg + ',' + b + ')';
    return 'rgba(' + r + ',' + gg + ',' + b + ',' + a + ')';
  };

  U.canvas = function (w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    return c;
  };

  /* 放射状のやわらかい光。火の粉・街灯・にじみに使う */
  U.glow = function (size, stops) {
    var c = U.canvas(size, size), x = c.getContext('2d');
    var gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (var i = 0; i < stops.length; i++) gr.addColorStop(stops[i][0], stops[i][1]);
    x.fillStyle = gr; x.fillRect(0, 0, size, size);
    return c;
  };

  /* 火の粉スプライト: stage 0(白熱) → 5(消えかけの赤) */
  U.fireSprite = function (stage, size) {
    var t = stage / 5;
    var core = [255 - 0 * t, 255 - 130 * t, 255 - 215 * t];
    var mid = [255, 216 - 130 * t, 130 - 110 * t];
    var out = [255 - 40 * t, 140 - 90 * t, 40 - 25 * t];
    var aC = 1 - 0.35 * t, aM = 0.62 - 0.30 * t, aO = 0.20 - 0.11 * t;
    return U.glow(size, [
      [0.00, U.css(core, aC)],
      [0.13, U.css(core, aC * 0.92)],
      [0.30, U.css(mid, aM)],
      [0.60, U.css(out, aO)],
      [1.00, U.css(out, 0)]
    ]);
  };

  /* もやもやした煙 */
  U.smokeSprite = function (size, seed) {
    var c = U.canvas(size, size), x = c.getContext('2d');
    var r = U.rng(seed);
    for (var i = 0; i < 7; i++) {
      var rad = size * (0.16 + r() * 0.20);
      var cx = size / 2 + (r() - 0.5) * size * 0.42;
      var cy = size / 2 + (r() - 0.5) * size * 0.42;
      var gr = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.22)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0.09)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, size, size);
    }
    /* 縁を落として四角さを消す */
    var vg = x.createRadialGradient(size / 2, size / 2, size * 0.22, size / 2, size / 2, size * 0.5);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = vg; x.fillRect(0, 0, size, size);
    return c;
  };

  /* フィルム粒子 */
  U.noiseTile = function (size, seed) {
    var c = U.canvas(size, size), x = c.getContext('2d');
    var img = x.createImageData(size, size), d = img.data, r = U.rng(seed);
    for (var i = 0; i < d.length; i += 4) {
      var v = 118 + (r() - 0.5) * 150;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  };

  /* スプライトに色を付ける */
  U.tint = function (src, color) {
    var c = U.canvas(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, src.width, src.height);
    return c;
  };

  U.now = function () { return (g.performance && g.performance.now) ? g.performance.now() : Date.now(); };

})(window);
