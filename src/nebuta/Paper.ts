/**
 * The paper panels and their material.
 *
 * Geometry: each panel is a patch of the goldfish surface, generated with four baked states
 * that the vertex shader blends between — held in the hand with a few soft creases, edges
 * caught on the frame, stretched out from the centre, and finally dry and taut. There is no
 * cloth simulation anywhere; the "smoothed" amount is a texture the child's finger paints,
 * sampled per vertex, so wrinkles genuinely retreat outward under the fingertip.
 *
 * Material: MeshPhysicalMaterial with the washi response grafted in — fibre normals, uneven
 * sheet thickness, wet glue gloss that dulls as it dries, sumi that soaks into the fibres,
 * dye density that deepens where strokes overlap, wax that repels dye, and a thin-film
 * approximation of the interior lamps that respects the baked frame shadows.
 */

import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IUniform,
  Mesh,
  MeshPhysicalMaterial,
  Texture,
  Vector3,
} from 'three';
import { PATCH_MARGIN, PATCHES, type PatchSpec, tileRect } from './shape';
import { DYE_SCALE } from './PaintAtlas';
import { washiTextures } from '../util/textures';
import { Noise2D } from '../util/noise';
import type { QualitySettings } from '../core/Quality';
import { clamp } from '../util/math';

const PAPER_PARS = /* glsl */ `
#define DYE_DENSITY_SCALE ${(1 / DYE_SCALE).toFixed(4)}
uniform sampler2D tPaper;
uniform sampler2D tInk;
uniform sampler2D tDye;
uniform sampler2D tInterior;
uniform sampler2D tGuide;
uniform sampler2D tFiber;
uniform float uDry;
uniform float uAttachU;
uniform vec3 uLamp;
uniform float uLampMaster;
uniform vec3 uLampColor;
uniform float uDayThrough;
uniform vec3 uBackAmbient;
uniform float uGuideFade;
uniform vec3 uInkColor;
uniform vec3 uPaperColor;
varying float vOverlap;
varying vec2 vTile;
varying vec2 vAtlasUv;
`;

const PAPER_VERT_PARS = /* glsl */ `
uniform sampler2D tPaper;
uniform float uAttach;
uniform float uDry;
uniform vec3 uHandOffset;
uniform float uTime;
uniform float uWrinkle;
attribute vec3 aHand;
attribute vec3 aEdge;
attribute vec2 aWrinkle;
attribute vec2 aTile;
attribute float aOverlap;
varying float vOverlap;
varying vec2 vTile;
varying vec2 vAtlasUv;
`;

const PAPER_VERT_BODY = /* glsl */ `
  vOverlap = aOverlap;
  vTile = aTile;
  vAtlasUv = uv;
  float sm = texture2D(tPaper, uv).g * uAttach;
  vec3 taut = transformed;
  vec3 held = aHand + uHandOffset;
  vec3 p = mix(held, aEdge, uAttach);
  p = mix(p, taut, sm);
  // remaining creases bunch up wherever the finger has not passed yet
  float wet = 1.0 - uDry;
  float amp = aWrinkle.x * (1.0 - sm) * mix(1.55, 1.0, uAttach) * (1.0 - uDry * 0.4);
  float breathe = 1.0 + 0.18 * wet * sin(uTime * 1.15 + aWrinkle.y);
  transformed = p + normal * amp * uWrinkle * breathe;
`;

/**
 * Everything the atlases say about this texel. Injected once at the top of the fragment
 * shader so the map / roughness / normal / emissive hooks can all read the same values.
 */
