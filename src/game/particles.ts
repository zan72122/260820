import * as THREE from 'three';

/**
 * One pooled point system for loose sand grains and pour sparks.
 * Micro-particles only - big shape changes happen in the heightfield mesh.
 */

const MAX = 600;

interface P {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  col: THREE.Color;
}

export class Particles {
  points: THREE.Points;
  private items: P[] = [];
  private geo: THREE.BufferGeometry;
  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;
  private budget = MAX;

  constructor() {
    this.geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(MAX * 3), 3);
    this.colAttr = new THREE.BufferAttribute(new Float32Array(MAX * 3), 3);
    this.sizeAttr = new THREE.BufferAttribute(new Float32Array(MAX), 1);
    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('color', this.colAttr);
    this.geo.setAttribute('size', this.sizeAttr);
    for (let i = 0; i < MAX; i++) {
      this.items.push({
        alive: false,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        life: 0, maxLife: 1, size: 1, col: new THREE.Color(),
      });
    }
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `
        attribute float size;
        varying vec3 vCol;
        void main() {
          vCol = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (140.0 / max(0.4, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vCol;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          if (dot(d, d) > 0.25) discard;
          gl_FragColor = vec4(vCol, 1.0);
        }`,
      vertexColors: true,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
  }

  setBudget(n: number) { this.budget = Math.min(MAX, n); }

  spawn(pos: THREE.Vector3, vel: THREE.Vector3, spread: number, count: number,
        color: THREE.Color, size = 0.012, life = 0.8, gravity = true) {
    let spawned = 0;
    for (let i = 0; i < MAX && spawned < count; i++) {
      const p = this.items[i];
      if (p.alive) continue;
      if (i >= this.budget) break;
      p.alive = true;
      p.pos.copy(pos).addScaledVector(new THREE.Vector3(
        Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5), spread);
      p.vel.copy(vel).add(new THREE.Vector3(
        (Math.random() - 0.5) * spread * 6,
        Math.random() * spread * 4,
        (Math.random() - 0.5) * spread * 6));
      p.life = 0;
      p.maxLife = life * (0.5 + Math.random() * 0.8);
      p.size = size * (0.6 + Math.random() * 0.9);
      p.col.copy(color).multiplyScalar(0.8 + Math.random() * 0.4);
      (p as any).gravity = gravity;
      spawned++;
    }
  }

  update(dt: number, floorY: number) {
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      const p = this.items[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life > p.maxLife) { p.alive = false; continue; }
      if ((p as any).gravity) p.vel.y -= 3.4 * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < floorY) { p.pos.y = floorY; p.vel.multiplyScalar(0.2); }
      this.posAttr.setXYZ(n, p.pos.x, p.pos.y, p.pos.z);
      const fade = 1 - p.life / p.maxLife;
      this.colAttr.setXYZ(n, p.col.r * fade + 0.02, p.col.g * fade + 0.02, p.col.b * fade + 0.02);
      this.sizeAttr.setX(n, p.size);
      n++;
    }
    this.geo.setDrawRange(0, n);
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }
}
