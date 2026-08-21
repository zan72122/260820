import './ui/styles.css';
import { App } from './app';

const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
const hud = document.getElementById('hud');

if (canvas && hud) {
  const app = new App(canvas, hud);
  void app.boot();
}
