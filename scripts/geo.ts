import { TOP_HEIGHT, EXIT_X, SLIDE_LENGTH, slidePoint, slideSlope, START_ZONES, restArc } from '../src/world/slideCurve';
console.log('TOP_HEIGHT', TOP_HEIGHT.toFixed(3), 'EXIT_X', EXIT_X.toFixed(3), 'L', SLIDE_LENGTH);
for (const z of START_ZONES) {
  const p = slidePoint(z.center);
  console.log(z.id, 'gateArc', z.center, 'pos', p.x.toFixed(3), p.y.toFixed(3), 'slope', ((slideSlope(z.center) * 180) / Math.PI).toFixed(1), 'restArc', restArc(z.center, 0.036).toFixed(3));
}
for (const s of [0, 1, 2, 3, 4, 4.6]) {
  const p = slidePoint(s);
  console.log('s=', s, p.x.toFixed(3), p.y.toFixed(3), 'slope', ((slideSlope(s) * 180) / Math.PI).toFixed(1));
}
