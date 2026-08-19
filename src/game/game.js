// ゲーム進行。「さがす → はっぱを はらう → まわりを ほる → したを きる → ひっぱる → かごへ」。
import * as THREE from 'three';
import { makeRng, clamp } from '../core/rng.js';
import { Ease, Tweener } from '../core/tween.js';
import { createGround, heightAt } from '../world/ground.js';
import { createBambooForest } from '../world/bamboo.js';
import { createLitter } from '../world/litter.js';
import { Atmosphere, setupLighting, createSky } from '../world/atmosphere.js';
import { radialTexture } from '../world/textures.js';
import { DigSite, SITE_RADIUS } from './digsite.js';
import { SPOT_LAYOUT, DECOY_LAYOUT, PLAYER_POS, groundBumps, viewAzimuthFor, Decoy } from './spots.js';
import { CameraRig, distanceScale } from './cameraRig.js';
import { createBasket, createDigTool } from './props.js';

export const State = {
  INTRO: 'intro',
  SURVEY: 'survey',
  APPROACH: 'approach',
  BRUSH: 'brush',
  DIG: 'dig',
  CROSS: 'cross',
  CUT: 'cut',
  PULL: 'pull',
  REVEAL: 'reveal',
  COLLECT: 'collect',
  DONE: 'done',
};

const DIG_GUIDE_RADIUS = 0.26;

export class Game {
  constructor(o) {
    this.renderer = o.renderer;
    this.scene = o.scene;
    this.camera = o.camera;
    this.input = o.input;
    this.audio = o.audio;
    this.hud = o.hud;
    this.fast = !!o.fast;
    this.rng = makeRng(o.seed ?? 20260819);
    this.tween = new Tweener();
    this.rig = new CameraRig(o.camera);
    this.ray = new THREE.Raycaster();
    this.state = State.INTRO;
    this.stateTime = 0;
    this.locked = true;
    this.collected = 0;
    this.misses = 0;
    this.round = 0;
    this.clippables = [];
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    this.activeSite = null;
    this.digAngle = null;
    this.cutProgress = 0;
    this.pullProgress = 0;
    this.crossShown = false;
    this.pulled = null;
    this.hintTimer = 0;
    this.dust = 0;
    if (this.rig) this.rig.sway = this.fast ? 0 : 1;
  }

  // ================= 世界を作る =================

