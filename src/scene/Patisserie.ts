import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MaterialLibrary } from './materials';
import { contactShadowTexture } from '../util/textures';
import { Config } from '../engine/config';
import { Rng } from '../util/math';

/** Where the acts happen, in metres, with the bench top at y = 0. */
export const LAYOUT = {
  nail: new THREE.Vector3(-0.035, 0, 0.05),
  nailHeight: 0.062,
  cake: new THREE.Vector3(0.155, 0, -0.2),
  cakeTop: 0.058,
  cakeRadius: 0.055,
};

/** Breaks the primitive look. Vertices near the axis are left alone so lathe
 *  caps do not fan out into a visible star. */
function jitterVertices(geo: THREE.BufferGeometry, amount: number, seed: number, minRadius = 0) {
  const rng = new Rng(seed);
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getZ(i));
    const k = minRadius > 0 ? Math.min(1, Math.max(0, (r - minRadius) / minRadius)) : 1;
    if (k <= 0) continue;
    p.setXYZ(
      i,
      p.getX(i) + rng.sym(amount * k),
      p.getY(i) + rng.sym(amount * 0.5 * k),
      p.getZ(i) + rng.sym(amount * k),
    );
  }
  geo.computeVertexNormals();
  return geo;
}

/** Cheap blurred blob that grounds a prop without a second shadow map. */
export function contactShadow(radius: number, opacity = 1): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: contactShadowTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = -1;
  return m;
}

export class Patisserie {
  readonly group = new THREE.Group();
  readonly keyLight: THREE.DirectionalLight;
  readonly cake: THREE.Group;
  readonly cakeSurface: THREE.Mesh;