const PAPER_FRAG_SAMPLE = /* glsl */ `
  vec4 paperS = texture2D(tPaper, vAtlasUv);
  vec4 inkS = texture2D(tInk, vAtlasUv);
  vec4 dyeS = texture2D(tDye, vAtlasUv);
  vec4 interiorS = texture2D(tInterior, vAtlasUv);
  vec4 fiberS = texture2D(tFiber, vTile * vec2(2.6, 2.0));

  float smoothed = paperS.g;
  float streak = paperS.b;
  float laid = paperS.a;
  // the paste wave that spreads outward as the sheet is laid, plus what the brush left
  float glueWet = clamp(paperS.r * 0.8 + laid * 0.5, 0.0, 1.2) * (1.0 - uDry);

  float inkMask = clamp(inkS.r, 0.0, 1.0);
  float inkPool = inkS.g;
  float inkDry = inkS.b;
  float wax = inkS.a;

  float dyeDensity = clamp(dyeS.a * DYE_DENSITY_SCALE, 0.0, 5.0);   // half-float target
  vec3 dyeCol = dyeS.rgb / max(dyeS.a, 1e-4);

  // uneven sheet: fibre clouds plus the double thickness where sheets overlap
  float thickness = mix(0.62, 1.35, fiberS.g) * (1.0 + vOverlap * 0.55);
  float fibreDensity = fiberS.r;
`;

const PAPER_FRAG_COLOR = /* glsl */ `
  vec3 washi = uPaperColor * (0.92 + 0.14 * fibreDensity - 0.1 * fiberS.b);
  // dye is soaked in, not painted on: it multiplies the sheet rather than covering it
  float soak = clamp(dyeDensity * 1.15, 0.0, 1.0);
  vec3 dyed = washi * mix(vec3(1.0), dyeCol * (1.25 - 0.3 * soak), soak);
  dyed = mix(dyed, dyed * 0.86, clamp(dyeDensity - 1.0, 0.0, 1.0) * 0.6);
  // wax repelled the dye, so the sheet stays white there
  dyed = mix(dyed, washi * 1.03, wax * 0.86);
  // sumi sinks in at the edges and sits darkest in the pools
  vec3 inked = mix(dyed, uInkColor * (1.0 - inkPool * 0.25), clamp(inkMask * 1.05, 0.0, 1.0));
  float guide = texture2D(tGuide, vAtlasUv).r * uGuideFade * (1.0 - inkMask);
  inked = mix(inked, inked * 0.72 + vec3(0.06, 0.07, 0.09), guide * 0.55);
  diffuseColor.rgb *= inked;
`;

const PAPER_FRAG_ROUGH = /* glsl */ `
  float rough = 0.94 - 0.1 * fibreDensity;
  rough -= glueWet * 0.62;          // wet paste is glossy
  rough -= inkPool * 0.3;           // ink pools keep a faint shine
  rough -= wax * 0.34;              // wax has its own low sheen
  rough -= dyeDensity * 0.1 * (1.0 - uDry);
  rough += streak * 0.05;
  roughnessFactor = clamp(rough, 0.08, 1.0);
`;

const PAPER_FRAG_NORMAL = /* glsl */ `
  {
    // washi fibres, tiled per panel rather than across the whole atlas
    vec3 mapN = texture2D(normalMap, vTile * vec2(2.6, 2.0)).xyz * 2.0 - 1.0;
    mapN.xy *= normalScale;
    normal = normalize(tbn * mapN);
    // creases the finger has not yet chased out, as a normal-space perturbation
    float creaseAmp = (1.0 - smoothed) * uAttachU * 0.85 + (1.0 - uAttachU) * 0.5;
    vec2 q = vTile * vec2(9.0, 7.0);
    float c1 = sin(q.x * 3.1 + q.y * 1.7);
    float c2 = sin(q.x * 1.3 - q.y * 4.3 + 1.9);
    vec2 grad = vec2(
      3.1 * cos(q.x * 3.1 + q.y * 1.7) + 1.3 * cos(q.x * 1.3 - q.y * 4.3 + 1.9),
      1.7 * cos(q.x * 3.1 + q.y * 1.7) - 4.3 * cos(q.x * 1.3 - q.y * 4.3 + 1.9)
    );
    float crease = (c1 * 0.6 + c2 * 0.4);
    normal = normalize(normal - (tbn[0] * grad.x + tbn[1] * grad.y) * creaseAmp * 0.045 * (0.6 + 0.4 * crease));
    // brush streaks left in the paste
    normal = normalize(normal - tbn[0] * streak * 0.05 * (1.0 - uDry));
  }
`;

