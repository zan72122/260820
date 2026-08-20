// 決定的な擬似乱数（E2E で同じ絵を再現するため）
export class Rng {
  constructor(seed = 20260820) { this.s = (seed >>> 0) || 1; }
  next() { // xorshift32
    let x = this.s;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    this.s = x;
    return x / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  /** 単位球面上の一様な向き */
  dir3(out) {
    const z = this.range(-1, 1);
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const th = this.range(0, Math.PI * 2);
    out.x = r * Math.cos(th); out.y = r * Math.sin(th); out.z = z;
    return out;
  }
  /** 正規分布っぽい値 */
  gauss() { return (this.next() + this.next() + this.next() + this.next() - 2) * 0.7071; }
}
export const rng = new Rng();
