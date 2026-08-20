import * as THREE from 'three';
import { MaterialLibrary } from '../materials/library';
import { SUN_DIRECTION, createSkyDome } from '../materials/envmap';
import {
  cableRubber,
  concrete,
  galvanised,
  ground as groundRecipe,
  meshPanel,
  paintedSteel,
  roofSheet,
  timber,
} from '../materials/recipes';
import { mulberry32 } from '../util/rng';
import { SLAB_Y } from './layout';

/**
 * The building.
 *
 * A small outdoor materials-testing pavilion: a poured slab, four posts, a
 * ribbed roof, a wind screen on the weather side, and the accumulated mess of
 * a place where the same test has been run a few thousand times. It is
 * deliberately not a clean white room — the child should feel that the drop rig
 * belongs to somewhere real.
 */

export interface PavilionParts {
  root: THREE.Group;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  fill: THREE.DirectionalLight;
  sky: THREE.Mesh;
  slab: THREE.Mesh;
}

/** Bolts, washers and small repeated hardware, drawn in one call. */
export function boltField(
  material: THREE.Material,
  placements: Array<{ pos: THREE.Vector3; rot?: THREE.Euler; scale?: number }>,
  radius = 0.016,
  height = 0.012
) {
  const geo = new THREE.CylinderGeometry(radius, radius * 1.06, height, 6);
  const mesh = new THREE.InstancedMesh(geo, material, placements.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    q.setFromEuler(p.rot ?? new THREE.Euler());
    s.setScalar(p.scale ?? 1);
    m.compose(p.pos, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildPavilion(lib: MaterialLibrary, shadowSize: number): PavilionParts {
  const root = new THREE.Group();
  root.name = 'pavilion';
  const rnd = mulberry32(4242);

  const concreteMat = lib.get(concrete, { repeat: 5, normalScale: 1.0, aoIntensity: 1.0 }, 'slab');
  const groundMat = lib.get(groundRecipe, { repeat: 14, normalScale: 1.3 }, 'ground');
  const paintMat = lib.get(paintedSteel, { repeat: 2, normalScale: 0.8 }, 'post');
  const galvMat = lib.get(galvanised, { repeat: 2, normalScale: 0.9 }, 'struct');
  const timberMat = lib.get(timber, { repeat: 2, normalScale: 1.1 }, 'post');
  const roofMat = lib.get(roofSheet, { repeat: 3, normalScale: 1.0 }, 'roof');
  const cableMat = lib.get(cableRubber, { repeat: 4, normalScale: 1.1 }, 'cable');
  const screenMat = lib.get(meshPanel, { repeat: 4, normalScale: 1.2 }, 'screen');
  (screenMat as THREE.MeshStandardMaterial).transparent = true;
  (screenMat as THREE.MeshStandardMaterial).opacity = 0.86;

  // --- terrain and slab ---------------------------------------------------
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(34, 48), groundMat);
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.y = SLAB_Y - 0.09;
  dirt.receiveShadow = true;
  root.add(dirt);

  const slabGeo = new THREE.BoxGeometry(6.6, 0.18, 6.2);
  const slab = new THREE.Mesh(slabGeo, concreteMat);
  slab.position.set(0, SLAB_Y - 0.09, 0.1);
  slab.receiveShadow = true;
  slab.castShadow = false;
  root.add(slab);

  // --- posts and roof -----------------------------------------------------
  const postGeo = new THREE.BoxGeometry(0.16, 3.3, 0.16);
  const postPositions: Array<[number, number]> = [
    [-2.85, -2.5],
    [2.85, -2.5],
    [-2.85, 2.6],
    [2.85, 2.6],
  ];
  const boltPlacements: Array<{ pos: THREE.Vector3; rot?: THREE.Euler }> = [];
  for (const [x, z] of postPositions) {
    const post = new THREE.Mesh(postGeo, timberMat);
    post.position.set(x, 1.65, z);
    post.castShadow = true;
    post.receiveShadow = true;
    root.add(post);

    // Galvanised base shoe, bolted down.
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.26), galvMat);
    shoe.position.set(x, 0.07, z);
    shoe.castShadow = true;
    shoe.receiveShadow = true;
    root.add(shoe);
    for (const [dx, dz] of [[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]]) {
      boltPlacements.push({ pos: new THREE.Vector3(x + dx, 0.145, z + dz) });
    }
  }

  const beamGeo = new THREE.BoxGeometry(6.0, 0.2, 0.14);
  for (const z of [-2.5, 2.6]) {
    const beam = new THREE.Mesh(beamGeo, timberMat);
    beam.position.set(0, 3.24, z);
    beam.castShadow = true;
    beam.receiveShadow = true;
    root.add(beam);
  }
  const purlinGeo = new THREE.BoxGeometry(0.09, 0.14, 5.2);
  for (const x of [-2.2, -0.75, 0.75, 2.2]) {
    const p = new THREE.Mesh(purlinGeo, timberMat);
    p.position.set(x, 3.4, 0.05);
    p.castShadow = true;
    root.add(p);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.05, 5.6), roofMat);
  roof.position.set(0, 3.5, 0.05);
  roof.rotation.x = -0.035;
  roof.castShadow = true;
  roof.receiveShadow = true;
  root.add(roof);

  // --- wind screen on the weather side ------------------------------------
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 2.1), screenMat);
  screen.position.set(0, 1.8, -2.52);
  screen.receiveShadow = false;
  root.add(screen);
  const screenRail = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.06, 0.06), galvMat);
  screenRail.position.set(0, 2.86, -2.52);
  screenRail.castShadow = true;
  root.add(screenRail);

  // --- practical lights under the roof ------------------------------------
  const lampBody = new THREE.CylinderGeometry(0.055, 0.055, 1.5, 10);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xf6f0e2,
    roughness: 0.42,
    metalness: 0,
    emissive: new THREE.Color(0xffeccb),
    emissiveIntensity: 1.35,
  });
  for (const z of [-1.15, 1.25]) {
    const lamp = new THREE.Mesh(lampBody, lampMat);
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(0, 3.3, z);
    root.add(lamp);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 0.16), paintMat);
    hood.position.set(0, 3.39, z);
    root.add(hood);
  }

  // --- cable runs ---------------------------------------------------------
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.85, 3.2, -2.45),
    new THREE.Vector3(2.2, 3.02, -1.6),
    new THREE.Vector3(1.6, 2.9, -0.7),
    new THREE.Vector3(1.36, 2.4, -0.34),
    new THREE.Vector3(1.36, 1.2, -0.34),
    new THREE.Vector3(1.42, 0.16, -0.5),
    new THREE.Vector3(1.9, 0.05, -1.2),
    new THREE.Vector3(2.6, 0.04, -2.1),
  ]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 40, 0.016, 6, false), cableMat);
  cable.castShadow = true;
  cable.receiveShadow = true;
  root.add(cable);

  // --- odds and ends that say "people work here" --------------------------
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.42), timberMat);
  const toolbox = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.2, 0.24), paintMat);
  toolbox.position.set(2.28, 0.5, -1.58);
  toolbox.rotation.y = 0.16;
  toolbox.castShadow = true;
  toolbox.receiveShadow = true;
  root.add(toolbox);
  crate.position.set(2.32, 0.2, -1.62);
  crate.rotation.y = 0.24;
  crate.castShadow = true;
  crate.receiveShadow = true;
  root.add(crate);

  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.28, 14), galvMat);
  bucket.position.set(2.05, 0.14, 1.35);
  bucket.castShadow = true;
  bucket.receiveShadow = true;
  root.add(bucket);

  // Sand and dust dragged out of the tray, scattered around the working side.
  const dustGeo = new THREE.CircleGeometry(0.5, 12);
  const dustMat = new THREE.MeshStandardMaterial({
    color: 0x9a8e75,
    roughness: 0.98,
    metalness: 0,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(dustGeo, dustMat);
    const a = rnd() * Math.PI * 2;
    const r = 0.9 + rnd() * 1.7;
    d.position.set(Math.cos(a) * r, SLAB_Y + 0.003, Math.sin(a) * r * 0.8 - 0.2);
    d.rotation.x = -Math.PI / 2;
    d.scale.setScalar(0.5 + rnd() * 0.9);
    (d.material as THREE.MeshStandardMaterial).opacity = 0.16 + rnd() * 0.22;
    d.renderOrder = 1;
    root.add(d);
  }

  root.add(boltField(galvMat, boltPlacements));

  // --- lighting -----------------------------------------------------------
  // One shadow-casting key light. Everything else is ambient or unshadowed
  // fill, which keeps the shadow budget at exactly one map.
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.35);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 22;
  sun.shadow.camera.left = -3.4;
  sun.shadow.camera.right = 3.4;
  sun.shadow.camera.top = 3.6;
  sun.shadow.camera.bottom = -2.2;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.018;
  sun.target.position.set(-0.3, 0.4, 0.3);
  root.add(sun);
  root.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xb9cbe0, 0x6a6252, 0.85);
  root.add(hemi);

  // Warm bounce from the roof lights; no shadow map, so it costs nothing.
  const fill = new THREE.DirectionalLight(0xffe6c0, 0.5);
  fill.position.set(1.6, 3.1, 1.9);
  root.add(fill);

  const sky = createSkyDome();
  root.add(sky);

  return { root, sun, hemi, fill, sky, slab };
}
