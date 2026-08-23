import * as THREE from 'three';
import {
  makeFloorMaterial,
  makeSteelMaterial,
  makeWornSteelMaterial,
  makeConcreteMaterial,
  netCanvas,
  rulerCanvas,
} from './materials';
import { NET_Y } from '../core/constants';

export interface Facility {
  group: THREE.Group;
  /** the traveling feed chute on the gantry — slides above the current gap. */
  chute: THREE.Group;
  net: THREE.Mesh;
  sun: THREE.DirectionalLight;
}

/**
 * Outdoor hydraulic letterform test yard. Only what the facility needs:
 * embedded rails, a feed gantry, safety net, drainage, a pump house and
 * service walkway in the back, and a mechanical distance gauge.
 */
export function buildFacility(lowQuality: boolean): Facility {
  const group = new THREE.Group();

  // ---- ground ---------------------------------------------------------
  const floorMat = makeFloorMaterial(101);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 22), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const steel = makeSteelMaterial(55);
  const worn = makeWornSteelMaterial(56);
  const concrete = makeConcreteMaterial(77, 0.4);

  // ---- embedded rails (letters travel along x) ------------------------
  const railLen = 14;
  for (const zz of [-0.33, 0.33]) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(railLen, 0.02, 0.2), new THREE.MeshStandardMaterial({ color: 0x55534e, roughness: 0.95 }));
    bed.position.set(0, 0.011, zz);
    bed.receiveShadow = true;
    group.add(bed);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(railLen, 0.028, 0.055), worn);
    rail.position.set(0, 0.028, zz);
    rail.receiveShadow = true;
    group.add(rail);
  }
  // rail anchor bolts, instanced
  const boltGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.02, 8);
  const boltCount = 2 * Math.floor(railLen / 0.5) * 2;
  const bolts = new THREE.InstancedMesh(boltGeo, steel, boltCount);
  let bi = 0;
  const m4 = new THREE.Matrix4();
  for (const zz of [-0.33, 0.33]) {
    for (let x = -railLen / 2 + 0.25; x < railLen / 2; x += 0.5) {
      for (const dz of [-0.085, 0.085]) {
        if (bi >= boltCount) break;
        m4.makeTranslation(x, 0.02, zz + dz);
        bolts.setMatrixAt(bi++, m4);
      }
    }
  }
  bolts.count = bi;
  group.add(bolts);

  // ---- drain channel under the test zone ------------------------------
  const drain = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.015, 0.5), new THREE.MeshStandardMaterial({ color: 0x2e2f30, roughness: 0.7, metalness: 0.35 }));
  drain.position.set(0, 0.009, 0.95);
  group.add(drain);
  // grate ribs
  const ribGeo = new THREE.BoxGeometry(0.035, 0.02, 0.46);
  const ribCount = 40;
  const ribs = new THREE.InstancedMesh(ribGeo, steel, ribCount);
  for (let i = 0; i < ribCount; i++) {
    m4.makeTranslation(-3.1 + i * 0.16, 0.018, 0.95);
    ribs.setMatrixAt(i, m4);
  }
  group.add(ribs);

  // ---- safety net across the fall zone --------------------------------
  const netTex = new THREE.CanvasTexture(netCanvas());
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
  netTex.repeat.set(6, 1.4);
  const netMat = new THREE.MeshStandardMaterial({
    color: 0xd8d3c6,
    alphaMap: netTex,
    transparent: true,
    side: THREE.DoubleSide,
    roughness: 0.9,
    alphaTest: 0.28,
  });
  const netGeo = new THREE.PlaneGeometry(5.6, 1.3, 28, 7);
  const net = new THREE.Mesh(netGeo, netMat);
  net.rotation.x = -Math.PI / 2;
  net.position.set(0, NET_Y, 0);
  group.add(net);
  // net frame posts
  const postGeo = new THREE.CylinderGeometry(0.025, 0.025, NET_Y + 0.05, 8);
  for (const xx of [-2.8, 2.8]) {
    for (const zz of [-0.62, 0.62]) {
      const p = new THREE.Mesh(postGeo, steel);
      p.position.set(xx, (NET_Y + 0.05) / 2, zz);
      group.add(p);
    }
  }
  for (const zz of [-0.62, 0.62]) {
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 5.6, 8).rotateZ(Math.PI / 2), steel);
    edge.position.set(0, NET_Y + 0.03, zz);
    group.add(edge);
  }

  // ---- feed gantry with traveling chute -------------------------------
  const gantry = new THREE.Group();
  const colGeo = new THREE.BoxGeometry(0.16, 3.1, 0.16);
  for (const xx of [-3.4, 3.4]) {
    const col = new THREE.Mesh(colGeo, steel);
    col.position.set(xx, 1.55, -0.75);
    col.castShadow = true;
    gantry.add(col);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.36), steel);
    foot.position.set(xx, 0.02, -0.75);
    gantry.add(foot);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.2, 0.18), steel);
  beam.position.set(0, 3.05, -0.75);
  beam.castShadow = true;
  gantry.add(beam);
  const beamRail = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.04, 0.06), worn);
  beamRail.position.set(0, 2.93, -0.75);
  gantry.add(beamRail);
  group.add(gantry);

  // traveling chute trolley: rollers + arm reaching over the gap + hopper
  const chute = new THREE.Group();
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.3), steel);
  trolley.position.set(0, 2.98, -0.75);
  trolley.castShadow = true;
  chute.add(trolley);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.75), steel);
  arm.position.set(0, 2.86, -0.38);
  chute.add(arm);
  const hopperMat = steel.clone();
  hopperMat.side = THREE.DoubleSide;
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.145, 0.3, 12, 1, true), hopperMat);
  hopper.position.set(0, 2.72, 0);
  chute.add(hopper);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.14, 12, 1, true), hopperMat);
  spout.position.set(0, 2.52, 0);
  chute.add(spout);
  group.add(chute);

  // ---- mechanical distance gauge behind the rails ---------------------
  const rulerTex = new THREE.CanvasTexture(rulerCanvas());
  rulerTex.colorSpace = THREE.SRGBColorSpace;
  const ruler = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 0.4),
    new THREE.MeshStandardMaterial({ map: rulerTex, roughness: 0.5, metalness: 0.6 }),
  );
  ruler.rotation.x = -Math.PI / 2.6;
  ruler.position.set(0, 0.06, -1.15);
  group.add(ruler);

  // ---- pump house + pipework + walkway (background only) --------------
  const back = new THREE.Group();
  const houseMat = makeConcreteMaterial(300, 0.25);
  const house = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.0, 3.2), houseMat);
  house.position.set(-4.6, 1.5, -7.2);
  house.castShadow = true;
  house.receiveShadow = true;
  back.add(house);
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x7c8288, roughness: 0.6, metalness: 0.5 }),
  );
  door.position.set(-4.0, 1.1, -5.58);
  back.add(door);
  const roofEdge = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.18, 3.4), new THREE.MeshStandardMaterial({ color: 0x63676b, roughness: 0.8 }));
  roofEdge.position.set(-4.6, 3.06, -7.2);
  back.add(roofEdge);

  // supply pipes running from the pump house along the back
  const pipeMat = steel;
  const mainPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 11, 12).rotateZ(Math.PI / 2), pipeMat);
  mainPipe.position.set(1.2, 0.55, -5.4);
  mainPipe.castShadow = true;
  back.add(mainPipe);
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.1, 12), pipeMat);
  riser.position.set(4.6, 1.6, -5.4);
  back.add(riser);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.9, 10).rotateX(Math.PI / 2), pipeMat);
  feed.position.set(4.6, 3.1, -2.95);
  back.add(feed);
  // pipe supports
  const supGeo = new THREE.BoxGeometry(0.05, 0.55, 0.05);
  const sups = new THREE.InstancedMesh(supGeo, steel, 8);
  for (let i = 0; i < 8; i++) {
    m4.makeTranslation(-3.6 + i * 1.35, 0.27, -5.4);
    sups.setMatrixAt(i, m4);
  }
  back.add(sups);

  // service walkway with railing behind the rails
  const walk = new THREE.Mesh(new THREE.BoxGeometry(12, 0.12, 1.1), concrete);
  walk.position.set(0, 0.06, -2.5);
  walk.receiveShadow = true;
  back.add(walk);
  const railPostGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.0, 8);
  const nPosts = 12;
  const posts = new THREE.InstancedMesh(railPostGeo, steel, nPosts);
  for (let i = 0; i < nPosts; i++) {
    m4.makeTranslation(-5.5 + i * 1.0, 0.62, -3.0);
    posts.setMatrixAt(i, m4);
  }
  posts.castShadow = true;
  back.add(posts);
  for (const hy of [1.1, 0.75]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 11.4, 8).rotateZ(Math.PI / 2), steel);
    r.position.set(0, hy, -3.0);
    back.add(r);
  }
  group.add(back);

  // ---- lights ---------------------------------------------------------
  const sun = new THREE.DirectionalLight(0xfff2e0, 3.1);
  sun.position.set(6, 9, 5);
  sun.castShadow = !lowQuality;
  sun.shadow.mapSize.set(lowQuality ? 1024 : 2048, lowQuality ? 1024 : 2048);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -3;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 26;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.015;
  group.add(sun);
  group.add(sun.target);
  sun.target.position.set(0, 0.8, 0);

  const hemi = new THREE.HemisphereLight(0xd4dde4, 0x6c6f66, 0.85);
  group.add(hemi);

  return { group, chute, net, sun };
}
