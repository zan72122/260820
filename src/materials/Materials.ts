import {
  Color,
  DoubleSide,
  FrontSide,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  Vector2,
} from 'three';
import type { QualitySettings } from '../core/Quality';
import type { PatternKind } from '../state/OpticsState';
import { injectOptics, type OpticsUniforms } from '../render/optics';
import { injectWater } from '../render/waterInject';
import { injectPlateGlow } from '../render/plateGlow';
import * as T from './Textures';

export interface MaterialLibrary {
  steelKnurl: MeshStandardMaterial;
  frpOuter: MeshPhysicalMaterial;
  frpInner: MeshPhysicalMaterial;
  frpCut: MeshStandardMaterial;
  frpRib: MeshPhysicalMaterial;
  steel: MeshStandardMaterial;
  steelDark: MeshStandardMaterial;
  paint: MeshStandardMaterial;
  epdm: MeshPhysicalMaterial;
  water: MeshPhysicalMaterial;
  raft: MeshPhysicalMaterial;
  testBody: MeshStandardMaterial;
  concrete: MeshStandardMaterial;
  grass: MeshStandardMaterial;
  building: MeshStandardMaterial;
  buildingRoof: MeshStandardMaterial;
  glassFar: MeshStandardMaterial;
  darkTrim: MeshStandardMaterial;
  plate: Record<PatternKind, MeshPhysicalMaterial>;
  plateBlank: MeshPhysicalMaterial;
  sunDisc: MeshBasicMaterial;
  spray: MeshStandardMaterial;
  sheet: MeshPhysicalMaterial;
  dispose(): void;
}

function tune(tex: ReturnType<typeof T.gelcoatNormal>, repeat: number, aniso: number) {
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = aniso;
  return tex;
}

// resin tints, not paint: these are what a translucent laminate looks like
const PLATE_TINT: Record<PatternKind, string> = {
  rings: '#b09b74',
  stripes: '#8aa9b6',
  holes: '#b8a276',
};

