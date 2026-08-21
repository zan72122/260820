import { InstancedMesh, Mesh, Object3D, type BufferGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Collapse the static props under `root` into one mesh per material.
 *
 * A park bench is thirteen boxes and a swing frame is forty tubes; drawn one at a
 * time that is most of a phone's draw-call budget spent on furniture. The parts
 * are still modelled individually — they are just uploaded once.
 */
export function mergeStatics(root: Object3D): number {
  const buckets = new Map<string, { mat: Material; geos: BufferGeometry[]; cast: boolean; receive: boolean }>();
  const doomed: Mesh[] = [];

  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert();

  root.traverse((o) => {
    if (!(o as Mesh).isMesh) return;
    if ((o as InstancedMesh).isInstancedMesh) return;
    if (o.userData.dynamic) return;
    const mesh = o as Mesh;
    if (Array.isArray(mesh.material)) return;
    // Anything parented under a moving node has to keep its own transform.
    let p: Object3D | null = mesh.parent;
    while (p && p !== root) {
      if (p.userData.dynamic) return;
      p = p.parent;
    }

    const mat = mesh.material as Material;
    const key = mat.uuid;
    const geo = mesh.geometry.clone().toNonIndexed();
    geo.applyMatrix4(rootInverse.clone().multiply(mesh.matrixWorld));
    // Merging needs identical attribute sets; drop anything exotic.
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
    }
    if (!geo.getAttribute('uv')) {
      geo.setAttribute('uv', geo.getAttribute('position').clone());
    }
    const b = buckets.get(key) ?? { mat, geos: [], cast: false, receive: false };
    b.geos.push(geo);
    b.cast = b.cast || mesh.castShadow;
    b.receive = b.receive || mesh.receiveShadow;
    buckets.set(key, b);
    doomed.push(mesh);
  });

  let merged = 0;
  for (const b of buckets.values()) {
    if (b.geos.length < 2) {
      for (const g of b.geos) g.dispose();
      continue;
    }
    const geo = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!geo) continue;
    geo.computeBoundingSphere();
    const mesh = new Mesh(geo, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    merged++;
  }

  if (merged > 0) {
    const keptMaterials = new Set(
      [...buckets.values()].filter((b) => b.geos.length >= 2).map((b) => b.mat.uuid),
    );
    for (const m of doomed) {
      if (!keptMaterials.has((m.material as Material).uuid)) continue;
      m.geometry.dispose();
      m.removeFromParent();
    }
  }
  return merged;
}
