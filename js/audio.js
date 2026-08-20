/* 長岡花火 正三尺玉 : 音（すべて WebAudio による合成音・外部素材なし）
   距離感が主役なので、共有のディレイ残響に全部を通して「河川敷で聞こえる音」に寄せる。 */
window.NFAudio = (function () {
  var ctx = null, master = null, wet = null, noiseBuf = null;
  var muted = false, started = false;
  var live = [];               // 停止可能なノード（リプレイ時に掃除する）

  function now() { return ctx ? ctx.currentTime : 0; }

  function build() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);

    // 河原の広がり: 短いフィードバックディレイ + ローパスの簡易リバーブ
    var pre = ctx.createDelay(1.0); pre.delayTime.value = 0.085;
    var fb = ctx.createGain(); fb.gain.value = 0.42;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    wet = ctx.createGain(); wet.gain.value = 0.5;
    wet.connect(pre); pre.connect(lp); lp.connect(fb); fb.connect(pre); lp.connect(master);

    // ノイズ源（2秒ぶんを使い回す）
    var len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function track(node) { live.push(node); return node; }

  function noise(dest, dur, t0) {
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.connect(dest); s.start(t0); s.stop(t0 + dur);
    track(s); return s;
  }
  function osc(type, dest, dur, t0) {
    var o = ctx.createOscillator();
    o.type = type; if (dest) o.connect(dest); o.start(t0); o.stop(t0 + dur);
    track(o); return o;
  }
  function gain(v, dest, send) {
    var g = ctx.createGain(); g.gain.value = v; g.connect(dest);
    if (send && wet) { var s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(wet); }
    return g;
  }
  function filt(type, f, q) {
    var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f;
    if (q != null) b.Q.value = q; return b;
  }

  var api = {
    /* iOS はユーザー操作の中でしか鳴らせないので、最初のタップからこれを呼ぶ */
    unlock: function () {
      if (!ctx && !build()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (!started) {                          // 無音バッファを1回流して確実に解禁
        var b = ctx.createBuffer(1, 1, 22050);
        var s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
        started = true;
      }
    },
    ready: function () { return !!ctx; },
    setMuted: function (m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, now(), 0.05); },
    isMuted: function () { return muted; },

    stopAll: function () {
      for (var i = 0; i < live.length; i++) { try { live[i].stop(0); } catch (e) {} }
      live = []; api._amb = null;
    },

    /* ---- 予告のサイレン（ゆっくり2回うねる） ---- */
    siren: function (dur) {
      if (!ctx) return; dur = dur || 3.0;
      var t = now();
      var out = gain(0, master, 0.55);
      var bp = filt('bandpass', 900, 2.2); bp.connect(out);
      var o1 = osc('sawtooth', bp, dur + 0.4, t);
      var o2 = osc('triangle', bp, dur + 0.4, t); o2.detune.value = 7;
      // 300 -> 860 -> 380 -> 820 -> 300 のウェイル
      var f = o1.frequency, f2 = o2.frequency, seg = dur / 4;
      [f, f2].forEach(function (p) {
        p.setValueAtTime(300, t);
        p.linearRampToValueAtTime(860, t + seg * 1.0);
        p.linearRampToValueAtTime(400, t + seg * 2.0);
        p.linearRampToValueAtTime(840, t + seg * 3.0);
        p.linearRampToValueAtTime(290, t + seg * 4.0);
      });
      out.gain.setValueAtTime(0, t);
      out.gain.linearRampToValueAtTime(0.16, t + 0.35);
      out.gain.setValueAtTime(0.16, t + dur - 0.5);
      out.gain.linearRampToValueAtTime(0, t + dur + 0.35);
      // 遠くの低い唸りを重ねて「屋外の大きなスピーカー」感を出す
      var lo = gain(0.05, master, 0.3);
      var lof = filt('lowpass', 260); lof.connect(lo);
      var o3 = osc('sine', lof, dur + 0.3, t);
      o3.frequency.setValueAtTime(150, t);
      o3.frequency.linearRampToValueAtTime(215, t + seg);
      o3.frequency.linearRampToValueAtTime(150, t + dur);
      lo.gain.setValueAtTime(0, t); lo.gain.linearRampToValueAtTime(0.05, t + 0.4);
      lo.gain.setValueAtTime(0.05, t + dur - 0.4); lo.gain.linearRampToValueAtTime(0, t + dur + 0.2);
    },

    /* ---- 打ち上げ: 筒のドンと、遠ざかる笛 ---- */
    launch: function () {
      if (!ctx) return;
      var t = now();
      // 筒の腹に響く「ドッ」
      var g1 = gain(0.0, master, 0.5);
      var o = osc('sine', g1, 0.7, t);
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.42);
      g1.gain.setValueAtTime(0.0001, t);
      g1.gain.linearRampToValueAtTime(0.85, t + 0.012);
      g1.gain.exponentialRampToValueAtTime(0.0008, t + 0.62);
      // 火薬の破裂成分
      var g2 = gain(0.0, master, 0.45);
      var hp = filt('highpass', 420); hp.connect(g2);
      noise(hp, 0.3, t);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.linearRampToValueAtTime(0.5, t + 0.008);
      g2.gain.exponentialRampToValueAtTime(0.0006, t + 0.28);
    },

    /* ---- 上昇: 重い玉が空気の層を抜けていく「ヒュ〜」 ---- */
    rise: function (dur) {
      if (!ctx) return; dur = dur || 2.3;
      var t = now();
      var g = gain(0, master, 0.6);
      var bp = filt('bandpass', 900, 6); bp.connect(g);
      var o = osc('sine', bp, dur + 0.2, t);
      o.frequency.setValueAtTime(980, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(300, t + dur);
      bp.frequency.setValueAtTime(1100, t); bp.frequency.exponentialRampToValueAtTime(320, t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.22);
      g.gain.linearRampToValueAtTime(0.055, t + dur * 0.8);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.15);
      // 風切りのざらつき
      var gn = gain(0, master, 0.4);
      var bn = filt('bandpass', 1400, 1.2); bn.connect(gn);
      noise(bn, dur + 0.2, t);
      bn.frequency.setValueAtTime(1500, t); bn.frequency.exponentialRampToValueAtTime(500, t + dur);
      gn.gain.setValueAtTime(0, t);
      gn.gain.linearRampToValueAtTime(0.075, t + 0.3);
      gn.gain.linearRampToValueAtTime(0, t + dur + 0.1);
      // ゆっくりしたトレモロ（回転しながら昇る感じ）
      var lfo = osc('sine', null, dur + 0.2, t); lfo.frequency.value = 7.5;
      var lg = ctx.createGain(); lg.gain.value = 0.035;
      lfo.connect(lg); lg.connect(g.gain);
    },

    /* ---- 開花: 光より遅れて届く「ドーン」と、谷に返るこだま ---- */
    boom: function (delay) {
      if (!ctx) return;
      var t = now() + (delay || 0);
      // 芯の一撃
      var gc = gain(0, master, 0.35);
      var hp = filt('highpass', 700); hp.connect(gc);
      noise(hp, 0.2, t);
      gc.gain.setValueAtTime(0.0001, t);
      gc.gain.linearRampToValueAtTime(0.4, t + 0.006);
      gc.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
      // 胴の低音（三尺玉の腹に来る音）
      var gb = gain(0, master, 0.7);
      var lp = filt('lowpass', 240, 1.1); lp.connect(gb);
      noise(lp, 1.6, t);
      lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(90, t + 1.1);
      gb.gain.setValueAtTime(0.0001, t);
      gb.gain.linearRampToValueAtTime(0.9, t + 0.02);
      gb.gain.exponentialRampToValueAtTime(0.0008, t + 1.5);
      var gs = gain(0, master, 0.5);
      var os = osc('sine', gs, 1.4, t);
      os.frequency.setValueAtTime(70, t); os.frequency.exponentialRampToValueAtTime(26, t + 0.9);
      gs.gain.setValueAtTime(0.0001, t);
      gs.gain.linearRampToValueAtTime(0.8, t + 0.025);
      gs.gain.exponentialRampToValueAtTime(0.0006, t + 1.3);
      // 山と川に返るこだま
      var ge = gain(0, master, 0.8);
      var le = filt('lowpass', 150); le.connect(ge);
      noise(le, 1.4, t + 0.62);
      ge.gain.setValueAtTime(0.0001, t + 0.62);
      ge.gain.linearRampToValueAtTime(0.22, t + 0.70);
      ge.gain.exponentialRampToValueAtTime(0.0005, t + 1.9);
    },

    /* ---- 開花後の残り火のパチパチ ---- */
    crackle: function (delay, dur) {
      if (!ctx) return;
      var t0 = now() + (delay || 0); dur = dur || 1.8;
      var g = gain(0.09, master, 0.5);
      var bp = filt('bandpass', 2600, 3); bp.connect(g);
      for (var i = 0; i < 26; i++) {
        var t = t0 + Math.random() * dur;
        var e = ctx.createGain(); e.gain.value = 0; e.connect(bp);
        var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        s.connect(e); s.start(t); s.stop(t + 0.06); track(s);
        var v = 0.5 + Math.random() * 0.5;
        e.gain.setValueAtTime(0.0001, t);
        e.gain.linearRampToValueAtTime(v, t + 0.004);
        e.gain.exponentialRampToValueAtTime(0.0004, t + 0.05);
      }
    },

    /* ---- 観客の「おぉ〜」 ---- */
    crowd: function (delay) {
      if (!ctx) return;
      var t = now() + (delay || 0);
      var g = gain(0, master, 0.9);
      var bp = filt('bandpass', 620, 0.9); bp.connect(g);
      noise(bp, 2.6, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.10, t + 0.5);
      g.gain.linearRampToValueAtTime(0.04, t + 1.4);
      g.gain.linearRampToValueAtTime(0, t + 2.5);
    },

    /* ---- 夜の川の環境音（ずっと薄く鳴らす） ---- */
    ambience: function () {
      if (!ctx || api._amb) return;
      var t = now();
      var g = gain(0, master, 0.2); api._amb = g;
      var lp = filt('lowpass', 420, 0.7); lp.connect(g);
      noise(lp, 100000, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035, t + 2.0);
    }
  };
  return api;
})();