export function buildMaterials(uniforms: OpticsUniforms, q: QualitySettings): MaterialLibrary {
  const aniso = q.anisotropy;
  const gel = T.gelcoatNormal();
  const rough = T.frpRoughness();
  const steelN = T.steelNormal();
  const steelR = T.steelRoughness();
  const rubberN = T.rubberNormal();
  const raftN = T.raftNormal();
  const concA = T.concreteAlbedo();
  const concN = T.concreteNormal();

  const frpOuter = new MeshPhysicalMaterial({
    color: new Color('#778b96'),
    roughness: 0.4,
    metalness: 0.0,
    normalMap: gel,
    normalScale: new Vector2(0.35, 0.35),
    roughnessMap: rough,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    side: FrontSide,
  });
  frpOuter.normalMap!.repeat.set(6, 3);
  frpOuter.normalMap!.wrapS = frpOuter.normalMap!.wrapT = RepeatWrapping;
  frpOuter.roughnessMap!.repeat.set(4, 2);
  frpOuter.roughnessMap!.wrapS = frpOuter.roughnessMap!.wrapT = RepeatWrapping;
  gel.anisotropy = aniso;
  rough.anisotropy = aniso;

  // The interior of a slide flume is a dark, glossy, wet gelcoat surface:
  // that darkness is what makes the projected pattern legible at all.
  const frpInner = new MeshPhysicalMaterial({
    color: new Color('#252c33'),
    roughness: 0.26,
    metalness: 0.0,
    normalMap: gel,
    normalScale: new Vector2(0.22, 0.22),
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    side: FrontSide,
  });

  const frpCut = new MeshStandardMaterial({
    color: new Color('#a9a293'),
    roughness: 0.86,
    metalness: 0.0,
    side: DoubleSide,
  });

  const frpRib = new MeshPhysicalMaterial({
    color: new Color('#7f8d95'),
    roughness: 0.42,
    metalness: 0,
    normalMap: gel,
    normalScale: new Vector2(0.3, 0.3),
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    side: DoubleSide,
  });

  const steel = new MeshStandardMaterial({
    color: new Color('#b6bcc2'),
    metalness: 1.0,
    roughness: 0.34,
    normalMap: tune(steelN, 2, aniso),
    normalScale: new Vector2(0.5, 0.5),
    roughnessMap: tune(steelR, 2, aniso),
    side: DoubleSide,
  });

  const steelKnurl = new MeshStandardMaterial({
    color: new Color('#8d949b'),
    metalness: 1.0,
    roughness: 0.42,
    normalMap: T.knurlNormal(),
    normalScale: new Vector2(1.1, 1.1),
    side: DoubleSide,
  });
  steelKnurl.normalMap!.repeat.set(1, 1);
  steelKnurl.normalMap!.anisotropy = aniso;

  const steelDark = new MeshStandardMaterial({
    color: new Color('#6d757c'),
    metalness: 0.9,
    roughness: 0.52,
    normalMap: steelN,
    normalScale: new Vector2(0.35, 0.35),
    side: DoubleSide,
  });

  const paint = new MeshStandardMaterial({
    color: new Color('#2f5f7a'),
    metalness: 0.15,
    roughness: 0.48,
    normalMap: steelN,
    normalScale: new Vector2(0.18, 0.18),
    side: DoubleSide,
  });

  const epdm = new MeshPhysicalMaterial({
    color: new Color('#0f1216'),
    roughness: 0.78,
    metalness: 0.0,
    normalMap: tune(rubberN, 3, aniso),
    normalScale: new Vector2(0.7, 0.7),
    clearcoat: 0.16,
    clearcoatRoughness: 0.7,
    side: DoubleSide,
  });

  const water = new MeshPhysicalMaterial({
    color: new Color('#12303d'),
    roughness: 0.03,
    metalness: 0.0,
    transparent: true,
    opacity: 0.12,
    ior: 1.33,
    side: FrontSide,
    depthWrite: false,
  });

  const raft = new MeshPhysicalMaterial({
    color: new Color('#2b4c60'),
    roughness: 0.55,
    metalness: 0.0,
    normalMap: tune(raftN, 4, aniso),
    normalScale: new Vector2(0.55, 0.55),
    clearcoat: 0.35,
    clearcoatRoughness: 0.55,
    side: DoubleSide,
  });

  const testBody = new MeshStandardMaterial({
    color: new Color('#eceff1'),
    roughness: 0.62,
    metalness: 0.0,
    side: DoubleSide,
  });

  const concrete = new MeshStandardMaterial({
    color: new Color('#b9bcbd'),
    map: tune(concA, 17, aniso),
    normalMap: tune(concN, 17, aniso),
    normalScale: new Vector2(0.6, 0.6),
    roughness: 0.92,
    metalness: 0.0,
  });

  const grass = new MeshStandardMaterial({
    color: new Color('#5c6b48'),
    roughness: 0.95,
    metalness: 0.0,
  });

  const building = new MeshStandardMaterial({
    color: new Color('#9aa3a8'),
    roughness: 0.7,
    metalness: 0.1,
    side: DoubleSide,
  });
  const buildingRoof = new MeshStandardMaterial({
    color: new Color('#7d848a'),
    roughness: 0.62,
    metalness: 0.25,
    side: DoubleSide,
  });
  const glassFar = new MeshStandardMaterial({
    color: new Color('#3c5a6b'),
    roughness: 0.16,
    metalness: 0.6,
    side: DoubleSide,
  });
  const darkTrim = new MeshStandardMaterial({
    color: new Color('#3a4147'),
    roughness: 0.68,
    metalness: 0.2,
    side: DoubleSide,
  });

  const sunDisc = new MeshBasicMaterial({ color: new Color('#fff6e2'), fog: false });

  const spray = new MeshStandardMaterial({
    color: new Color('#cfe4ee'),
    roughness: 0.14,
    metalness: 0,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });

  const sheet = new MeshPhysicalMaterial({
    color: new Color('#9fc4d6'),
    roughness: 0.09,
    metalness: 0,
    transparent: true,
    opacity: 0.42,
    side: DoubleSide,
    depthWrite: false,
  });

  const makePlate = (kind: PatternKind | null): MeshPhysicalMaterial => {
    const m = new MeshPhysicalMaterial({
      color: new Color(kind ? PLATE_TINT[kind] : '#8d9599'),
      roughness: kind ? 0.17 : 0.44,
      metalness: 0.0,
      transparent: !!kind,
      opacity: kind ? 0.82 : 1,
      clearcoat: kind ? 0.75 : 0.4,
      clearcoatRoughness: 0.09,
      side: DoubleSide,
      depthWrite: true,
    });
    m.envMapIntensity = kind ? 0.5 : 1;
    if (kind) {
      const relief = T.plateReliefNormal(kind);
      relief.anisotropy = aniso;
      relief.repeat.set(1 / 0.98, 1 / 0.98);
      relief.offset.set(0.5, 0.5);
      m.normalMap = relief;
      m.normalScale = new Vector2(1.5, 1.5);
      injectPlateGlow(m, uniforms, kind);
    } else {
      m.normalMap = gel;
      m.normalScale = new Vector2(0.3, 0.3);
    }
    return m;
  };

  // the interior, the film and the white test body all read the same optics block
  injectOptics(frpInner, uniforms, { receiver: 'interior', gain: 1.0, mouth: true });
  injectOptics(frpCut, uniforms, { receiver: 'interior', gain: 0.5, mouth: true });
  injectOptics(water, uniforms, { receiver: 'water', gain: 1.15 });
  injectWater(water, uniforms, q.tier === 'low' ? 0.7 : 1.0);
  injectOptics(raft, uniforms, { receiver: 'body', gain: 0.9, wetExpr: '0.35' });
  injectOptics(testBody, uniforms, { receiver: 'body', gain: 1.5, wetExpr: '0.1' });

  const lib: MaterialLibrary = {
    steelKnurl,
    frpOuter,
    frpInner,
    frpCut,
    frpRib,
    steel,
    steelDark,
    paint,
    epdm,
    water,
    raft,
    testBody,
    concrete,
    grass,
    building,
    buildingRoof,
    glassFar,
    darkTrim,
    plate: {
      rings: makePlate('rings'),
      stripes: makePlate('stripes'),
      holes: makePlate('holes'),
    },
    plateBlank: makePlate(null),
    sunDisc,
    spray,
    sheet,
    dispose() {
      for (const key of Object.keys(this) as Array<keyof MaterialLibrary>) {
        const v = this[key];
        if (v && typeof v === 'object' && 'dispose' in v && typeof v.dispose === 'function') {
          (v as { dispose: () => void }).dispose();
        }
      }
      for (const k of Object.keys(this.plate) as PatternKind[]) this.plate[k].dispose();
    },
  };
  return lib;
}
