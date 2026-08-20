/* 長岡花火 正三尺玉 : 信濃川の河川敷（夜）
   ワールド座標は x:0..1000 が基準画面幅、y は上が正、y=0 が対岸の水際。
   遠景・水面・手前の土手を、それぞれ必要な範囲だけオフスクリーンに焼く。 */
window.NFScene = (function () {
  /* 焼き付ける3つの帯。少しずつ重ねて継ぎ目を出さない */
  var FAR   = { x0: -300, x1: 1300, yTop:  400, yBot:  -30 };
  var WATER = { x0: -300, x1: 1300, yTop:    8, yBot: -270 };
  var FORE  = { x0: -300, x1: 1300, yTop: -180, yBot: -780 };
  var LAUNCH = { x: 500, y: 18 };                    // 中州の打ち上げ筒

  var far = null, water = null, fore = null, grain = null, puff = null;
  var bakeScale = 1, stars = [], ripples = [], lamps = [], clouds = [];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function layer(R) {
    var c = mk((R.x1 - R.x0) * bakeScale, (R.yTop - R.yBot) * bakeScale);
    var g = c.getContext('2d');
    g.setTransform(bakeScale, 0, 0, -bakeScale, -R.x0 * bakeScale, R.yTop * bakeScale);
    return { c: c, g: g };
  }
  function glowDot(g, x, y, r, color, a) {
    var grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(' + color + ',' + a + ')');
    grd.addColorStop(0.35, 'rgba(' + color + ',' + (a * 0.33) + ')');
    grd.addColorStop(1, 'rgba(' + color + ',0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }

  /* ---------- 遠景：山なみ・対岸の街・長生橋・川霧 ---------- */
  function bakeFar() {
    var L = layer(FAR); far = L.c; var g = L.g;

    // 水平線に溜まる街あかりと祭りの照り返し
    var glow = g.createLinearGradient(0, -10, 0, 400);
    glow.addColorStop(0, 'rgba(146,98,54,0.58)');
    glow.addColorStop(0.08, 'rgba(114,80,52,0.40)');
    glow.addColorStop(0.22, 'rgba(74,62,58,0.22)');
    glow.addColorStop(0.45, 'rgba(44,48,58,0.11)');
    glow.addColorStop(0.72, 'rgba(28,34,48,0.04)');
    glow.addColorStop(1, 'rgba(20,26,38,0)');
    g.fillStyle = glow; g.fillRect(FAR.x0, -10, FAR.x1 - FAR.x0, 410);
    glowDot(g, 520, 0, 700, '255,176,96', 0.20);
    glowDot(g, 150, 0, 380, '255,146,86', 0.11);
    glowDot(g, 900, 0, 420, '198,178,255', 0.06);

    // 盆地をふちどる山なみ（奥ほど淡い）
    function ridge(base, amp, freq, phase, fill) {
      g.beginPath(); g.moveTo(FAR.x0, 0);
      for (var x = FAR.x0; x <= FAR.x1; x += 8) {
        g.lineTo(x, base + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.42
                    + Math.sin(x * freq * 5.7 + phase * 0.6) * amp * 0.18 + Math.sin(x * freq * 11.3 + phase) * amp * 0.07);
      }
      g.lineTo(FAR.x1, 0); g.closePath(); g.fillStyle = fill; g.fill();
    }
    ridge(196, 52, 0.0030, 1.1, 'rgba(38,48,64,0.80)');
    ridge(138, 34, 0.0052, 3.4, 'rgba(25,32,45,0.92)');

    // 対岸の街。窓あかりは控えめに、でも確かにそこにある
    var bx = FAR.x0;
    while (bx < FAR.x1) {
      var w = rnd(20, 58), h = rnd(16, 52);
      if (Math.random() < 0.10) h = rnd(58, 116);
      g.fillStyle = 'rgba(' + (10 + Math.random() * 8 | 0) + ',' + (14 + Math.random() * 8 | 0) + ',' + (21 + Math.random() * 10 | 0) + ',0.97)';
      g.fillRect(bx, 0, w, h);
      var cols = Math.max(1, Math.floor(w / 11)), rows = Math.max(1, Math.floor(h / 14));
      for (var c = 0; c < cols; c++) for (var r2 = 0; r2 < rows; r2++) {
        if (Math.random() < 0.11) {
          var wx = bx + 4 + c * 11, wy = 7 + r2 * 15;
          g.fillStyle = Math.random() < 0.22 ? 'rgba(180,210,250,0.55)' : 'rgba(255,190,116,0.68)';
          g.fillRect(wx, wy, 4, 5.5);
          lamps.push({ x: wx + 2, y: wy, c: '255,190,120', a: 0.18, w: 7 });
        }
      }
      bx += w + rnd(3, 16);
    }

    // 河畔の街路灯
    for (var i = 0; i < 30; i++) {
      var lx = FAR.x0 + i * ((FAR.x1 - FAR.x0) / 30) + rnd(-10, 10), ly = rnd(16, 34);
      glowDot(g, lx, ly, 40, '255,186,110', 0.30);
      g.fillStyle = 'rgba(255,228,184,0.95)';
      g.beginPath(); g.arc(lx, ly, 2.2, 0, 6.2832); g.fill();
      lamps.push({ x: lx, y: ly, c: '255,186,110', a: 0.34, w: 13 });
    }

    // 長生橋のトラス
    var deck = 96, span = 265, x0 = -240, dark = 'rgba(7,10,17,0.99)';
    g.lineWidth = 4.5; g.strokeStyle = dark; g.fillStyle = dark;
    g.fillRect(FAR.x0, deck - 9, FAR.x1 - FAR.x0, 12);              // 桁
    for (var s = 0; s < 7; s++) {
      var sx = x0 + s * span, mid = sx + span * 0.5;
      g.beginPath(); g.moveTo(sx, deck);                            // トラスの山形
      g.quadraticCurveTo(mid, deck + 96, sx + span, deck); g.stroke();
      g.lineWidth = 2.6;
      for (var v = 1; v <= 5; v++) {                                // 斜材
        var vx = sx + span * (v / 6), h2 = deck + 78 * (1 - Math.pow((v / 6 - 0.5) * 2, 2));
        g.beginPath(); g.moveTo(vx, deck); g.lineTo(vx, h2); g.stroke();
      }
      g.lineWidth = 4.5;
      g.fillRect(sx - 9, 0, 19, deck);                              // 橋脚
      glowDot(g, mid, deck + 12, 52, '255,206,140', 0.30);
      g.fillStyle = 'rgba(255,240,210,0.95)';
      g.beginPath(); g.arc(mid, deck + 12, 3.2, 0, 6.2832); g.fill();
      g.fillStyle = dark;
      lamps.push({ x: mid, y: deck + 12, c: '255,206,140', a: 0.40, w: 20 });
    }
    for (var dl = 0; dl < 22; dl++) {                                // 高欄の連なり
      var dx = FAR.x0 + dl * ((FAR.x1 - FAR.x0) / 22);
      glowDot(g, dx, deck + 6, 22, '255,214,158', 0.22);
      g.fillStyle = 'rgba(255,236,206,0.8)';
      g.beginPath(); g.arc(dx, deck + 6, 1.5, 0, 6.2832); g.fill();
      g.fillStyle = dark;
      lamps.push({ x: dx, y: deck + 6, c: '255,214,158', a: 0.26, w: 9 });
    }

    // 川面から立ちのぼる湿った靄。橋脚の足元を溶かして距離を出す
    var mist = g.createLinearGradient(0, -12, 0, 140);
    mist.addColorStop(0, 'rgba(152,148,152,0.32)');
    mist.addColorStop(0.30, 'rgba(128,128,140,0.17)');
    mist.addColorStop(1, 'rgba(110,116,132,0)');
    g.fillStyle = mist; g.fillRect(FAR.x0, -12, FAR.x1 - FAR.x0, 152);

    // 中州と打ち上げ筒
    g.fillStyle = 'rgba(11,14,21,0.95)';
    g.beginPath(); g.ellipse(LAUNCH.x, 4, 150, 12, 0, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(19,23,32,0.98)';
    g.fillRect(LAUNCH.x - 7, 2, 15, 20);
    glowDot(g, LAUNCH.x, 10, 34, '255,150,70', 0.10);
  }

  /* ---------- 水面 ---------- */
  function bakeWater() {
    var L = layer(WATER); water = L.c; var g = L.g;
    var base = g.createLinearGradient(0, 0, 0, -270);
    base.addColorStop(0, 'rgba(38,41,46,1)');
    base.addColorStop(0.08, 'rgba(24,29,37,1)');
    base.addColorStop(0.42, 'rgba(13,17,24,1)');
    base.addColorStop(1, 'rgba(7,10,15,1)');
    g.fillStyle = base; g.fillRect(WATER.x0, -270, WATER.x1 - WATER.x0, 270);

    g.globalCompositeOperation = 'lighter';
    // 灯りの映り込みは、さざなみで横に折れ、下へ行くほどほどけていく
    for (var i = 0; i < lamps.length; i++) {
      var Lp = lamps[i];
      var len = (70 + Lp.a * 340) * rnd(0.6, 1.5);
      var seg = 26, ph = rnd(0, 6.28), amp = 2.5 + Lp.w * 0.4;
      for (var sgi = 0; sgi < seg; sgi++) {
        var f = sgi / seg;
        var y = -f * len, hgt = (len / seg) * rnd(0.30, 0.80);
        var wj = Lp.w * (0.6 + f * 1.5) * rnd(0.5, 1.25);
        var dx = Math.sin(f * 9 + ph) * amp * (0.4 + f) + rnd(-2, 2);
        var a = Lp.a * (1 - f) * (1 - f) * rnd(0.5, 1.15);
        if (a < 0.006) continue;
        g.fillStyle = 'rgba(' + Lp.c + ',' + a.toFixed(3) + ')';
        g.fillRect(Lp.x + dx - wj * 0.5, y - hgt, wj, hgt);
      }
    }
    for (var k = 0; k < 900; k++) {                          // 水面のこまかな横筋
      var u = Math.random(), y2 = -268 * u * u, x2 = rnd(WATER.x0, WATER.x1);
      g.fillStyle = 'rgba(202,192,172,' + (rnd(0.02, 0.12) * (1 - u * 0.5)) + ')';
      g.fillRect(x2, y2, rnd(5, 34) * (0.3 + u), 0.9 + u * 1.6);
    }
    g.globalCompositeOperation = 'source-over';

    var edge = g.createLinearGradient(0, -238, 0, -270);     // 波打ち際の暗がり
    edge.addColorStop(0, 'rgba(8,11,17,0)');
    edge.addColorStop(1, 'rgba(8,11,17,1)');
    g.fillStyle = edge; g.fillRect(WATER.x0, -270, WATER.x1 - WATER.x0, 32);
  }

  /* ---------- 手前の土手と観客 ---------- */
  function bakeFore() {
    var L = layer(FORE); fore = L.c; var g = L.g;

    var gr = g.createLinearGradient(0, -248, 0, -780);       // 河川敷の地面
    gr.addColorStop(0, 'rgba(21,22,24,1)');
    gr.addColorStop(0.22, 'rgba(15,16,18,1)');
    gr.addColorStop(1, 'rgba(6,6,8,1)');
    g.fillStyle = gr; g.fillRect(FORE.x0, -780, FORE.x1 - FORE.x0, 532);

    for (var i = 0; i < 3200; i++) {                          // 砂利。手前ほど粗い
      var u = Math.random(), y = -248 - u * 532, x = rnd(FORE.x0, FORE.x1);
      var sz = 0.7 + u * 3.4;
      g.fillStyle = 'rgba(' + (148 + Math.random() * 62 | 0) + ',' + (138 + Math.random() * 52 | 0) + ',' + (122 + Math.random() * 46 | 0) + ',' + (rnd(0.03, 0.17) * (1 - u * 0.4)) + ')';
      g.beginPath(); g.ellipse(x, y, sz, sz * 0.6, 0, 0, 6.2832); g.fill();
    }
    for (var j = 0; j < 360; j++) {                           // 水際の草
      var gx = rnd(FORE.x0, FORE.x1), gy = -244 - Math.random() * 40;
      g.strokeStyle = 'rgba(22,28,23,' + rnd(0.35, 0.85) + ')';
      g.lineWidth = rnd(0.8, 2);
      g.beginPath(); g.moveTo(gx, gy);
      g.quadraticCurveTo(gx + rnd(-6, 6), gy + 13, gx + rnd(-13, 13), gy + rnd(16, 34));
      g.stroke();
    }

    function person(x, y, h, standing) {
      var hw = h * 0.30, hy = y + h * (standing ? 0.72 : 0.64), hr = h * 0.16;
      g.fillStyle = 'rgba(5,6,9,0.97)';
      g.beginPath();
      if (standing) {
        g.moveTo(x - hw, y); g.lineTo(x - hw * 0.82, y + h * 0.64);
        g.lineTo(x + hw * 0.82, y + h * 0.64); g.lineTo(x + hw, y);
      } else {
        g.moveTo(x - hw * 1.3, y); g.lineTo(x - hw * 0.92, y + h * 0.54);
        g.lineTo(x + hw * 0.92, y + h * 0.54); g.lineTo(x + hw * 1.3, y);
      }
      g.closePath(); g.fill();
      g.beginPath(); g.arc(x, hy, hr, 0, 6.2832); g.fill();
      if (Math.random() < 0.55) {                                   // 水平線からのリムライト
        g.strokeStyle = 'rgba(178,162,142,' + rnd(0.10, 0.22).toFixed(2) + ')';
        g.lineWidth = Math.max(0.5, h * 0.014);
        g.beginPath(); g.arc(x, hy, hr, Math.PI * (1.12 + Math.random() * 0.2), Math.PI * 1.88); g.stroke();
      }
    }
    var rows = [
      { y: -264, h: 58, n: 52, sp: 0.10 },
      { y: -336, h: 92, n: 34, sp: 0.16 },
      { y: -438, h: 156, n: 19, sp: 0.14 }
    ];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r], span2 = (FORE.x1 - FORE.x0) / row.n;
      for (var p = 0; p < row.n; p++) {
        // 等間隔に並べず、家族連れのように寄り集まらせる
        var px = FORE.x0 + span2 * (p + 0.5) + rnd(-span2 * 0.75, span2 * 0.75);
        person(px, row.y + rnd(-9, 9), row.h * rnd(0.72, 1.2), Math.random() < row.sp);
      }
      for (var q = 0; q < 4; q++) glowDot(g, rnd(FORE.x0, FORE.x1), row.y + 12, 24, '255,178,108', 0.16);
    }

    // 最手前のピンぼけ（土手の肩と草の穂）
    var soft = mk(fore.width, fore.height), sg = soft.getContext('2d');
    sg.setTransform(bakeScale, 0, 0, -bakeScale, -FORE.x0 * bakeScale, FORE.yTop * bakeScale);
    sg.fillStyle = 'rgba(3,4,6,1)';
    sg.beginPath(); sg.moveTo(FORE.x0, FORE.yBot);
    for (var x2 = FORE.x0; x2 <= FORE.x1; x2 += 20) {
      sg.lineTo(x2, -640 + Math.sin(x2 * 0.009) * 26 + Math.sin(x2 * 0.028) * 12);
    }
    sg.lineTo(FORE.x1, FORE.yBot); sg.closePath(); sg.fill();
    for (var b = 0; b < 110; b++) {
      var bx2 = rnd(FORE.x0, FORE.x1), by = -648 + rnd(-16, 10);
      sg.strokeStyle = 'rgba(3,4,6,1)'; sg.lineWidth = rnd(2, 6);
      sg.beginPath(); sg.moveTo(bx2, by);
      sg.quadraticCurveTo(bx2 + rnd(-14, 14), by + 34, bx2 + rnd(-34, 34), by + rnd(40, 84));
      sg.stroke();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (typeof g.filter === 'string') g.filter = 'blur(' + (4 * bakeScale).toFixed(2) + 'px)';
    g.globalAlpha = 0.6;
    for (var d = 0; d < 3; d++) g.drawImage(soft, 0, 0);
    g.globalAlpha = 1; g.filter = 'none';
  }

  function bakeSprites() {
    grain = mk(256, 256);
    var gg = grain.getContext('2d'), img = gg.createImageData(256, 256), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = 128 + (Math.random() - 0.5) * 200;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 24;
    }
    gg.putImageData(img, 0, 0);

    puff = mk(128, 128);                                     // 雲・靄のもと
    var pg = puff.getContext('2d');
    var grd = pg.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.28)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    pg.fillStyle = grd; pg.fillRect(0, 0, 128, 128);
  }

  /* ---------- 組み立て ---------- */
  function build(cssW, cssH, dpr, quality) {
    bakeScale = Math.min(1.5, (cssW / 1000) * dpr * 1.25) * (quality || 1);
    bakeScale = Math.max(0.40, bakeScale);
    lamps = [];
    bakeFar(); bakeWater(); bakeFore();
    if (!grain) bakeSprites();

    stars = [];
    for (var i = 0; i < 260; i++) {
      var y = 120 + Math.pow(Math.random(), 0.65) * 3000;
      stars.push({ x: rnd(-500, 1500), y: y, r: rnd(0.5, 1.6), a: rnd(0.15, 0.9) * Math.min(1, y / 700 + 0.2), p: rnd(0, 6.28), sp: rnd(0.6, 2.4) });
    }
    ripples = [];
    for (var j = 0; j < 170; j++) {
      var u = Math.random();
      ripples.push({ x: rnd(-320, 1320), y: -266 * u * u, w: rnd(12, 62) * (0.3 + u), p: rnd(0, 6.28), sp: rnd(0.5, 1.6), a: rnd(0.05, 0.26) * (1 - u * 0.45) });
    }
    clouds = [];
    for (var k = 0; k < 9; k++) {                             // 空気の層（大きく淡い靄）
      var cy = 180 + Math.random() * 1700;
      clouds.push({
        x: rnd(-350, 1350), y: cy, r: rnd(520, 1100),
        a: rnd(0.018, 0.042) * (1 - Math.min(1, cy / 2400) * 0.6),
        warm: cy < 520
      });
    }
  }

  function rectOf(R, cam) {
    return { x: cam.sx(R.x0), y: cam.sy(R.yTop), w: (R.x1 - R.x0) * cam.s, h: (R.yTop - R.yBot) * cam.s };
  }

  /* ---------- 描画 ---------- */
  function drawSky(g, cam, W, H, t) {
    var sky = g.createLinearGradient(0, cam.sy(3400), 0, cam.sy(-60));
    sky.addColorStop(0.00, '#03050a');
    sky.addColorStop(0.20, '#05080f');
    sky.addColorStop(0.40, '#070b14');
    sky.addColorStop(0.55, '#080d18');
    sky.addColorStop(0.68, '#0a101d');
    sky.addColorStop(0.78, '#0c1421');
    sky.addColorStop(0.86, '#0f1825');
    sky.addColorStop(0.93, '#131c29');
    sky.addColorStop(1.00, '#1a222f');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], x = cam.sx(s.x), y = cam.sy(s.y);
      if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
      var a = s.a * (0.66 + 0.34 * Math.sin(t * s.sp + s.p));
      g.fillStyle = 'rgba(226,232,246,' + a.toFixed(3) + ')';
      g.beginPath(); g.arc(x, y, s.r * Math.max(0.7, cam.s * 1.7), 0, 6.2832); g.fill();
    }
  }

  /* 空気の層。上昇する玉がここを抜けていくのが見えると距離が出る */
  function drawClouds(g, cam, t) {
    g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      var x = cam.sx(c.x + Math.sin(t * 0.05 + i) * 20), y = cam.sy(c.y), r = c.r * cam.s;
      if (r < 2 || x < -r * 2 || x > cam.W + r * 2 || y < -r * 2 || y > cam.H + r * 2) continue;
      g.globalAlpha = c.a;
      g.fillStyle = c.warm ? 'rgba(132,112,96,1)' : 'rgba(96,110,138,1)';
      g.drawImage(puff, x - r, y - r * 0.42, r * 2, r * 0.84);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  function drawFar(g, cam) { var r = rectOf(FAR, cam); g.drawImage(far, r.x, r.y, r.w, r.h); }
  function drawFore(g, cam) { var r = rectOf(FORE, cam); g.drawImage(fore, r.x, r.y, r.w, r.h); }

  /* light: 花火などの照り返し {x, i, r, color:[r,g,b]} */
  function drawWater(g, cam, t, light) {
    var r = rectOf(WATER, cam);
    g.drawImage(water, r.x, r.y, r.w, r.h);

    var y0 = cam.sy(0), y1 = cam.sy(-268);
    if (y1 < 0 || y0 > cam.H) return;
    g.save();
    g.beginPath(); g.rect(0, y0, cam.W, Math.max(0, y1 - y0)); g.clip();
    g.globalCompositeOperation = 'lighter';

    if (light && light.i > 0.004) {
      var cx = cam.sx(light.x), c = light.color;
      var grd = g.createRadialGradient(cx, y0, 0, cx, y0, Math.max(40, light.r * cam.s * 2.2));
      grd.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.58 * light.i).toFixed(3) + ')');
      grd.addColorStop(0.4, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.20 * light.i).toFixed(3) + ')');
      grd.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      g.fillStyle = grd; g.fillRect(0, y0, cam.W, y1 - y0);
    }
    for (var i = 0; i < ripples.length; i++) {
      var p = ripples[i];
      var x = cam.sx(p.x + Math.sin(t * p.sp + p.p) * 11), y = cam.sy(p.y + Math.sin(t * 0.7 + p.p) * 2);
      var w = p.w * cam.s;
      var a = p.a * (0.55 + 0.45 * Math.sin(t * p.sp * 1.7 + p.p));
      if (light && light.i > 0.02) a += light.i * 0.30 * Math.max(0, 1 - Math.abs(p.x - light.x) / 850);
      g.fillStyle = 'rgba(216,208,188,' + Math.min(0.55, a).toFixed(3) + ')';
      g.fillRect(x - w * 0.5, y, w, Math.max(0.8, cam.s * 1.4));
    }
    g.restore();
    g.globalCompositeOperation = 'source-over';
  }

  function drawGrade(g, W, H, t, wash, quality) {
    if (wash && wash.i > 0.003) {
      g.globalCompositeOperation = 'lighter';
      var c = wash.color;
      var grd = g.createRadialGradient(wash.x, wash.y, 0, wash.x, wash.y, Math.max(W, H) * 0.95);
      grd.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.30 * wash.i).toFixed(3) + ')');
      grd.addColorStop(0.40, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.10 * wash.i).toFixed(3) + ')');
      grd.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }
    var vig = g.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.30, W * 0.5, H * 0.52, Math.max(W, H) * 0.80);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.60)');
    g.fillStyle = vig; g.fillRect(0, 0, W, H);

    if (grain && quality >= 0.8) {                      // 粒状感。負荷が高い端末では省く
      g.globalAlpha = 0.55;
      var ox = -(Math.random() * 256) | 0, oy = -(Math.random() * 256) | 0;
      for (var x = ox; x < W; x += 256) for (var y = oy; y < H; y += 256) g.drawImage(grain, x, y);
      g.globalAlpha = 1;
    }
  }

  return {
    LAUNCH: LAUNCH, FAR: FAR, WATER: WATER, FORE: FORE,
    build: build,
    drawSky: drawSky, drawClouds: drawClouds, drawFar: drawFar,
    drawWater: drawWater, drawFore: drawFore, drawGrade: drawGrade
  };
})();
