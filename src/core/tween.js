// ちいさなトゥイーン。カメラ演出と演出用の値をすべてここで動かす。

export const Ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c1 = 1.9;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  outBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

export class Tweener {
  constructor() {
    this.items = [];
  }

  /**
   * @param {object} o {duration, ease, onUpdate(t), onComplete(), delay}
   */
  add(o) {
    const item = {
      t: 0,
      delay: o.delay || 0,
      duration: Math.max(0.0001, o.duration || 0.5),
      ease: o.ease || Ease.inOut,
      onUpdate: o.onUpdate,
      onComplete: o.onComplete,
      done: false,
    };
    this.items.push(item);
    return item;
  }

  /** 指定タグの以前のトゥイーンを止めたいときに使う簡易版 */
  clear() {
    this.items.length = 0;
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.delay > 0) {
        it.delay -= dt;
        continue;
      }
      it.t += dt;
      const k = Math.min(1, it.t / it.duration);
      if (it.onUpdate) it.onUpdate(it.ease(k), k);
      if (k >= 1) {
        this.items.splice(i, 1);
        if (it.onComplete) it.onComplete();
      }
    }
  }

  get busy() {
    return this.items.length > 0;
  }
}

/** 指数的な追従。フレームレートに依存しない滑らかな補間 */
export function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
