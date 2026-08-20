/**
 * The poi: a plastic hoop, a handle, and one sheet of thin washi.
 *
 * The sheet is the whole game. It has to say four things without a word of
 * text: I am dry paper; water has touched me; I am getting weak; I have gone.
 * All four are carried by the same shader, driven by the same numbers the
 * catching rules use (see src/game/paper.js).
 */

import * as THREE from 'three';
import { TEAR_GLSL, SAG_GLSL, NOISE_GLSL, MAX_TEARS_GLSL } from './glsl/shared.js';
import { LIGHTING_GLSL, createLightUniforms } from './lighting.js';
import { createPaperState, MAX_TEARS } from '../game/paper.js';
import { clamp, damp } from '../core/Rng.js';

export const POI_RADIUS = 0.09;
const FRAME_COLORS = [0xd8557a, 0x4aa6c6, 0x8dbe58, 0xe0a13c, 0xb98ad0];

/** Radial grid over the sheet, carrying local disc coords in `aDisc`. */
function makePaperGeometry(radius, rings = 12, segments = 48) {
  const pos = [];
  const disc = [];
  const idx = [];
  pos.push(0, 0, 0);
  disc.push(0, 0);
  for (let i = 1; i <= rings; i++) {
    const r = Math.pow(i / rings, 0.92);
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      pos.push(x * radius, 0, z * radius);
      disc.push(x, z);
    }
  }
  for (let j = 0; j < segments; j++) idx.push(0, 1 + ((j + 1) % segments), 1 + j);
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segments;
    const b0 = 1 + i * segments;
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments;
      idx.push(a0 + j, b0 + j1, b0 + j);
      idx.push(a0 + j, a0 + j1, b0 + j1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDisc', new THREE.Float32BufferAttribute(disc, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 1.6);
  return g;
}

