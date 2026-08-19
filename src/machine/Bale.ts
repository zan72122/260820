import * as THREE from 'three';
import { baleBarrel, baleEnd, wrapFilm } from '../world/textures';
import { BALE_HALF_W } from '../game/constants';

/**
 * A round bale.  The barrel geometry is unit-radius so the same mesh can
 * be *grown* by scaling — the roll in the chamber is not a gauge, it is
 * the real cylinder getting fatter.
 * Local axis of the roll is X (the machine's lateral axis), which means
 * looking at the machine from the side you see the round end of it: a
 * circle that visibly swells.
 */
export class Bale {
  readonly group = new THREE.Group();
  private core: THREE.Mesh;
  private wrapBarrel: THREE.Mesh;
  private wrapCapL: THREE.Mesh;
  private wrapCapR: THREE.Mesh;
  private wrapMat: THREE.MeshStandardMaterial;
  private capMat: THREE.MeshStandardMaterial;

  radius = 0.2;
  coverage = 0;
  /** how much of the barrel's length the film currently covers */
  private axial = 0.04;

  constructor(halfWidth = BALE_HALF_W) {
    const side = new THREE.MeshStandardMaterial({
      map: baleBarrel(),
      roughness: 0.94,
      metalness: 0,
      color: 0xffffff,
    });
    (side.map as THREE.Texture).repeat.set(3, 1);
    const end = new THREE.MeshStandardMaterial({
      map: baleEnd(),
      roughness: 0.96,
      metalness: 0,
    });

    const geo = new THREE.CylinderGeometry(1, 1, halfWidth * 2, 30, 1, false);
    geo.rotateZ(Math.PI / 2);
    this.core = new THREE.Mesh(geo, [side, end, end]);
    this.core.castShadow = true;
    this.core.receiveShadow = true;
    this.group.add(this.core);

    const wrapTex = wrapFilm();
    this.wrapMat = new THREE.MeshStandardMaterial({
      map: wrapTex,
      roughness: 0.34,
      metalness: 0.02,
      transparent: true,
      opacity: 0.96,
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    const wgeo = new THREE.CylinderGeometry(1.045, 1.045, halfWidth * 2 * 1.01, 30, 1, true);
    wgeo.rotateZ(Math.PI / 2);
    this.wrapBarrel = new THREE.Mesh(wgeo, this.wrapMat);
    this.wrapBarrel.castShadow = true;
    this.wrapBarrel.visible = false;
    this.group.add(this.wrapBarrel);

    // the shoulders that close over the ends once the barrel is covered
    this.capMat = new THREE.MeshStandardMaterial({
      map: wrapTex,
      roughness: 0.36,
      transparent: true,
      opacity: 0,
      color: 0xf2f4ef,
      side: THREE.DoubleSide,
    });
    const capGeo = new THREE.CircleGeometry(1.06, 26);
    capGeo.rotateY(Math.PI / 2);
    this.wrapCapR = new THREE.Mesh(capGeo, this.capMat);
    this.wrapCapR.position.x = halfWidth * 1.02;
    this.wrapCapL = new THREE.Mesh(capGeo, this.capMat);
    this.wrapCapL.position.x = -halfWidth * 1.02;
    this.wrapCapL.rotation.y = Math.PI;
    this.wrapCapL.visible = this.wrapCapR.visible = false;
    this.group.add(this.wrapCapL, this.wrapCapR);

    this.setRadius(0.2);
  }

  /**
   * Every one of these geometries was baked with a rotation so the roll's
   * axis runs along X — which means each mesh's local X is its *length* and
   * Y/Z are its radius.  Scaling the wrong axis turns the bale into an
   * ellipse that only fattens sideways, so keep the two terms apart.
   */
  setRadius(r: number) {
    this.radius = r;
    this.core.scale.set(1, r, r);
    this.wrapBarrel.scale.set(this.axial, r, r);
    this.wrapCapL.scale.set(1, r, r);
    this.wrapCapR.scale.set(1, r, r);
  }

  /** 0 = bare crop, 1 = fully sheathed in white film. */
  setCoverage(c: number) {
    this.coverage = c;
    if (c <= 0.001) {
      this.wrapBarrel.visible = false;
      this.wrapCapL.visible = this.wrapCapR.visible = false;
      return;
    }
    this.wrapBarrel.visible = true;
    // film starts as a band in the middle and creeps out to both shoulders
    const cover = Math.min(1, c * 1.12);
    this.axial = Math.max(0.04, cover);
    this.wrapBarrel.scale.x = this.axial;
    this.wrapMat.opacity = 0.62 + Math.min(1, c) * 0.36;
    const capA = THREE.MathUtils.clamp((c - 0.72) / 0.28, 0, 1);
    const showCaps = capA > 0.001;
    this.wrapCapL.visible = this.wrapCapR.visible = showCaps;
    // Once the shoulders are closed the film is solid; leaving it blended
    // let the dark cut end of the bale ghost through as a dirty ring.
    const opaque = capA > 0.985;
    if (this.capMat.transparent === opaque) {
      this.capMat.transparent = !opaque;
      this.capMat.needsUpdate = true;
    }
    this.capMat.opacity = opaque ? 1 : capA * 0.97;
  }

  /** Roll about the bale's own axis. */
  spin(radians: number) {
    this.group.rotation.x += radians;
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