/**
 * Sumi is not a shiny surface: where the ink has soaked in, the sheen and the specular
 * highlight have to come down too, or the lines read as grey instead of black.
 */
const PAPER_FRAG_LIGHTS = /* glsl */ `
  material.sheenColor *= 1.0 - inkMask * 0.88;
  material.specularColor *= 1.0 - inkMask * 0.55;
  material.roughness = mix(material.roughness, 0.97, inkMask * (1.0 - inkPool));
`;

const PAPER_FRAG_EMISSIVE = /* glsl */ `
  {
    // --- lamps inside the paper (thin film approximation, not a flat emissive ramp)
    float inner = dot(interiorS.rgb, uLamp) * uLampMaster * 0.55;
    // paper thickness and the frame shadow both survive
    float frameShade = 1.0 - interiorS.a * 0.88;
    // even a light wash reads clearly once the lamp is behind it
    vec3 transmitTint = mix(vec3(1.0), dyeCol * dyeCol * 1.35 + dyeCol * 0.45, clamp(dyeDensity * 2.2, 0.0, 1.0));
    float blockedByInk = 1.0 - inkMask * 0.93;
    float waxLine = 1.0 + wax * 1.35;
    float thin = mix(1.25, 0.72, clamp(thickness - 0.62, 0.0, 1.0) / 0.73);
    vec3 glow = uLampColor * inner * frameShade * transmitTint * blockedByInk * waxLine * thin;
    // the fibres themselves stay readable against the light
    glow *= 0.82 + 0.32 * fibreDensity;
    glow *= 1.0 - vOverlap * 0.28;
    // a soft ceiling: bright, but never so hot that the sumi and the fibre wash out
    glow = glow / (1.0 + glow * 0.42);
    totalEmissiveRadiance += glow;

    // --- daylight coming through the sheet from behind: this is how the frame reads
    float through = uDayThrough * thin * (1.0 - inkMask * 0.95) * (1.0 - dyeDensity * 0.28);
    totalEmissiveRadiance += uBackAmbient * through * frameShade;
  }
`;

export interface PanelRuntime {
  spec: PatchSpec;
  mesh: Mesh;
  material: MeshPhysicalMaterial;
  uniforms: Record<string, IUniform>;
  /** 0 = in the child's hands, 1 = edges on the frame. */
  attach: number;
  /** 0 = paste still wet, 1 = dry and taut. */
  dry: number;
  state: 'stack' | 'held' | 'settling' | 'attached';
  handOffset: Vector3;
  centre: Vector3;
  normal: Vector3;
  /** Screen-space magnet target is derived from this each frame. */
  radius: number;
  smoothed: number;
  attachTime: number;
}

export interface PaperTexturesIn {
  paper: Texture;
  ink: Texture;
  dye: Texture;
  interior: Texture;
  guide: Texture;
}

const _p = new Vector3();
const _q = new Vector3();
const _r = new Vector3();
const _du = new Vector3();
const _dv = new Vector3();

function patchPoint(spec: PatchSpec, a: number, b: number, out: Vector3): Vector3 {
  const pa = -PATCH_MARGIN + a * (1 + 2 * PATCH_MARGIN);
  const pb = -PATCH_MARGIN + b * (1 + 2 * PATCH_MARGIN);
  return spec.point(clamp(pa, -0.05, 1.05), clamp(pb, -0.05, 1.05), out);
}

function patchNormalAt(spec: PatchSpec, a: number, b: number, out: Vector3): Vector3 {
  const e = 0.006;
  patchPoint(spec, Math.min(1, a + e), b, _p);
  patchPoint(spec, Math.max(0, a - e), b, _q);
  _du.subVectors(_p, _q);
  patchPoint(spec, a, Math.min(1, b + e), _p);
  patchPoint(spec, a, Math.max(0, b - e), _q);
  _dv.subVectors(_p, _q);
  out.crossVectors(_du, _dv);
  if (out.lengthSq() < 1e-12) out.set(0, 1, 0);
  return out.normalize();
}

