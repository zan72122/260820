import * as THREE from 'three';
import * as T from './textures.js';

/* Shared material library. Canvases are painted once and reused, so the
   whole vehicle fleet costs only a handful of textures on a phone. */

let lib = null;

export function materials() {
  if (lib) return lib;

  const asphaltC = T.asphaltTexture();
  const asphaltR = T.asphaltRoughness();
  const packedC = T.packedSnowTexture();
  const snowC = T.snowTexture();

  const road = T.stdMaterial({
    mapCanvas: asphaltC, repeat: 1, roughCanvas: asphaltR,
    color: 0x8f9aa4, roughness: 0.62, metalness: 0.05,
  });
  road.map.repeat.set(2, 26);
  road.roughnessMap.repeat.set(2, 26);

  const sidewalk = T.stdMaterial({
    mapCanvas: asphaltC, color: 0xb9c2cb, roughness: 0.95,
  });
  sidewalk.map.repeat.set(1, 14);

  const packedSnow = T.stdMaterial({
    mapCanvas: packedC, color: 0xdfe9f4, roughness: 0.85, metalness: 0.0,
  });
  packedSnow.map.repeat.set(1, 1);

  const snowGround = T.stdMaterial({
    mapCanvas: snowC, color: 0xe8f1fb, roughness: 0.9,
  });
  snowGround.map.repeat.set(18, 18);

  const snowPile = T.stdMaterial({
    mapCanvas: snowC, color: 0xf0f6ff, roughness: 0.82, flatShading: false,
  });
  snowPile.map.repeat.set(3, 3);

  const snowChunk = new THREE.MeshStandardMaterial({
    color: 0xf4f9ff, roughness: 0.85, metalness: 0, flatShading: true,
  });

  const orangePaint = T.stdMaterial({
    mapCanvas: T.paintTexture(0xff8f22, { rust: 1.0, dirt: 0.9 }),
    color: 0xffffff, roughness: 0.52, metalness: 0.45,
  });
  const yellowPaint = T.stdMaterial({
    mapCanvas: T.paintTexture(0xf6c81c, { rust: 0.8, dirt: 1.0 }),
    color: 0xffffff, roughness: 0.55, metalness: 0.4,
  });
  // the chute is the part a child should track with their eyes: keep it loud
  const chutePaint = T.stdMaterial({
    mapCanvas: T.paintTexture(0xffd815, { rust: 0.45, dirt: 0.5 }),
    color: 0xffffff, roughness: 0.45, metalness: 0.3,
  });
  const bluePaint = T.stdMaterial({
    mapCanvas: T.paintTexture(0x2b6ec4, { rust: 0.7, dirt: 0.9 }),
    color: 0xffffff, roughness: 0.5, metalness: 0.45,
  });
  const greyPaint = T.stdMaterial({
    mapCanvas: T.paintTexture(0x8d97a2, { rust: 0.9, dirt: 1.0 }),
    color: 0xffffff, roughness: 0.6, metalness: 0.5,
  });
  const darkPaint = T.stdMaterial({
    mapCanvas: T.paintTexture(0x37414c, { rust: 0.9, dirt: 1.0 }),
    color: 0xffffff, roughness: 0.62, metalness: 0.45,
  });

  const hazard = T.stdMaterial({
    mapCanvas: T.hazardTexture(), color: 0xffffff, roughness: 0.6, metalness: 0.35,
  });

  const bareSteel = new THREE.MeshStandardMaterial({
    color: 0x9aa3ac, roughness: 0.42, metalness: 0.85, envMapIntensity: 0.9,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xd6dee6, roughness: 0.2, metalness: 1.0, envMapIntensity: 1.0,
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x14171b, roughness: 0.95, metalness: 0.0,
  });
  const rubberDirty = new THREE.MeshStandardMaterial({
    color: 0x21262c, roughness: 0.98, metalness: 0.0,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x8ec6e2, roughness: 0.05, metalness: 0.2,
    transparent: true, opacity: 0.5, envMapIntensity: 1.6,
  });
  const lampWhite = new THREE.MeshStandardMaterial({
    color: 0xfff6d8, emissive: 0xfff0c0, emissiveIntensity: 2.2, roughness: 0.3,
  });
  const lampAmber = new THREE.MeshStandardMaterial({
    color: 0xffb020, emissive: 0xff8a00, emissiveIntensity: 2.6,
    roughness: 0.35, transparent: true, opacity: 0.9,
  });
  const lampRed = new THREE.MeshStandardMaterial({
    color: 0xff3b30, emissive: 0xff1a10, emissiveIntensity: 1.8, roughness: 0.4,
  });

  for (const m of [road, packedSnow, snowGround, snowPile, snowChunk]) m.envMapIntensity = 0.35;
  for (const m of [orangePaint, yellowPaint, chutePaint, bluePaint, greyPaint, darkPaint]) m.envMapIntensity = 0.55;

  lib = {
    road, sidewalk, packedSnow, snowGround, snowPile, snowChunk,
    orangePaint, yellowPaint, chutePaint, bluePaint, greyPaint, darkPaint,
    bareSteel, chrome, rubber, rubberDirty, glass, hazard,
    lampWhite, lampAmber, lampRed,
    canvases: { asphaltC, packedC, snowC },
  };
  return lib;
}
