/**
 * The stall, and everything around it.
 *
 * The rule for this file is that nothing here may out-shout the tub. The
 * festival is built in three flat planes of depth — the poi and the water up
 * close, the fish and the bowl in the middle, lanterns and a crowd of
 * silhouettes far behind — and the far plane is deliberately dim, slow and
 * cheap: emissive lantern paper instead of lights, flat cut-outs instead of
 * people, no shadow casting past the tub rim.
 */

import * as THREE from 'three';
import {
  woodTexture,
  clothTexture,
  lanternTexture,
  crowdTexture,
  glowTexture,
  porcelainTexture,
  tubFloorTexture,
} from './textures.js';
import { LIGHT } from './lighting.js';
import { RIPPLE_GLSL, CAUSTIC_GLSL, NOISE_GLSL } from './glsl/shared.js';
import { clamp, lerp } from '../core/Rng.js';

export const TUB = {
  /** unit radius; the group is scaled to make the tub an ellipse */
  depth: 0.19,
  waterY: 0,
  floorY: -0.16,
  rimY: 0.032,
  wall: 0.022,
};

export class Stage {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {object} o.settings
   * @param {object} o.waterUniforms  shared with Water so caustics track the ripples
   * @param {import('../core/Rng.js').Rng} o.rng
   */
  constructor({ scene, settings, waterUniforms, rng }) {
    this.scene = scene;
    this.settings = settings;
    this.rng = rng;
    this.waterUniforms = waterUniforms;
    this.time = 0;
    this.disposables = [];

    this.root = new THREE.Group();
    scene.add(this.root);

    this._sky();
    this._lights();
    this._ground();
    this._tub();
    this._bowl();
    this._stall();
    this._lanterns();
    this._crowd();
    this._hand();
  }

  _track(x) {
    this.disposables.push(x);
    return x;
  }

  // ------------------------------------------------------------------- sky

  _sky() {
    const geo = new THREE.SphereGeometry(28, 20, 14);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        ${NOISE_GLSL}
        uniform float uTime;
        varying vec3 vDir;
        void main() {
          float up = clamp(vDir.y, -1.0, 1.0);
          // the last of the sunset still sitting on the horizon at dusk
          vec3 deep    = vec3(0.020, 0.026, 0.058);
          vec3 mid     = vec3(0.075, 0.062, 0.098);
          vec3 horizon = vec3(0.300, 0.150, 0.088);
          vec3 c = mix(mid, deep, smoothstep(0.10, 0.75, up));
          c = mix(horizon, c, smoothstep(-0.06, 0.30, up));
          // warm haze thrown up by the stalls
          float glow = exp(-pow((up - 0.015) * 6.0, 2.0));
          c += vec3(0.30, 0.13, 0.045) * glow * (0.6 + 0.4 * fbm2(vDir.xz * 3.0));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -100;
    this.root.add(this.sky);
    this._track(geo);
    this._track(mat);
  }

  // ---------------------------------------------------------------- lights

  _lights() {
    const s = this.settings;

    const hemi = new THREE.HemisphereLight(
      LIGHT.skyColor.getHex(),
      LIGHT.groundColor.getHex(),
      LIGHT.ambientIntensity
    );
    this.root.add(hemi);

    // One key: the bare bulb over the stall counter. It is the only light in
    // the scene allowed to cast a shadow, and its frustum is pulled in tight
    // around the tub so every texel goes to the poi and the fish.
    const key = new THREE.DirectionalLight(LIGHT.keyColor.getHex(), LIGHT.keyIntensity);
    key.position.copy(LIGHT.keyDir).multiplyScalar(3.2);
    key.target.position.set(0, -0.05, 0);
    key.castShadow = s.shadows;
    if (s.shadows) {
      const c = key.shadow.camera;
      c.left = -0.95;
      c.right = 0.95;
      c.top = 0.95;
      c.bottom = -0.95;
      c.near = 1.2;
      c.far = 5.2;
      key.shadow.mapSize.set(s.shadowMapSize, s.shadowMapSize);
      key.shadow.bias = -0.0011;
      key.shadow.normalBias = 0.012;
      key.shadow.radius = s.softShadow ? 2.4 : 1;
    }
    this.root.add(key, key.target);
    this.keyLight = key;

    // Three point lights stand in for a whole street of lanterns. None of them
    // casts a shadow; the rest of the "many lights" feeling comes from
    // emissive paper and glow sprites.
    this.lampLights = LIGHT.lanterns.map((l) => {
      const p = new THREE.PointLight(l.color.getHex(), l.power * 2.6, 6.5, 2);
      p.position.copy(l.pos);
      this.root.add(p);
      return p;
    });

    // A soft fill from the front so the near lip of the tub is never a black
    // shape against the water.
    const fill = new THREE.DirectionalLight(0x6f86b8, 0.42);
    fill.position.set(-0.6, 0.5, 2.4);
    this.root.add(fill);
  }

  // ---------------------------------------------------------------- ground

  _ground() {
    const tex = this._track(woodTexture(512, '#3a2c24'));
    tex.repeat.set(9, 9);
    const mat = this._track(
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, metalness: 0 })
    );
    const geo = this._track(new THREE.PlaneGeometry(26, 26));
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = -TUB.depth - 0.012;
    m.receiveShadow = this.settings.shadows;
    this.root.add(m);
    this.groundY = m.position.y;

