import { Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import {
  makeChestpieceWear,
  makeCurtainTexture,
  makeFloorRoughness,
  makeFloorTexture,
  makeLaminateTexture,
  makePaperTexture,
  makePowderCoatRoughness,
  makeSkinRoughness,
  makeSkinTexture,
  makeVinylTexture,
} from './textures';

/**
 * One place where every surface in the room declares what it is made of.
 * The point of the piece is that machined metal, moulded rubber, synthetic
 * skin, woven fabric and wiped vinyl stay recognisably different materials
 * even after the quality manager has stripped the scene back.
 */
export interface MaterialLibrary {
  skin: MeshPhysicalMaterial;
  chromeSteel: MeshPhysicalMaterial;
  brushedSteel: MeshPhysicalMaterial;
  diaphragm: MeshPhysicalMaterial;
  nonChillRim: MeshPhysicalMaterial;
  tubing: MeshPhysicalMaterial;
  earTip: MeshPhysicalMaterial;
  vinylPad: MeshPhysicalMaterial;
  paper: MeshStandardMaterial;
  laminate: MeshPhysicalMaterial;
  powderCoat: MeshStandardMaterial;
  floor: MeshStandardMaterial;
  wall: MeshStandardMaterial;
  curtain: MeshPhysicalMaterial;
  engravedPlate: MeshPhysicalMaterial;
  manikinShell: MeshStandardMaterial;
  glove: MeshPhysicalMaterial;
  heartTissue: MeshPhysicalMaterial;
  boneTissue: MeshPhysicalMaterial;
  vibration: MeshStandardMaterial;
}

export function createMaterials(): MaterialLibrary {
  const skinMap = makeSkinTexture();
  const skinRough = makeSkinRoughness();
  const floorMap = makeFloorTexture();
  const floorRough = makeFloorRoughness();
  const laminateMap = makeLaminateTexture();
  const vinylMap = makeVinylTexture();
  const paperMap = makePaperTexture();
  const curtainMap = makeCurtainTexture();
  const rimWear = makeChestpieceWear();
  const coatRough = makePowderCoatRoughness();

  return {
    // Moulded polymer over a foam core: soft sheen, no wetness, visible mould
    // texture. It must never read as living skin.
    skin: new MeshPhysicalMaterial({
      map: skinMap,
      roughnessMap: skinRough,
      color: new Color('#cfa88f'),
      roughness: 0.74,
      metalness: 0.0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.62,
      sheen: 0.25,
      sheenRoughness: 0.8,
      sheenColor: new Color('#c08b72'),
    }),
    chromeSteel: new MeshPhysicalMaterial({
      color: new Color('#cdd2d6'),
      metalness: 1.0,
      roughness: 0.19,
      clearcoat: 0.35,
      clearcoatRoughness: 0.16,
    }),
    brushedSteel: new MeshPhysicalMaterial({
      color: new Color('#b3b8bd'),
      metalness: 1.0,
      roughness: 0.34,
      roughnessMap: rimWear,
    }),
    // A thin, taut, slightly translucent membrane — not a painted disc.
    diaphragm: new MeshPhysicalMaterial({
      color: new Color('#e6e3dc'),
      metalness: 0.0,
      roughness: 0.24,
      clearcoat: 0.7,
      clearcoatRoughness: 0.14,
      transmission: 0.22,
      thickness: 0.0012,
      ior: 1.45,
      side: DoubleSide,
    }),
    nonChillRim: new MeshPhysicalMaterial({
      color: new Color('#3c4046'),
      metalness: 0.0,
      roughness: 0.66,
      clearcoat: 0.1,
      clearcoatRoughness: 0.7,
    }),
    tubing: new MeshPhysicalMaterial({
      color: new Color('#23282e'),
      metalness: 0.0,
      roughness: 0.58,
      clearcoat: 0.32,
      clearcoatRoughness: 0.45,
      sheen: 0.18,
      sheenRoughness: 0.6,
    }),
    earTip: new MeshPhysicalMaterial({
      color: new Color('#4a4f56'),
      metalness: 0.0,
      roughness: 0.78,
      clearcoat: 0.06,
    }),
    vinylPad: new MeshPhysicalMaterial({
      map: vinylMap,
      color: new Color('#5a7d86'),
      metalness: 0.0,
      roughness: 0.42,
      clearcoat: 0.45,
      clearcoatRoughness: 0.3,
    }),
    paper: new MeshStandardMaterial({
      map: paperMap,
      color: new Color('#eeeae0'),
      roughness: 0.94,
      metalness: 0.0,
    }),
    laminate: new MeshPhysicalMaterial({
      map: laminateMap,
      roughness: 0.36,
      metalness: 0.0,
      clearcoat: 0.4,
      clearcoatRoughness: 0.28,
    }),
    powderCoat: new MeshStandardMaterial({
      color: new Color('#8d9096'),
      roughness: 0.62,
      roughnessMap: coatRough,
      metalness: 0.32,
    }),
    floor: new MeshStandardMaterial({
      map: floorMap,
      roughnessMap: floorRough,
      roughness: 0.7,
      metalness: 0.0,
    }),
    wall: new MeshStandardMaterial({
      color: new Color('#cfc7b8'),
      roughness: 0.92,
      metalness: 0.0,
    }),
    curtain: new MeshPhysicalMaterial({
      map: curtainMap,
      color: new Color('#93a298'),
      roughness: 0.95,
      metalness: 0.0,
      sheen: 0.9,
      sheenRoughness: 0.72,
      sheenColor: new Color('#b9c6bc'),
      side: DoubleSide,
    }),
    engravedPlate: new MeshPhysicalMaterial({
      color: new Color('#9c9a94'),
      metalness: 0.55,
      roughness: 0.55,
      clearcoat: 0.15,
    }),
    manikinShell: new MeshStandardMaterial({
      color: new Color('#6f7378'),
      roughness: 0.55,
      metalness: 0.45,
    }),
    glove: new MeshPhysicalMaterial({
      color: new Color('#d8d3c8'),
      roughness: 0.68,
      metalness: 0.0,
      clearcoat: 0.14,
      clearcoatRoughness: 0.5,
      sheen: 0.3,
      sheenRoughness: 0.7,
    }),
    // Anatomy shown only during the reveal, lit softly and never emissive.
    heartTissue: new MeshPhysicalMaterial({
      color: new Color('#9c4f4b'),
      roughness: 0.52,
      metalness: 0.0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      sheen: 0.35,
      sheenColor: new Color('#c07b6f'),
    }),
    boneTissue: new MeshPhysicalMaterial({
      color: new Color('#ded3bd'),
      roughness: 0.66,
      metalness: 0.0,
      transmission: 0.12,
      thickness: 0.02,
      ior: 1.35,
    }),
    vibration: new MeshStandardMaterial({
      color: new Color('#cfd8d6'),
      transparent: true,
      opacity: 0.13,
      roughness: 1.0,
      metalness: 0.0,
      depthWrite: false,
      side: DoubleSide,
    }),
  };
}
