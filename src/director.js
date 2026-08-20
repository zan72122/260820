// ---------------------------------------------------------------------------
// 進行と演出。ゲームの本体はここ。
//
//   idle   氷の中の瓶。押し具が横にある。まだ何も説明しない。
//   aim    触った。押し具が瓶口へ吸い付き、カメラが首へ寄る。
//   press  押している。押し具とビー玉が入力に完全同期して沈む。
//   pop    栓が外れた 0.5〜1.5 秒。カットを入れない。
//   settle カメラが引く。瓶が氷から持ち上がる。
//   play   傾ける遊び。ビー玉が転がり、流れが変わる。
//   refill 次の一本。1 操作も要らずに戻ってくる。
// ---------------------------------------------------------------------------
import * as THREE from '../vendor/three/three.module.min.js';
import { Bottle, VARIANTS } from './bottle.js';
import { buildPusher, PUSH_TRAVEL } from './pusher.js';
import { MarblePhysics } from './marblePhysics.js';
import { BASIN, CUP, PourStream } from './world.js';
import { MOUTH_Y, MARBLE_R, POP_VENT_VOLUME } from './profile.js';
import { makeGlow } from './textures.js';

const SEAT_Y = 0.1892;          // 栓をしているときのビー玉中心
const PRESS_DEPTH = 0.0058;     // 押し込まれるビー玉の移動量

// 傾けの回転軸は瓶の「首」に置く。実際に手で注ぐときもそこを持つし、
// 何より、傾けてもビー玉と瓶口が画面の同じ場所に留まるので、
// 「傾ける → ビー玉が転がる → 流れが変わる」が一目で読める。
const PIVOT_Y = 0.148;
const BASIN_RIG = new THREE.Vector3(BASIN.x, BASIN.bottleBaseY + PIVOT_Y, BASIN.z);
const POUR_RIG = new THREE.Vector3(CUP.x - 0.088, 0.246, CUP.z);
const MAX_TILT = 138 * Math.PI / 180;
const MIN_TILT = -12 * Math.PI / 180;

const ease = (t) => t * t * (3 - 2 * t);
const damp = (cur, to, k, dt) => cur + (to - cur) * (1 - Math.exp(-k * dt));

export class Director {
  constructor(scene, camera, audio, input, quality, world) {
    this.scene = scene; this.camera = camera; this.audio = audio;
    this.input = input; this.quality = quality; this.world = world;
    this.state = 'idle';
    this.stateTime = 0;
    this.time = 0;
    this.variantIndex = Math.floor(Math.random() * VARIANTS.length);
    this.bottleSerial = 0;
    this.aspect = 1;

    // 瓶を載せる台。傾けはこの rig の Z 回転。
    this.rig = new THREE.Object3D();
    this.rig.position.copy(BASIN_RIG);
    scene.add(this.rig);
    this.tilt = 0;
    this.tiltTarget = 0;
    this.tiltAtGrab = 0;

    this.physics = new MarblePhysics();
    this.bottle = null;
    this.nextBottle = null;
    this.spawnBottle();

    // 押し具
    this.pusher = buildPusher();
    scene.add(this.pusher);
    // 実物のラムネは、玉押しが瓶口にちょこんと載った状態で売られている。
    // 少しだけ斜めに置いておき、触れたときに「すっ」と芯が合う。
    this.pusherAskew = new THREE.Vector3(0.0052, SEAT_Y + MARBLE_R - 0.0016, 0.0030);
    this.pusherLean = new THREE.Vector3(0.0052, 0, 0.0030).normalize();
    this.snap = 0;          // 0:横に置いてある 1:瓶口
    this.press = 0;         // 0..1
    this.pusherLift = 0;    // 開栓後に退く

    // 言葉を使わないヒント
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlow(), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.glow.scale.setScalar(0.075);
    scene.add(this.glow);
    this.idleQuiet = 0;

    // 注ぐ流れ
    this.stream = new PourStream();
    scene.add(this.stream.mesh);
    this.stream.material.envMap = scene.environment;
    this.flow = 0;
    this.cupVolume = 0;
    this.cupCapacity = Math.PI * CUP.innerR * CUP.innerR * (CUP.height - CUP.floorY) * 0.78;
    this.wasSealing = false;

    // カメラ
    this.cam = { tx: 0, ty: 0.125, tz: 0, az: -0.55, el: 0.22, dist: 0.46 };
    this.camGoal = { ...this.cam };
    this.shake = 0;
    this.applyCamera(1);

    this.nextIce = 2 + Math.random() * 3;
    this.nextChime = 12 + Math.random() * 14;
    this.nextTick = 1.5 + Math.random() * 2;
    this.vent = 0;
  }