export class PaperPanels {
  readonly group = new Group();
  readonly panels: PanelRuntime[] = [];
  private readonly byId = new Map<string, PanelRuntime>();
  private readonly sharedUniforms: Record<string, IUniform>;

  constructor(
    private readonly quality: QualitySettings,
    textures: PaperTexturesIn,
  ) {
    this.group.name = 'paper';
    const washi = washiTextures(quality.tier === 'low' ? 256 : 512);
    this.sharedUniforms = {
      tPaper: { value: textures.paper },
      tInk: { value: textures.ink },
      tDye: { value: textures.dye },
      tInterior: { value: textures.interior },
      tGuide: { value: textures.guide },
      tFiber: { value: washi.fiberDetail },
      uLamp: { value: new Vector3(0, 0, 0) },
      uLampMaster: { value: 0 },
      uLampColor: { value: new Color('#ffb45a') },
      uDayThrough: { value: 0.26 },
      uBackAmbient: { value: new Color('#cddcf0') },
      uGuideFade: { value: 0 },
      uInkColor: { value: new Color('#141013') },
      uPaperColor: { value: new Color('#f6efe1') },
      uTime: { value: 0 },
      uWrinkle: { value: 1 },
    };

    const noise = new Noise2D(7717);
    for (const spec of PATCHES) {
      const panel = this.build(spec, washi.fiberNormal, noise);
      this.panels.push(panel);
      this.byId.set(spec.id, panel);
      this.group.add(panel.mesh);
    }
  }

