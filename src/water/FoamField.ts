import * as THREE from 'three';
import { Rng, clamp } from '../core/Rng';
import { dropletSprite, foamSprite } from '../world/Textures';

interface Particle {
  life: number;
  maxLife: number;
  size: number;
}

/**
 * Foam where water meets rubber, and the handful of real droplets that come
 * off it. Deliberately small counts: the point is to read the contact, not to
 * cover the screen in spray.
 */
export class FoamField {
  readonly group = new THREE.Group();
  private readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly sizes: Float32Array;
  private readonly alphas: Float32Array;
  private readonly velocities: Float32Array;
  private readonly particles: Particle[] = [];
  private cursor = 0;

  private readonly drops: THREE.InstancedMesh;
  private readonly dropState: { pos: THREE.Vector3; vel: THREE.Vector3; life: number; size: number }[] = [];
  private dropCursor = 0;
  private readonly dummy = new THREE.Object3D();
  private readonly rng = new Rng(0x2f19);

  constructor(private readonly maxFoam: number, private readonly maxDrops: number) {
    this.positions = new Float32Array(maxFoam * 3);
    this.sizes = new Float32Array(maxFoam);
    this.alphas = new Float32Array(maxFoam);
    this.velocities = new Float32Array(maxFoam * 3);
    for (let i = 0; i < maxFoam; i++) {
      this.particles.push({ life: 0, maxLife: 1, size: 0.2 });
      this.positions[i * 3 + 1] = -1000;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(30, 4, 0), 90);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: foamSprite() },
        uScale: { value: 700 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        varying float vAlpha;
        uniform float uScale;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(0.001, -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          if (t.a * vAlpha < 0.01) discard;
          gl_FragColor = vec4(t.rgb, t.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
    this.group.add(this.points);

    const dropGeo = new THREE.SphereGeometry(0.032, 6, 4);
    dropGeo.scale(1, 1.35, 1);
    const dropMat = new THREE.MeshStandardMaterial({
      color: 0xdff0fa,
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.85,
      envMapIntensity: 2.0,
      map: dropletSprite(),
    });
    this.drops = new THREE.InstancedMesh(dropGeo, dropMat, maxDrops);
    this.drops.frustumCulled = false;
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < maxDrops; i++) {
      this.dropState.push({ pos: new THREE.Vector3(0, -1000, 0), vel: new THREE.Vector3(), life: 0, size: 1 });
      this.dummy.position.set(0, -1000, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.drops.setMatrixAt(i, this.dummy.matrix);
    }
    this.group.add(this.drops);
  }

  /** Foam boiling off a contact point. */
  emitFoam(at: THREE.Vector3, amount: number, spread = 0.22, upward = 1.1): void {
    const n = Math.min(this.maxFoam, Math.round(amount));
    for (let i = 0; i < n; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.maxFoam;
      const p = this.particles[idx];
      p.life = 0;
      p.maxLife = this.rng.range(0.28, 0.62);
      p.size = this.rng.range(0.16, 0.42);
      this.positions[idx * 3] = at.x + this.rng.range(-spread, spread);
      this.positions[idx * 3 + 1] = at.y + this.rng.range(-spread * 0.4, spread * 0.7);
      this.positions[idx * 3 + 2] = at.z + this.rng.range(-spread, spread);
      this.velocities[idx * 3] = this.rng.range(-0.9, 0.9);
      this.velocities[idx * 3 + 1] = this.rng.range(0.2, 1.0) * upward;
      this.velocities[idx * 3 + 2] = this.rng.range(-0.9, 0.9);
    }
  }

  emitDrops(at: THREE.Vector3, amount: number, speed = 2.2): void {
    const n = Math.min(this.maxDrops, Math.round(amount));
    for (let i = 0; i < n; i++) {
      const idx = this.dropCursor;
      this.dropCursor = (this.dropCursor + 1) % this.maxDrops;
      const d = this.dropState[idx];
      d.pos.set(
        at.x + this.rng.range(-0.2, 0.2),
        at.y + this.rng.range(0, 0.25),
        at.z + this.rng.range(-0.25, 0.25),
      );
      d.vel.set(
        this.rng.range(-0.6, 1.1) * speed,
        this.rng.range(0.7, 1.6) * speed,
        this.rng.range(-1, 1) * speed,
      );
      d.life = this.rng.range(0.5, 1.1);
      d.size = this.rng.range(0.6, 1.5);
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.maxFoam; i++) {
      const p = this.particles[i];
      if (p.life >= p.maxLife) {
        this.alphas[i] = 0;
        continue;
      }
      p.life += dt;
      const t = clamp(p.life / p.maxLife, 0, 1);
      this.velocities[i * 3 + 1] -= 5.2 * dt;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      this.sizes[i] = p.size * (0.55 + t * 1.5);
      this.alphas[i] = (1 - t) * 0.85;
    }
    const geo = this.points.geometry;
    (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;

    for (let i = 0; i < this.maxDrops; i++) {
      const d = this.dropState[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      d.vel.y -= 9.81 * dt;
      d.pos.addScaledVector(d.vel, dt);
      this.dummy.position.copy(d.pos);
      this.dummy.scale.setScalar(d.life > 0 ? d.size : 0.001);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.drops.setMatrixAt(i, this.dummy.matrix);
      if (d.life <= 0) {
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.drops.setMatrixAt(i, this.dummy.matrix);
      }
    }
    this.drops.instanceMatrix.needsUpdate = true;
  }
}
