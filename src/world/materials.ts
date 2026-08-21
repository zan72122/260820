import * as THREE from 'three';
import { metalRoughness, roughnessCloud } from '../core/textures';

/**
 * Shared shop materials. The point of this table is that aluminium, moulded
 * plastic and rubber must read apart by surface response alone, not by hue.
 */
export function makeShopMaterials(envMap: THREE.Texture): {
  aluminium: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  plastic: (color: number) => THREE.MeshPhysicalMaterial;
  rubber: THREE.MeshStandardMaterial;
  grip: THREE.MeshStandardMaterial;
  foam: THREE.MeshStandardMaterial;
  galv: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
} {
  const alRough = metalRoughness();
  alRough.repeat.set(2, 2);

  const aluminium = new THREE.MeshStandardMaterial({
    color: 0xcfd4d8,
    metalness: 1,
    roughness: 0.34,
    roughnessMap: alRough,
    envMap,
    envMapIntensity: 1.25,
  });

  const steel = new THREE.MeshStandardMaterial({
    color: 0xe4e9ee,
    metalness: 1,
    roughness: 0.16,
    envMap,
    envMapIntensity: 1.4,
  });

  const rubber = new THREE.MeshStandardMaterial({
    color: 0x25292d,
    metalness: 0,
    roughness: 0.94,
    roughnessMap: roughnessCloud(0.9, 0.08, 77, 'rubberRough'),
    envMap,
    envMapIntensity: 0.35,
  });

  const grip = new THREE.MeshStandardMaterial({
    color: 0x2f3a40,
    metalness: 0,
    roughness: 0.86,
    envMap,
    envMapIntensity: 0.4,
  });

  const foam = new THREE.MeshStandardMaterial({
    color: 0xf7e9c9,
    metalness: 0,
    roughness: 0.99,
    envMap,
    envMapIntensity: 0.25,
  });

  const galv = new THREE.MeshStandardMaterial({
    color: 0xa9b6ba,
    metalness: 0.45,
    roughness: 0.56,
    roughnessMap: alRough,
    envMap,
    envMapIntensity: 0.9,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xdff3ff,
    metalness: 0,
    roughness: 0.05,
    transparent: true,
    opacity: 0.55,
    clearcoat: 1,
    envMap,
    envMapIntensity: 1.6,
  });

  const plastic = (color: number): THREE.MeshPhysicalMaterial =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0,
      roughness: 0.42,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
      envMap,
      envMapIntensity: 0.9,
    });

  return { aluminium, steel, galv, plastic, rubber, grip, foam, glass };
}

export type ShopMaterials = ReturnType<typeof makeShopMaterials>;
