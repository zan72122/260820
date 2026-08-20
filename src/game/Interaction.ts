/**
 * Turning one finger into paper, ink and dye.
 *
 * Two rules run through all of it. First, the paint always lands slightly above the
 * fingertip, so a small hand never covers the line it is drawing. Second, nothing can fail:
 * a stroke that wanders off a guide keeps its wobble but is drawn back, and a sheet let go
 * in the wrong place drifts to the nearest sensible spot instead of falling.
 */

import { Camera, Object3D, Raycaster, Vector2, Vector3 } from 'three';
import { PATCHES, localToTile, tileRect } from '../nebuta/shape';
import { GUIDES, type Pt } from '../nebuta/artwork';
import { clamp, closestOnSegment2 } from '../util/math';

export interface SurfaceHit {
  patchId: string;
  tile: number;
  /** Tile-space coordinates, 0..1. */
  a: number;
  b: number;
  point: Vector3;
  object: Object3D;
}

const _ray = new Raycaster();
const _ndc = new Vector2();

export function raycastPanels(
  camera: Camera,
  ndcX: number,
  ndcY: number,
  meshes: Object3D[],
): SurfaceHit | null {
  if (meshes.length === 0) return null;
  _ndc.set(ndcX, ndcY);
  _ray.setFromCamera(_ndc, camera);
  const hits = _ray.intersectObjects(meshes, false);
  for (const h of hits) {
    const patchId = h.object.userData.patchId as string | undefined;
    if (!patchId || !h.uv) continue;
    const spec = PATCHES.find((p) => p.id === patchId);
    if (!spec) continue;
    const r = tileRect(spec.tile);
    return {
      patchId,
      tile: spec.tile,
      a: clamp((h.uv.x - r.x) / r.w, 0, 1),
      b: clamp((h.uv.y - r.y) / r.h, 0, 1),
      point: h.point.clone(),
      object: h.object,
    };
  }
  return null;
}

/* ------------------------------------------------------------------ ink guides */

export interface GuidePath {
  patchId: string;
  /** Tile-space points. */
  pts: Pt[];
  hits: Uint8Array;
}

export function buildGuidePaths(): GuidePath[] {
  return GUIDES.map((s) => ({
    patchId: s.patch,
    pts: s.pts.map(([a, b]) => [localToTile(a), localToTile(b)] as Pt),
    hits: new Uint8Array(s.pts.length),
  }));
}

export interface GuideSnap {
  a: number;
  b: number;
  strength: number;
}

/**
 * Pulls a point toward the nearest planned line without snapping onto it: the child's own
 * wobble survives, the stroke just never wanders off the drawing.
 */
export function snapToGuide(
  paths: GuidePath[],
  patchId: string,
  a: number,
  b: number,
  tolerance = 0.1,
): GuideSnap {
  let bestD = Infinity;
  let bestA = a;
  let bestB = b;
  let bestPath: GuidePath | null = null;
  let bestIndex = 0;

  for (const path of paths) {
    if (path.patchId !== patchId) continue;
    for (let i = 0; i < path.pts.length - 1; i++) {
      const [ax, ay] = path.pts[i];
      const [bx, by] = path.pts[i + 1];
      const t = closestOnSegment2(ax, ay, bx, by, a, b);
      const px = ax + (bx - ax) * t;
      const py = ay + (by - ay) * t;
      const d = Math.hypot(px - a, py - b);
      if (d < bestD) {
        bestD = d;
        bestA = px;
        bestB = py;
        bestPath = path;
        bestIndex = t < 0.5 ? i : i + 1;
      }
    }
  }

  if (!bestPath || bestD > tolerance) return { a, b, strength: 0 };
  bestPath.hits[Math.min(bestIndex, bestPath.hits.length - 1)] = 1;
  // full attraction only right on the line, easing off toward the tolerance edge
  const w = (1 - bestD / tolerance) * 0.66;
  return { a: a + (bestA - a) * w, b: b + (bestB - b) * w, strength: 1 - bestD / tolerance };
}

export function guideProgress(paths: GuidePath[], patchIds?: string[]): number {
  let total = 0;
  let hit = 0;
  for (const p of paths) {
    if (patchIds && !patchIds.includes(p.patchId)) continue;
    for (let i = 0; i < p.hits.length; i++) {
      total++;
      hit += p.hits[i];
    }
  }
  return total === 0 ? 0 : hit / total;
}

export function resetGuides(paths: GuidePath[]): void {
  for (const p of paths) p.hits.fill(0);
}
