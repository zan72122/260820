/* 長岡花火 正三尺玉 : 玉と星（パーティクル）
   三尺玉は「重い・遠い・大きい」が命なので、上昇はゆっくり、開花は一気に、消えぎわは長く。 */
window.NFFire = (function () {

  /* 色は増やしすぎない。毎回の型は同じで、色だけが変わる */
  var PALETTES = [
    { name: 'きん',   core: [255, 244, 214], shell: [255, 206, 108], shift: [255, 128, 48],  pistil: [255, 240, 190], wash: [255, 196, 118] },
    { name: 'べに',   core: [255, 236, 236], shell: [255, 118, 128], shift: [255, 208, 120], pistil: [140, 240, 190], wash: [255, 140, 130] },
    { name: 'あお',   core: [236, 246, 255], shell: [130, 190, 255], shift: [220, 240, 255], pistil: [255, 232, 160], wash: [150, 190, 255] },
    { name: 'みどり', core: [240, 255, 240], shell: [150, 240, 160], shift: [255, 224, 130], pistil: [255, 170, 200], wash: [160, 235, 170] }
  ];

  var sprite = null, sprR = 40, tinted = {};
  function radial(col, hot) {
    var c = document.createElement('canvas');
    c.width = c.height = sprR * 2;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(sprR, sprR, 0, sprR, sprR, sprR);
    grd.addColorStop(0, 'rgba(255,255,255,' + (hot ? 1 : 0.95) + ')');
    grd.addColorStop(0.10, 'rgba(' + col + ',0.98)');
    grd.addColorStop(0.28, 'rgba(' + col + ',0.42)');
    grd.addColorStop(0.55, 'rgba(' + col + ',0.12)');
    grd.addColorStop(1, 'rgba(' + col + ',0)');
    g.fillStyle = grd; g.fillRect(0, 0, sprR * 2, sprR * 2);
    return c;
  }
  function tint(c) {
    var key = c[0] + ',' + c[1] + ',' + c[2];
    var s = tinted[key];
    if (!s) { s = tinted[key] = radial(key, true); }
    return s;
  }
  function makeSprite() { if (!sprite) sprite = radial('255,255,255', true); }

  function Field(quality) {
    this.q = quality || 1;
    this.stars = [];
    this.trail = [];          // 昇る玉の火の粉
    this.smoke = [];
    this.tint = null;
    makeSprite();
  }

  Field.prototype.reset = function () { this.stars.length = 0; this.trail.length = 0; this.smoke.length = 0; this.core = null; };

  /* 前フレームの位置との間に散らして置く。フレームが落ちても尾が途切れない */
  Field.prototype.addTrail = function (x, y, px, py, vy, n) {
    for (var i = 0; i < n; i++) {
      var hot = Math.random() < 0.22, f = (i + Math.random()) / n;
      var ex = px + (x - px) * f, ey = py + (y - py) * f;
      this.trail.push({
        x: ex + (Math.random() - 0.5) * 14, y: ey + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 70,
        vy: vy * 0.34 + (Math.random() - 0.5) * 60 - 20,   // 玉の勢いを少し受け継いで尾を伸ばす
        life: 0, max: 0.55 + Math.random() * 0.85,
        size: (hot ? 22 : 14) + Math.random() * 16,
        c: hot ? [255, 244, 214] : [255, 172, 78]
      });
    }
  };

  /* 開花: 芯入り二重の大輪。星は速度差と空気抵抗で球状に広がってから垂れる */
  Field.prototype.burst = function (x, y, pal, scale) {
    this.tint = pal;
    var q = this.q, s = scale || 1;
    var outer = Math.round(400 * q), inner = Math.round(155 * q);
    this.core = { life: 0, max: 0.55, x: x, y: y };
    var i, a, sp, e;

    for (i = 0; i < outer; i++) {
      a = Math.random() * 6.2832;
      e = Math.acos(2 * Math.random() - 1);                 // 球面に均等
      sp = (470 + Math.random() * 80) * s * (0.80 + 0.20 * Math.sin(e));
      this.stars.push(mkStar(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.95, {
        k: 0.70 + Math.random() * 0.10, gg: 56,
        max: 3.8 + Math.random() * 1.7,
        size: (22 + Math.random() * 15) * s,
        c1: pal.shell, c2: pal.shift, shiftAt: 0.42 + Math.random() * 0.14,
        twinkle: Math.random() < 0.45
      }));
    }
    for (i = 0; i < inner; i++) {                            // 芯（内側のもう一輪）
      a = Math.random() * 6.2832;
      e = Math.acos(2 * Math.random() - 1);
      sp = (250 + Math.random() * 55) * s * (0.80 + 0.20 * Math.sin(e));
      this.stars.push(mkStar(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.95, {
        k: 1.00 + Math.random() * 0.12, gg: 50,
        max: 2.9 + Math.random() * 1.2,
        size: (18 + Math.random() * 11) * s,
        c1: pal.pistil, c2: pal.pistil, shiftAt: 2,
        twinkle: Math.random() < 0.3
      }));
    }
    for (i = 0; i < 14; i++) {                               // 火薬の煙（薄く、あとを引く）
      this.smoke.push({
        x: x + (Math.random() - 0.5) * 220, y: y + (Math.random() - 0.5) * 200,
        r: 60 + Math.random() * 80, vr: 46 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 30 + 10,
        life: 0, max: 5 + Math.random() * 3
      });
    }
  };

  /* 星は「指数減衰する空気抵抗 + 重力」の解析解で動かす。
     こうすると t-T 秒前の位置も一発で出せるので、燃えた軌跡そのものを尾として描ける。
       x(t) = x0 + vx0 * f(t)
       y(t) = y0 + (vy0 + g/k) * f(t) - (g/k) * t          f(t) = (1 - e^(-k t)) / k   */
  function mkStar(x, y, vx, vy, o) {
    return {
      x0: x, y0: y, vx: vx, vy: vy, k: o.k, gg: o.gg,
      x: x, y: y, tx: x, ty: y, mx: x, my: y,
      life: 0, max: o.max, size: o.size,
      c1: o.c1, c2: o.c2, shiftAt: o.shiftAt,
      twinkle: o.twinkle, ph: Math.random() * 6.28
    };
  }
  function posX(p, t) { return p.x0 + p.vx * (1 - Math.exp(-p.k * t)) / p.k; }
  function posY(p, t) {
    var vt = p.gg / p.k;
    return p.y0 + (p.vy + vt) * (1 - Math.exp(-p.k * t)) / p.k - vt * t;
  }

  Field.prototype.update = function (dt) {
    var i, p;
    if (this.core) { this.core.life += dt; if (this.core.life > this.core.max) this.core = null; }
    for (i = this.stars.length - 1; i >= 0; i--) {
      p = this.stars[i];
      p.life += dt;
      var t = p.life, T = Math.min(t, 0.42);
      p.x = posX(p, t); p.y = posY(p, t);
      p.mx = posX(p, t - T * 0.5); p.my = posY(p, t - T * 0.5);
      p.tx = posX(p, t - T); p.ty = posY(p, t - T);
      if (p.life > p.max || p.y < 30) this.stars.splice(i, 1);   // 対岸の向こうに落ちた星は消す
    }
    for (i = this.trail.length - 1; i >= 0; i--) {
      p = this.trail[i];
      p.life += dt;
      p.vx *= Math.pow(0.45, dt); p.vy *= Math.pow(0.45, dt);
      p.vy -= 150 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life > p.max) this.trail.splice(i, 1);
    }
    for (i = this.smoke.length - 1; i >= 0; i--) {
      p = this.smoke[i];
      p.life += dt; p.r += p.vr * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life > p.max) this.smoke.splice(i, 1);
    }
  };

  Field.prototype.count = function () { return this.stars.length + this.trail.length; };

  /* 星は「白い光の玉」+「色の被せ」で描くと、芯が白く飛んで本物っぽくなる */
  Field.prototype.draw = function (g, cam) {
    g.globalCompositeOperation = 'lighter';

    // 煙（光を受けて薄く見える）
    for (var s = 0; s < this.smoke.length; s++) {
      var m = this.smoke[s], k = 1 - m.life / m.max;
      var sx = cam.sx(m.x), sy = cam.sy(m.y), sr = m.r * cam.s;
      if (sr < 1) continue;
      g.globalAlpha = 0.020 * k;
      g.drawImage(sprite, sx - sr, sy - sr, sr * 2, sr * 2);
    }

    if (this.core) {                                        // 割れた瞬間の白い芯
      var ck = this.core.life / this.core.max;
      var cr = (40 + 420 * Math.pow(ck, 0.45)) * cam.s;
      var cx = cam.sx(this.core.x), cy = cam.sy(this.core.y);
      g.globalAlpha = Math.pow(1 - ck, 1.7);
      g.drawImage(sprite, cx - cr, cy - cr, cr * 2, cr * 2);
    }

    var i, p, k2, col, a;
    for (i = 0; i < this.stars.length; i++) {
      p = this.stars[i];
      k2 = p.life / p.max;
      a = k2 < 0.06 ? k2 / 0.06 : Math.pow(1 - k2, 1.4);
      if (p.twinkle && k2 > 0.55) a *= 0.35 + 0.65 * Math.abs(Math.sin(p.life * 26 + p.ph));
      if (a <= 0.01) continue;
      col = k2 < p.shiftAt ? p.c1 : p.c2;

      // 尾は「燃えながら通ってきた道」そのもの
      var x2 = cam.sx(p.x), y2 = cam.sy(p.y);
      g.globalAlpha = a * 0.40;
      g.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',1)';
      g.lineWidth = Math.max(0.9, p.size * cam.s * 0.28);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(cam.sx(p.tx), cam.sy(p.ty));
      g.lineTo(cam.sx(p.mx), cam.sy(p.my));
      g.lineTo(x2, y2);
      g.stroke();

      var sr2 = p.size * cam.s * (k2 < 0.1 ? 1.8 : 1);       // 光の玉
      if (sr2 > 0.3) {
        g.globalAlpha = a;
        g.drawImage(tint(col), x2 - sr2, y2 - sr2, sr2 * 2, sr2 * 2);
      }
    }

    for (i = 0; i < this.trail.length; i++) {
      p = this.trail[i];
      k2 = Math.pow(1 - p.life / p.max, 0.7);
      var r3 = p.size * cam.s * k2;
      if (r3 < 0.3) continue;
      var x3 = cam.sx(p.x), y3 = cam.sy(p.y);
      g.globalAlpha = k2 * 0.8;
      g.drawImage(tint(p.c), x3 - r3, y3 - r3, r3 * 2, r3 * 2);
    }

    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  };

  /* 昇っていく玉そのもの（コメット） */
  Field.prototype.drawShell = function (g, cam, shell) {
    var x = cam.sx(shell.x), y = cam.sy(shell.y);
    g.globalCompositeOperation = 'lighter';
    var r = 26 * cam.s * shell.glow;
    g.globalAlpha = 0.95;
    g.drawImage(sprite, x - r, y - r, r * 2, r * 2);
    var r2 = 120 * cam.s * shell.glow;
    g.globalAlpha = 0.35;
    g.drawImage(sprite, x - r2, y - r2, r2 * 2, r2 * 2);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,244,220,1)';
    g.beginPath(); g.arc(x, y, Math.max(1.5, 11 * cam.s * shell.glow), 0, 6.2832); g.fill();
    g.globalCompositeOperation = 'source-over';
  };

  return { Field: Field, PALETTES: PALETTES };
})();
