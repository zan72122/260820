// ---------------------------------------------------------------------------
// ラムネ瓶（コッド瓶）の断面プロファイル定義。
// メッシュ生成・ビー玉の物理・液量計算がすべてこの 1 ファイルを共有する。
// 単位はメートル。原点は瓶底の中心、+Y が瓶口方向。
// ---------------------------------------------------------------------------

export const BOTTLE_HEIGHT = 0.200;   // 200mm
export const MARBLE_R      = 0.00850; // ビー玉 直径 17mm
export const MOUTH_Y       = 0.200;

// 外形（下→上）。[y, r]
export const OUTER = [
  [0.0000, 0.0000],
  [0.0000, 0.0230],
  [0.0018, 0.0270],
  [0.0055, 0.0296],
  [0.0140, 0.0303],
  [0.0600, 0.0304],
  [0.0850, 0.0302],
  [0.1020, 0.0295],
  [0.1120, 0.0285],
  [0.1200, 0.0264],
  [0.1290, 0.0223],
  [0.1360, 0.0176],
  [0.1420, 0.0147],
  [0.1480, 0.0132],
  [0.1530, 0.0128], // くびれ（手で持つところ）
  [0.1580, 0.0130],
  [0.1620, 0.0140],
  [0.1660, 0.0148], // ビー玉室のふくらみ
  [0.1740, 0.0151],
  [0.1810, 0.0147],
  [0.1860, 0.0138],
  [0.1888, 0.0159], // 口元のフランジ
  [0.1930, 0.0161],
  [0.1962, 0.0139],
  [0.2000, 0.0132],
];

// 内形（上→下）。[y, r]
export const INNER = [
  [0.2000, 0.00750], // 瓶口（ビー玉 r=0.0085 は通り抜けられない）
  [0.1962, 0.00735],
  [0.1930, 0.00760],
  [0.1900, 0.00880], // ビー玉が栓として密着する座面
  [0.1870, 0.01040],
  [0.1840, 0.01140],
  [0.1800, 0.01205],
  [0.1740, 0.01230], // ビー玉室
  [0.1680, 0.01225],
  [0.1640, 0.01180],
  [0.1600, 0.00900],
  [0.1570, 0.00690], // 絞り（ビー玉はここから下へ落ちない）
  [0.1500, 0.00680],
  [0.1450, 0.00760],
  [0.1400, 0.00980],
  [0.1360, 0.01380],
  [0.1290, 0.01940],
  [0.1200, 0.02350],
  [0.1120, 0.02570],
  [0.1020, 0.02670],
  [0.0850, 0.02740],
  [0.0600, 0.02760],
  [0.0140, 0.02760],
  [0.0095, 0.02480],
  [0.0080, 0.01900],
  [0.0080, 0.00000], // 内側の底
];

// 瓶首のくぼみ（ビー玉保持用の 2 点の凹み）。±X 側に対で入る。
export const DIMPLE = {
  y: 0.1790,
  depth: 0.00260, // 内壁が内側へ張り出す量
  sigmaY: 0.0042, // 高さ方向の広がり
  power: 6.0,     // 角度方向の集中度（cos^power）
};

// 未開栓のラムネは炭酸圧で満たされていて、液面はビー玉の底に接している。
// 開栓すると圧が抜けて泡が口から少し逃げ、液面が首の中をすっと下がる。
// この落差が「開けた」という状態変化の一番わかりやすい signal になる。
export const LIQUID_START_Y = 0.1815;
export const POP_VENT_VOLUME = 8.5e-6; // 開栓で逃げる分（m^3 = 8.5mL）

// --- 補間ヘルパ -----------------------------------------------------------

function sampleProfile(list, y) {
  // list は y 昇順とは限らないので呼び出し側で整列済みのものを渡す
  if (y <= list[0][0]) return list[0][1];
  const n = list.length;
  if (y >= list[n - 1][0]) return list[n - 1][1];
  for (let i = 1; i < n; i++) {
    if (y <= list[i][0]) {
      const [y0, r0] = list[i - 1];
      const [y1, r1] = list[i];
      const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      return r0 + (r1 - r0) * t;
    }
  }
  return list[n - 1][1];
}

const INNER_ASC = INNER.slice().reverse();

/** 高さ y における内壁半径（くぼみは含まない） */
export function innerRadiusAt(y) {
  return sampleProfile(INNER_ASC, y);
}

/** 高さ y における外壁半径 */
export function outerRadiusAt(y) {
  return sampleProfile(OUTER, y);
}

/** くぼみによる半径の減少量（角度 phi は X 軸からのラジアン） */
export function dimpleInset(y, phi) {
  const dy = (y - DIMPLE.y) / DIMPLE.sigmaY;
  const fy = Math.exp(-dy * dy);
  if (fy < 0.004) return 0;
  const c = Math.abs(Math.cos(phi)); // ±X の 2 箇所
  const fa = Math.pow(c, DIMPLE.power);
  return DIMPLE.depth * fy * fa;
}

// --- 体積サンプル ---------------------------------------------------------
// 任意姿勢での液面高さを求めるための内部空間サンプル点群。
// 各点は等体積を担当する（層別サンプリング）。

export function buildVolumeSamples(count = 1100) {
  const yLo = 0.0080;
  const yHi = 0.1900;
  // まず高さ方向の累積断面積で層を切る
  const N = 220;
  const areas = new Float64Array(N);
  let total = 0;
  for (let i = 0; i < N; i++) {
    const y = yLo + ((i + 0.5) / N) * (yHi - yLo);
    const r = innerRadiusAt(y);
    areas[i] = Math.PI * r * r;
    total += areas[i];
  }
  const dy = (yHi - yLo) / N;
  const volume = total * dy;

  const pts = new Float32Array(count * 3);
  let seed = 20260820;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // 累積分布から逆変換サンプリング
  const cum = new Float64Array(N);
  let acc = 0;
  for (let i = 0; i < N; i++) { acc += areas[i]; cum[i] = acc / total; }

  for (let k = 0; k < count; k++) {
    const u = (k + rnd()) / count; // 層別化
    let lo = 0, hi = N - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < u) lo = mid + 1; else hi = mid; }
    const y = yLo + (lo + rnd()) * dy;
    const rMax = innerRadiusAt(y);
    const rr = rMax * Math.sqrt(rnd());
    const a = rnd() * Math.PI * 2;
    pts[k * 3 + 0] = Math.cos(a) * rr;
    pts[k * 3 + 1] = y;
    pts[k * 3 + 2] = Math.sin(a) * rr;
  }
  return { points: pts, count, volume };
}