  private build(spec: PatchSpec, fiberNormal: Texture, noise: Noise2D): PanelRuntime {
    const scale = this.quality.paperSegments / 20;
    const segA = Math.max(6, Math.round(spec.segA * scale));
    const segB = Math.max(6, Math.round(spec.segB * scale));
    const rect = tileRect(spec.tile);

    const count = (segA + 1) * (segB + 1);
    const position = new Float32Array(count * 3);
    const normal = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const aTile = new Float32Array(count * 2);
    const aHand = new Float32Array(count * 3);
    const aEdge = new Float32Array(count * 3);
    const aWrinkle = new Float32Array(count * 2);
    const aOverlap = new Float32Array(count);

    // local frame for the flat "sheet in hand" state
    const centre = patchPoint(spec, 0.5, 0.5, new Vector3());
    const nrm = patchNormalAt(spec, 0.5, 0.5, new Vector3());
    const uEnd = patchPoint(spec, 1, 0.5, new Vector3());
    const uStart = patchPoint(spec, 0, 0.5, new Vector3());
    const vEnd = patchPoint(spec, 0.5, 1, new Vector3());
    const vStart = patchPoint(spec, 0.5, 0, new Vector3());
    const axisU = new Vector3().subVectors(uEnd, uStart);
    const sizeU = axisU.length() * 1.04;
    axisU.normalize();
    const axisV = new Vector3().crossVectors(nrm, axisU).normalize();
    const sizeV = vEnd.distanceTo(vStart) * 1.04;
    const radius = Math.max(sizeU, sizeV) * 0.5;

    let i = 0;
    for (let bi = 0; bi <= segB; bi++) {
      for (let ai = 0; ai <= segA; ai++) {
        const a = ai / segA;
        const b = bi / segB;
        patchPoint(spec, a, b, _p);
        patchNormalAt(spec, a, b, _r);

        const pa = -PATCH_MARGIN + a * (1 + 2 * PATCH_MARGIN);
        const pb = -PATCH_MARGIN + b * (1 + 2 * PATCH_MARGIN);
        const over = Math.max(
          Math.max(0, -pa / PATCH_MARGIN),
          Math.max(0, (pa - 1) / PATCH_MARGIN),
          Math.max(0, -pb / PATCH_MARGIN),
          Math.max(0, (pb - 1) / PATCH_MARGIN),
        );

        const off = spec.offset;
        position[i * 3] = _p.x + _r.x * off;
        position[i * 3 + 1] = _p.y + _r.y * off;
        position[i * 3 + 2] = _p.z + _r.z * off;
        normal[i * 3] = _r.x;
        normal[i * 3 + 1] = _r.y;
        normal[i * 3 + 2] = _r.z;
        uv[i * 2] = rect.x + rect.w * a;
        uv[i * 2 + 1] = rect.y + rect.h * b;
        aTile[i * 2] = a;
        aTile[i * 2 + 1] = b;
        aOverlap[i] = clamp(over, 0, 1);

        // edges caught on the frame, centre still ballooning off it
        const bulge = Math.sin(Math.PI * clamp(a, 0, 1)) * Math.sin(Math.PI * clamp(b, 0, 1));
        const crumpleE = noise.fbm(a * 5.1 + spec.tile * 3.7, b * 5.1, 3) * 0.02;
        aEdge[i * 3] = position[i * 3] + _r.x * (bulge * 0.085 + crumpleE);
        aEdge[i * 3 + 1] = position[i * 3 + 1] + _r.y * (bulge * 0.085 + crumpleE);
        aEdge[i * 3 + 2] = position[i * 3 + 2] + _r.z * (bulge * 0.085 + crumpleE);

        // flat sheet lifted off the frame, tilted as if held
        const crumpleH = noise.fbm(a * 7.3 + spec.tile * 11.1, b * 7.3, 4) * 0.028;
        const tilt = (b - 0.5) * 0.14;
        _q
          .copy(centre)
          .addScaledVector(nrm, 0.3 + crumpleH + tilt)
          .addScaledVector(axisU, (a - 0.5) * sizeU)
          .addScaledVector(axisV, (b - 0.5) * sizeV);
        aHand[i * 3] = _q.x;
        aHand[i * 3 + 1] = _q.y;
        aHand[i * 3 + 2] = _q.z;

        const wn = noise.fbm(a * 6.7 + spec.tile * 5.3, b * 8.9 + 2.1, 3);
        aWrinkle[i * 2] = wn * 0.03;
        aWrinkle[i * 2 + 1] = (noise.fbm(a * 3.1, b * 3.1 + spec.tile, 2) + 1) * 3.14;

        i++;
      }
    }

    const index: number[] = [];
    for (let bi = 0; bi < segB; bi++) {
      for (let ai = 0; ai < segA; ai++) {
        const p0 = bi * (segA + 1) + ai;
        const p1 = p0 + 1;
        const p2 = p0 + segA + 1;
        const p3 = p2 + 1;
        index.push(p0, p2, p1, p1, p2, p3);
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    geometry.setAttribute('aTile', new Float32BufferAttribute(aTile, 2));
    geometry.setAttribute('aHand', new Float32BufferAttribute(aHand, 3));
    geometry.setAttribute('aEdge', new Float32BufferAttribute(aEdge, 3));
    geometry.setAttribute('aWrinkle', new Float32BufferAttribute(aWrinkle, 2));
    geometry.setAttribute('aOverlap', new Float32BufferAttribute(aOverlap, 1));
    geometry.setIndex(index);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    const material = new MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0,
      side: DoubleSide,
      normalMap: fiberNormal,
      sheen: 0.22,
      sheenColor: new Color('#fff3dd'),
      sheenRoughness: 0.85,
      clearcoat: 0,
      transparent: false,
      emissive: new Color(0x000000),
    });
    material.normalScale.set(0.55, 0.55);

    const uniforms: Record<string, IUniform> = {
      ...this.sharedUniforms,
      uAttach: { value: spec.preAttached ? 1 : 0 },
      uAttachU: { value: spec.preAttached ? 1 : 0 },
      uDry: { value: spec.preAttached ? 1 : 0 },
      uHandOffset: { value: new Vector3() },
    };

    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${PAPER_VERT_PARS}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${PAPER_VERT_BODY}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${PAPER_PARS}`)
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>\n${PAPER_FRAG_SAMPLE}`,
        )
        .replace('#include <map_fragment>', `#include <map_fragment>\n${PAPER_FRAG_COLOR}`)
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>\n${PAPER_FRAG_ROUGH}`,
        )
        .replace('#include <normal_fragment_maps>', PAPER_FRAG_NORMAL)
        .replace(
          '#include <lights_physical_fragment>',
          `#include <lights_physical_fragment>\n${PAPER_FRAG_LIGHTS}`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>\n${PAPER_FRAG_EMISSIVE}`,
        );
    };
    material.customProgramCacheKey = () => 'nebuta-washi-v1';

    const mesh = new Mesh(geometry, material);
    mesh.name = `paper-${spec.id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = spec.preAttached;
    mesh.userData.patchId = spec.id;
    mesh.renderOrder = 2;

    return {
      spec,
      mesh,
      material,
      uniforms,
      attach: spec.preAttached ? 1 : 0,
      dry: spec.preAttached ? 1 : 0,
      state: spec.preAttached ? 'attached' : 'stack',
      handOffset: uniforms.uHandOffset.value as Vector3,
      centre,
      normal: nrm,
      radius,
      smoothed: spec.preAttached ? 1 : 0,
      attachTime: 0,
    };
  }

  get(id: string): PanelRuntime | undefined {
    return this.byId.get(id);
  }

  /** Panels the child still has to paste. */
  remaining(): PanelRuntime[] {
    return this.panels.filter((p) => !p.spec.preAttached && p.state !== 'attached');
  }

  attachedMeshes(): Mesh[] {
    return this.panels.filter((p) => p.state === 'attached' || p.state === 'settling').map((p) => p.mesh);
  }

  setLamps(a: number, b: number, c: number, master: number): void {
    (this.sharedUniforms.uLamp.value as Vector3).set(a, b, c);
    this.sharedUniforms.uLampMaster.value = master;
  }

  setLampColor(hex: string): void {
    (this.sharedUniforms.uLampColor.value as Color).set(hex);
  }

  setDaylight(through: number, ambient: Color): void {
    this.sharedUniforms.uDayThrough.value = through;
    (this.sharedUniforms.uBackAmbient.value as Color).copy(ambient);
  }

  /** The dye atlas ping-pongs between two targets, so the material is repointed each frame. */
  setDyeTexture(tex: Texture): void {
    this.sharedUniforms.tDye.value = tex;
  }

  setGuideFade(v: number): void {
    this.sharedUniforms.uGuideFade.value = v;
  }

  setWrinkleScale(v: number): void {
    this.sharedUniforms.uWrinkle.value = v;
  }

  update(dt: number, time: number): void {
    this.sharedUniforms.uTime.value = time;
    for (const p of this.panels) {
      p.uniforms.uAttach.value = p.attach;
      p.uniforms.uAttachU.value = p.attach;
      p.uniforms.uDry.value = p.dry;
      if (p.state === 'attached' && p.dry < 1) p.dry = Math.min(1, p.dry + dt * 0.055);
      p.mesh.castShadow = p.state === 'attached';
    }
  }

  reset(): void {
    for (const p of this.panels) {
      const pre = p.spec.preAttached;
      p.attach = pre ? 1 : 0;
      p.dry = pre ? 1 : 0;
      p.state = pre ? 'attached' : 'stack';
      p.smoothed = pre ? 1 : 0;
      p.attachTime = 0;
      p.handOffset.set(0, 0, 0);
      p.mesh.visible = pre;
      p.uniforms.uAttach.value = p.attach;
      p.uniforms.uAttachU.value = p.attach;
      p.uniforms.uDry.value = p.dry;
    }
  }

  dispose(): void {
    for (const p of this.panels) {
      p.mesh.geometry.dispose();
      p.material.dispose();
    }
    this.panels.length = 0;
    this.byId.clear();
  }
}