const PAPER_VERT = /* glsl */ `
  ${TEAR_GLSL}
  ${SAG_GLSL}
  attribute vec2 aDisc;
  uniform float uSag;
  uniform float uLoad;
  uniform float uLoadR;
  uniform float uWetness;
  uniform float uTime;
  uniform float uRadius;
  varying vec2 vDisc;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vSagY;

  float sheetY(vec2 d) {
    float r = length(d);
    float y = sagProfile(r, uSag, uLoad, uLoadR);
    // Wet paper stops being flat: slow soft undulations across the sheet.
    y += sin(d.x * 12.0 + uTime * 0.9) * sin(d.y * 9.5 - uTime * 0.72)
       * 0.030 * uWetness * (1.0 - r * r);
    // The lip of a hole curls down under its own weight.
    y -= smoothstep(-0.10, 0.0, holeDepth(d)) * 0.085 * (0.35 + uWetness);
    return y * uRadius;
  }

  void main() {
    vDisc = aDisc;
    vec3 p = position;
    float y = sheetY(aDisc);
    p.y += y;
    vSagY = y;

    // Analytic normal from the same surface, so the sheen follows the droop.
    float e = 0.06;
    float hx = sheetY(aDisc + vec2(e, 0.0)) - y;
    float hz = sheetY(aDisc + vec2(0.0, e)) - y;
    vec3 nLocal = normalize(vec3(-hx / (e * uRadius), 1.0, -hz / (e * uRadius)));

    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * nLocal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const PAPER_FRAG = /* glsl */ `
  ${TEAR_GLSL}
  ${NOISE_GLSL}
  ${LIGHTING_GLSL}
  uniform sampler2D uFibre;
  uniform sampler2D uThickness;
  uniform float uWetness;
  uniform float uWetFront;
  uniform vec2 uWetOrigin;
  uniform float uDamage;
  uniform float uSubmerge;
  uniform float uTime;
  uniform vec3 uWaterTint;
  uniform float uOpacity;
  varying vec2 vDisc;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vSagY;

  void main() {
    float r = length(vDisc);
    if (r > 1.0) discard;

    vec2 uv = vDisc * 0.5 + 0.5;
    float fibreN = fbm2(vDisc * 9.0);

    // --- where the sheet has gone --------------------------------------
    float hd = holeDepth(vDisc) + (fibreN - 0.5) * 0.028;
    if (hd > 0.0) discard;
    // Torn washi does not end in a clean line: it frays into loose fibres
    // that stay pale and catch the light, with a damp shadow just behind.
    float rim = smoothstep(-0.055, 0.0, hd);
    float fray = smoothstep(-0.022, 0.0, hd);
    float bruise = smoothstep(-0.075, -0.03, hd) * (1.0 - fray);

    // --- how wet it is here --------------------------------------------
    float frontR = uWetFront * 2.6;
    float stain = smoothstep(frontR, frontR - 0.5, distance(vDisc, uWetOrigin));
    float thick = texture2D(uThickness, uv * 1.6).r;
    float wet = clamp(max(stain * 0.62, 0.0) + uWetness * 0.78, 0.0, 1.0);
    wet *= 0.72 + 0.56 * (1.0 - thick);          // thin fibres soak first
    wet = clamp(wet, 0.0, 1.0);

    // --- cracks that arrive before the holes -----------------------------
    float crackField = fbm2(vDisc * 6.5 + 11.0);
    float crackLine = 1.0 - smoothstep(0.0, 0.035, abs(crackField - 0.5));
    float crackMask = crackLine
      * smoothstep(0.10, 0.42, uDamage)
      * (1.0 - smoothstep(0.55, 1.0, r));

    // --- colour ----------------------------------------------------------
    vec3 dry = texture2D(uFibre, uv * 1.35).rgb * vec3(1.02, 1.0, 0.96);
    vec3 soaked = dry * vec3(0.74, 0.72, 0.70);
    vec3 albedo = mix(dry, soaked, wet);
    albedo = mix(albedo, vec3(0.30, 0.24, 0.18), bruise * 0.8);
    albedo = mix(albedo, vec3(1.0, 0.94, 0.84), fray * 0.75 * (0.4 + fibreN));
    albedo = mix(albedo, vec3(0.46, 0.40, 0.33), crackMask * 0.6);

    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vWorld);
    if (dot(n, v) < 0.0) n = -n;                  // the sheet is seen from both sides

    // --- light -----------------------------------------------------------
    float ndl = max(dot(n, uKeyDir), 0.0);
    vec3 lit = albedo * (hemi(n) + uKeyColor * ndl * 0.55 + allLamps(vWorld, n) * 0.6);

    // Thin paper glows where light passes through it, and more so when wet.
    float through = max(dot(-n, uKeyDir), 0.0);
    lit += albedo * uKeyColor * through * (0.28 + 0.42 * wet) * (1.0 - bruise * 0.6);

    // Surface tension leaves a thin film that catches the lamps.
    vec3 h = normalize(uKeyDir + v);
    float gloss = mix(24.0, 190.0, wet);
    float sheen = pow(max(dot(n, h), 0.0), gloss) * (0.08 + 1.5 * wet);
    float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.6);
    lit += (uKeyColor * 0.6 + uLampColor * 0.55) * (sheen + fres * wet * 0.6);
    // lantern light skimming across the wet film
    vec3 hl = normalize(normalize(uLampA.xyz - vWorld) + v);
    lit += uLampColor * pow(max(dot(n, hl), 0.0), gloss) * wet * 1.1;

    // --- under the surface ----------------------------------------------
    lit = mix(lit, lit * uWaterTint, clamp(uSubmerge, 0.0, 1.0) * 0.62);

    // --- how much of it you can see through ------------------------------
    // Wet washi goes translucent, but it must never stop being a sheet: the
    // child has to keep seeing what they are holding the fish on.
    float alpha = mix(0.98, 0.66, wet);
    alpha *= mix(1.0, 0.35, fray);
    alpha *= mix(1.0, 0.62, crackMask);
    alpha = clamp(alpha * uOpacity, 0.0, 1.0);

    gl_FragColor = vec4(lit, alpha);
    #include <colorspace_fragment>
  }
