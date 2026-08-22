import * as THREE from 'three';
import {
  brushedRoughness,
  handledRoughness,
  feltAlbedo,
  floorAlbedo,
  plasterAlbedo,
  resetSeed,
  woodAlbedo,
  woodRoughness,
} from './textures';

/**
 * Shared PBR materials. Deliberate variation between metals — different
 * base colors, roughness structure and wear — so nothing reads as "the
 * same chrome everywhere".
 */
export interface MaterialSet {
  brassKey: THREE.MeshStandardMaterial;
  nickelSilverKey: THREE.MeshStandardMaterial;
  agedBrassKey: THREE.MeshStandardMaterial;
  plugBrass: THREE.MeshStandardMaterial;
  plugSection: THREE.MeshStandardMaterial;
  housingNickel: THREE.MeshStandardMaterial;
  housingSection: THREE.MeshStandardMaterial;
  lowerPin: THREE.MeshStandardMaterial;
  upperPin: THREE.MeshStandardMaterial;
  springSteel: THREE.MeshStandardMaterial;
  boltSteel: THREE.MeshStandardMaterial;
  cabinetWood: THREE.MeshStandardMaterial;
  cabinetWoodSide: THREE.MeshStandardMaterial;
  benchWood: THREE.MeshStandardMaterial;
  felt: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  wall: THREE.MeshStandardMaterial;
  corridorWall: THREE.MeshStandardMaterial;
  darkIron: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  musicBoxBrass: THREE.MeshStandardMaterial;
}

export function createMaterials(): MaterialSet {
  resetSeed();

  const brassKey = new THREE.MeshStandardMaterial({
    color: 0xc9a24a,
    metalness: 1.0,
    roughness: 0.34,
    roughnessMap: handledRoughness(0.34),
  });

  const nickelSilverKey = new THREE.MeshStandardMaterial({
    color: 0xc4c8c2,
    metalness: 1.0,
    roughness: 0.4,
    roughnessMap: handledRoughness(0.4),
  });

  const agedBrassKey = new THREE.MeshStandardMaterial({
    color: 0xa8823c,
    metalness: 1.0,
    roughness: 0.5,
    roughnessMap: handledRoughness(0.5),
  });

  const plugBrass = new THREE.MeshStandardMaterial({
    color: 0xbe9a48,
    metalness: 1.0,
    roughness: 0.3,
    roughnessMap: brushedRoughness(0.3, 0.22, false),
  });

  // machined section faces: flat-milled, slightly duller than turned faces
  const plugSection = new THREE.MeshStandardMaterial({
    color: 0xcaa855,
    metalness: 1.0,
    roughness: 0.44,
    roughnessMap: brushedRoughness(0.44, 0.12, true),
  });

  const housingNickel = new THREE.MeshStandardMaterial({
    color: 0xb9bdbf,
    metalness: 1.0,
    roughness: 0.36,
    roughnessMap: brushedRoughness(0.36, 0.18, false),
  });

  const housingSection = new THREE.MeshStandardMaterial({
    color: 0xa7abad,
    metalness: 1.0,
    roughness: 0.5,
    roughnessMap: brushedRoughness(0.5, 0.1, true),
  });

  // lower pins: turned brass, polished by key contact on the tips
  const lowerPin = new THREE.MeshStandardMaterial({
    color: 0xc09c50,
    metalness: 1.0,
    roughness: 0.28,
  });

  // upper (driver) pins: nickel-plated steel — a different metal on purpose
  const upperPin = new THREE.MeshStandardMaterial({
    color: 0xaeb2b4,
    metalness: 1.0,
    roughness: 0.42,
  });

  const springSteel = new THREE.MeshStandardMaterial({
    color: 0x8e9294,
    metalness: 1.0,
    roughness: 0.55,
  });

  const boltSteel = new THREE.MeshStandardMaterial({
    color: 0x969a9c,
    metalness: 1.0,
    roughness: 0.46,
    roughnessMap: brushedRoughness(0.46, 0.2, false),
  });

  const woodRough = woodRoughness();
  const cabinetWoodMap = woodAlbedo({ light: '#79492a', dark: '#4c2d16', rings: 34, alongU: false });
  cabinetWoodMap.repeat.set(1.4, 1.0);
  const cabinetWood = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: cabinetWoodMap,
    roughness: 0.62,
    roughnessMap: woodRough,
    metalness: 0.0,
  });

  const cabinetWoodSideMap = woodAlbedo({ light: '#6d4326', dark: '#452817', rings: 40, alongU: true });
  cabinetWoodSideMap.repeat.set(1.0, 1.6);
  const cabinetWoodSide = new THREE.MeshStandardMaterial({
    color: 0xf2e8dc,
    map: cabinetWoodSideMap,
    roughness: 0.66,
    roughnessMap: woodRough,
    metalness: 0.0,
  });

  const benchWood = new THREE.MeshStandardMaterial({
    color: 0xd9c8b0,
    map: woodAlbedo({ light: '#8a6c44', dark: '#54391e', rings: 16, alongU: true }),
    roughness: 0.7,
    roughnessMap: woodRough,
    metalness: 0.0,
  });

  const felt = new THREE.MeshStandardMaterial({
    map: feltAlbedo(),
    roughness: 0.96,
    metalness: 0.0,
  });

  const floorTex = floorAlbedo();
  floorTex.repeat.set(3, 3);
  const floor = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.55,
    metalness: 0.0,
  });

  const wall = new THREE.MeshStandardMaterial({
    map: plasterAlbedo('#b6ab97', '#8d8271'),
    roughness: 0.94,
    metalness: 0.0,
  });

  const corridorWall = new THREE.MeshStandardMaterial({
    map: plasterAlbedo('#9b948a', '#726c62'),
    roughness: 0.95,
    metalness: 0.0,
  });

  const darkIron = new THREE.MeshStandardMaterial({
    color: 0x3b3a38,
    metalness: 0.85,
    roughness: 0.6,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xdfe8ea,
    metalness: 0,
    roughness: 0.06,
    transmission: 0.92,
    thickness: 0.004,
    transparent: true,
  });

  const musicBoxBrass = new THREE.MeshStandardMaterial({
    color: 0xcfae5e,
    metalness: 1.0,
    roughness: 0.32,
  });

  return {
    brassKey,
    nickelSilverKey,
    agedBrassKey,
    plugBrass,
    plugSection,
    housingNickel,
    housingSection,
    lowerPin,
    upperPin,
    springSteel,
    boltSteel,
    cabinetWood,
    cabinetWoodSide,
    benchWood,
    felt,
    floor,
    wall,
    corridorWall,
    darkIron,
    glass,
    musicBoxBrass,
  };
}
