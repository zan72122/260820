import * as THREE from 'three';
import { treelineTexture, gardenTexture, houseTexture, bokehTexture, smokeTexture } from '../gfx/textures.js';
import { Sky } from './sky.js';

// The world behind the sparkler is painted, not built.
//
// A macro lens at 25cm has a depth of field of a few millimetres, so everything
// past the hand is a soft wash of value anyway. Painting it pre-defocused onto
// four parallax planes costs four textured quads instead of a garden, and it
// leaves the entire GPU budget where the brief wants it: on a bead of fire the
// size of a grain of rice.

function textureAspect(mesh) {
  const img = mesh.material.map?.image;
  return img && img.height ? img.width / img.height : 1;
}

function plate(texture, opts = {}) {
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: opts.transparent !== false,
    depthWrite: false,
    depthTest: false,
    color: new THREE.Color(opts.tint ?? 0xffffff),
    opacity: opts.opacity ?? 1,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.frustumCulled = false;
  return mesh;
}

export class Environment {
  constructor(quality) {
    this.group = new THREE.Group();
    const big = quality.settings.name === 'high' ? 1 : 0.75;

    this.sky = new Sky();
    this.group.add(this.sky.mesh);
    this.trees = plate(treelineTexture(Math.round(3072 * big), Math.round(384 * big)));
    this.garden = plate(gardenTexture(Math.round(3072 * big), Math.round(512 * big)));
    this.house = plate(houseTexture(Math.round(1024 * big)));

    // Painter's order: these never occlude anything, they only sit behind it,
    // so they are drawn back to front by hand.
    this.trees.renderOrder = -30;
    this.garden.renderOrder = -22;
    this.house.renderOrder = -18;

    // Exposure per layer does the work that aerial perspective would do.
    this.trees.material.color.setScalar(0.5);
    this.garden.material.color.setScalar(1.15);
    this.house.material.color.setScalar(0.5);

    // Layers sit at real distances and real sizes rather than being fitted to
    // the frustum, so one set of numbers composes correctly in both
    // orientations: portrait crops the width away, landscape reveals more of it.
    // The lens is at roughly chest height, so the ground is at y = -1.2.
    //   dist   metres in front of the camera
    //   width  metres across (height follows the texture's aspect)
    //   x, y   metres from the lens axis
    this.layers = [
      { mesh: this.trees, dist: 42, width: 92, x: 3.0, anchorV: 0.78, anchorY: -1.2 },
      { mesh: this.garden, dist: 9.0, width: 30, x: 0.6, anchorV: 0.62, anchorY: -1.2 },
      { mesh: this.house, dist: 8.0, width: 10.24, x: -1.44, anchorV: 0.62, anchorY: -0.72 },
    ];
    for (const l of this.layers) this.group.add(l.mesh);

    // Fireflies and the distant lanterns of a festival nobody is going to.
    const bokehTex = bokehTexture(96);
    this.bokehs = [];
    const spec = [
      { x: -0.78, y: 0.26, z: -6.6, s: 0.115, c: 0xffb066, i: 0.13, drift: 0.05, hz: 0.07 },
      { x: 1.02, y: -0.14, z: -5.6, s: 0.090, c: 0xffc888, i: 0.10, drift: 0.04, hz: 0.05 },
      { x: 0.40, y: -0.26, z: -3.9, s: 0.024, c: 0xd8ffa8, i: 0.30, drift: 0.10, hz: 0.19 },
      { x: -0.34, y: -0.44, z: -3.2, s: 0.019, c: 0xcaf79a, i: 0.26, drift: 0.12, hz: 0.23 },
      { x: 2.0, y: 0.40, z: -9.4, s: 0.170, c: 0xff9a5a, i: 0.08, drift: 0.02, hz: 0.03 },
    ];
    for (const s of spec) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: bokehTex,
          color: new THREE.Color(s.c),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
          opacity: s.i,
        })
      );
      m.scale.setScalar(s.s);
      m.position.set(s.x, s.y, s.z);
      m.renderOrder = -5;
      m.frustumCulled = false;
      m.userData = { ...s, base: new THREE.Vector3(s.x, s.y, s.z), phase: Math.random() * 10 };
      this.group.add(m);
      this.bokehs.push(m);
    }

    // Mosquito-coil smoke on the veranda: three slow, almost invisible wisps.
    const smokeTex = smokeTexture(128, 21);
    this.coilSmoke = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: smokeTex,
          color: new THREE.Color(0x6b7180),
          transparent: true,
          depthWrite: false,
          depthTest: false,
          opacity: 0.05,
        })
      );
      m.position.set(-0.62, -0.28 + i * 0.22, -2.9);
      m.scale.setScalar(0.5 + i * 0.25);
      m.renderOrder = -8;
      m.frustumCulled = false;
      m.userData = { t: i / 3, speed: 0.055 + i * 0.012, phase: i * 2.1 };
      this.group.add(m);
      this.coilSmoke.push(m);
    }

    // The glow the fallen bead leaves on the ground, well below the frame edge.
    this.groundGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: bokehTexture(64),
        color: new THREE.Color(1.0, 0.36, 0.12),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        opacity: 0,
      })
    );
    this.groundGlow.scale.setScalar(0.16);
    this.groundGlow.renderOrder = -4;
    this.groundGlow.frustumCulled = false;
    this.group.add(this.groundGlow);
  }

  // Plates are placed at true size and anchored to real ground heights.
  layout(camera) {
    for (const l of this.layers) {
      const w = l.width;
      const h = w / textureAspect(l.mesh);
      // anchorV is the row of the plate that must land at world height anchorY:
      // the tree bases on the ground, the veranda deck at knee height.
      const cy = l.anchorY + (l.anchorV - 0.5) * h;
      l.mesh.scale.set(w, h, 1);
      l.mesh.position.set(
        camera.position.x + (l.x || 0),
        camera.position.y + cy,
        camera.position.z - l.dist
      );
      l.mesh.quaternion.copy(camera.quaternion);
    }
  }

  update(dt, t, camera, groundGlow) {
    this.layout(camera);
    this.sky.update(camera, t);
    for (const m of this.bokehs) {
      const d = m.userData;
      // Positions are camera-relative so the layers stay put behind the lens.
      m.position.set(
        camera.position.x + d.base.x + Math.sin(t * d.hz * 2.1 + d.phase) * d.drift,
        camera.position.y + d.base.y + Math.sin(t * d.hz * 1.4 + d.phase * 1.7) * d.drift * 0.8,
        camera.position.z + d.base.z
      );
      m.quaternion.copy(camera.quaternion);
      // Fireflies breathe; lanterns barely flicker.
      const pulse = d.hz > 0.15 ? 0.45 + 0.55 * Math.pow(Math.sin(t * 1.1 + d.phase) * 0.5 + 0.5, 3) : 1;
      m.material.opacity = d.i * pulse;
    }
    for (const m of this.coilSmoke) {
      const d = m.userData;
      d.t += dt * d.speed;
      if (d.t > 1) d.t -= 1;
      m.position.y = camera.position.y - 0.42 + d.t * 0.95;
      m.position.x = camera.position.x - 0.62 + Math.sin(d.t * 3.1 + d.phase) * 0.09;
      m.position.z = camera.position.z - 2.9;
      m.scale.setScalar(0.35 + d.t * 0.85);
      m.material.opacity = 0.055 * Math.sin(Math.PI * Math.min(1, d.t * 1.15));
      m.quaternion.copy(camera.quaternion);
    }
    if (groundGlow > 0.001) {
      this.groundGlow.material.opacity = groundGlow * 0.42;
      this.groundGlow.position.set(camera.position.x + 0.01, camera.position.y - 0.60, camera.position.z - 1.9);
      this.groundGlow.scale.setScalar(0.30 + (1 - groundGlow) * 0.34);
      this.groundGlow.quaternion.copy(camera.quaternion);
      this.groundGlow.visible = true;
    } else {
      this.groundGlow.visible = false;
    }
  }

  dispose() {
    this.sky.dispose();
    this.group.traverse((o) => {
      if (o === this.sky.mesh) return;
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
  }
}
