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

let blobTexture: THREE.Texture | null = null;

/** A soft round falloff, used for anything that should not have a visible edge. */
export function softBlobTexture() {
  if (blobTexture) return blobTexture;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  blobTexture = new THREE.CanvasTexture(c);
  blobTexture.colorSpace = THREE.SRGBColorSpace;
  return blobTexture;
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
  const screenMat = lib.get(meshPanel, { repeat: 2, normalScale: 0.9 }, 'screen');
  (screenMat as THREE.MeshStandardMaterial).transparent = true;
  (screenMat as THREE.MeshStandardMaterial).opacity = 0.9;
  (screenMat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;

  // --- terrain and slab ---------------------------------------------------
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(34, 48), groundMat);
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.y = SLAB_Y - 0.09;
  dirt.receiveShadow = true;
  root.add(dirt);

  const slabGeo = new THREE.BoxGeometry(7.8, 0.18, 7.4);
  const slab = new THREE.Mesh(slabGeo, concreteMat);
  slab.position.set(0, SLAB_Y - 0.09, -0.6);
  slab.receiveShadow = true;
  slab.castShadow = false;
  root.add(slab);

  // --- posts and roof -----------------------------------------------------
  const postGeo = new THREE.BoxGeometry(0.16, 3.3, 0.16);
  // The camera works from out in the yard, looking in through the open side.
  // The posts therefore sit behind and beside the rig, never between the lens
  // and the ball.
  const postPositions: Array<[number, number]> = [
    [-3.4, -3.2],
    [3.4, -3.2],
    [-3.4, 1.45],
    [3.4, 1.45],
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
    shoe.castShadow = false;
    shoe.receiveShadow = true;
    root.add(shoe);
    for (const [dx, dz] of [[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]]) {
      boltPlacements.push({ pos: new THREE.Vector3(x + dx, 0.145, z + dz) });
    }
  }

  const beamGeo = new THREE.BoxGeometry(7.1, 0.2, 0.14);
  for (const z of [-3.2, 1.45]) {
    const beam = new THREE.Mesh(beamGeo, timberMat);
    beam.position.set(0, 3.24, z);
    beam.castShadow = true;
    beam.receiveShadow = true;
    root.add(beam);
  }
  const purlinGeo = new THREE.BoxGeometry(0.09, 0.14, 5.0);
  for (const x of [-2.6, -0.9, 0.9, 2.6]) {
    const p = new THREE.Mesh(purlinGeo, timberMat);
    p.position.set(x, 3.4, -0.88);
    p.castShadow = false;
    root.add(p);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.05, 5.4), roofMat);
  roof.position.set(0, 3.5, -0.88);
  roof.rotation.x = -0.035;
  roof.castShadow = true;
  roof.receiveShadow = true;
  root.add(roof);

  // --- wind screen on the weather side ------------------------------------
  // Kept deliberately low. Everything above it is open sky, which is what
  // gives the ball a bright field to be seen against.
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.7, 1.5), screenMat);
  screen.position.set(0, 0.78, -3.22);
  screen.receiveShadow = false;
  root.add(screen);
  for (const y of [0.06, 1.52]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.07, 0.07), galvMat);
    rail.position.set(0, y, -3.22);
    rail.castShadow = false;
    rail.receiveShadow = true;
    root.add(rail);
  }

  // --- distant landscape ---------------------------------------------------
  // Three coarse masses of trees at the property line. They cost three draw
  // calls and stop the horizon from reading as an empty grey band.
  const treeMat = new THREE.MeshStandardMaterial({
    color: 0x5a5e4a,
    roughness: 1,
    metalness: 0,
  });
  const treeGeo = new THREE.SphereGeometry(1, 10, 7);
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, 5);
  const tm = new THREE.Matrix4();
  const tq = new THREE.Quaternion();
  const ts = new THREE.Vector3();
  for (let i = 0; i < 5; i++) {
    const a = -2.5 + i * 0.95 + rnd() * 0.2;
    const r = 21 + rnd() * 7;
    ts.set(6 + rnd() * 5, 3.2 + rnd() * 1.8, 6 + rnd() * 4);
    tq.setFromEuler(new THREE.Euler(0, rnd() * 3, 0));
    tm.compose(new THREE.Vector3(Math.sin(a) * r, -1.9 + rnd() * 0.6, Math.cos(a) * r - 4), tq, ts);
    trees.setMatrixAt(i, tm);
  }
  trees.instanceMatrix.needsUpdate = true;
  trees.castShadow = false;
  trees.receiveShadow = false;
  root.add(trees);

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
  const dustGeo = new THREE.PlaneGeometry(1, 1);
  const dustMat = new THREE.MeshBasicMaterial({
    color: 0xbeb195,
    map: softBlobTexture(),
    alphaMap: softBlobTexture(),
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    toneMapped: true,
  });
  const dust = new THREE.InstancedMesh(dustGeo, dustMat, 9);
  const dm = new THREE.Matrix4();
  const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const ds = new THREE.Vector3();
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.8 + rnd() * 1.9;
    const size = 0.5 + rnd() * 1.0;
    ds.set(size, size, 1);
    dm.compose(
      new THREE.Vector3(Math.cos(a) * r, SLAB_Y + 0.004, Math.sin(a) * r * 0.75 - 0.5),
      dq,
      ds
    );
    dust.setMatrixAt(i, dm);
  }
  dust.instanceMatrix.needsUpdate = true;
  dust.renderOrder = 1;
  root.add(dust);

  const bolts = boltField(galvMat, boltPlacements);
  bolts.castShadow = false;
  root.add(bolts);

  // --- lighting -----------------------------------------------------------
  // One shadow-casting key light. Everything else is ambient or unshadowed
  // fill, which keeps the shadow budget at exactly one map.
  const sun = new THREE.DirectionalLight(0xfff4e2, 3.5);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 22;
  sun.shadow.camera.left = -3.6;
  sun.shadow.camera.right = 3.2;
  sun.shadow.camera.top = 3.8;
  sun.shadow.camera.bottom = -2.4;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.018;
  sun.target.position.set(-0.3, 0.4, 0.3);
  root.add(sun);
  root.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xc6d6ea, 0x7d7361, 1.15);
  root.add(hemi);

  // Warm bounce from the roof lights; no shadow map, so it costs nothing.
  const fill = new THREE.DirectionalLight(0xffe6c0, 0.62);
  fill.position.set(1.6, 3.1, 1.9);
  root.add(fill);

  const sky = createSkyDome();
  root.add(sky);

  return { root, sun, hemi, fill, sky, slab };
}
