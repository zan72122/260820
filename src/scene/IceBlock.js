// The block. A rounded slab of block ice with a milky core, held nose-down on
// the blade table; it loses height as the blade eats it.

import { Mesh, Vector3, Group, CylinderGeometry, MeshStandardMaterial, Color } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createIceMaterial } from '../materials/ice.js';
import { M } from './Machine.js';

export class IceBlock {
  constructor(parent, { volume, envMap, sun, quality }) {
    this.size = M.iceSize.clone();
    this.h0 = this.size.y;
    this.height = this.h0;
    this.minHeight = this.h0 * 0.54;   // one serving never eats more than this

    const geo = new RoundedBoxGeometry(this.size.x, this.size.y, this.size.z, 4, 0.0068);
    this.mat = createIceMaterial({ volume, envMap, sun, quality });
    this.mat.userData.uniforms.uVolMin.value.set(-this.size.x / 2, -this.size.y / 2, -this.size.z / 2);
    this.mat.userData.uniforms.uVolSize.value.copy(this.size);

    this.mesh = new Mesh(geo, this.mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    parent.add(this.mesh);

    // a thin skim of meltwater under the block, on the chrome
    this.puddle = new Mesh(
      new CylinderGeometry(0.062, 0.062, 0.0006, 28),
      new MeshStandardMaterial({
        color: new Color(0.82, 0.90, 0.96), metalness: 0.1, roughness: 0.06,
        transparent: true, opacity: 0.0,
      })
    );
    this.puddle.position.set(M.iceCenter.x, M.tableTop + 0.0005, M.iceCenter.z);
    parent.add(this.puddle);

    this._objCam = new Vector3();
    this.apply(0);
  }

  get top() { return M.tableTop + this.height; }
  get wornFraction() { return (this.h0 - this.height) / (this.h0 - this.minHeight); }

  /** Removes `dv` cubic metres of ice from the bottom of the block. */
  consume(dv) {
    const area = this.size.x * this.size.z * 0.82;   // the block is rounded, not square
    this.height = Math.max(this.minHeight, this.height - dv / area);
  }

  apply(angle) {
    const s = this.height / this.h0;
    this.mesh.scale.set(1, s, 1);
    this.mesh.position.set(M.iceCenter.x, M.tableTop + this.height * 0.5, M.iceCenter.z);
    this.mesh.rotation.y = angle;
    this.puddle.material.opacity = Math.min(0.35, this.wornFraction * 0.9);
    this.puddle.visible = this.puddle.material.opacity > 0.01;
  }

  update(camera, dt, wet) {
    const u = this.mat.userData.uniforms;
    u.uTime.value += dt;
    u.uWet.value += (wet - u.uWet.value) * Math.min(1, dt * 3);
    // camera in the block's own space, for the interior raymarch
    this.mesh.updateMatrixWorld();
    this._objCam.copy(camera.position);
    this.mesh.worldToLocal(this._objCam);
    u.uObjCam.value.copy(this._objCam);
  }

  setEnvMap(env) { this.mat.envMap = env; this.mat.needsUpdate = true; }
}
