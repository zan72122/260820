// The place: a small sweet shop counter on a hot afternoon. Everything past the
// counter edge is deliberately cheap -- the detail budget belongs to the machine.

import {
  Group, Mesh, BoxGeometry, PlaneGeometry, SphereGeometry, CylinderGeometry,
  MeshStandardMaterial, MeshBasicMaterial, DirectionalLight, HemisphereLight, NormalBlending,
  Color, Vector3, DoubleSide, BackSide, RepeatWrapping, Fog, IcosahedronGeometry,
  ShaderMaterial, AmbientLight,
} from 'three';
import { woodMaps, fabricMaps, counterShadeTexture } from '../util/procTextures.js';
import { mulberry32 } from '../util/rand.js';

export const SUN_DIR = new Vector3(-0.52, 0.76, -0.39).normalize();

export class Environment {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.group = new Group();
    scene.add(this.group);
    this.time = 0;

    scene.fog = new Fog(new Color(0.720, 0.775, 0.752), 3.0, 14.0);

    this._light();
    this._sky();
    this._counter();
    this._garden();
    this._noren();
  }

  // ------------------------------------------------------------------ lighting
  _light() {
    // One sun. Everything else is image-based, so there is a single shadow to pay for.
    const sun = new DirectionalLight(new Color(1.0, 0.955, 0.885), 3.9);
    sun.position.copy(SUN_DIR).multiplyScalar(4.0);
    sun.target.position.set(0, 0.10, 0.02);
    sun.castShadow = true;
    const s = 0.62;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 1.6; sun.shadow.camera.far = 6.4;
    sun.shadow.mapSize.set(this.quality.shadowMap, this.quality.shadowMap);
    sun.shadow.bias = -0.00042;
    sun.shadow.normalBias = 0.006;
    sun.shadow.radius = 3;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    // a whisper of bounce from the hot ground; the IBL does the rest
    const hemi = new HemisphereLight(new Color(0.72, 0.83, 1.0), new Color(0.42, 0.33, 0.24), 0.42);
    this.scene.add(hemi);
  }

  // ----------------------------------------------------------------------- sky
  _sky() {
    const geo = new SphereGeometry(30, 24, 16);
    const mat = new ShaderMaterial({
      side: BackSide, depthWrite: false, fog: false,
      uniforms: { uSun: { value: SUN_DIR.clone() } },
      vertexShader: `varying vec3 vDir;
        void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vDir; uniform vec3 uSun;
        void main(){
          float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 top = vec3(0.33, 0.55, 0.96);
          vec3 haze = vec3(0.86, 0.90, 0.94);
          vec3 col = mix(haze, top, pow(clamp(vDir.y, 0.0, 1.0), 0.5));
          col = mix(vec3(0.62,0.62,0.56), col, smoothstep(-0.12, 0.06, vDir.y));
          float sd = max(dot(normalize(vDir), uSun), 0.0);
          col += vec3(1.0,0.94,0.80) * pow(sd, 90.0) * 3.0;
          col += vec3(1.0,0.95,0.85) * pow(sd, 6.0) * 0.22;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const sky = new Mesh(geo, mat);
    sky.frustumCulled = false;
    this.scene.add(sky);
  }

  // ------------------------------------------------------------------- counter
  _counter() {
    const w = woodMaps(512);
    w.map.repeat.set(6, 5.5); w.roughnessMap.repeat.copy(w.map.repeat); w.normalMap.repeat.copy(w.map.repeat);
    const woodMat = new MeshStandardMaterial({
      map: w.map, roughnessMap: w.roughnessMap, normalMap: w.normalMap,
      metalness: 0.0, roughness: 1.0, color: 0xffffff,
    });
    woodMat.normalScale.set(0.22, 0.22);

    // Six boards, not one slab: the seams are what tell you how wide this counter
    // actually is, and therefore how big the machine on it is.
    const BOARDS = [0.185, 0.150, 0.205, 0.165, 0.195, 0.140];
    let z = -0.575;
    for (let i = 0; i < BOARDS.length; i++) {
      const w = BOARDS[i];
      const m = new Mesh(new BoxGeometry(2.4, 0.058, w - 0.004), woodMat);
      m.position.set(-0.05, -0.029 - (i % 2) * 0.0006, z + w / 2);
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
      z += w;
    }
    // dark line in the seams so the boards read even in flat light
    const seam = new Mesh(
      new BoxGeometry(2.4, 0.050, 1.02),
      new MeshStandardMaterial({ color: new Color(0.055, 0.038, 0.026), roughness: 1.0 })
    );
    seam.position.set(-0.05, -0.033, -0.06);
    this.group.add(seam);

    // rounded front nosing so the near edge catches a highlight
    const nose = new Mesh(new CylinderGeometry(0.029, 0.029, 2.4, 14, 1, false, 0, Math.PI), woodMat);
    nose.rotation.set(0, 0, Math.PI / 2);
    nose.position.set(-0.05, -0.029, 0.445);
    nose.rotation.y = Math.PI;
    nose.castShadow = true; nose.receiveShadow = true;
    this.group.add(nose);

    // soft shade cast across the counter by the eave and the noren
    const shade = new Mesh(
      new PlaneGeometry(1.95, 1.12),
      new MeshBasicMaterial({
        map: counterShadeTexture(512), transparent: true, opacity: 0.72,
        depthWrite: false, color: new Color(0.055, 0.070, 0.115),
        blending: NormalBlending, fog: false, toneMapped: false,
      })
    );
    shade.material.polygonOffset = true;
    shade.material.polygonOffsetFactor = -2;
    shade.rotation.x = -Math.PI / 2;
    shade.rotation.z = -0.14;
    shade.position.set(-0.40, 0.0010, -0.10);
    shade.renderOrder = -1;
    this.group.add(shade);

    // a damp cotton cloth folded on the counter — sells the scale and the trade
    // a damp cotton cloth, folded twice, of the kind that lives beside the machine
    const clothMat = new MeshStandardMaterial({ color: new Color(0.235, 0.250, 0.245), roughness: 0.96 });
    for (const [dx, dz, w, d, y, ry] of [
      [0, 0, 0.115, 0.082, 0.0045, 0.22],
      [0.006, -0.004, 0.100, 0.070, 0.0110, 0.30],
    ]) {
      const c = new Mesh(new BoxGeometry(w, 0.009, d), clothMat);
      c.position.set(-0.415 + dx, y, 0.205 + dz);
      c.rotation.y = ry;
      c.castShadow = true; c.receiveShadow = true;
      this.group.add(c);
    }
  }

  // -------------------------------------------------------------------- garden
  _garden() {
    const rnd = mulberry32(4242);
    const g = new Group();
    g.position.y = -0.95;

    const ground = new Mesh(
      new PlaneGeometry(16, 10),
      new MeshStandardMaterial({ color: new Color(0.140, 0.165, 0.088), roughness: 1.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -3.2);
    ground.receiveShadow = false;
    g.add(ground);

    // pale gravel path catching the sun, right of frame
    const gravel = new Mesh(
      new PlaneGeometry(3.0, 3.4),
      new MeshStandardMaterial({ color: new Color(0.455, 0.425, 0.355), roughness: 1.0 })
    );
    gravel.rotation.x = -Math.PI / 2;
    gravel.position.set(1.6, 0.004, -3.0);
    g.add(gravel);

    const leafMat = new MeshStandardMaterial({ color: new Color(0.062, 0.128, 0.040), roughness: 0.96, flatShading: true });
    const leafMat2 = new MeshStandardMaterial({ color: new Color(0.105, 0.198, 0.058), roughness: 0.96, flatShading: true });
    const bushGeo = new IcosahedronGeometry(1, 1);
    for (let i = 0; i < 20; i++) {
      const m = new Mesh(bushGeo, rnd() > 0.5 ? leafMat : leafMat2);
      const r = 0.17 + rnd() * 0.30;
      m.scale.set(r * (0.8 + rnd() * 0.6), r * (0.7 + rnd() * 0.5), r);
      m.position.set(-3.6 + rnd() * 7.4, r * 0.6, -2.6 - rnd() * 3.2);
      m.rotation.set(rnd(), rnd(), rnd());
      g.add(m);
    }
    // a tree edge overhead-right so the light has something to come through
    const canopyMat = new MeshStandardMaterial({ color: new Color(0.058, 0.115, 0.038), roughness: 0.97, side: DoubleSide, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const m = new Mesh(bushGeo, canopyMat);
      const r = 0.6 + rnd() * 0.7;
      m.scale.set(r * 1.5, r * 0.7, r * 1.2);
      m.position.set(1.5 + rnd() * 1.9, 2.15 + rnd() * 0.55, -3.1 - rnd() * 1.3);
      g.add(m);
    }
    const trunk = new Mesh(
      new CylinderGeometry(0.07, 0.10, 2.2, 7),
      new MeshStandardMaterial({ color: new Color(0.20, 0.15, 0.11), roughness: 1.0 })
    );
    trunk.position.set(2.35, 1.1, -3.6);
    g.add(trunk);

    // board fence across the back: one dark mass reads better than a row of sticks
    const fenceMat = new MeshStandardMaterial({ color: new Color(0.058, 0.044, 0.030), roughness: 0.98 });
    const fence = new Mesh(new BoxGeometry(9.0, 1.28, 0.05), fenceMat);
    fence.position.set(-0.2, 0.64, -5.0);
    g.add(fence);
    const capRail = new Mesh(new BoxGeometry(9.1, 0.07, 0.10), new MeshStandardMaterial({
      color: new Color(0.115, 0.088, 0.058), roughness: 0.92,
    }));
    capRail.position.set(-0.2, 1.30, -5.0);
    g.add(capRail);
    for (let i = 0; i < 14; i++) {
      const p = new Mesh(new BoxGeometry(0.055, 1.34, 0.075), fenceMat);
      p.position.set(-4.4 + i * 0.66, 0.67, -4.955);
      g.add(p);
    }

    // stone lantern
    const stoneMat = new MeshStandardMaterial({ color: new Color(0.205, 0.200, 0.185), roughness: 0.98 });
    const lantern = new Group();
    lantern.add(new Mesh(new CylinderGeometry(0.11, 0.14, 0.34, 8), stoneMat));
    const mid = new Mesh(new CylinderGeometry(0.16, 0.16, 0.20, 8), stoneMat); mid.position.y = 0.27; lantern.add(mid);
    const cap = new Mesh(new CylinderGeometry(0.02, 0.26, 0.16, 6), stoneMat); cap.position.y = 0.45; lantern.add(cap);
    lantern.position.set(-1.45, 0.17, -2.6);
    g.add(lantern);

    this.group.add(g);
  }

  // --------------------------------------------------------------------- noren
  _noren() {
    const darkWood = new MeshStandardMaterial({ color: new Color(0.155, 0.105, 0.065), roughness: 0.88 });

    // the shop's eave: a post and a beam, so the curtain is hung on something
    const post = new Mesh(new BoxGeometry(0.090, 2.35, 0.090), darkWood);
    post.position.set(-1.04, 0.18, -0.70);
    post.castShadow = true; post.receiveShadow = true;
    this.group.add(post);

    const beam = new Mesh(new BoxGeometry(2.70, 0.105, 0.085), darkWood);
    beam.position.set(-0.86, 1.06, -0.70);
    beam.castShadow = true;
    this.group.add(beam);

    const rail = new Mesh(new CylinderGeometry(0.017, 0.017, 1.50, 8), darkWood);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(-1.00, 0.985, -0.665);
    this.group.add(rail);

    // plaster wall behind, only far enough to close off the shop side
    const wall = new Mesh(
      new BoxGeometry(1.55, 2.35, 0.06),
      new MeshStandardMaterial({ color: new Color(0.365, 0.345, 0.305), roughness: 1.0 })
    );
    wall.position.set(-1.86, 0.18, -0.78);
    wall.receiveShadow = true;
    this.group.add(wall);

    const mats = [];
    this.norenMats = mats;
    const panelW = 0.238, gap = 0.011;
    const chars = ['', '氷', '', 'か', ''];
    for (let i = 0; i < 5; i++) {
      const f = fabricMaps(256, chars[i]);
      const mat = new MeshStandardMaterial({
        map: f.map, normalMap: f.normalMap, side: DoubleSide,
        roughness: 0.94, metalness: 0.0, color: new Color(0.95, 0.97, 1.0),
      });
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = { value: 0 };
        sh.uniforms.uPhase = { value: i * 0.7 };
        mat.userData.shader = sh;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', `#include <common>
            uniform float uTime; uniform float uPhase;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            float drop = clamp(0.5 - position.y / 0.60, 0.0, 1.0);
            float sway = sin(uTime * 0.9 + uPhase + position.y * 2.0) * 0.026
                       + sin(uTime * 2.3 + uPhase * 1.7) * 0.010;
            transformed.x += sway * drop * drop;
            transformed.z += cos(uTime * 0.75 + uPhase) * 0.020 * drop * drop;`);
      };
      mats.push(mat);
      const p = new Mesh(new PlaneGeometry(panelW, 0.60, 4, 9), mat);
      p.position.set(-1.62 + i * (panelW + gap), 0.985 - 0.30, -0.665);
      p.castShadow = true;
      this.group.add(p);
    }
  }

  update(dt) {
    this.time += dt;
    for (const m of this.norenMats) {
      if (m.userData.shader) m.userData.shader.uniforms.uTime.value = this.time;
    }
  }
}
