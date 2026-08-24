import { Game } from './game';

const container = document.getElementById('app')!;
const game = new Game(container);

let last = performance.now();
function frame(now: number) {
  // タブ復帰などの大きな飛びは切り詰める
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.update(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame((now) => {
  last = now;
  frame(now);
});
