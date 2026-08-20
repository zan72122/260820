/* world.js - 長生橋と信濃川のかたち。実寸に近い数字で組む */
(function (g) {
  'use strict';
  var NB = g.NB, U = NB.U;

  var W = NB.W = {
    /* 橋: 13連のトラス、1径間 65m、全長 845m */
    SPAN_N: 13,
    SPAN_L: 65,
    X0: 60,
    DECK_Y: 13.0,      /* 路面の高さ (水面から) */
    LOW_Y: 11.4,       /* 下弦材 */
    ARCH_H: 8.4,       /* アーチの立ち上がり */
    CHORD_BASE: 1.35,  /* 橋脚上の上弦材の高さ (路面から) */
    HW: 4.35,          /* トラス面の半間隔 */
    ROAD_HW: 3.4,
    GROUND: 2.6,       /* 河川敷の高さ */
    RAMP: 210,         /* 取付道路の長さ */
    /* 川幅 */
    BANK_L: 205,
    BANK_R: 795
  };
  W.X1 = W.X0 + W.SPAN_N * W.SPAN_L;
  W.RX0 = W.X0 - W.RAMP;
  W.RX1 = W.X1 + W.RAMP;
  W.MID = (W.X0 + W.X1) * 0.5;

  /* 川岸。手前ほど右へ寄り、上流はやや狭まる = 川が曲がって見える */
  W.bankL = function (z) {
    return W.BANK_L + 0.30 * Math.max(0, z - 120) + 0.05 * Math.max(0, -z - 260);
  };
  W.bankR = function (z) {
    return W.BANK_R + 0.13 * Math.max(0, z - 120) - 0.05 * Math.max(0, -z - 260);
  };

  /* 路面の高さ: 取付道路でなだらかに地面へ降りる */
  W.roadY = function (x) {
    if (x >= W.X0 && x <= W.X1) return W.DECK_Y;
    var t;
    if (x < W.X0) t = (x - W.RX0) / W.RAMP; else t = (W.RX1 - x) / W.RAMP;
    t = U.clamp(t, 0, 1);
    return U.lerp(W.GROUND + 0.4, W.DECK_Y, U.smoother(t));
  };

  /* 火のカーテンが下がる面(下流側) */
  W.CURTAIN_Z = W.HW + 0.25;

  /* 点火の進み具合を持つ区間 */
  W.SEG = 176;
  W.SEG_L = (W.X1 - W.X0) / W.SEG;
  W.segX = function (i) { return W.X0 + (i + 0.5) * W.SEG_L; };

  /* ---------------- トラスの部材生成 ---------------- */
  /* kind: 0=弦材 1=垂直材 2=斜材 3=横つなぎ 4=高欄 */
  function member(list, x1, y1, z1, x2, y2, z2, th, kind) {
    list.push({ a: [x1, y1, z1], b: [x2, y2, z2], th: th, k: kind });
  }

  W.build = function () {
    var spans = W.spans = [];
    var P = 6, HW = W.HW, L = W.SPAN_L;
    var upper = function (i) {
      return W.DECK_Y + W.CHORD_BASE + W.ARCH_H * Math.sin(Math.PI * i / P);
    };
    for (var k = 0; k < W.SPAN_N; k++) {
      var x0 = W.X0 + k * L, dx = L / P;
      var main = [], det = [];
      for (var si = 0; si < 2; si++) {
        var z = si === 0 ? -HW : HW;
        for (var i = 0; i < P; i++) {
          var xa = x0 + i * dx, xb = xa + dx;
          member(main, xa, W.LOW_Y, z, xb, W.LOW_Y, z, 0.52, 0);          /* 下弦 */
          member(main, xa, upper(i), z, xb, upper(i + 1), z, 0.60, 0);    /* 上弦(アーチ) */
        }
        for (i = 1; i < P; i++) {
          member(det, x0 + i * dx, W.LOW_Y, z, x0 + i * dx, upper(i), z, 0.32, 1);
        }
        /* 端柱 */
        member(main, x0, W.LOW_Y, z, x0, upper(0), z, 0.46, 1);
        member(main, x0 + L, W.LOW_Y, z, x0 + L, upper(P), z, 0.46, 1);
        /* 斜材 */
        for (i = 0; i < P; i++) {
          var xa2 = x0 + i * dx, xb2 = xa2 + dx;
          if (i < P / 2) member(det, xa2, W.LOW_Y, z, xb2, upper(i + 1), z, 0.28, 2);
          else member(det, xa2, upper(i), z, xb2, W.LOW_Y, z, 0.28, 2);
        }
      }
      /* 上横構 */
      for (i = 1; i < P; i++) {
        member(det, x0 + i * dx, upper(i), -HW, x0 + i * dx, upper(i), HW, 0.24, 3);
      }
      for (i = 1; i < P - 1; i++) {
        var xa3 = x0 + i * dx, xb3 = xa3 + dx;
        member(det, xa3, upper(i), -HW, xb3, upper(i + 1), HW, 0.16, 3);
        member(det, xa3, upper(i), HW, xb3, upper(i + 1), -HW, 0.16, 3);
      }
      /* 門構 (径間の入口) */
      member(main, x0, upper(0), -HW, x0, upper(0), HW, 0.34, 3);
      member(main, x0 + L, upper(P), -HW, x0 + L, upper(P), HW, 0.34, 3);

      spans.push({ x0: x0, x1: x0 + L, main: main, det: det });
    }

    /* 橋脚 */
    var piers = W.piers = [];
    for (k = 1; k < W.SPAN_N; k++) {
      var px = W.X0 + k * L;
      var inWater = px > W.BANK_L && px < W.BANK_R;
      piers.push({ x: px, base: inWater ? 0 : W.GROUND - 0.2, top: W.LOW_Y - 0.35, hw: 2.1, hz: 5.0, water: inWater });
    }
    /* 橋台 */
    W.abut = [
      { x: W.X0 - 3.2, base: W.GROUND - 0.3, top: W.DECK_Y - 0.5, hw: 3.4, hz: 5.6 },
      { x: W.X1 + 3.2, base: W.GROUND - 0.3, top: W.DECK_Y - 0.5, hw: 3.4, hz: 5.6 }
    ];

    /* 照明 (上流側にだけ立つ) */
    var lamps = W.lamps = [];
    for (var x = W.RX0 + 30; x < W.RX1; x += 43) {
      lamps.push({ x: x, y: W.roadY(x), z: -W.ROAD_HW - 0.55, h: 4.6 });
    }

    /* 高欄 */
    var rails = W.rails = [];
    var step = 26;
    for (x = W.RX0; x < W.RX1 - step; x += step) {
      rails.push({ x0: x, x1: x + step, y0: W.roadY(x), y1: W.roadY(x + step) });
    }

    /* 通行止めのバリケード (取付道路のふもと側) */
    W.BAR_X = W.X0 - 118;
    W.BAR_Y = W.roadY(W.BAR_X);
    return W;
  };

  W.build();
})(window);