  // --- 瓶の生成 -----------------------------------------------------------

  spawnBottle() {
    const b = this.nextBottle || new Bottle(this.quality, this.variantIndex, ++this.bottleSerial);
    this.nextBottle = null;
    b.setEnvMap(this.scene.environment);
    b.group.position.set(0, -PIVOT_Y, 0);
    this.rig.add(b.group);
    if (this.bottle) { this.rig.remove(this.bottle.group); this.bottle.dispose(); }
    this.bottle = b;
    this.physics.reset(0, SEAT_Y);
    this.physics.active = false;
    b.marble.position.set(0, SEAT_Y, 0);
    b.clingFade = 1;
  }

  prepareNext() {
    if (this.nextBottle) return;
    this.variantIndex = (this.variantIndex + 1 + Math.floor(Math.random() * 2)) % VARIANTS.length;
    this.nextBottle = new Bottle(this.quality, this.variantIndex, ++this.bottleSerial);
    this.nextBottle.setEnvMap(this.scene.environment);
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  // --- カメラ -------------------------------------------------------------

  goalForState() {
    const portrait = this.aspect < 1;
    switch (this.state) {
      case 'aim':
      case 'press':
      case 'pop':
        return {
          tx: BASIN.x, ty: BASIN.bottleBaseY + MOUTH_Y - 0.0135 - (portrait ? 0.008 : 0),
          tz: BASIN.z, az: -0.50, el: 0.10,
          dist: portrait ? 0.190 : 0.176,
        };
      case 'settle':
      case 'play':
      case 'refill':
        {
          const tf = THREE.MathUtils.clamp(Math.abs(this.tilt) / MAX_TILT, 0, 1);
          return portrait
            ? { tx: 0.066 - tf * 0.030, ty: 0.132 - tf * 0.010, tz: 0.006,
                az: -0.40, el: 0.185, dist: 0.66 + tf * 0.34 }
            : { tx: 0.060 - tf * 0.020, ty: 0.120 - tf * 0.008, tz: 0.006,
                az: -0.40, el: 0.165, dist: 0.47 + tf * 0.19 };
        }
      default:
        return portrait
          ? { tx: BASIN.x + 0.006, ty: 0.126, tz: BASIN.z, az: -0.58, el: 0.28, dist: 0.44 }
          : { tx: BASIN.x + 0.010, ty: 0.118, tz: BASIN.z, az: -0.58, el: 0.26, dist: 0.40 };
    }
  }

  applyCamera(k) {
    const c = this.cam;
    const cy = Math.cos(c.el), sy = Math.sin(c.el);
    const px = c.tx + Math.sin(c.az) * cy * c.dist;
    const py = c.ty + sy * c.dist;
    const pz = c.tz + Math.cos(c.az) * cy * c.dist;
    let sx = 0, sy2 = 0;
    if (this.shake > 0) {
      sx = (Math.random() - 0.5) * this.shake * 0.004;
      sy2 = (Math.random() - 0.5) * this.shake * 0.004;
    }
    this.camera.position.set(px + sx, py + sy2, pz);
    this.camera.lookAt(c.tx, c.ty, c.tz);
  }

  updateCamera(dt) {
    const g = this.goalForState();
    const k = this.state === 'settle' || this.state === 'play' ? 2.6 : 3.6;
    for (const key of ['tx', 'ty', 'tz', 'az', 'el', 'dist']) {
      this.cam[key] = damp(this.cam[key], g[key], k, dt);
    }
    // 開栓の瞬間だけ、ほんの少しだけ寄る（カットはしない）
    if (this.state === 'pop' && this.stateTime < 0.6) {
      this.cam.dist -= dt * 0.012;
    }
    this.shake = Math.max(0, this.shake - dt * 6);
    this.applyCamera(dt);
  }

  // --- 更新 ---------------------------------------------------------------

  update(dt, pixelScale) {
    this.time += dt;
    this.stateTime += dt;
    const input = this.input;

    this.ambientLife(dt);

    switch (this.state) {
      case 'idle': this.updateIdle(dt); break;
      case 'aim': this.updateAim(dt); break;
      case 'press': this.updatePress(dt); break;
      case 'pop': this.updatePop(dt); break;
      case 'settle': this.updateSettle(dt); break;
      case 'play': this.updatePlay(dt); break;
      case 'refill': this.updateRefill(dt); break;
    }

    this.rig.rotation.z = -this.tilt;
    this.rig.updateMatrixWorld(true);

    this.stepMarble(dt);
    this.bottle.update(dt, this.time, this.tilt, pixelScale);
    if (this.bottle.droplets) this.bottle.droplets.visible = this.state !== 'refill' || this.stateTime > 0.6;
    this.updateCamera(dt);
    this.updateCup(dt);
    this.updateBottleShadow();
    input.end();
  }

  /** 氷の音、風鈴、開栓前にビー玉へ当たる気泡 */
  ambientLife(dt) {
    this.nextIce -= dt;
    if (this.nextIce <= 0) {
      this.nextIce = 3.5 + Math.random() * 5;
      if (this.state === 'idle' || this.state === 'aim') this.audio.ice();
    }
    this.nextChime -= dt;
    if (this.nextChime <= 0) {
      this.nextChime = 16 + Math.random() * 18;
      this.audio.chime();
    }
    if (!this.physics.active) {
      this.nextTick -= dt;
      if (this.nextTick <= 0) {
        this.nextTick = 1.4 + Math.random() * 2.6;
        // 気泡がビー玉を下から小突く
        this.marbleNudge = 0.00022;
        this.audio.marble(0.07, true);
      }
    }
    if (this.marbleNudge) this.marbleNudge = Math.max(0, this.marbleNudge - dt * 0.0011);
  }

  updateIdle(dt) {
    this.hintBob = 0;
    this.snap = damp(this.snap, 0, 6, dt);
    this.press = damp(this.press, 0, 8, dt);
    this.pusherLift = damp(this.pusherLift, 0, 4, dt);
    this.placePusher();

    this.idleQuiet += dt;
    if (this.input.downFlag) { this.idleQuiet = 0; this.setState('aim'); }

    // 4.5 秒さわらなければ、押し具がそっと弾んで光が瓶口を示す（文字は出さない）
    const hint = Math.max(0, this.idleQuiet - 4.5);
    const pulse = hint > 0 ? Math.max(0, Math.sin(hint * 2.2)) : 0;
    this.glow.material.opacity = pulse * 0.26;
    this.bottle.mouthWorld(this.glow.position);
    this.glow.position.y += 0.006;
    this.hintBob = pulse * 0.0035;
    this.placePusher();
  }

  updateAim(dt) {
    this.snap = damp(this.snap, 1, 7, dt);
    this.glow.material.opacity = damp(this.glow.material.opacity, 0, 8, dt);
    this.placePusher();
    if (this.snap > 0.92 && this.input.down) this.setState('press');
    // 触れずに放置したら idle へは戻さない（押し具は瓶口に載ったまま待つ）
  }

  updatePress(dt) {
    this.snap = damp(this.snap, 1, 10, dt);
    const inp = this.input;
    if (inp.down) {
      // 下方向 drag と 長押しの両方を受け付ける。1mm の精度は要求しない。
      const byDrag = Math.max(0, inp.dragDown) / 105;
      const byHold = Math.max(0, inp.holdTime - 0.12) * 0.62;
      const want = Math.min(1.25, byDrag + byHold);
      this.press = damp(this.press, want, 22, dt);
      this.audio.setPress(Math.min(1, Math.abs(inp.dy) * 0.10 + Math.abs(this.press - (this._lastPress || 0)) * 12), this.press);
      this._lastPress = this.press;
      if (this.press >= 0.985) { this.doPop(); return; }
    } else {
      this.press = damp(this.press, 0, 9, dt);
      this.audio.setPress(0, 0);
      if (this.press < 0.03) this.setState('aim');
    }
    this.placePusher();
    // ビー玉は入力に完全同期して沈む
    this.bottle.marble.position.set(0, SEAT_Y - PRESS_DEPTH * Math.min(this.press, 1), 0);
  }

  doPop() {
    this.setState('pop');
    this.audio.setPress(0, 0);
    this.press = 1;
    this.audio.pon();
    setTimeoutSafe(() => this.audio.fizz(1.0), 40);
    this.bottle.pop();
    this.shake = 1;
    this.vent = POP_VENT_VOLUME;
    // ここから物理。落下は演出ではなく本当に落ちる。
    this.physics.reset(0, SEAT_Y - PRESS_DEPTH);
    this.physics.active = true;
    this.physics.vy = -0.50;
    this.physics.vx = (Math.random() - 0.5) * 0.02;
    this.bottle.clingFade = 0;
  }

  updatePop(dt) {
    // 炭酸が抜けて液面が首の中をすっと下がる = 開栓した証拠
    if (this.vent > 0) {
      const d = Math.min(this.vent, POP_VENT_VOLUME * dt / 1.3);
      this.bottle.volume -= d;
      this.vent -= d;
    }
    // 押し具は少し跳ね返ってから退く
    this.press = damp(this.press, -0.25, 9, dt);
    if (this.stateTime > 0.35) this.pusherLift = damp(this.pusherLift, 1, 3.2, dt);
    this.snap = this.stateTime > 1.0 ? damp(this.snap, 0, 2.2, dt) : this.snap;
    this.placePusher();
    if (this.stateTime > 1.25) this.setState('settle');
  }

  updateSettle(dt) {
    this.pusherLift = damp(this.pusherLift, 1, 3, dt);
    this.snap = damp(this.snap, 0, 3, dt);
    this.placePusher();
    // 瓶が氷から持ち上がる
    const t = ease(Math.min(1, this.stateTime / 1.25));
    this.rig.position.lerpVectors(BASIN_RIG, POUR_RIG, t);
    if (this.stateTime > 0.8) this.prepareNext();
    if (this.stateTime > 1.3) this.setState('play');
  }

  updatePlay(dt) {
    const inp = this.input;
    this.pusherLift = damp(this.pusherLift, 1, 3, dt);
    this.placePusher();
    this.rig.position.copy(POUR_RIG);

    if (inp.down) {
      // 横 drag = 瓶の傾き。カメラは動かないので指の意味が衝突しない。
      // 相対で積むので、画面幅より大きく傾けたければ何度か撫でればよい。
      if (Math.abs(inp.dx) > 0.01) {
        this.tiltTarget = THREE.MathUtils.clamp(
          this.tiltTarget + inp.dx * 0.42 * Math.PI / 180, MIN_TILT, MAX_TILT);
      }
      this.idleQuiet = 0;
    } else {
      this.idleQuiet += dt;
    }
    this.tilt = damp(this.tilt, this.tiltTarget, 9, dt);

    // 何もしないまま置かれたら、そっと揺れて「傾けられる」ことを示す
    if (this.idleQuiet > 6 && Math.abs(this.tiltTarget) < 0.05) {
      this.tilt += Math.sin(this.time * 2.0) * 0.006;
    }

    this.updatePour(dt);

    // 一杯そそぎ切ったか、瓶が空になったら次の一本へ
    const done = this.bottle.volume < this.bottle.fullVolume * 0.030 ||
                 this.cupVolume > this.cupCapacity * 0.985;
    // 半分ほど注いだところで手が止まったら、それも一区切りとみなす
    this.stillTime = this.flow > 2e-6 || this.input.down ? 0 : (this.stillTime || 0) + dt;
    const paused = this.stillTime > 4.5 && this.cupVolume > this.cupCapacity * 0.35;
    if ((done || paused) && this.stateTime > 1.0) this.setState('refill');
    // 氷のたらいを軽くつつけば、いつでも次の一本
    if (inp.tapFlag && inp.travel < 12 && this.hitsBasin()) this.setState('refill');
  }

  hitsBasin() {
    const r = this._ray || (this._ray = new THREE.Raycaster());
    const el = this.input.el;
    const nx = (this.input.x / el.clientWidth) * 2 - 1;
    const ny = -(this.input.y / el.clientHeight) * 2 + 1;
    r.setFromCamera({ x: nx, y: ny }, this.camera);
    return r.intersectObjects([this.world.basin, this.world.ice], true).length > 0;
  }

  updatePour(dt) {
    const b = this.bottle;
    const mouth = b.mouthWorld(this._mw || (this._mw = new THREE.Vector3()));
    const head = b.levelWorld - mouth.y;
    const sealing = this.physics.isSealingMouth();

    if (!this.wasSealing && sealing && this.flow > 2e-6) {
      this.audio.marble(0.42, true); // 「コトン」
    }
    this.wasSealing = sealing;

    let target = 0;
    if (head > 0.0004 && !sealing && b.volume > 0 && this.cupVolume < this.cupCapacity) {
      const A = Math.PI * 0.0072 * 0.0072;
      const v = Math.sqrt(2 * 9.81 * head);
      // 空気が入る隙間の分だけ「どくどく」と脈打つ
      const glug = 0.78 + 0.22 * Math.sin(this.time * 12.5);
      target = A * v * 0.235 * glug;
    }
    this.flow = damp(this.flow, target, sealing ? 22 : 9, dt);
    if (this.flow < 1e-7) this.flow = 0;

    const moved = Math.min(this.flow * dt, b.volume);
    b.volume -= moved;
    this.cupVolume = Math.min(this.cupCapacity, this.cupVolume + moved);

    const on = this.flow > 2e-6;
    this.stream.mesh.visible = on;
    if (on) {
      // 瓶口の縁から、瓶の軸の向きへ流れ出す
      const dir = this._dir || (this._dir = new THREE.Vector3());
      dir.set(0, 1, 0).applyQuaternion(this.rig.quaternion);
      const lip = this._lip || (this._lip = new THREE.Vector3());
      lip.copy(mouth).addScaledVector(dir, 0.001);
      const speed = THREE.MathUtils.clamp(Math.sqrt(2 * 9.81 * Math.max(head, 0.001)) * 0.30, 0.05, 0.40);
      const rad = THREE.MathUtils.clamp(Math.sqrt(this.flow / 2.2e-5) * 0.0032, 0.0012, 0.0052);
      const floorY = CUP.floorY + this.cupHeight() + 0.002;
      this.stream.update(lip, dir, speed, rad, floorY);
      this.world.cupFoam.material.opacity = Math.min(0.62,
        this.world.cupFoam.material.opacity + dt * 1.6);
    }
    this.audio.setPour(on ? THREE.MathUtils.clamp(this.flow / 2.0e-5, 0.15, 1) : 0);
  }

  /** 持ち上げた瓶の下に、柔らかい接地影を置いて浮かせない */
  updateBottleShadow() {
    const sh = this.world.bottleShadow;
    if (!sh) return;
    const p = this._bs || (this._bs = new THREE.Vector3());
    p.set(0, 0.02, 0).applyMatrix4(this.bottle.group.matrixWorld);
    const h = Math.max(0.0, p.y);
    sh.position.set(p.x, 0.0018, p.z);
    const k = THREE.MathUtils.clamp(1 - h / 0.42, 0, 1);
    sh.material.opacity = 0.34 * k * k;
    const sc = 1 + h * 1.6;
    sh.scale.set(sc, sc, 1);
    sh.visible = sh.material.opacity > 0.01;
  }

  cupHeight() {
    return this.cupVolume / (Math.PI * CUP.innerR * CUP.innerR);
  }

  updateCup(dt) {
    const h = this.cupHeight();
    const L = this.world.cupLiquid;
    if (h > 0.0004) {
      L.visible = true;
      L.scale.set(1, h, 1);
      L.position.y = CUP.floorY + h * 0.5;
      this.world.cupFoam.position.y = CUP.floorY + h + 0.0006;
      this.world.cupFoam.visible = true;
    } else {
      L.visible = false;
      this.world.cupFoam.visible = false;
    }
    const f = this.world.cupFoam.material;
    if (this.flow <= 2e-6) f.opacity = Math.max(0, f.opacity - dt * 0.28);
  }

  updateRefill(dt) {
    const t = this.stateTime;
    this.audio.setPour(0);
    this.stream.mesh.visible = false;
    this.flow = 0;
    // 立て直して、氷へ戻す
    this.tiltTarget = 0;
    this.tilt = damp(this.tilt, 0, 5, dt);
    const k = ease(THREE.MathUtils.clamp((t - 0.15) / 1.0, 0, 1));
    this.rig.position.lerpVectors(POUR_RIG, BASIN_RIG, k);
    // コップの中身は飲み干されたことにして静かに消す
    const fade = THREE.MathUtils.clamp(1 - (t - 0.2) / 0.9, 0, 1);
    this.cupVolume *= fade > 0 ? Math.pow(fade, 0.02) : 0;
    if (t > 0.9) this.cupVolume = Math.max(0, this.cupVolume - dt * this.cupCapacity * 1.6);

    if (!this._swapped && t > 1.15) {
      this._swapped = true;
      this.audio.swap();
      this.spawnBottle();
      this.tilt = this.tiltTarget = 0;
      this.rig.rotation.z = 0;
      this.cupVolume = 0;
      this.world.cupFoam.material.opacity = 0;
      // 新しい瓶は氷の中からすっと持ち上がってくる
      this.bottle.group.position.y = -PIVOT_Y - 0.055;
    }
    if (this._swapped) {
      this.bottle.group.position.y = damp(this.bottle.group.position.y, -PIVOT_Y, 5, dt);
      this.pusherLift = damp(this.pusherLift, 0, 4, dt);
      this.snap = damp(this.snap, 0, 5, dt);
      this.press = 0;
      this.placePusher();
      if (t > 2.1) {
        this._swapped = false;
        this.idleQuiet = 0;
        this.setState('idle');
      }
    }
  }

  // --- 押し具の配置 -------------------------------------------------------

  placePusher() {
    const s = ease(THREE.MathUtils.clamp(this.snap, 0, 1));
    const seatY = SEAT_Y + MARBLE_R; // ピン先がビー玉の頭に触れる高さ
    const local = this._pt || (this._pt = new THREE.Vector3());
    const aligned = this._pa || (this._pa = new THREE.Vector3());
    aligned.set(0, seatY - PUSH_TRAVEL * THREE.MathUtils.clamp(this.press, -0.4, 1), 0);
    aligned.y += this.hintBob || 0;
    local.lerpVectors(this.pusherAskew, aligned, s);
    // 退くときは瓶口の斜め上へ
    if (this.pusherLift > 0.001) {
      local.y += this.pusherLift * 0.055;
      local.x += this.pusherLift * 0.026;
      local.z += this.pusherLift * 0.024;
    }
    this.pusher.position.copy(local).applyMatrix4(this.bottle.group.matrixWorld);

    // 斜めに載っている姿勢 → 芯の合った姿勢
    const up = this._up || (this._up = new THREE.Vector3(0, 1, 0));
    const lean = this._ln || (this._ln = new THREE.Vector3());
    const a = (1 - s) * 0.17;
    lean.copy(up).multiplyScalar(Math.cos(a)).addScaledVector(this.pusherLean, Math.sin(a)).normalize();
    const q = this._q || (this._q = new THREE.Quaternion());
    q.setFromUnitVectors(up, lean);
    const q2 = this._q2 || (this._q2 = new THREE.Quaternion());
    this.bottle.group.getWorldQuaternion(q2);
    this.pusher.quaternion.copy(q2).multiply(q);
    this.pusher.visible = this.pusherLift < 0.97;
  }

  // --- ビー玉 -------------------------------------------------------------

  stepMarble(dt) {
    const b = this.bottle;
    if (this.physics.active) {
      const q = this._gq || (this._gq = new THREE.Quaternion());
      b.group.getWorldQuaternion(q).invert();
      const g = this._gv || (this._gv = new THREE.Vector3());
      g.set(0, -9.81, 0).applyQuaternion(q);
      this.physics.submergedY = b.levelLocal;
      this.physics.step(dt, g.x, g.y);
      for (const c of this.physics.contacts) {
        this.audio.marble(c.speed, c.speed < 0.16);
      }
      this.audio.setRoll(THREE.MathUtils.clamp(this.physics.rollSpeed / 0.26, 0, 1));
      b.marble.position.set(this.physics.x, this.physics.y, 0);
      b.marble.rotation.z = -this.physics.spin;
    } else if (this.state !== 'press') {
      this.audio.setRoll(0);
      const n = this.marbleNudge || 0;
      b.marble.position.set(0, SEAT_Y - n * Math.sin(this.time * 40), 0);
    }
  }

  // --- テスト用 -----------------------------------------------------------

  debugState() {
    return {
      state: this.state,
      press: +this.press.toFixed(3),
      tiltDeg: +(this.tilt * 180 / Math.PI).toFixed(1),
      marble: { x: +this.bottle.marble.position.x.toFixed(4), y: +this.bottle.marble.position.y.toFixed(4) },
      physicsOn: this.physics.active,
      sealing: this.physics.isSealingMouth(),
      held: this.physics.isHeldByDimple(),
      bottleML: +(this.bottle.volume * 1e6).toFixed(1),
      cupML: +(this.cupVolume * 1e6).toFixed(1),
      flow: +(this.flow * 1e6).toFixed(2),
      levelWorld: +this.bottle.levelWorld.toFixed(4),
    };
  }
}

function setTimeoutSafe(fn, ms) {
  try { setTimeout(fn, ms); } catch (e) { fn(); }
}
