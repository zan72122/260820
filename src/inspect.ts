import * as THREE from 'three';
import { HeroPlant, PlantAssets } from './world/Plant';

/**
 * Asset check: one plant, one light, no game. Used to confirm the pods, the
 * roots and the clinging soil actually look like what they are supposed to be.
 */
export function inspect(container: HTMLElement) {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6f7a86);
  const cam = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 20);
  cam.position.set(0.45, 0.28, 0.62);
  cam.lookAt(0, 0.02, 0);

  const sun = new THREE.DirectionalLight(0xffe6ba, 3.2);
  sun.position.set(2, 3, 2.5);
  scene.add(sun, new THREE.HemisphereLight(0xb4cce8, 0x8a7350, 0.7));

  const assets = new PlantAssets();
  const plant = new HeroPlant(assets, {
    podCount: 28,
    podScale: 1.1,
    podSpread: 0.12,
    clumpCount: 14,
    wetness: 0.4,
    seed: 4242,
  });
  scene.add(plant.group);

  const params = new URLSearchParams(location.search);
  const revealed = params.get('revealed') === '1';
  if (revealed) {
    plant.setSoil(0.05);
    plant.setPodReveal(1);
    plant.body.rotation.x = Math.PI;
    plant.group.position.y = 0.16;
  }

  const state = {
    pods: plant.pods.count,
    revealed,
  };
  (window as unknown as { __inspect: unknown }).__inspect = () => state;

  let t = 0;
  const loop = () => {
    t += 0.016;
    plant.group.rotation.y = t * 0.4;
    plant.update(0.016);
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  };
  loop();
}
