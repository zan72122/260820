import * as THREE from 'three';
import { Vec2 } from '../sim/types';

/**
 * 子どもが描く太い床経路のリボン表示。
 */
export class PathRibbon {
  mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  private mat: THREE.MeshBasicMaterial;

  constructor(color = 0xd9a066) {
    this.mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  setPath(pts: Vec2[], width = 0.34): void {
    if (pts.length < 2) {
      this.mesh.visible = false;
      return;
    }
    const half = width / 2;
    const verts: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      let dx = next.x - prev.x;
      let dz = next.z - prev.z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d;
      dz /= d;
      // 法線
      const nx = -dz;
      const nz = dx;
      verts.push(p.x + nx * half, 0.018, p.z + nz * half);
      verts.push(p.x - nx * half, 0.018, p.z - nz * half);
      if (i > 0) {
        const b = i * 2;
        idx.push(b - 2, b - 1, b, b - 1, b + 1, b);
      }
    }
    this.geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    this.geo.setIndex(idx);
    this.geo.computeBoundingSphere();
    this.mesh.visible = true;
  }

  clear(): void {
    this.mesh.visible = false;
  }
}