    // Pools of lantern light on the wet ground, faked with additive sprites.
    const glow = this._track(glowTexture(128, 'rgba(255,196,120,1)', 'rgba(255,120,40,0)'));
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Mesh(
        this._track(new THREE.PlaneGeometry(1.6, 1.6)),
        this._track(
          new THREE.MeshBasicMaterial({
            map: glow,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.16,
          })
        )
      );
      g.rotation.x = -Math.PI / 2;
      g.position.set(this.rng.range(-2.4, 2.4), this.groundY + 0.004, this.rng.range(-3.2, 0.4));
      this.root.add(g);
    }
  }

  // ------------------------------------------------------------------- tub

  _tub() {
    const g = new THREE.Group();
    this.tubGroup = g;
    this.root.add(g);

    const wood = this._track(woodTexture(512, '#7d5433'));
    wood.repeat.set(6, 1);
    const woodMat = this._track(
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.72, metalness: 0.02 })
    );
    // Below the waterline the staves are soaked and much darker.
    const wetWood = this._track(
      new THREE.MeshStandardMaterial({
        map: wood,
        roughness: 0.24,
        metalness: 0.04,
        color: 0x6a4526,
      })
    );

    const h = TUB.depth;
    const outer = new THREE.Mesh(
      this._track(new THREE.CylinderGeometry(1.045, 1.0, h, 56, 1, true)),
      woodMat
    );
    outer.position.y = TUB.rimY - h / 2;
    outer.receiveShadow = this.settings.shadows;
    g.add(outer);

    const inner = new THREE.Mesh(
      this._track(new THREE.CylinderGeometry(1.045 - TUB.wall, 1.0 - TUB.wall, h, 56, 1, true)),
      wetWood
    );
    inner.material.side = THREE.BackSide;
    inner.position.y = TUB.rimY - h / 2;
    inner.receiveShadow = this.settings.shadows;
    g.add(inner);

    // Rim: a rolled lip, the brightest wooden thing in the frame because it is
    // what the child's eye uses to place the tub in space.
    const rim = new THREE.Mesh(
      this._track(new THREE.TorusGeometry(1.024, TUB.wall * 0.62, 8, 60)),
      this._track(new THREE.MeshStandardMaterial({ map: wood, roughness: 0.5, metalness: 0.03 }))
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = TUB.rimY;
    rim.castShadow = this.settings.shadows;
    rim.receiveShadow = this.settings.shadows;
    g.add(rim);

    // Two iron hoops.
    const iron = this._track(
      new THREE.MeshStandardMaterial({ color: 0x2e2723, roughness: 0.55, metalness: 0.75 })
    );
    for (const [y, r] of [
      [TUB.rimY - 0.045, 1.036],
      [TUB.rimY - 0.145, 1.012],
    ]) {
      const band = new THREE.Mesh(
        this._track(new THREE.CylinderGeometry(r, r, 0.014, 48, 1, true)),
        iron
      );
      band.position.y = y;
      g.add(band);
    }

    // Floor: gravel, lit through moving water.
    const floorTex = this._track(tubFloorTexture(512));
    const floorMat = this._track(
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.86, metalness: 0.0 })
    );
    this._injectCaustics(floorMat, 1.0);
    const floor = new THREE.Mesh(this._track(new THREE.CircleGeometry(1.0 - TUB.wall, 56)), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = TUB.floorY;
    floor.receiveShadow = this.settings.shadows;
    g.add(floor);
    this.tubFloor = floor;

    // The inside of the wall catches caustics too — that band of dancing light
    // is most of what says "this is water, not glass".
    this._injectCaustics(wetWood, 0.55);
  }

  /**
   * Adds moving focused light to a standard material, driven by the same
   * ripple uniforms the water surface uses.
   */
  _injectCaustics(material, strength) {
    if (!this.settings.caustics) return material;
    const wu = this.waterUniforms;
    material.onBeforeCompile = (shader) => {
      shader.defines = { ...(shader.defines || {}), RIPPLE_COUNT: wu.uRipples.value.length };
      shader.uniforms.uTime = wu.uTime;
      shader.uniforms.uSwell = wu.uSwell;
      shader.uniforms.uRipples = wu.uRipples;
      shader.uniforms.uCaustic = { value: strength };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvWorldP = (modelMatrix * vec4(position, 1.0)).xyz;'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vWorldP;
           uniform float uCaustic;
           ${NOISE_GLSL}
           ${RIPPLE_GLSL}
           ${CAUSTIC_GLSL}`
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
           float depthBelow = clamp(-vWorldP.y * 5.2, 0.0, 1.0);
           float caus = caustics(vWorldP.xz * 2.6, uTime * 1.35);
           float rip = waterHeight(vWorldP.xz, uTime) * 55.0;
           caus *= 0.55 + 0.9 * clamp(0.5 + rip, 0.0, 1.6);
           gl_FragColor.rgb += vec3(1.0, 0.80, 0.55) * caus * uCaustic * 0.42 * depthBelow;
           // the water column tints everything under it
           gl_FragColor.rgb *= mix(vec3(1.0), vec3(0.56, 0.82, 0.78), depthBelow * 0.75);`
        );
    };
    material.customProgramCacheKey = () => `caustic-${strength}`;
    return material;
  }

  /** Portrait and landscape use differently shaped tubs; see CameraRig. */
  setBounds(rx, rz) {
    this.tubGroup.scale.set(rx, 1, rz);
    this.bounds = { rx, rz };
  }

  // ------------------------------------------------------------------ bowl

  _bowl() {
    const g = new THREE.Group();
    this.bowlGroup = g;
    this.root.add(g);

    const profile = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const r = lerp(0.028, 0.085, Math.pow(t, 0.62));
      profile.push(new THREE.Vector2(r, lerp(0, 0.062, t)));
    }
    profile.push(new THREE.Vector2(0.083, 0.064));
    profile.push(new THREE.Vector2(0.0255, 0.004));
    profile.push(new THREE.Vector2(0, 0.004));

    const tex = this._track(porcelainTexture(256));
    const mat = this._track(
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.14,
        metalness: 0.02,
        side: THREE.DoubleSide,
      })
    );
    const bowl = new THREE.Mesh(this._track(new THREE.LatheGeometry(profile, 40)), mat);
    bowl.castShadow = this.settings.shadows;
    bowl.receiveShadow = this.settings.shadows;
    g.add(bowl);

    // The water in the bowl: a small disc with the same trick as the tub.
    const wmat = this._track(
      new THREE.MeshStandardMaterial({
        color: 0x1c3a36,
        roughness: 0.03,
        metalness: 0.25,
        transparent: true,
        opacity: 0.72,
      })
    );
    const w = new THREE.Mesh(this._track(new THREE.CircleGeometry(0.0755, 32)), wmat);
    w.rotation.x = -Math.PI / 2;
    w.position.y = 0.052;
    w.renderOrder = 12;
    g.add(w);
    this.bowlWater = w;
    this.bowlWaterY = 0.052;
  }

  setBowlPosition(x, y, z) {
    this.bowlGroup.position.set(x, y, z);
    this.bowlPoint = new THREE.Vector3(x, y + this.bowlWaterY, z);
  }

  // ----------------------------------------------------------------- stall

  _stall() {
    const wood = this._track(woodTexture(512, '#6b4a2c'));
    wood.repeat.set(4, 1);
    const mat = this._track(
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.78, metalness: 0.02 })
    );

    // Counter plank behind the tub.
    const counter = new THREE.Mesh(this._track(new THREE.BoxGeometry(3.1, 0.055, 0.42)), mat);
    counter.position.set(0.1, 0.16, -1.05);
    counter.castShadow = this.settings.shadows;
    counter.receiveShadow = this.settings.shadows;
    this.root.add(counter);

    for (const x of [-1.25, 1.45]) {
      const leg = new THREE.Mesh(this._track(new THREE.BoxGeometry(0.07, 0.4, 0.07)), mat);
      leg.position.set(x, -0.04, -1.02);
      this.root.add(leg);
      const post = new THREE.Mesh(this._track(new THREE.CylinderGeometry(0.035, 0.04, 2.3, 8)), mat);
      post.position.set(x, 1.1, -1.15);
      this.root.add(post);
    }

    // A frame of noren above the counter.
    const cloth = this._track(clothTexture(256));
    cloth.repeat.set(3, 1);
    const clothMat = this._track(
      new THREE.MeshStandardMaterial({
        map: cloth,
        roughness: 0.92,
        metalness: 0,
        side: THREE.DoubleSide,
      })
    );
    const noren = new THREE.Mesh(this._track(new THREE.PlaneGeometry(2.8, 0.66, 24, 4)), clothMat);
    noren.position.set(0.1, 1.62, -1.2);
    this.root.add(noren);
    this.noren = noren;
    this._norenBase = noren.geometry.attributes.position.array.slice();

    // A stack of spare poi on the counter, so the fresh one that arrives later
    // has somewhere to have come from.
    const stackMat = this._track(
      new THREE.MeshStandardMaterial({ color: 0xd8557a, roughness: 0.35 })
    );
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(
        this._track(new THREE.TorusGeometry(0.088, 0.005, 6, 24)),
        stackMat
      );
      ring.rotation.x = -Math.PI / 2 + 0.06;
      ring.position.set(0.62 + i * 0.004, 0.192 + i * 0.008, -1.02);
      this.root.add(ring);
    }
  }

  // -------------------------------------------------------------- lanterns

  _lanterns() {
    const glyphs = ['祭', '金', '', '魚', ''];
    const glow = this._track(glowTexture(128, 'rgba(255,206,142,1)', 'rgba(255,120,40,0)'));
    this.lanterns = [];

    const place = [
      [-1.62, 1.5, -1.78, 0.115],
      [-0.82, 1.58, -1.82, 0.1],
      [0.05, 1.54, -1.86, 0.11],
      [0.86, 1.6, -1.8, 0.1],
      [1.48, 1.52, -1.76, 0.118],
      [-2.4, 1.72, -2.6, 0.13],
      [2.3, 1.66, -2.5, 0.125],
      [0.12, 2.05, 0.9, 0.09],
    ];

    place.forEach((p, i) => {
      const [x, y, z, r] = p;
      const tex = this._track(lanternTexture(128, 128, glyphs[i % glyphs.length]));
      const mat = this._track(
        new THREE.MeshStandardMaterial({
          map: tex,
          emissiveMap: tex,
          emissive: 0xffb267,
          emissiveIntensity: 2.6,
          roughness: 0.85,
          color: 0x552d16,
        })
      );
      const body = new THREE.Mesh(
        this._track(new THREE.SphereGeometry(r, 14, 12)),
        mat
      );
      body.scale.set(1, 1.32, 1);
      const grp = new THREE.Group();
      grp.position.set(x, y, z);
      grp.add(body);

      const halo = new THREE.Mesh(
        this._track(new THREE.PlaneGeometry(r * 9, r * 9)),
        this._track(
          new THREE.MeshBasicMaterial({
            map: glow,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.34,
          })
        )
      );
      grp.add(halo);
      this.root.add(grp);
      this.lanterns.push({ group: grp, halo, base: new THREE.Vector3(x, y, z), phase: this.rng.range(0, 6.28) });
    });
  }

  // ----------------------------------------------------------------- crowd

  _crowd() {
    const tex = this._track(crowdTexture(512, 256));
    const geo = this._track(new THREE.PlaneGeometry(0.62, 1.5));
    const mat = this._track(
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        color: 0x1a1416,
        opacity: 0.96,
      })
    );
    const n = this.settings.crowd;
    const inst = new THREE.InstancedMesh(geo, mat, n);
    inst.frustumCulled = false;
    inst.renderOrder = -50;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    this.crowdData = [];
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * this.rng.range(0.7, 4.2) + this.rng.sym(0.5);
      const z = -this.rng.range(1.9, 5.2);
      const sc = this.rng.range(0.92, 1.22) * (1 + (-z - 2) * 0.06);
      p.set(x, this.groundY + 0.75 * sc, z);
      s.set(sc, sc, 1);
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
      this.crowdData.push({ p: p.clone(), s: sc, phase: this.rng.range(0, 6.28) });
    }
    inst.instanceMatrix.needsUpdate = true;
    this.crowd = inst;
    this.root.add(inst);
    this._crowdM = new THREE.Matrix4();
    this._crowdQ = new THREE.Quaternion();
    this._crowdS = new THREE.Vector3();
    this._crowdP = new THREE.Vector3();
  }

  // ------------------------------------------------------- stall keeper's hand

  _hand() {
    const g = new THREE.Group();
    const skin = this._track(
      new THREE.MeshStandardMaterial({ color: 0xc79b78, roughness: 0.72, metalness: 0 })
    );
    const sleeve = this._track(
      new THREE.MeshStandardMaterial({ color: 0x27384f, roughness: 0.9, metalness: 0 })
    );

    const arm = new THREE.Mesh(this._track(new THREE.CylinderGeometry(0.045, 0.052, 0.42, 10)), sleeve);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.3, 0, 0);
    g.add(arm);

    const fore = new THREE.Mesh(this._track(new THREE.CylinderGeometry(0.033, 0.042, 0.24, 10)), skin);
    fore.rotation.z = Math.PI / 2;
    fore.position.set(0.02, 0, 0);
    g.add(fore);

    const palm = new THREE.Mesh(this._track(new THREE.BoxGeometry(0.075, 0.028, 0.06)), skin);
    palm.position.set(-0.12, 0, 0);
    g.add(palm);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(this._track(new THREE.BoxGeometry(0.05, 0.013, 0.014)), skin);
      f.position.set(-0.175, 0.006, -0.02 + i * 0.02);
      f.rotation.z = -0.2;
      g.add(f);
    }
    const thumb = new THREE.Mesh(this._track(new THREE.BoxGeometry(0.038, 0.013, 0.015)), skin);
    thumb.position.set(-0.15, -0.014, 0.026);
    thumb.rotation.z = 0.35;
    g.add(thumb);

    g.traverse((o) => {
      if (o.isMesh) o.castShadow = this.settings.shadows;
    });
    g.visible = false;
    this.hand = g;
    this.root.add(g);
  }

  /**
   * @param {number} t   0 = off screen, 1 = fully extended over the tub
   * @param {THREE.Vector3} to  where the poi should be handed over
   */
  setHand(t, to) {
    const k = clamp(t, 0, 1);
    this.hand.visible = k > 0.001;
    if (!this.hand.visible) return;
    const ease = k * k * (3 - 2 * k);
    const startX = to.x + 1.15;
    this.hand.position.set(lerp(startX, to.x + 0.2, ease), lerp(to.y + 0.16, to.y + 0.05, ease), lerp(to.z - 0.45, to.z, ease));
    this.hand.rotation.set(0, lerp(-0.5, -0.12, ease), lerp(0.35, 0.05, ease));
  }

  // ---------------------------------------------------------------- update

  update(dt, camera) {
    this.time += dt;
    const t = this.time;

    // Lanterns breathe and swing a little in the evening air.
    for (const l of this.lanterns) {
      const sway = Math.sin(t * 0.55 + l.phase) * 0.014;
      l.group.position.set(l.base.x + sway, l.base.y + Math.sin(t * 0.8 + l.phase) * 0.004, l.base.z);
      l.group.rotation.z = sway * 0.5;
      l.halo.material.opacity = 0.3 + Math.sin(t * 1.7 + l.phase) * 0.035;
      if (camera) l.halo.quaternion.copy(camera.quaternion);
    }
    for (let i = 0; i < this.lampLights.length; i++) {
      const l = LIGHT.lanterns[i];
      this.lampLights[i].intensity = l.power * 2.6 * (0.94 + Math.sin(t * 2.1 + i * 2.2) * 0.06);
    }

    // Noren stirs.
    const arr = this.noren.geometry.attributes.position.array;
    const base = this._norenBase;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const y = base[i + 1];
      const k = clamp((0.33 - y) / 0.66, 0, 1);
      arr[i + 2] = base[i + 2] + Math.sin(x * 3.1 + t * 1.15) * 0.035 * k;
    }
    this.noren.geometry.attributes.position.needsUpdate = true;

    // Crowd: a slow shift of weight, and always facing the camera.
    if (this.crowd && camera) {
      this._crowdQ.copy(camera.quaternion);
      const e = new THREE.Euler().setFromQuaternion(this._crowdQ, 'YXZ');
      this._crowdQ.setFromEuler(new THREE.Euler(0, e.y, 0, 'YXZ'));
      for (let i = 0; i < this.crowdData.length; i++) {
        const c = this.crowdData[i];
        this._crowdP.copy(c.p);
        this._crowdP.x += Math.sin(t * 0.42 + c.phase) * 0.014;
        this._crowdS.set(c.s, c.s * (1 + Math.sin(t * 0.7 + c.phase) * 0.006), 1);
        this._crowdM.compose(this._crowdP, this._crowdQ, this._crowdS);
        this.crowd.setMatrixAt(i, this._crowdM);
      }
      this.crowd.instanceMatrix.needsUpdate = true;
    }

    if (this.sky) this.sky.material.uniforms.uTime.value = t;
  }

  dispose() {
    for (const d of this.disposables) if (d && d.dispose) d.dispose();
  }
}
