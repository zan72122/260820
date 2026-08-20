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

/**
 * The tub stands on trestles, the way it does at a real stall. That one
 * decision is what puts the festival *behind* the water instead of underneath
 * it: from a child's eye height the background of a raised tub is the stall,
 * the cloth and the lanterns, not a metre of empty ground.
 */
export const GROUND_Y = -0.72;

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
      c.left = -1.35;
      c.right = 1.35;
      c.top = 1.35;
      c.bottom = -1.35;
      c.near = 1.0;
      c.far = 6.0;
      key.shadow.mapSize.set(s.shadowMapSize, s.shadowMapSize);
      key.shadow.bias = -0.0011;
      key.shadow.normalBias = 0.012;
      key.shadow.radius = s.softShadow ? 4.5 : 1.5;
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
    const tex = this._track(woodTexture(512, '#2a201a'));
    tex.repeat.set(9, 9);
    const mat = this._track(
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, metalness: 0 })
    );
    const geo = this._track(new THREE.PlaneGeometry(26, 26));
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = GROUND_Y;
    m.receiveShadow = this.settings.shadows;
    this.root.add(m);
    this.groundY = GROUND_Y;

    // Pools of lantern light on the wet ground, faked with additive sprites.
    const glow = this._track(glowTexture(128, 'rgba(255,196,120,1)', 'rgba(255,120,40,0)'));
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Mesh(
        this._track(new THREE.PlaneGeometry(1.6, 1.6)),
        this._track(
          new THREE.MeshBasicMaterial({
            map: glow,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.24,
          })
        )
      );
      g.rotation.x = -Math.PI / 2;
      g.position.set(this.rng.range(-2.6, 2.6), this.groundY + 0.004, this.rng.range(-3.4, 1.2));
      this.root.add(g);
    }
  }

  // ------------------------------------------------------------------- tub

  _tub() {
    const g = new THREE.Group();
    this.tubGroup = g;
    this.root.add(g);

    // Trestles. Barely seen, but they are the reason the tub reads as being
    // at working height rather than sitting in the dirt.
    const standWood = this._track(woodTexture(256, '#4a3421'));
    standWood.repeat.set(3, 1);
    const standMat = this._track(
      new THREE.MeshStandardMaterial({ map: standWood, roughness: 0.9, metalness: 0 })
    );
    const standTop = TUB.rimY - TUB.depth - 0.01;
    for (const sx of [-0.62, 0.62]) {
      const beam = new THREE.Mesh(this._track(new THREE.BoxGeometry(0.13, 0.05, 1.5)), standMat);
      beam.position.set(sx, standTop - 0.03, 0);
      g.add(beam);
      for (const sz of [-0.52, 0.52]) {
        const leg = new THREE.Mesh(
          this._track(new THREE.BoxGeometry(0.085, Math.abs(GROUND_Y - standTop), 0.085)),
          standMat
        );
        leg.position.set(sx, (GROUND_Y + standTop) * 0.5 - 0.02, sz);
        leg.castShadow = this.settings.shadows;
        g.add(leg);
      }
    }

    const wood = this._track(woodTexture(512, '#7d5433'));
    wood.repeat.set(6, 1);
    const woodMat = this._track(
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.72, metalness: 0.02 })
    );
    // Below the waterline the staves are soaked and much darker.
    const wetWood = this._track(
      new THREE.MeshStandardMaterial({
        map: wood,
        roughness: 0.34,
        metalness: 0.03,
        color: 0xa7754a,
      })
    );

    const h = TUB.depth;
    const outer = new THREE.Mesh(
      this._track(new THREE.CylinderGeometry(1.045, 1.0, h, 56, 1, true)),
      woodMat
    );
    outer.position.y = TUB.rimY - h / 2;
    outer.receiveShadow = this.settings.shadows;
    // The tub has to plant a real shadow on the ground, or it floats.
    outer.castShadow = this.settings.shadows;
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
           // ~4cm cells: the size real caustics make through 20cm of water
           // (caustics() multiplies by ~4 internally, so this is not the cell size)
           float caus = caustics(vWorldP.xz * 9.0, uTime * 1.1);
           float rip = waterHeight(vWorldP.xz, uTime) * 46.0;
           caus *= 0.5 + 0.8 * clamp(0.5 + rip, 0.0, 1.5);
           gl_FragColor.rgb += vec3(1.0, 0.80, 0.52) * caus * uCaustic * 0.55 * depthBelow;
           // the water column tints and dims everything under it
           gl_FragColor.rgb *= mix(vec3(1.0), vec3(0.30, 0.46, 0.45), depthBelow * 0.92);`
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
        color: 0x2e5f57,
        roughness: 0.04,
        metalness: 0.3,
        transparent: true,
        opacity: 0.7,
      })
    );
    const w = new THREE.Mesh(this._track(new THREE.CircleGeometry(0.0755, 32)), wmat);
    w.rotation.x = -Math.PI / 2;
    w.position.y = 0.052;
    w.renderOrder = 12;
    g.add(w);
    this.bowlWater = w;
    this.bowlWaterY = 0.052;

    // Two crates to stand it on, so the bowl is at the same working height as
    // the tub instead of hovering.
    const crateTex = this._track(woodTexture(256, '#5c4128'));
    crateTex.repeat.set(2, 2);
    const crateMat = this._track(
      new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.88, metalness: 0 })
    );
    this.bowlStand = new THREE.Group();
    const hTotal = 0.7;
    for (let i = 0; i < 2; i++) {
      const hh = hTotal / 2;
      const box = new THREE.Mesh(this._track(new THREE.BoxGeometry(0.2, hh - 0.01, 0.22)), crateMat);
      box.position.set(i === 0 ? 0 : 0.016, -hh * (i + 0.5), i === 0 ? 0 : -0.014);
      box.rotation.y = i === 0 ? 0.08 : -0.05;
      box.castShadow = this.settings.shadows;
      box.receiveShadow = this.settings.shadows;
      this.bowlStand.add(box);
    }
    this.root.add(this.bowlStand);
  }

  setBowlPosition(x, y, z) {
    this.bowlGroup.position.set(x, y, z);
    this.bowlPoint = new THREE.Vector3(x, y + this.bowlWaterY, z);
    if (this.bowlStand) this.bowlStand.position.set(x, y, z);
  }

  // ----------------------------------------------------------------- stall

  _stall() {
    const wood = this._track(woodTexture(512, '#6b4a2c'));
    wood.repeat.set(4, 1);
    const mat = this._track(
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.78, metalness: 0.02 })
    );

    // Counter plank behind the tub.
    const counter = new THREE.Mesh(this._track(new THREE.BoxGeometry(3.4, 0.06, 0.46)), mat);
    counter.position.set(0.1, 0.15, -1.12);
    counter.castShadow = this.settings.shadows;
    counter.receiveShadow = this.settings.shadows;
    this.root.add(counter);

    for (const x of [-1.3, 1.5]) {
      const leg = new THREE.Mesh(
        this._track(new THREE.BoxGeometry(0.075, Math.abs(GROUND_Y - 0.12), 0.075)),
        mat
      );
      leg.position.set(x, (GROUND_Y + 0.12) * 0.5, -1.09);
      this.root.add(leg);
      const post = new THREE.Mesh(
        this._track(new THREE.CylinderGeometry(0.032, 0.038, 1.95, 8)),
        mat
      );
      post.position.set(x, 0.66, -1.24);
      this.root.add(post);
    }
    const crossbar = new THREE.Mesh(
      this._track(new THREE.CylinderGeometry(0.026, 0.026, 3.0, 8)),
      mat
    );
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0.1, 0.58, -1.38);
    this.root.add(crossbar);

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
    const noren = new THREE.Mesh(this._track(new THREE.PlaneGeometry(2.9, 0.62, 24, 4)), clothMat);
    noren.position.set(0.1, 0.9, -1.8);
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
      ring.position.set(0.62 + i * 0.004, 0.185 + i * 0.008, -1.09);
      this.root.add(ring);
    }
  }

  // -------------------------------------------------------------- lanterns

  _lanterns() {
    const glyphs = ['祭', '金', '', '魚', ''];
    const glow = this._track(glowTexture(128, 'rgba(255,206,142,1)', 'rgba(255,120,40,0)'));
    this.lanterns = [];

    // A low string of small lanterns along the front of the stall, then two
    // deeper ranks for the street. The front row is deliberately not far off
    // the water: it has to sit inside the frame in landscape as well as
    // portrait, where a camera looking down at a tub sees very little sky.
    const place = [
      [-1.5, 0.4, -1.36, 0.072],
      [-1.0, 0.37, -1.36, 0.07],
      [-0.5, 0.41, -1.38, 0.066],
      [0.02, 0.38, -1.36, 0.07],
      [0.55, 0.42, -1.38, 0.066],
      [1.08, 0.37, -1.36, 0.072],
      [1.62, 0.4, -1.38, 0.068],
      [-2.35, 0.78, -2.9, 0.125],
      [2.25, 0.72, -2.75, 0.12],
      [-3.3, 0.88, -4.2, 0.14],
      [3.2, 0.84, -4.0, 0.135],
    ];

    place.forEach((p, i) => {
      const [x, y, z, r] = p;
      const tex = this._track(lanternTexture(128, 128, glyphs[i % glyphs.length]));
      const mat = this._track(
        new THREE.MeshStandardMaterial({
          map: tex,
          emissiveMap: tex,
          emissive: 0xff9a45,
          emissiveIntensity: 2.4,
          roughness: 0.85,
          color: 0x6b3a1c,
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

      // the cord it hangs from
      const cord = new THREE.Mesh(
        this._track(new THREE.CylinderGeometry(0.0035, 0.0035, 0.3, 5)),
        this._track(new THREE.MeshBasicMaterial({ color: 0x1a1210 }))
      );
      cord.position.y = r * 1.32 + 0.1;
      grp.add(cord);

      const halo = new THREE.Mesh(
        this._track(new THREE.PlaneGeometry(r * 13, r * 13)),
        this._track(
          new THREE.MeshBasicMaterial({
            map: glow,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
            opacity: 0.5,
          })
        )
      );
      halo.renderOrder = -20;
      grp.add(halo);
      this.root.add(grp);
      this.lanterns.push({ group: grp, halo, base: new THREE.Vector3(x, y, z), phase: this.rng.range(0, 6.28) });
    });
  }

  // ----------------------------------------------------------------- crowd

  _crowd() {
    const tex = this._track(crowdTexture(512, 256));
    const geo = this._track(new THREE.PlaneGeometry(0.8, 1.62));
    const CELLS = 4;
    const mat = this._track(
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        fog: true,
        color: 0x50372c,
        opacity: 0.82,
      })
    );
    // The texture holds four different people. Without a per-instance cell
    // offset every plane draws all four, and a crowd turns into a fence.
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aCell;')
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
           #ifdef USE_MAP
             vMapUv = vMapUv * vec2(${(1 / CELLS).toFixed(4)}, 1.0)
                    + vec2(aCell * ${(1 / CELLS).toFixed(4)}, 0.0);
           #endif`
        );
    };
    mat.customProgramCacheKey = () => 'crowd-cell';

    const n = this.settings.crowd;
    const inst = new THREE.InstancedMesh(geo, mat, n);
    inst.frustumCulled = false;
    inst.renderOrder = -50;
    const cells = new Float32Array(n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    this.crowdData = [];
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      // Two ranks: people at the counter, and a thinning crowd in the street
      // behind them. Nobody stands where they would cover the tub.
      const front = i % 3 === 0;
      const x = side * this.rng.range(front ? 0.5 : 1.5, front ? 1.7 : 5.4);
      const z = front ? -this.rng.range(4.0, 5.2) : -this.rng.range(5.4, 8.5);
      const s = this.rng.range(0.94, 1.22);
      cells[i] = this.rng.int(CELLS);
      p.set(x, this.groundY + 0.8 * s, z);
      sc.set(s, s, 1);
      m.compose(p, q, sc);
      inst.setMatrixAt(i, m);
      this.crowdData.push({ p: p.clone(), s, phase: this.rng.range(0, 6.28) });
    }
    inst.geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 1));
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
      l.halo.material.opacity = 0.46 + Math.sin(t * 1.7 + l.phase) * 0.05;
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
