import { IN } from '../util/units';

/** USBC規格ピンの回転体プロファイル（高さin → 直径in）。 */
const CONTROL: [number, number][] = [
  [0.0, 2.031],
  [0.375, 2.828],
  [0.75, 3.406],
  [1.125, 3.906],
  [2.25, 4.51],
  [3.375, 4.71],
  [4.5, 4.766],
  [5.875, 4.51],
  [7.25, 3.703],
  [8.625, 2.472],
  [10.0, 1.797],
  [11.25, 2.094],
  [12.375, 2.406],
  [13.125, 2.547],
  [13.875, 2.49],
  [14.4, 2.15],
  [14.8, 1.35],
  [15.0, 0.0],
];

/** 高さ h(m) における半径(m)。エルミート補間で滑らかに */
export function pinRadiusAt(hMeters: number): number {
  const h = hMeters / IN;
  const last = CONTROL[CONTROL.length - 1]!;
  if (h <= 0) return (CONTROL[0]![1] / 2) * IN;
  if (h >= last[0]) return 0;
  let i = 0;
  while (i < CONTROL.length - 2 && CONTROL[i + 1]![0] < h) i++;
  const [h0, d0] = CONTROL[i]!;
  const [h1, d1] = CONTROL[i + 1]!;
  const t = (h - h0) / (h1 - h0);
  // 区間端の傾き（中央差分）
  const dm = i > 0 ? (d1 - CONTROL[i - 1]![1]) / (h1 - CONTROL[i - 1]![0]) : (d1 - d0) / (h1 - h0);
  const dp =
    i + 2 < CONTROL.length ? (CONTROL[i + 2]![1] - d0) / (CONTROL[i + 2]![0] - h0) : (d1 - d0) / (h1 - h0);
  const t2 = t * t;
  const t3 = t2 * t;
  const dh = h1 - h0;
  const dia =
    (2 * t3 - 3 * t2 + 1) * d0 +
    (t3 - 2 * t2 + t) * dm * dh +
    (-2 * t3 + 3 * t2) * d1 +
    (t3 - t2) * dp * dh;
  return (Math.max(dia, 0) / 2) * IN;
}

/** 一様密度の回転体としての質量特性（実測質量へスケール） */
export function pinMassProperties(totalMass: number): {
  comY: number;
  /** 主慣性 [Ixx, Iyy, Izz]（COM回り, kg·m²） */
  inertia: [number, number, number];
} {
  const H = 15 * IN;
  const n = 300;
  const dh = H / n;
  let vol = 0;
  let momY = 0;
  const slices: { y: number; r: number; v: number }[] = [];
  for (let i = 0; i < n; i++) {
    const y = (i + 0.5) * dh;
    const r = pinRadiusAt(y);
    const v = Math.PI * r * r * dh;
    vol += v;
    momY += v * y;
    slices.push({ y, r, v });
  }
  const comY = momY / vol;
  const rho = totalMass / vol;
  let iAxial = 0; // y軸（対称軸）回り
  let iTrans = 0; // COMを通る横軸回り
  for (const s of slices) {
    const m = rho * s.v;
    iAxial += 0.5 * m * s.r * s.r;
    const d = s.y - comY;
    iTrans += m * ((s.r * s.r) / 4 + d * d);
  }
  return { comY, inertia: [iTrans, iAxial, iTrans] };
}