  build() {
    const scene = this.scene;
    this.lights = setupLighting(scene, { fast: this.fast });
    scene.add(createSky());

    this.bumps = groundBumps();
    this.surfaceAt = (x, z) => {
      let y = heightAt(x, z);
      for (const b of this.bumps) {
        const d = Math.hypot(x - b.x, z - b.z);
        if (d < b.radius) y += b.height * Math.pow(Math.cos((d / b.radius) * Math.PI * 0.5), 2);
      }
      return y;
    };

    this.ground = createGround({ bumps: this.bumps });
    scene.add(this.ground);

    const avoid = [
      ...SPOT_LAYOUT.map((s) => ({ x: s.x, z: s.z, r: 1.05 })),
      ...DECOY_LAYOUT.map((s) => ({ x: s.x, z: s.z, r: 0.85 })),
      { x: PLAYER_POS.x, z: PLAYER_POS.z, r: 1.5 },
    ];
    this.forest = createBambooForest(this.rng, { fast: this.fast, avoid });
    scene.add(this.forest);

    this.litter = createLitter(this.rng, {
      fast: this.fast,
      avoid: [...SPOT_LAYOUT, ...DECOY_LAYOUT].map((p2) => ({ x: p2.x, z: p2.z, r: 0.62 })),
    });
    scene.add(this.litter);

    this.atmos = new Atmosphere(this.rng, { fast: this.fast });
    scene.add(this.atmos.group);

    // かご
    this.basket = createBasket();
    this.basket.position.set(0.78, this.surfaceAt(0.78, 1.85), 1.85);
    this.basket.rotation.y = -0.5;
    scene.add(this.basket);

    // 根元を切る道具
    this.tool = createDigTool();
    this.tool.visible = false;
    scene.add(this.tool);

    // 穴の中は日が入らず真っ暗になるので、接写のときだけ淡い補助光を足す。
    // 実際に木漏れ日が差し込んだような、暖かい弱い光。
    this.closeLight = new THREE.PointLight(0xffe8c6, 0, 2.2, 2);
    this.closeLight.visible = false;
    scene.add(this.closeLight);

    // 掘るところを示すガイド(ぐるぐるの道しるべ)
    const guide = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(DIG_GUIDE_RADIUS, 0.0075, 6, 44),
      new THREE.MeshBasicMaterial({ color: 0xffdc94, transparent: true, opacity: 0.5, fog: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 9;
    guide.add(ring);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.019, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff6dd, fog: false })
    );
    dot.renderOrder = 10;
    guide.add(dot);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.85),
      new THREE.MeshBasicMaterial({
        map: radialTexture('rgba(255,236,178,0.5)', 'rgba(255,214,120,0)', 2.6),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.18,
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.renderOrder = 8;
    guide.add(glow);
    guide.visible = false;
    this.guide = guide;
    this.guideRing = ring;
    this.guideDot = dot;
    this.guideGlow = glow;
    scene.add(guide);

    this.sites = [];
    this.decoys = [];
    this._buildSites();

    // クリップ(断面表示)の対象になるマテリアルを集める
    this.clippables.push(this.ground.material);
    this.litter.traverse((o) => { if (o.material) this.clippables.push(o.material); });

    this._startIntro();
  }

  _buildSites() {
    for (const s of this.sites) {
      this.scene.remove(s.group);
      s.dispose();
    }
    for (const d of this.decoys) this.scene.remove(d.group);
    this.sites = [];
    this.decoys = [];
    for (const s of SPOT_LAYOUT) {
      const site = new DigSite({
        rng: this.rng,
        position: new THREE.Vector3(s.x, this.surfaceAt(s.x, s.z), s.z),
        surfaceAt: this.surfaceAt,
        hintLevel: s.hint,
        viewAzimuth: viewAzimuthFor(s.x, s.z),
        fast: this.fast,
      });
      site.taken = false;
      this.sites.push(site);
      this.scene.add(site.group);
      for (const m of site.materials) if (!this.clippables.includes(m)) this.clippables.push(m);
    }
    for (const d of DECOY_LAYOUT) {
      const dec = new Decoy(this.rng, d, this.surfaceAt, this.fast);
      this.decoys.push(dec);
      this.scene.add(dec.group);
      if (dec.litter.material) this.clippables.push(dec.litter.material);
    }
  }

  // ================= カメラの画づくり =================

  get ds() {
    return distanceScale(this.camera.aspect, 'close');
  }

  get dsWide() {
    return distanceScale(this.camera.aspect, 'wide');
  }

  _dirOf(site) {
    return new THREE.Vector3(Math.cos(site.viewAzimuth), 0, Math.sin(site.viewAzimuth));
  }

  shot(name, site = this.activeSite) {
    const ds = this.ds;
    const gy = this.surfaceAt(PLAYER_POS.x, PLAYER_POS.z);
    // 縦画面では横が狭いぶん、少し引いて高く構える
    const back = (this.dsWide - 1) * 1.55;
    if (name === 'introStart') {
      return {
        pos: new THREE.Vector3(2.4, gy + 3.9, 9.6 + back),
        target: new THREE.Vector3(-0.3, gy + 1.4, -3.5),
        fov: 60,
      };
    }
    if (name === 'survey') {
      return {
        pos: new THREE.Vector3(PLAYER_POS.x, gy + 1.36 + back * 0.22, PLAYER_POS.z + back),
        target: new THREE.Vector3(-0.05, gy - 0.02, -1.9),
        fov: 58,
      };
    }
    if (name === 'basket') {
      const b = this.basket.position;
      const target = new THREE.Vector3(b.x, b.y + 0.17, b.z);
      const u = new THREE.Vector3(-0.28, 0.62, 0.86).normalize();
      const dist = THREE.MathUtils.clamp(0.42 / (Math.tan(THREE.MathUtils.degToRad(24)) * Math.max(0.35, this.camera.aspect)), 0.75, 1.9);
      return { pos: target.clone().addScaledVector(u, dist), target, fov: 48 };
    }
    const p = site.position;
    const dir = this._dirOf(site);
    // 注視点からのオフセットを丸ごとスケールする。方向を保つので、
    // 縦画面で引いてもカメラが土の中に潜り込まない。
    const at = (dist, up, ty, fov) => {
      const target = new THREE.Vector3(p.x, p.y + ty, p.z);
      const off = new THREE.Vector3(dir.x * dist, up - ty, dir.z * dist).multiplyScalar(ds);
      return { pos: target.clone().add(off), target, fov };
    };
    switch (name) {
      case 'approach': return at(1.15, 0.86, 0.02, 52);
      case 'brush': return at(0.66, 0.52, -0.01, 48);
      case 'dig': return at(0.70, 0.54, -0.05, 46);
      case 'cross': return at(0.86, 0.15, -0.13, 42);
      case 'cut': {
        // 根元の接写。手前の土を切り取った断面で見せるので、
        // 刃先と根元の関係がはっきり読める。ほぼ真横からの低い視点。
        const target = new THREE.Vector3(p.x, p.y + site.takenokoBaseY + 0.02, p.z);
        const fov = 44;
        const halfW = 0.16; // 横に写したい幅の半分(m)
        const aspect = Math.max(0.35, this.camera.aspect);
        const dist = THREE.MathUtils.clamp(
          halfW / (Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect),
          0.34,
          0.9
        );
        const u = new THREE.Vector3(dir.x * 0.94, 0.34, dir.z * 0.94).normalize();
        return { pos: target.clone().addScaledVector(u, dist), target, fov };
      }
      case 'pull': return at(0.58, 0.36, -0.02, 50);
      case 'reveal': return at(0.46, 0.30, 0.18, 45);
      default: return this.shot('survey');
    }
  }

  moveCamera(name, opts = {}) {
    this.currentShot = name;
    const s = this.shot(name, opts.site || this.activeSite);
    this.rig.moveTo(s.pos, s.target, {
      fov: s.fov,
      duration: opts.duration ?? 1.2,
      ease: opts.ease ?? Ease.inOutCubic,
      onComplete: opts.onComplete,
    });
  }

  /**
   * 画面が回ったとき。いまの画づくりを新しい画面比で取りなおす。
   * 縦横で寄りの距離が変わるので、これをしないと構図が崩れたままになる。
   */
  onResize() {
    if (!this.currentShot || this.rig.busy) return;
    if (this.state === State.INTRO) return;
    const site = this.activeSite;
    if (!site && !['survey', 'basket'].includes(this.currentShot)) return;
    this.moveCamera(this.currentShot, { duration: 0.4, ease: Ease.outCubic });
  }

  // ================= 状態遷移 =================

  /** 接写のときだけ、穴の中を照らす */
  setCloseLight(on, site = this.activeSite, height = 0.42) {
    if (!this.closeLight) return;
    const target = on ? 0.30 : 0;
    if (on && site) {
      const dir = this._dirOf(site);
      this.closeLight.position.set(
        site.position.x + dir.x * 0.16,
        site.position.y + height,
        site.position.z + dir.z * 0.16
      );
      this.closeLight.visible = true;
    }
    const from = this.closeLight.intensity;
    this.tween.add({
      duration: 0.6,
      onUpdate: (t) => { this.closeLight.intensity = from + (target - from) * t; },
      onComplete: () => { if (!on) this.closeLight.visible = false; },
    });
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
    this.hintTimer = 0;
  }

  _startIntro() {
    const a = this.shot('introStart');
    this.currentShot = 'introStart';
    this.rig.snap(a.pos, a.target, a.fov);
    this.setState(State.INTRO);
    this.locked = true;
    this.hud.showTitle('たけのこを さがそう', 'つちの なかに かくれているよ');
    this.hud.setPrompt('');
    this.hud.setGesture(null);
    this.hud.setProgress(null);
    const b = this.shot('survey');
    this.rig.moveTo(b.pos, b.target, {
      fov: b.fov,
      duration: this.fast ? 0.6 : 6.2,
      ease: Ease.inOutCubic,
      onComplete: () => this._enterSurvey(),
    });
  }

  skipIntro() {
    if (this.state !== State.INTRO) return;
    this._enterSurvey();
  }

  _enterSurvey() {
    const b = this.shot('survey');
    this.currentShot = 'survey';
    this.rig.moveTo(b.pos, b.target, { fov: b.fov, duration: this.rig.busy ? 0.9 : 0.001 });
    this.hud.showTitle(null);
    this.setState(State.SURVEY);
    this.locked = false;
    this.activeSite = null;
    this.guide.visible = false;
    this.tool.visible = false;
    this.hud.setProgress(null);
    const remaining = this.sites.filter((s) => !s.taken).length;
    if (remaining === 0) {
      this._enterDone();
      return;
    }
    this.hud.setPrompt(
      'たけのこは どこかな？',
      'つちが もりあがった ところを さわってみよう'
    );
    // 最初の1本はすぐ分かるように、指のヒントを出しておく
    if (this.collected === 0) this.hintTimer = 6.2;
    this.misses = 0;
  }

  _enterDone() {
    this.setState(State.DONE);
    this.locked = true;
    this.hud.setPrompt('');
    this.hud.setGesture(null);
    this.hud.showTitle('かごが いっぱい！', 'がめんを さわると もういちど あそべるよ');
    this.audio.chime(700);
    const b = this.shot('basket');
    this.currentShot = 'basket';
    this.rig.moveTo(b.pos, b.target, { fov: b.fov, duration: 1.6 });
    this.tween.add({
      duration: 1.2,
      onComplete: () => { this.locked = false; },
    });
  }

  restart() {
    this.hud.showTitle(null);
    this.collected = 0;
    this.round++;
    this.hud.setCount(0);
    for (let i = this.basket.children.length - 1; i >= 0; i--) {
      const c = this.basket.children[i];
      if (c.name === 'takenoko') this.basket.remove(c);
    }
    this.basket.userData.slot = 0;
    this._buildSites();
    this._enterSurvey();
  }

  approach(site) {
    this.activeSite = site;
    for (const s of this.sites) s.showRing(false);
    this.setState(State.APPROACH);
    this.locked = true;
    this.crossShown = false;
    this.cutProgress = 0;
    this.pullProgress = 0;
    this.digAngle = null;
    this.hud.setGesture(null);
    this.hud.setPrompt('ここに ありそう！', 'ちかづいて みよう');
    this.audio.chime(620);
    this.moveCamera('approach', {
      duration: this.fast ? 0.35 : 1.5,
      onComplete: () => this._enterBrush(),
    });
  }

  _enterBrush() {
    this.setState(State.BRUSH);
    this.moveCamera('brush', { duration: this.fast ? 0.2 : 0.9 });
    this.locked = false;
    this.hud.setPrompt('はっぱを はらおう', 'ゆびで こするように うごかしてね');
    this.hud.setGesture('swipe');
    this.hud.setProgress(0);
    this.guide.visible = false;
  }

  _enterDig() {
    this.setState(State.DIG);
    this.moveCamera('dig', { duration: this.fast ? 0.2 : 1.0 });
    this.locked = false;
    this.hud.setPrompt('まわりを ぐるぐる ほろう', 'ゆびで まるく なぞってね');
    this.hud.setGesture('circle');
    this.hud.setProgress(0);
    this.audio.chime(560);
    const p = this.activeSite.position;
    this.guide.position.set(p.x, p.y + 0.02, p.z);
    this.guide.visible = true;
  }

  _enterCross() {
    this.crossShown = true;
    this.setState(State.CROSS);
    this.locked = true;
    this.guide.visible = false;
    this.hud.setGesture(null);
    this.hud.setProgress(null);
    this.setCrossSection(true);
    this.setCloseLight(true, this.activeSite, 0.34);
    this.hud.setPrompt('つちの なかが みえた！', 'たけのこは こんなに ながいよ');
    this.moveCamera('cross', { duration: this.fast ? 0.25 : 1.5 });
    this.tween.add({
      duration: this.fast ? 0.4 : 3.4,
      onComplete: () => {
        this.setCrossSection(false);
        this.setCloseLight(false);
        this.setState(State.DIG);
        this.moveCamera('dig', {
          duration: this.fast ? 0.2 : 1.2,
          onComplete: () => {
            this.locked = false;
            this.hud.setPrompt('もうすこし ほろう', 'ゆびで まるく なぞってね');
            this.hud.setGesture('circle');
            this.hud.setProgress(this.activeSite.digProgress);
            this.guide.visible = true;
          },
        });
      },
    });
  }

  _enterCut() {
    this.setState(State.CUT);
    this.locked = true;
    this.guide.visible = false;
    this.hud.setGesture(null);
    this.hud.setProgress(null);
    this.hud.setPrompt('ねもとが みえたよ', 'したを きって はなそう');
    const site = this.activeSite;
    const dir = this._dirOf(site);
    // 手前の土を切り取って、根元と刃先が見えるようにする
    this.setCrossSection(true);
    this.setCloseLight(true, site, 0.30);
    // 刃を根元の横に構える
    const p = site.position;
    this.tool.visible = true;
    this.toolBaseY = p.y + site.takenokoBaseY + 0.012;
    this.toolAxis = new THREE.Vector3(-dir.z, 0, dir.x); // 刃が動く向き(画面の横)
    this.tool.position.set(
      p.x - this.toolAxis.x * 0.105,
      this.toolBaseY,
      p.z - this.toolAxis.z * 0.105
    );
    this.tool.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
    this.tool.scale.setScalar(0.001);
    this.tween.add({
      duration: 0.5,
      ease: Ease.outBack,
      onUpdate: (t) => this.tool.scale.setScalar(Math.max(0.001, t * 0.85)),
    });
    this.moveCamera('cut', {
      duration: this.fast ? 0.25 : 1.6,
      onComplete: () => {
        this.locked = false;
        this.hud.setPrompt('したを よこに きろう', 'ゆびを よこに スッと うごかしてね');
        this.hud.setGesture('cut');
        this.hud.setProgress(0);
      },
    });
  }

  _enterPull() {
    this.setState(State.PULL);
    this.locked = true;
    this.hud.setGesture(null);
    this.hud.setProgress(null);
    this.hud.setPrompt('きれた！', 'こんどは ひっぱるよ');
    this.audio.cut();
    this.activeSite.takenoko.userData.setCut(true);
    this.activeSite.spawnDirt(this.activeSite.position.clone().setY(this.activeSite.position.y - 0.2), 8, 0.7);
    this.tween.add({
      duration: 0.45,
      onUpdate: (t) => this.tool.scale.setScalar(Math.max(0.001, 0.85 * (1 - t))),
      onComplete: () => { this.tool.visible = false; },
    });
    this.setCloseLight(false);
    this.setCrossSection(false);
    this.moveCamera('pull', {
      duration: this.fast ? 0.25 : 1.4,
      onComplete: () => {
        this.locked = false;
        this.hud.setPrompt('うえに ひっぱろう！', 'ゆびを うえに うごかしてね');
        this.hud.setGesture('pull');
        this.hud.setProgress(0);
      },
    });
  }

  _pop() {
    const site = this.activeSite;
    this.setState(State.REVEAL);
    this.locked = true;
    this.hud.setGesture(null);
    this.hud.setProgress(null);
    this.hud.setPrompt('');
    this.hud.flash('とれた！');
    this.audio.pop();
    this.rig.addShake(0.9);
    site.spawnDirt(site.position.clone().setY(site.position.y - 0.12), this.fast ? 10 : 40, 1.5);

    // たけのこをシーンへ移して、抜ける演出をする
    const t = site.takenoko;
    const world = new THREE.Vector3();
    t.getWorldPosition(world);
    const quat = new THREE.Quaternion();
    t.getWorldQuaternion(quat);
    site.group.remove(t);
    this.scene.add(t);
    t.position.copy(world);
    t.quaternion.copy(quat);
    this.pulled = t;
    const startY = world.y;
    const revealY = site.position.y + 0.30;

    this.tween.add({
      duration: this.fast ? 0.25 : 0.62,
      ease: Ease.outBack,
      onUpdate: (k) => {
        t.position.y = startY + (revealY - startY) * k;
        t.rotation.z = Math.sin(k * 6.0) * 0.16 * (1 - k);
        t.rotation.x = Math.sin(k * 5.0 + 1) * 0.12 * (1 - k);
      },
    });
    this.tween.add({
      duration: this.fast ? 0.3 : 0.9,
      onUpdate: (k) => site.setCollapse(k),
    });
    this.moveCamera('reveal', { duration: this.fast ? 0.3 : 1.1 });
    // ゆっくり回して、掘り出したものの全体を見せる
    this.tween.add({
      delay: this.fast ? 0.2 : 0.7,
      duration: this.fast ? 0.2 : 1.5,
      ease: Ease.linear,
      onUpdate: (k) => {
        if (!this.pulled) return;
        this.pulled.rotation.y = k * Math.PI * 0.9;
        this.pulled.position.y = revealY + Math.sin(k * Math.PI * 2) * 0.012;
      },
    });
    this.tween.add({
      delay: this.fast ? 0.4 : 2.3,
      duration: 0.001,
      onComplete: () => this._enterCollect(),
    });
  }

  _enterCollect() {
    this.setState(State.COLLECT);
    this.locked = true;
    const t = this.pulled;
    const site = this.activeSite;
    site.taken = true;
    this.hud.setPrompt('かごに いれよう', '');
    const b = this.shot('basket');
    this.currentShot = 'basket';
    this.rig.moveTo(b.pos, b.target, { fov: b.fov, duration: this.fast ? 0.3 : 1.3 });

    const from = t.position.clone();
    const slot = this.basket.userData.slot++;
    const ang = slot * 2.1;
    const rad = slot === 0 ? 0 : 0.075;
    const local = new THREE.Vector3(
      Math.cos(ang) * rad,
      0.1 + Math.floor(slot / 3) * 0.05,
      Math.sin(ang) * rad
    );
    const to = this.basket.localToWorld(local.clone());
    const startQ = t.quaternion.clone();
    const endQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.3, ang, 0.25));
    this.tween.add({
      delay: this.fast ? 0.05 : 0.35,
      duration: this.fast ? 0.3 : 1.0,
      ease: Ease.inOutCubic,
      onUpdate: (k) => {
        t.position.lerpVectors(from, to, k);
        t.position.y += Math.sin(k * Math.PI) * 0.42; // ふわりと弧を描く
        t.quaternion.slerpQuaternions(startQ, endQ, k);
      },
      onComplete: () => {
        this.scene.remove(t);
        this.basket.add(t);
        t.position.copy(local);
        t.quaternion.copy(endQ);
        this.collected++;
        this.hud.setCount(this.collected);
        this.audio.basket();
        this.pulled = null;
        this.tween.add({
          delay: this.fast ? 0.1 : 0.75,
          duration: 0.001,
          onComplete: () => this._enterSurvey(),
        });
      },
    });
  }

  // ================= 断面表示 =================

  setCrossSection(on) {
    this.renderer.localClippingEnabled = true;
    const site = this.activeSite;
    if (on && site) {
      const dir = this._dirOf(site);
      this.clipPlane.normal.set(-dir.x, 0, -dir.z);
      this.clipPlane.constant = dir.dot(site.position);
      site.wall.position.set(-dir.x * 0.004, 0, -dir.z * 0.004);
    }
    for (const m of this.clippables) {
      const had = !!(m.clippingPlanes && m.clippingPlanes.length);
      m.clippingPlanes = on ? [this.clipPlane] : null;
      if (had !== on) m.needsUpdate = true;
    }
    if (site) site.setCrossSection(on);
  }

  // ================= 入力 =================

  /** ポインタのスナップショット({ndcX,ndcY})でも生の NDC({x,y})でも受け取れる */
  _rayFromNdc(p) {
    const x = p.ndcX !== undefined ? p.ndcX : p.x;
    const y = p.ndcY !== undefined ? p.ndcY : p.y;
    this.ray.setFromCamera(new THREE.Vector2(x, y), this.camera);
    return this.ray;
  }

  /** 地面(と各サイト)へのレイキャスト */
  pickGround(ndc) {
    const ray = this._rayFromNdc(ndc);
    const objs = [this.ground];
    for (const s of this.sites) {
      objs.push(s.soil);
      if (s.takenoko.parent === s.group) objs.push(s.takenoko.userData.body);
    }
    const hits = ray.intersectObjects(objs, false);
    if (!hits.length) return null;
    return hits[0];
  }

  /** サイト平面(水平)との交点。掘る・払うの座標に使う */
  pickSitePlane(ndc, site = this.activeSite, yOffset = 0) {
    if (!site) return null;
    const ray = this._rayFromNdc(ndc);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(site.position.y + yOffset));
    const out = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, out) ? out : null;
  }

  onTap(p) {
    this.audio.unlock();
    if (this.state === State.INTRO) {
      this.skipIntro();
      return;
    }
    if (this.state === State.DONE) {
      if (!this.locked) this.restart();
      return;
    }
    if (this.locked) return;
    if (this.state === State.SURVEY) this._trySelect(p);
  }

  _trySelect(p) {
    const hit = this.pickGround(p);
    if (!hit) {
      this._miss(null);
      return;
    }
    const pt = hit.point;
    // 多少ずれても、いちばん近いあやしい場所へ吸着する
    let best = null;
    let bestD = 1e9;
    for (const s of this.sites) {
      if (s.taken) continue;
      const d = Math.hypot(pt.x - s.position.x, pt.z - s.position.z);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best && bestD < 0.95) {
      this.approach(best);
      return;
    }
    let dec = null;
    let decD = 1e9;
    for (const d of this.decoys) {
      const dd = Math.hypot(pt.x - d.position.x, pt.z - d.position.z);
      if (dd < decD) { decD = dd; dec = d; }
    }
    this._miss(decD < 0.6 ? dec : null, pt);
  }

  /** はずれ。強い罰は無く、小さな反応とヒントだけ */
  _miss(decoy, point) {
    this.misses++;
    this.audio.nudge();
    if (decoy) {
      decoy.reveal();
      this.hud.setPrompt(
        decoy.kind === 'stone' ? 'あれ、いしだった' : 'はっぱだけ だったね',
        'たけのこは べつの ところに いるよ'
      );
    } else {
      this.hud.setPrompt('ここには なさそう…', 'つちが もりあがった ところを さがしてね');
      if (point) this._puff(point);
    }
    this.hintTimer = Math.max(this.hintTimer, this.misses >= 2 ? 0.05 : 3.5);
  }

  _puff(point) {
    const near = this._nearestSite(point);
    if (near) near.spawnDirt(point, 3, 0.35);
  }

  _nearestSite(point) {
    let best = null;
    let bd = 1e9;
    for (const s of this.sites) {
      const d = Math.hypot(point.x - s.position.x, point.z - s.position.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  nextTarget() {
    let best = null;
    let bd = 1e9;
    for (const s of this.sites) {
      if (s.taken) continue;
      const d = Math.hypot(PLAYER_POS.x - s.position.x, PLAYER_POS.z - s.position.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  onDown(p) {
    this.audio.unlock();
    if (this.state === State.DIG) this.digAngle = null;
  }

  onMove(p) {
    if (this.locked || !this.activeSite) return;
    const site = this.activeSite;
    switch (this.state) {
      case State.BRUSH: {
        const pt = this.pickSitePlane(p, site, 0.02);
        if (!pt) return;
        const n = site.brushAt(pt, 0.15);
        if (n > 0) {
          this.audio.leaves(Math.min(1, n / 4));
          this.hud.setProgress(site.brushProgress);
          if (site.brushProgress >= 1) this._brushDone();
        }
        break;
      }
      case State.DIG: {
        const pt = this.pickSitePlane(p, site, 0);
        if (!pt) return;
        const dx = pt.x - site.position.x;
        const dz = pt.z - site.position.z;
        const r = Math.hypot(dx, dz);
        if (r < 0.03 || r > SITE_RADIUS * 1.9) return;
        const a = Math.atan2(dz, dx);
        let d = 0;
        if (this.digAngle !== null) {
          d = a - this.digAngle;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          if (Math.abs(d) > 1.1) d = 0;
        }
        this.digAngle = a;
        if (d !== 0) {
          const gained = site.dig(a, d);
          if (gained > 0.0005) {
            this.dust += Math.abs(d);
            if (this.dust > 0.28) {
              this.dust = 0;
              // 掘っている位置は正しい円周へ吸着させる
              const snap = new THREE.Vector3(
                site.position.x + Math.cos(a) * DIG_GUIDE_RADIUS,
                site.position.y - site.depthAtAngle(a) * 0.6,
                site.position.z + Math.sin(a) * DIG_GUIDE_RADIUS
              );
              site.spawnDirt(snap, 3, 0.75);
              this.audio.dig(0.8);
            }
            this.hud.setProgress(site.digProgress);
            if (site.digProgress >= 0.45 && !this.crossShown) this._enterCross();
            else if (site.digProgress >= 0.82) this._digDone();
          }
        }
        break;
      }
      case State.CUT: {
        const w = this.renderer.domElement.clientWidth || 1;
        const along = Math.abs(p.dx) - Math.abs(p.dy) * 0.5;
        if (along > 0) {
          this.cutProgress = clamp(this.cutProgress + along / (w * 0.45), 0, 1);
          this.hud.setProgress(this.cutProgress);
          if (this.cutProgress >= 1) this._enterPull();
        }
        break;
      }
      case State.PULL: {
        const h = this.renderer.domElement.clientHeight || 1;
        if (p.dy < 0) {
          this.pullProgress = clamp(this.pullProgress + -p.dy / (h * 0.42), 0, 1);
          this.hud.setProgress(this.pullProgress);
          if (this.pullProgress >= 1) this._pop();
        }
        break;
      }
      default:
        break;
    }
  }

  onUp(p) {
    if (this.state === State.BRUSH && this.activeSite && this.activeSite.brushProgress >= 1) {
      this._brushDone();
    }
  }

  _brushDone() {
    if (this.state !== State.BRUSH) return;
    const site = this.activeSite;
    site.brushAll();
    site.crack.material.opacity *= 0.35;
    this.audio.leaves(1);
    this.hud.setProgress(1);
    this.setState(State.APPROACH);
    this.locked = true;
    this.hud.setPrompt('たけのこの あたまが みえた！', '');
    this.hud.setGesture(null);
    this.tween.add({
      duration: this.fast ? 0.2 : 1.0,
      onComplete: () => this._enterDig(),
    });
  }

  _digDone() {
    if (this.state !== State.DIG) return;
    this.setState(State.APPROACH);
    this.locked = true;
    this.guide.visible = false;
    this.hud.setGesture(null);
    this.hud.setPrompt('ほれた！', '');
    this.digFinishing = true;
  }

  // ================= 毎フレーム =================

  update(dt) {
    this.stateTime += dt;
    this.tween.update(dt);
    this.rig.update(dt);
    this.atmos.update(dt, this.camera);
    for (const s of this.sites) s.update(dt);
    for (const d of this.decoys) d.update(dt);

    if (this.digFinishing && this.activeSite) {
      if (this.activeSite.finishDig(dt)) {
        this.digFinishing = false;
        this._enterCut();
      }
    }

    // 掘る道具の位置(切る動きに合わせて横へ動く)
    if (this.state === State.CUT && this.activeSite && this.toolAxis) {
      const p = this.activeSite.position;
      const s = -0.105 + this.cutProgress * 0.21;
      this.tool.position.set(
        p.x + this.toolAxis.x * s,
        this.toolBaseY + Math.sin(this.cutProgress * Math.PI) * -0.004,
        p.z + this.toolAxis.z * s
      );
      if (this.cutProgress > 0.02 && Math.random() < 0.25 * dt * 60) {
        this.activeSite.spawnDirt(this.tool.position.clone(), 1, 0.35);
      }
    }

    // 引き抜きの手ごたえ
    if (this.state === State.PULL && this.activeSite) {
      const t = this.activeSite.takenoko;
      const base = this.activeSite.takenokoBaseY;
      const k = this.pullProgress;
      t.position.y = base + k * 0.055;
      t.rotation.z = Math.sin(this.stateTime * 22) * 0.012 * k;
      if (!this.input.active) this.pullProgress = Math.max(0, this.pullProgress - dt * 0.16);
    }

    // ぐるぐるガイドの案内ドット
    if (this.guide.visible && this.activeSite) {
      const a = this.stateTime * 1.5;
      const p = this.activeSite.position;
      const prog = this.activeSite.digProgress;
      this.guideDot.position.set(Math.cos(a) * DIG_GUIDE_RADIUS, 0.03, Math.sin(a) * DIG_GUIDE_RADIUS);
      this.guideRing.material.opacity = 0.22 + 0.34 * (1 - prog);
      this.guideGlow.material.opacity = 0.08 + 0.14 * (1 - prog);
      this.guide.position.set(p.x, p.y + 0.02, p.z);
    }

    // ヒント: 迷っていそうなら、そっと光の輪と指を出す
    if (this.state === State.SURVEY && !this.locked) {
      this.hintTimer += dt;
      const target = this.nextTarget();
      const need = this.collected === 0 ? 4.0 : this.misses >= 2 ? 0.1 : 11.0;
      if (target && this.hintTimer > need) {
        if (!target.ring.userData.target) {
          target.showRing(true);
          this.audio.chime(760);
        }
        // 指のヒントは対象の少し上に。たけのこの頭を隠さない
        const above = target.position.clone();
        above.y += 0.32;
        this.hud.setGesture('tap', this._project(above));
      } else {
        this.hud.setGesture(null);
      }
    } else if (
      this.state === State.BRUSH ||
      this.state === State.DIG ||
      this.state === State.CUT ||
      this.state === State.PULL
    ) {
      if (this.activeSite && !this.locked) {
        const p = this.focusPoint();
        if (p) this.hud.setGesture(this._gestureFor(this.state), this._project(p));
      }
    }
  }

  /** いま指を置くべき場所(世界座標)。ゆびヒントの位置とテストの操作点に使う */
  focusPoint() {
    if (this.state === State.SURVEY) {
      const t = this.nextTarget();
      return t ? t.position.clone() : null;
    }
    if (!this.activeSite) return null;
    const p = this.activeSite.position.clone();
    if (this.state === State.CUT) p.y += this.activeSite.takenokoBaseY + 0.02;
    else if (this.state === State.PULL || this.state === State.REVEAL) p.y -= 0.06;
    return p;
  }

  _gestureFor(state) {
    return { [State.BRUSH]: 'swipe', [State.DIG]: 'circle', [State.CUT]: 'cut', [State.PULL]: 'pull' }[state] || null;
  }

  _project(worldPos) {
    const v = worldPos.clone().project(this.camera);
    const el = this.renderer.domElement;
    return {
      x: (v.x * 0.5 + 0.5) * el.clientWidth,
      y: (-v.y * 0.5 + 0.5) * el.clientHeight,
    };
  }

  // ================= デバッグ / テスト用 =================

  debugState() {
    const s = this.activeSite;
    return {
      state: this.state,
      collected: this.collected,
      locked: this.locked,
      misses: this.misses,
      brush: s ? s.brushProgress : 0,
      dig: s ? s.digProgress : 0,
      cut: this.cutProgress,
      pull: this.pullProgress,
      crossShown: this.crossShown,
      siteIndex: s ? this.sites.indexOf(s) : -1,
      remaining: this.sites.filter((x) => !x.taken).length,
      aspect: this.camera.aspect,
    };
  }
}
