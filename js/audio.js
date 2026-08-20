/* audio.js - 手続き的な音。川のざわめき、導火線、ナイアガラの燃える音 */
(function (g) {
  'use strict';
  var NB = g.NB;
  var A = NB.Audio = { ok: false, muted: false, ctx: null };

  var noiseBuf = null, river = null, riverG = null, fireSrc = null, fireG = null, fireF = null,
    fuseSrc = null, fuseG = null, fuseF = null, master = null;

  function makeNoise(ac) {
    var len = ac.sampleRate * 2;
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function loopNoise(ac, dest) {
    var s = ac.createBufferSource();
    s.buffer = noiseBuf; s.loop = true; s.connect(dest); s.start();
    return s;
  }

  A.unlock = function () {
    if (A.ok) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      var AC = g.AudioContext || g.webkitAudioContext;
      if (!AC) return;
      var ac = A.ctx = new AC();
      noiseBuf = makeNoise(ac);

      master = ac.createGain(); master.gain.value = A.muted ? 0 : 0.9; master.connect(ac.destination);

      /* 川と夜の空気 */
      riverG = ac.createGain(); riverG.gain.value = 0.055;
      var rf = ac.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 420; rf.Q.value = 0.4;
      rf.connect(riverG); riverG.connect(master);
      river = loopNoise(ac, rf);

      /* ナイアガラ */
      fireG = ac.createGain(); fireG.gain.value = 0;
      fireF = ac.createBiquadFilter(); fireF.type = 'lowpass'; fireF.frequency.value = 1500; fireF.Q.value = 0.6;
      var fh = ac.createBiquadFilter(); fh.type = 'highpass'; fh.frequency.value = 110;
      fireF.connect(fh); fh.connect(fireG); fireG.connect(master);
      fireSrc = loopNoise(ac, fireF);

      /* 導火線 */
      fuseG = ac.createGain(); fuseG.gain.value = 0;
      fuseF = ac.createBiquadFilter(); fuseF.type = 'bandpass'; fuseF.frequency.value = 900; fuseF.Q.value = 1.1;
      fuseF.connect(fuseG); fuseG.connect(master);
      fuseSrc = loopNoise(ac, fuseF);

      A.ok = true;
      if (ac.state === 'suspended') ac.resume();
    } catch (err) { A.ok = false; }
  };

  A.setMuted = function (m) {
    A.muted = m;
    if (A.ok) master.gain.setTargetAtTime(m ? 0 : 0.9, A.ctx.currentTime, 0.05);
  };

  A.niagara = function (level) {
    if (!A.ok) return;
    var t = A.ctx.currentTime;
    fireG.gain.setTargetAtTime(0.34 * level, t, 0.25);
    fireF.frequency.setTargetAtTime(900 + 1900 * level, t, 0.4);
  };

  A.fuse = function (level) {
    if (!A.ok) return;
    var t = A.ctx.currentTime;
    fuseG.gain.setTargetAtTime(0.20 * level, t, 0.06);
    fuseF.frequency.setTargetAtTime(600 + 1800 * level, t, 0.1);
  };

  /* 単発の音 */
  function blip(freq, dur, vol, type, filt) {
    if (!A.ok) return;
    var ac = A.ctx, t = ac.currentTime;
    var o = ac.createOscillator(), gg = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(28, freq * 0.35), t + dur);
    gg.gain.setValueAtTime(0.0001, t);
    gg.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gg);
    if (filt) { var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; gg.connect(f); f.connect(master); }
    else gg.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  A.clunk = function () {
    blip(190, 0.28, 0.30, 'triangle', 900);
    if (!A.ok) return;
    var ac = A.ctx, t = ac.currentTime;
    var s = ac.createBufferSource(); s.buffer = noiseBuf;
    var gg = ac.createGain(); gg.gain.setValueAtTime(0.22, t);
    gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600;
    s.connect(f); f.connect(gg); gg.connect(master);
    s.start(t); s.stop(t + 0.2);
  };

  A.whoosh = function () { blip(520, 0.5, 0.18, 'sawtooth', 2200); };
  A.done = function () { blip(330, 0.9, 0.12, 'sine', 1200); };

  A.suspend = function () { if (A.ok && A.ctx.state === 'running') A.ctx.suspend(); };
  A.resume = function () { if (A.ok && A.ctx.state === 'suspended') A.ctx.resume(); };
})(window);