  constructor(readonly mats: MaterialLibrary, scene: THREE.Scene) {
    scene.add(this.group);
    scene.fog = new THREE.Fog(0x241f1a, 0.85, 3.4);

    // ---- bench ----
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 1.1), mats.woodMat);
    bench.position.set(0, -0.025, -0.15);
    bench.receiveShadow = true;
    this.group.add(bench);

    const apron = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.03), mats.woodMat);
    apron.position.set(0, -0.12, 0.38);
    this.group.add(apron);

    // ---- room ----
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6), mats.wallMat);
    wall.position.set(0, 0.6, -0.72);
    wall.receiveShadow = true;
    this.group.add(wall);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 3),
      new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.92, 0.2);
    this.group.add(floor);

    // shelf with silhouette props: real geometry, merged into one draw call
    const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.026, 0.16), mats.woodMat);
    shelfBoard.position.set(-0.05, 0.34, -0.63);
    shelfBoard.castShadow = !Config.fast;
    this.group.add(shelfBoard);

    const clutter: THREE.BufferGeometry[] = [];
    const rng = new Rng(1207);
    for (let i = 0; i < 9; i++) {
      const h = rng.range(0.05, 0.12);
      const r = rng.range(0.022, 0.04);
      const g = new THREE.CylinderGeometry(r * rng.range(0.85, 1), r, h, 14, 1);
      g.translate(-0.55 + i * 0.14 + rng.sym(0.015), 0.353 + h / 2, -0.63 + rng.sym(0.02));
      clutter.push(g);
      const lid = new THREE.CylinderGeometry(r * 1.06, r * 1.06, 0.008, 14);
      lid.translate(-0.55 + i * 0.14, 0.353 + h + 0.004, -0.63);
      clutter.push(lid);
    }
    const jars = new THREE.Mesh(
      mergeGeometries(clutter, false)!,
      new THREE.MeshStandardMaterial({ color: 0xb9a68c, roughness: 0.55, metalness: 0.1 }),
    );
    jars.castShadow = !Config.fast;
    this.group.add(jars);

    // ---- background bowls and tools (real geometry for occlusion, merged) ----
    const steelBits: THREE.BufferGeometry[] = [];
    const bowl = (x: number, z: number, r: number) => {
      // lower half of a sphere, lifted so the bowl rests on the bench
      const g = new THREE.SphereGeometry(r, 26, 14, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48);
      g.translate(x, r, z);
      steelBits.push(g);
      const rimY = r - r * Math.cos(Math.PI * 0.52) * -1;
      const rim = new THREE.TorusGeometry(r * 0.999, 0.0016, 6, 30);
      rim.rotateX(Math.PI / 2);
      rim.translate(x, rimY, z);
      steelBits.push(rim);
    };
    bowl(-0.34, -0.3, 0.075);
    bowl(-0.2, -0.44, 0.05);
    const scraper = new THREE.BoxGeometry(0.075, 0.0012, 0.05);
    scraper.rotateY(0.5);
    scraper.translate(0.36, 0.001, 0.02);
    steelBits.push(scraper);
    const steelProps = new THREE.Mesh(mergeGeometries(steelBits, false)!, mats.steelDark);
    steelProps.castShadow = !Config.fast;
    steelProps.receiveShadow = true;
    this.group.add(steelProps);

    const cloth = new THREE.Mesh(
      jitterVertices(new THREE.PlaneGeometry(0.2, 0.15, 8, 6), 0.0035, 8),
      new THREE.MeshStandardMaterial({ color: 0xa8b7c4, roughness: 0.95 }),
    );
    cloth.rotation.set(-Math.PI / 2, 0, 0.6);
    cloth.position.set(-0.3, 0.002, 0.16);
    cloth.receiveShadow = true;
    this.group.add(cloth);

    // ---- cake on its turntable ----
    this.cake = new THREE.Group();
    this.cake.position.copy(LAYOUT.cake);
    this.group.add(this.cake);

    const turntableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.09, 0.008, 40), mats.steelDark);
    turntableBase.position.y = 0.004;
    turntableBase.receiveShadow = true;
    this.cake.add(turntableBase);
    const turntableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.004, 40), mats.steel);
    turntableTop.position.y = 0.011;
    turntableTop.castShadow = !Config.fast;
    turntableTop.receiveShadow = true;
    this.cake.add(turntableTop);

    const R = LAYOUT.cakeRadius;
    const bodyH = 0.042;
    const profile: THREE.Vector2[] = [];
    profile.push(new THREE.Vector2(0.0001, 0));
    profile.push(new THREE.Vector2(R * 0.98, 0));
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      profile.push(new THREE.Vector2(R * (0.98 + 0.02 * Math.sin(t * Math.PI)), bodyH * t));
    }
    // rounded top edge, then a slightly domed buttercream lid
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      const a = (t * Math.PI) / 2;
      profile.push(new THREE.Vector2(R - R * 0.09 * (1 - Math.cos(a)), bodyH + 0.006 * Math.sin(a)));
    }
    profile.push(new THREE.Vector2(R * 0.6, bodyH + 0.008));
    profile.push(new THREE.Vector2(0.0001, bodyH + 0.0105));
    const cakeGeo = jitterVertices(new THREE.LatheGeometry(profile, Config.fast ? 30 : 54), 0.00035, 44, R * 0.45);
    const cakeMesh = new THREE.Mesh(cakeGeo, mats.spongeMat);
    cakeMesh.position.y = 0.013;
    cakeMesh.castShadow = !Config.fast;
    cakeMesh.receiveShadow = true;
    this.cake.add(cakeMesh);

    // buttercream coat on top so the flower lands on cream, not sponge
    const coat = new THREE.Mesh(
      jitterVertices(new THREE.CylinderGeometry(R * 0.995, R * 1.0, 0.006, Config.fast ? 30 : 54, 1), 0.00025, 91, R * 0.6),
      new THREE.MeshPhysicalMaterial({
        color: 0xf5e7cf,
        roughness: 0.5,
        clearcoat: 0.18,
        clearcoatRoughness: 0.6,
        sheen: 0.4,
        sheenColor: new THREE.Color(0xfff0dd),
      }),
    );
    coat.position.y = 0.013 + bodyH + 0.008;
    coat.castShadow = !Config.fast;
    coat.receiveShadow = true;
    this.cake.add(coat);
    this.cakeSurface = coat;
    LAYOUT.cakeTop = LAYOUT.cake.y + 0.013 + bodyH + 0.011;

    const cakeShadow = contactShadow(0.115, 0.85);
    cakeShadow.position.set(0, 0.0012, 0);
    this.cake.add(cakeShadow);

    // ---- light: one soft window key that casts, plus non-casting shaping ----
    this.keyLight = new THREE.DirectionalLight(0xfff2e0, 2.2);
    this.keyLight.position.set(-0.45, 0.62, 0.34);
    this.keyLight.target.position.set(0.02, 0.04, -0.05);
    this.keyLight.castShadow = !Config.fast;
    const sh = this.keyLight.shadow;
    sh.mapSize.set(Config.fast ? 512 : 1024, Config.fast ? 512 : 1024);
    sh.camera.near = 0.05;
    sh.camera.far = 1.6;
    sh.camera.left = -0.34;
    sh.camera.right = 0.34;
    sh.camera.top = 0.34;
    sh.camera.bottom = -0.34;
    sh.bias = -0.00035;
    sh.normalBias = 0.0015;
    sh.radius = 3;
    scene.add(this.keyLight);
    scene.add(this.keyLight.target);

    const softbox = new THREE.DirectionalLight(0xffe9d2, 0.7);
    softbox.position.set(0.6, 0.75, 0.15);
    scene.add(softbox);

    const rim = new THREE.DirectionalLight(0xbdd6ff, 0.75);
    rim.position.set(0.15, 0.3, -0.75);
    scene.add(rim);

    const bounce = new THREE.HemisphereLight(0xbcd0ef, 0x5b4433, 0.42);
    scene.add(bounce);
  }
}
