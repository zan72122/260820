// かごと、根元を切る道具。実寸で作る。
import * as THREE from 'three';
import { basketTexture } from '../world/textures.js';

/** 竹かご: 直径 44cm、深さ 26cm ほど */
export function createBasket() {
  const group = new THREE.Group();
  group.name = 'basket';
  const mat = new THREE.MeshStandardMaterial({
    map: basketTexture(),
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.155, 0.26, 22, 3, true), mat);
  body.position.y = 0.13;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.155, 22), mat);
  bottom.rotateX(-Math.PI / 2);
  bottom.position.y = 0.004;
  bottom.receiveShadow = true;
  group.add(bottom);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.221, 0.016, 7, 26),
    new THREE.MeshStandardMaterial({ map: basketTexture(), color: 0xcdac74, roughness: 0.82 })
  );
  rim.rotateX(Math.PI / 2);
  rim.position.y = 0.258;
  rim.castShadow = true;
  group.add(rim);

  group.userData.slot = 0;
  group.userData.mouthY = 0.26;
  return group;
}

/** たけのこ掘りの道具(小さな鍬先のような刃) */
export function createDigTool() {
  const group = new THREE.Group();
  group.name = 'digTool';
  const steel = new THREE.MeshStandardMaterial({
    color: 0xa8aeb4,
    roughness: 0.28,
    metalness: 0.8,
  });
  const edge = new THREE.MeshStandardMaterial({
    color: 0xdfe6ea,
    roughness: 0.14,
    metalness: 0.95,
  });
  // 刃: 幅 11cm、厚み 4mm
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.005, 0.07), steel);
  blade.castShadow = true;
  group.add(blade);
  const edgeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.002, 0.014), edge);
  edgeMesh.position.set(0, -0.0015, -0.035);
  group.add(edgeMesh);
  // 首と柄
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.06, 8), steel);
  neck.position.set(0, 0.028, 0.036);
  neck.rotation.x = -0.5;
  group.add(neck);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.014, 0.24, 10),
    new THREE.MeshStandardMaterial({ color: 0x6d4f30, roughness: 0.85 })
  );
  handle.position.set(0, 0.13, 0.115);
  handle.rotation.x = -0.5;
  handle.castShadow = true;
  group.add(handle);
  return group;
}
