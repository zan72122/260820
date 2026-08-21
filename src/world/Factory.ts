import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
} from 'three';
import type { MaterialLibrary } from '../materials/Materials';
import type { QualitySettings } from '../core/Quality';
import { beam, buildPlate, revolve } from './geo';

/**
 * Deep background. Loaded after the flume is already playable, kept at low
 * LOD and lit flat — it only has to give scale and aerial perspective.
 */
export function buildFactory(mats: MaterialLibrary, q: QualitySettings): Group {
  const g = new Group();
  const detail = q.farLOD;

  // ---- assembly hall ----
  const hall = new Group();
  hall.position.set(-78, 0, 16);
  hall.rotation.y = 1.32;
  const shell = new Mesh(beam(44, 13, 24), mats.building);
  shell.position.y = 6.5;
  hall.add(shell);
  const roof = new Mesh(beam(45.5, 1.2, 25.5), mats.buildingRoof);
  roof.position.y = 13.4;
  hall.add(roof);
  if (detail > 0.3) {
    for (let i = 0; i < 9; i++) {
      const rib = new Mesh(beam(0.35, 12.6, 0.35), mats.darkTrim);
      rib.position.set(-21 + i * 5.2, 6.5, 12.2);
      hall.add(rib);
    }
    for (let i = 0; i < 3; i++) {
      const door = new Mesh(beam(6.2, 7.4, 0.3), mats.darkTrim);
      door.position.set(-13 + i * 13, 3.7, 12.25);
      hall.add(door);
    }
    const strip = new Mesh(beam(43, 2.2, 0.25), mats.glassFar);
    strip.position.set(0, 10.4, 12.25);
    hall.add(strip);
  }
  g.add(hall);

  const office = new Mesh(beam(16, 9, 12), mats.building);
  office.position.set(-64, 4.5, -46);
  office.rotation.y = 1.1;
  g.add(office);
  const officeGlass = new Mesh(beam(15.4, 5.6, 0.3), mats.glassFar);
  officeGlass.position.set(-58.6, 5.2, -46);
  officeGlass.rotation.y = 1.1;
  g.add(officeGlass);

  // ---- gantry crane ----
  const crane = new Group();
  crane.position.set(-46, 0, 34);
  crane.rotation.y = 0.9;
  for (const s of [-1, 1]) {
    const leg = new Mesh(beam(0.7, 15.5, 0.7), mats.steelDark);
    leg.position.set(s * 11, 7.75, 0);
    crane.add(leg);
    const brace = new Mesh(beam(0.4, 11, 0.4), mats.steelDark);
    brace.position.set(s * 10.2, 6.5, 0);
    brace.rotation.z = s * 0.14;
    crane.add(brace);
  }
  const girder = new Mesh(beam(24, 1.5, 1.1), mats.paint);
  girder.position.y = 16;
  crane.add(girder);
  const trolley = new Mesh(beam(2.2, 1.6, 1.6), mats.steelDark);
  trolley.position.set(3.5, 14.6, 0);
  crane.add(trolley);
  const hook = new Mesh(beam(0.16, 5.6, 0.16), mats.steel);
  hook.position.set(3.5, 11.4, 0);
  crane.add(hook);
  g.add(crane);

  // ---- slide sections under assembly ----
  const sections = Math.max(2, Math.round(4 * detail));
  for (let i = 0; i < sections; i++) {
    const sec = new Group();
    sec.position.set(-38 - i * 7, 0, 12 + i * 9);
    sec.rotation.y = 0.5 + i * 0.7;
    const arc = new Mesh(
      new TorusGeometry(4.2, 0.98, Math.max(8, Math.round(14 * detail)), Math.max(10, Math.round(22 * detail)), 1.5),
      mats.frpOuter,
    );
    arc.rotation.x = Math.PI * 0.5;
    arc.rotation.z = 0.4;
    arc.position.y = 2.6;
    sec.add(arc);
    for (const s of [-1, 1]) {
      const stand = new Mesh(beam(0.5, 2.0, 0.5), mats.steelDark);
      stand.position.set(s * 2.4, 1.0, 0);
      sec.add(stand);
    }
    g.add(sec);
  }

  // stacked plates on pallets
  for (let i = 0; i < 3; i++) {
    const stack = new Group();
    stack.position.set(-30 - i * 3.4, 0, -6);
    stack.rotation.y = 0.2 * i;
    for (let k = 0; k < 5; k++) {
      const p = new Mesh(buildPlate({ half: 0.62, thickness: 0.03, corner: 0.05 }), mats.frpRib);
      p.position.y = 0.2 + k * 0.045;
      stack.add(p);
    }
    const pal = new Mesh(beam(1.5, 0.16, 1.5), mats.darkTrim);
    pal.position.y = 0.08;
    stack.add(pal);
    g.add(stack);
  }

  // ---- perimeter and tree line ----
  const fenceTex = fenceTexture();
  const fenceMat = new MeshBasicMaterial({
    map: fenceTex,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    fog: true,
  });
  for (const z of [96, -86]) {
    const fence = new Mesh(new PlaneGeometry(220, 2.1), fenceMat);
    fence.position.set(0, 1.05, z);
    g.add(fence);
    for (let i = -6; i <= 6; i++) {
      const post = new Mesh(revolve([new Vector2(0.05, 0), new Vector2(0.05, 2.1)], 6), mats.steelDark);
      post.position.set(i * 17, 0, z);
      g.add(post);
    }
  }

  const treeTex = treeTexture();
  const treeMat = new MeshBasicMaterial({ map: treeTex, transparent: true, depthWrite: false, side: DoubleSide });
  for (let i = 0; i < 5; i++) {
    const belt = new Mesh(new PlaneGeometry(190, 26), treeMat);
    belt.position.set(-230 + i * 122, 12, -186 - (i % 2) * 34);
    belt.rotation.y = i % 2 ? 0.1 : -0.08;
    g.add(belt);
  }
  const belt2 = new Mesh(new PlaneGeometry(420, 30), treeMat);
  belt2.position.set(60, 13, 214);
  belt2.rotation.y = Math.PI;
  g.add(belt2);

  g.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });
  return g;
}

function fenceTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d');
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(150,160,168,0.72)';
  ctx.lineWidth = 2;
  for (let i = -64; i < 64; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 64, 64);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + 64, 0);
    ctx.lineTo(i, 64);
    ctx.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = 1000;
  t.repeat.set(50, 1);
  return t;
}

function treeTexture(): CanvasTexture {
  const w = 256;
  const h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d');
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * w;
    const r = 6 + Math.random() * 14;
    const y = h - r * 0.5 - Math.random() * 12;
    const shade = 44 + Math.random() * 34;
    ctx.fillStyle = `rgba(${Math.round(shade * 0.7)},${Math.round(shade)},${Math.round(shade * 0.72)},0.94)`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
