import * as THREE from 'three';
import { CourseSpline } from '../course/CourseSpline';
import { poolGeometry, waterFilmGeometry } from '../course/CourseGeometry';
import { caustics, flowStreaks, waterNormal } from '../world/Textures';
import { LANDMARK_X } from '../core/Config';
import { approach } from '../core/Rng';

export interface WaterQuality {
  caustics: boolean;
  secondFilmLayer: boolean;
}

/**
 * The water that is always on the slide: a thin running film on the FRP, the
 * standing water in the waiting dimple, and the runout pool. Flow direction is
 * always down-course except where the blast drives it back up the hill.
 */
export class WaterSurfaceRenderer {
  readonly group = new THREE.Group();
  private readonly filmA: THREE.Mesh;
  private readonly filmB: THREE.Mesh | null = null;
  private readonly dimple: THREE.Mesh;
  private readonly runout: THREE.Mesh;
  private readonly causticMesh: THREE.Mesh | null = null;
  private readonly normalTex: THREE.Texture;
  private readonly normalTexB: THREE.Texture;
  private readonly causticTex: THREE.Texture;
  private flow = 1;
  private blastFlow = 0;
  private time = 0;

  constructor(spline: CourseSpline, quality: WaterQuality) {
    this.normalTex = waterNormal().clone();
    this.normalTex.needsUpdate = true;
    this.normalTex.wrapS = this.normalTex.wrapT = THREE.RepeatWrapping;
    this.normalTex.repeat.set(0.7, 1.1);

    this.normalTexB = waterNormal().clone();
    this.normalTexB.needsUpdate = true;
    this.normalTexB.wrapS = this.normalTexB.wrapT = THREE.RepeatWrapping;
    this.normalTexB.repeat.set(1.5, 2.6);

    const streaks = flowStreaks();

    const filmGeo = waterFilmGeometry(spline);
    const filmMat = new THREE.MeshStandardMaterial({
      color: 0xd6f0fa,
      roughness: 0.055,
      metalness: 0.0,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      normalMap: this.normalTex,
      roughnessMap: streaks,
      envMapIntensity: 1.35,
      side: THREE.FrontSide,
    });
    filmMat.normalScale.set(0.16, 0.16);
    this.filmA = new THREE.Mesh(filmGeo, filmMat);
    this.filmA.renderOrder = 2;
    this.group.add(this.filmA);

    if (quality.secondFilmLayer) {
      const geoB = waterFilmGeometry(spline);
      geoB.translate(0, 0.012, 0);
      const matB = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.03,
        metalness: 0,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        normalMap: this.normalTexB,
        envMapIntensity: 1.6,
      });
      matB.normalScale.set(0.16, 0.16);
      this.filmB = new THREE.Mesh(geoB, matB);
      this.filmB.renderOrder = 3;
      this.group.add(this.filmB);
    }

    const poolMat = () =>
      new THREE.MeshStandardMaterial({
        color: 0x2f8ba8,
        roughness: 0.045,
        metalness: 0.0,
        transparent: true,
        opacity: 0.82,
        normalMap: this.normalTexB,
        envMapIntensity: 1.5,
        depthWrite: false,
      });

    const dimpleFrom = spline.sAtX(15.6);
    const dimpleTo = spline.sAtX(21.9);
    this.dimple = new THREE.Mesh(poolGeometry(spline, dimpleFrom, dimpleTo, 0.72), poolMat());
    this.dimple.renderOrder = 4;
    this.group.add(this.dimple);

    const runoutFrom = spline.sAtX(58.0);
    const runoutTo = spline.sAtX(LANDMARK_X.runoutEnd + 3);
    this.runout = new THREE.Mesh(poolGeometry(spline, runoutFrom, runoutTo, 1.32), poolMat());
    this.runout.renderOrder = 4;
    this.group.add(this.runout);

    if (quality.caustics) {
      this.causticTex = caustics().clone();
      this.causticTex.needsUpdate = true;
      this.causticTex.wrapS = this.causticTex.wrapT = THREE.RepeatWrapping;
      this.causticTex.repeat.set(3, 6);
      const causticGeo = poolGeometry(spline, runoutFrom, runoutTo, 1.0, 1.18);
      const causticMat = new THREE.MeshBasicMaterial({
        map: this.causticTex,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.causticMesh = new THREE.Mesh(causticGeo, causticMat);
      this.causticMesh.renderOrder = 1;
      this.group.add(this.causticMesh);
    } else {
      this.causticTex = caustics();
    }
  }

  /** 0..1 how hard the pumps are driving water up the hill. */
  setBlastFlow(v: number): void {
    this.blastFlow = v;
  }

  update(dt: number): void {
    this.time += dt;
    this.flow = approach(this.flow, 1 + this.blastFlow * 2.6, 0.25, dt);
    const base = this.flow * dt;
    this.normalTex.offset.y -= base * 0.34;
    this.normalTex.offset.x += Math.sin(this.time * 0.4) * dt * 0.01;
    this.normalTexB.offset.y -= base * 0.62;
    if (this.causticMesh) {
      this.causticTex.offset.y -= dt * 0.03;
      this.causticTex.offset.x = Math.sin(this.time * 0.22) * 0.05;
      (this.causticMesh.material as THREE.MeshBasicMaterial).opacity =
        0.28 + Math.sin(this.time * 1.7) * 0.05;
    }
    // Standing water reacts to the raft dropping in: a slow settle, no more.
    const dimpleMat = this.dimple.material as THREE.MeshStandardMaterial;
    dimpleMat.opacity = 0.78 + Math.sin(this.time * 0.9) * 0.03;
  }

  get runoutLevel(): number {
    return 1.32;
  }
}
