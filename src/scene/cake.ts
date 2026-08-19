import * as THREE from 'three';
import { DIM, type Flavour, type QualityProfile } from '../core/tuning';
import { Rng } from '../core/rng';
import { frostMaps, spongeMaps } from './textures';
import { createCutMeringueMaterial, createIceMaterial, type MeringueUniforms } from './materials';
import {
  buildCylinderWedge,
  buildIceCutFace,
  buildIceWedge,
  buildMeringueCutFace,
  buildSpongeCutFace,
} from './geometry';

export interface Cake {
  /** sits on the plate; everything cake-shaped hangs off this */
  root: THREE.Group;
  /** the ~300 degree remainder */
  main: THREE.Group;
  /** the pre-split wedge that travels forward on the reveal */
  slice: THREE.Group;
  /** dome-space parents (origin at the dome equator) for the meringue */
  domeMain: THREE.Group;
  domeSlice: THREE.Group;
  setFlavour: (f: Flavour) => void;
  /** cut faces start hidden inside a whole cake and only matter once cut */
  setCutFacesVisible: (v: boolean) => void;
  dispose: () => void;
}

const PHI0 = DIM.sliceStart;
const PHI1 = DIM.sliceStart + DIM.sliceSweep;
const TAU = Math.PI * 2;

export function buildCake(uniforms: MeringueUniforms, quality: QualityProfile): Cake {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const rng = new Rng(0xca4e01);

  const frost = frostMaps(quality.backdropDetail >= 2 ? 256 : 128);
  const sponge = spongeMaps(quality.backdropDetail >= 2 ? 256 : 192);
  if (frost.normalMap) track(frost.normalMap);
  if (frost.roughnessMap) track(frost.roughnessMap);
  if (sponge.map) track(sponge.map);
  if (sponge.normalMap) track(sponge.normalMap);
  if (sponge.roughnessMap) track(sponge.roughnessMap);

  const root = new THREE.Group();
  root.position.y = DIM.plateHeight;

  const main = new THREE.Group();
  const slice = new THREE.Group();
  root.add(main, slice);

  const domeMain = new THREE.Group();
  const domeSlice = new THREE.Group();
  domeMain.position.y = DIM.spongeHeight;
  domeSlice.position.y = DIM.spongeHeight;
  main.add(domeMain);
  slice.add(domeSlice);

  /* ------------------------------- materials ---------------------------- */
  const iceMat = track(createIceMaterial(0xf6ead0, frost, { frost: 1 }));
  const iceCutMat = track(createIceMaterial(0xf6ead0, frost, { frost: 1, cut: true }));
  const spongeMat = track(
    new THREE.MeshStandardMaterial({
      map: sponge.map,
      normalMap: sponge.normalMap,
      roughnessMap: sponge.roughnessMap,
      color: 0xdcc196,
      roughness: 0.88,
      metalness: 0,
      normalScale: new THREE.Vector2(0.9, 0.9),
    }),
  );
  const spongeCutMat = track(
    new THREE.MeshStandardMaterial({
      map: sponge.map,
      normalMap: sponge.normalMap,
      color: 0xe7d2ad,
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
      normalScale: new THREE.Vector2(1.15, 1.15),
    }),
  );
  const cutMeringueMat = track(createCutMeringueMaterial(uniforms));

  /* ------------------------------- sponge ------------------------------- */
  const segFor = (sweep: number) => Math.max(6, Math.round((sweep / TAU) * 64));

  const spongeMain = new THREE.Mesh(
    track(
      buildCylinderWedge({
        radius: DIM.spongeRadius,
        top: DIM.spongeHeight,
        bottom: 0,
        phiStart: PHI1,
        phiLength: TAU - DIM.sliceSweep,
        seg: segFor(TAU - DIM.sliceSweep),
      }),
    ),
    spongeMat,
  );
  spongeMain.castShadow = quality.shadows;
  spongeMain.receiveShadow = quality.shadows;
  main.add(spongeMain);

  const spongeSlice = new THREE.Mesh(
    track(
      buildCylinderWedge({
        radius: DIM.spongeRadius,
        top: DIM.spongeHeight,
        bottom: 0,
        phiStart: PHI0,
        phiLength: DIM.sliceSweep,
        seg: segFor(DIM.sliceSweep),
      }),
    ),
    spongeMat,
  );
  spongeSlice.castShadow = quality.shadows;
  spongeSlice.receiveShadow = quality.shadows;
  slice.add(spongeSlice);

  /* ----------------------------- ice cream ------------------------------ */
  const iceMain = new THREE.Mesh(
    track(
      buildIceWedge({
        radius: DIM.iceRadius,
        phiStart: PHI1,
        phiLength: TAU - DIM.sliceSweep,
        segU: segFor(TAU - DIM.sliceSweep),
        segV: 26,
      }),
    ),
    iceMat,
  );
  iceMain.castShadow = quality.shadows;
  domeMain.add(iceMain);

  const iceSlice = new THREE.Mesh(
    track(
      buildIceWedge({
        radius: DIM.iceRadius,
        phiStart: PHI0,
        phiLength: DIM.sliceSweep,
        segU: segFor(DIM.sliceSweep),
        segV: 26,
      }),
    ),
    iceMat,
  );
  iceSlice.castShadow = quality.shadows;
  domeSlice.add(iceSlice);

  /* ------------------------------ cut faces ----------------------------- */
  const cutFaces: THREE.Mesh[] = [];
  const addFace = (
    parent: THREE.Group,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(track(geo), mat);
    m.renderOrder = 1;
    parent.add(m);
    cutFaces.push(m);
    return m;
  };

  // slice: start face points back down the azimuth, end face points forward
  for (const [phi, sign, dome, flat] of [
    [PHI0, -1, domeSlice, slice],
    [PHI1, 1, domeSlice, slice],
    [PHI1, -1, domeMain, main],
    [PHI0, 1, domeMain, main],
  ] as Array<[number, number, THREE.Group, THREE.Group]>) {
    addFace(dome, buildIceCutFace({ radius: DIM.iceRadius, phi, sign }), iceCutMat);
    addFace(
      dome,
      buildMeringueCutFace({
        rInner: DIM.iceRadius - 0.004,
        rOuter: DIM.meringueRadius,
        phi,
        sign,
      }),
      cutMeringueMat,
    );
    addFace(
      flat,
      buildSpongeCutFace({
        radius: DIM.spongeRadius,
        top: DIM.spongeHeight,
        bottom: 0,
        phi,
        sign,
      }),
      spongeCutMat,
    );
  }

  /* --------------------------- condensation ----------------------------- */
  const dropGeo = track(new THREE.SphereGeometry(1, 7, 5));
  const dropMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xe8f0f4,
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.68,
    }),
  );
  const beads = new THREE.InstancedMesh(dropGeo, dropMat, 34);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 34; i++) {
    const a = rng.range(0, TAU);
    const r = DIM.spongeRadius * rng.range(0.985, 1.005);
    const y = rng.range(0.01, DIM.spongeHeight * 0.85);
    const s = rng.range(0.008, 0.02);
    m4.makeScale(s, s * rng.range(1.0, 1.7), s);
    m4.setPosition(Math.cos(a) * r, y, Math.sin(a) * r);
    beads.setMatrixAt(i, m4);
  }
  beads.instanceMatrix.needsUpdate = true;
  main.add(beads);

  const setCutFacesVisible = (v: boolean) => {
    for (const f of cutFaces) f.visible = v;
  };
  setCutFacesVisible(false);

  const setFlavour = (f: Flavour) => {
    iceMat.color.setHex(f.iceCream);
    iceCutMat.color.setHex(f.iceCream);
    uniforms.uTint.value.setHex(f.meringue);
  };

  return {
    root,
    main,
    slice,
    domeMain,
    domeSlice,
    setFlavour,
    setCutFacesVisible,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