`;


export class Poi {
  /**
   * @param {object} o
   * @param {THREE.Texture} o.fibre
   * @param {THREE.Texture} o.thickness
   * @param {object} o.settings
   * @param {import('../core/Rng.js').Rng} o.rng
   */
  constructor({ fibre, thickness, settings, rng }) {
    this.rng = rng;
    this.radius = POI_RADIUS;
    this.paper = createPaperState();
    this.colorIndex = 0;
    this._fibre = fibre;
    this._thickness = thickness;
    this._shadows = settings.shadows;
    this._rings = settings.waterSegments > 60 ? 13 : 10;
    this._segs = settings.waterSegments > 60 ? 52 : 38;

    this.group = new THREE.Group();
    this.group.name = 'poi';

    this.paperGeo = makePaperGeometry(this.radius, this._rings, this._segs);
    this.paperMesh = null;
    this.uniforms = null;
    this._buildPaperMesh();
    this._buildFrame();

    // --- kinematics ---------------------------------------------------------
    this.pos = new THREE.Vector3(0, 0.03, 0.5);
    this.vel = new THREE.Vector3();
    this.prevPos = this.pos.clone();
    this.targetXZ = new THREE.Vector2(0, 0.5);
    this.lift = 1;
    this.submerge = 0;
    this.tilt = new THREE.Vector2();
    this.yaw = 0;
    this.held = false;
    this.planarSpeed = 0;
    this.liftSpeed = 0;
    this.enteredWater = false;
    this.exitedWater = false;
    this.group.position.copy(this.pos);
  }

  _makeUniforms() {
    const tears = [];
    for (let i = 0; i < MAX_TEARS_GLSL; i++) tears.push(new THREE.Vector4(0, 0, 0, 0));
    return {
      ...createLightUniforms(),
      uFibre: { value: this._fibre },
      uThickness: { value: this._thickness },
      uTears: { value: tears },
      uSag: { value: 0.035 },
      uLoad: { value: 0 },
      uLoadR: { value: 0 },
      uWetness: { value: 0 },
      uWetFront: { value: 0 },
      uWetOrigin: { value: new THREE.Vector2(0, 0) },
      uDamage: { value: 0 },
      uSubmerge: { value: 0 },
      uTime: { value: 0 },
      uRadius: { value: this.radius },
      uWaterTint: { value: new THREE.Color(0x5f8f86) },
      uOpacity: { value: 1 },
    };
  }

  /** Builds a fresh sheet, its material, and a matching shadow caster. */
  _buildPaperMesh() {
    const uniforms = this._makeUniforms();
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: PAPER_VERT,
      fragmentShader: PAPER_FRAG,
      defines: { TEAR_COUNT: MAX_TEARS_GLSL },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(this.paperGeo, mat);
    mesh.renderOrder = 20;
    mesh.frustumCulled = false;
    mesh.castShadow = this._shadows;

    // The shadow pass needs the same droop and the same holes, or a wrecked
    // poi keeps throwing the shadow of a sheet that is not there any more.
    const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depthMat.onBeforeCompile = (shader) => {
      shader.defines = { ...(shader.defines || {}), TEAR_COUNT: MAX_TEARS_GLSL };
      Object.assign(shader.uniforms, {
        uTears: uniforms.uTears,
        uSag: uniforms.uSag,
        uLoad: uniforms.uLoad,
        uLoadR: uniforms.uLoadR,
        uRadius: uniforms.uRadius,
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           ${TEAR_GLSL}
           ${SAG_GLSL}
           attribute vec2 aDisc;
           uniform float uSag; uniform float uLoad; uniform float uLoadR; uniform float uRadius;
           varying vec2 vDiscD;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vDiscD = aDisc;
           transformed.y += sagProfile(length(aDisc), uSag, uLoad, uLoadR) * uRadius;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           ${TEAR_GLSL}
           ${NOISE_GLSL}
           varying vec2 vDiscD;`
        )
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
           if (length(vDiscD) > 1.0) discard;
           if (holeDepth(vDiscD) + (fbm2(vDiscD * 9.0) - 0.5) * 0.028 > 0.0) discard;`
        );
    };
    depthMat.customProgramCacheKey = () => 'poi-paper-depth';
    mesh.customDepthMaterial = depthMat;

    this.paperMesh = mesh;
    this.paperMat = mat;
    this.uniforms = uniforms;
    this.group.add(mesh);
    return mesh;
  }

  _buildFrame() {
    this.frameMat = new THREE.MeshStandardMaterial({
      color: FRAME_COLORS[0],
      roughness: 0.32,
      metalness: 0.0,
    });
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(this.radius + 0.004, 0.0058, 8, 44),
      this.frameMat
    );
    hoop.rotation.x = -Math.PI / 2;
    hoop.castShadow = this._shadows;

    // Handle: a flat moulded tongue, tapering to the grip.
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.017);
    shape.lineTo(0.05, -0.015);
    shape.quadraticCurveTo(0.125, -0.012, 0.13, 0);
    shape.quadraticCurveTo(0.125, 0.012, 0.05, 0.015);
    shape.lineTo(0, 0.017);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.005,
      bevelEnabled: true,
      bevelSize: 0.0016,
      bevelThickness: 0.0014,
      bevelSegments: 2,
      curveSegments: 6,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(this.radius - 0.004, -0.0028, 0);
    const handle = new THREE.Mesh(geo, this.frameMat);
    handle.castShadow = this._shadows;

    this.frameGroup = new THREE.Group();
    this.frameGroup.add(hoop, handle);
    this.group.add(this.frameGroup);
  }

  get hasPaper() {
    return !!this.paperMesh && !this.paper.destroyed;
  }

  /**
   * Hands the ruined sheet over to the caller so it can fall into the tub,
   * and leaves the frame empty until a new one is fitted.
   */
  detachPaper() {
    const mesh = this.paperMesh;
    if (!mesh) return null;
    mesh.updateMatrixWorld(true);
    this.group.remove(mesh);
    mesh.castShadow = false;
    this.paperMesh = null;
    return { mesh, uniforms: this.uniforms, material: this.paperMat };
  }

  /** Fresh sheet, fresh colour — a new poi should look new. */
  refresh() {
    if (this.paperMesh) {
      this.group.remove(this.paperMesh);
      this.paperMat.dispose();
    }
    this.paper = createPaperState();
    this.colorIndex = (this.colorIndex + 1) % FRAME_COLORS.length;
    this.frameMat.color.setHex(FRAME_COLORS[this.colorIndex]);
    this._buildPaperMesh();
  }

  /**
   * World point -> the sheet's unit-disc space, plus how far above the sheet
   * the point sits (in sheet radii). The bridge between the scene and the
   * pure catching rules.
   */
  worldToPaperLocal(worldPos, out = { x: 0, y: 0, above: 0 }) {
    const l = _tmp.copy(worldPos);
    this.group.worldToLocal(l);
    out.x = l.x / this.radius;
    out.y = l.z / this.radius;
    out.above = l.y / this.radius;
    return out;
  }

  paperWorldPoint(dx, dy, out = new THREE.Vector3()) {
    out.set(dx * this.radius, 0, dy * this.radius);
    return this.group.localToWorld(out);
  }

  /**
   * @param {number} dt
   * @param {object} ctx
   * @param {number} ctx.waterY     surface height under the poi
   * @param {number} ctx.restDepth  how deep the sheet should sit when in the water
   * @param {number} ctx.floorY
   * @param {boolean} ctx.held
   * @param {number} ctx.lift       0..1, read off the gesture
   */
  step(dt, ctx) {
    this.held = ctx.held;
    this.lift = ctx.lift;

    // Lateral follow. Water pushes back, so the sheet is noticeably lazier
    // while it is submerged — that drag is what teaches a child to slow down.
    const follow = ctx.held ? 15.5 - this.submerge * 6.2 : 7.0;
    this.pos.x = damp(this.pos.x, this.targetXZ.x, follow, dt);
    this.pos.z = damp(this.pos.z, this.targetXZ.y, follow, dt);

    // Height is never controlled directly: it is read off the gesture and off
    // where the nearest fish is swimming.
    const ease = this.lift * this.lift * (3 - 2 * this.lift);
    const deep = Math.max(ctx.restDepth, ctx.floorY + 0.03);
    const high = ctx.waterY + 0.135;
    const targetY = deep + (high - deep) * ease;
    this.pos.y = damp(this.pos.y, targetY, ctx.held ? 12.5 : 8.0, dt);

    this.vel.subVectors(this.pos, this.prevPos).divideScalar(Math.max(dt, 1e-4));
    this.prevPos.copy(this.pos);
    this.planarSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.liftSpeed = this.vel.y;

    const prev = this.submerge;
    const depth = ctx.waterY - this.pos.y;
    this.submerge = clamp(depth / (this.radius * 0.55) + 0.5, 0, 1);
    this.enteredWater = prev < 0.35 && this.submerge >= 0.35;
    this.exitedWater = prev > 0.4 && this.submerge <= 0.4;

    // Bank into the movement, and keep the near lip a touch low so water runs
    // off towards the camera instead of pooling.
    const bankX = clamp(-this.vel.z * 0.16, -0.2, 0.2);
    const bankZ = clamp(this.vel.x * 0.16, -0.2, 0.2);
    this.tilt.x = damp(this.tilt.x, bankX + 0.06, 7, dt);
    this.tilt.y = damp(this.tilt.y, bankZ, 7, dt);
    this.yaw = damp(this.yaw, Math.atan2(this.vel.x, this.vel.z) * 0.14, 4.5, dt);

    this.group.position.copy(this.pos);
    this.group.rotation.set(this.tilt.x, this.yaw, this.tilt.y, 'YXZ');
    this.group.updateMatrixWorld(true);
  }

  /** Push the paper simulation results into the shader. */
  syncMaterial(dt, time, load, loadR) {
    if (!this.uniforms) return;
    const p = this.paper;
    const u = this.uniforms;
    u.uTime.value = time;
    u.uWetness.value = damp(u.uWetness.value, p.wetness, 9, dt);
    u.uWetFront.value = p.wetFront;
    u.uWetOrigin.value.set(p.wetOriginX, p.wetOriginY);
    u.uDamage.value = p.damage;
    u.uSubmerge.value = damp(u.uSubmerge.value, this.submerge, 10, dt);
    u.uLoad.value = damp(u.uLoad.value, load, 8, dt);
    u.uLoadR.value = damp(u.uLoadR.value, loadR, 8, dt);

    // Wet paper hangs; dry paper is nearly flat.
    const sagTarget = 0.045 + p.wetness * 0.46 + p.damage * 0.2;
    u.uSag.value = damp(u.uSag.value, sagTarget, 5, dt);

    const arr = u.uTears.value;
    for (let i = 0; i < arr.length; i++) {
      const t = i < MAX_TEARS ? p.tears[i] : null;
      if (t) arr[i].set(t.x, t.y, t.radius, t.wobble);
      else arr[i].set(0, 0, 0, 0);
    }
  }

  dispose() {
    this.paperGeo.dispose();
    if (this.paperMat) this.paperMat.dispose();
    this.frameMat.dispose();
    this.frameGroup.traverse((o) => o.geometry && o.geometry.dispose());
  }
}

const _tmp = new THREE.Vector3();
