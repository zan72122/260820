import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { MaterialLibrary } from '../render/materials';
import { SlideSurface } from './surface';
import {
  BED_HALF_WIDTH,
  SLIDE_LENGTH,
  START_ZONES,
  StartZoneId,
  TOP_HEIGHT,
  slideNormal,
  slidePoint,
  slideSlope,
  slideSurface,
  slideTangent,
} from './slideCurve';
import { sweepAlongSlide, shellProfile, type Profile2D } from './geometryUtil';
import { clamp, damp, deg } from '../core/math';

const RAIL_Z = 0.315;

/** Cross-section of the bed: flat pan, rolled edges, upturned side rails. */
function bedProfile(): Profile2D {
  const pts: Profile2D = [];
  const halfBed = BED_HALF_WIDTH;
  // Left rail, from the outer crest inwards.
  pts.push({ z: -RAIL_Z - 0.022, n: 0.128 });
  pts.push({ z: -RAIL_Z - 0.004, n: 0.152 });
  pts.push({ z: -RAIL_Z + 0.022, n: 0.146 });
  pts.push({ z: -RAIL_Z + 0.04, n: 0.108 });
  pts.push({ z: -halfBed - 0.038, n: 0.052 });
  pts.push({ z: -halfBed - 0.012, n: 0.012 });
  pts.push({ z: -halfBed, n: 0 });
  pts.push({ z: -halfBed * 0.4, n: -0.0035 });
  pts.push({ z: halfBed * 0.4, n: -0.0035 });
  pts.push({ z: halfBed, n: 0 });
  pts.push({ z: halfBed + 0.012, n: 0.012 });
  pts.push({ z: halfBed + 0.038, n: 0.052 });
  pts.push({ z: RAIL_Z - 0.04, n: 0.108 });
  pts.push({ z: RAIL_Z - 0.022, n: 0.146 });
  pts.push({ z: RAIL_Z + 0.004, n: 0.152 });
  pts.push({ z: RAIL_Z + 0.022, n: 0.128 });
  return pts;
}

function boxProfile(halfZ: number, top: number, bottom: number): Profile2D {
  return [
    { z: -halfZ, n: top },
    { z: halfZ, n: top },
    { z: halfZ, n: bottom },
    { z: -halfZ, n: bottom },
  ];
}

/** Orientation that maps local +X to downhill, +Y to the bed normal. */
export function slideFrame(s: number, out = new Quaternion()): Quaternion {
  const t = slideTangent(s);
  const n = slideNormal(s);
  const b = new Vector3(0, 0, 1);
  return out.setFromRotationMatrix(
    new Matrix4().makeBasis(t, n, b),
  );
}

function tubeThrough(points: Vector3[], radius: number, radial = 8): TubeGeometry {
  return new TubeGeometry(new CatmullRomCurve3(points), Math.max(8, points.length * 6), radius, radial, false);
}

export interface Gate {
  id: StartZoneId;
  arc: number;
  root: Group;
  arm: Object3D;
  /** 0 closed, 1 fully swung clear. */
  open: number;
  target: number;
  available: boolean;
  latchNoise: number;
}

export class SlideRig {
  readonly root = new Group();
  readonly gates: Gate[] = [];
  readonly bed: Mesh;
  private bedMaterial: MeshPhysicalMaterial;
  /** Small stop wedges shown under the object when a gate holds it. */
  readonly deckTop: number;

  constructor(
    private lib: MaterialLibrary,
    private surface: SlideSurface,
  ) {
    this.root.name = 'slide';
    this.deckTop = TOP_HEIGHT;

    const steel = lib.slideSteel();
    this.bedMaterial = steel;
    patchSurfaceShader(steel, surface);
    const under = lib.paint('#437c8a', 'underside');

    const geo = sweepAlongSlide(shellProfile(bedProfile(), 0.014), {
      segments: 150,
      uScale: 1.15,
      vScale: 0.42,
      slideAttr: true,
      topGroupUntil: 16,
      lateralHalfWidth: RAIL_Z + 0.03,
    });
    this.bed = new Mesh(geo, [steel, under]);
    this.bed.castShadow = true;
    this.bed.receiveShadow = true;
    this.bed.name = 'slideBed';
    this.root.add(this.bed);

    this.buildStringers();
    this.buildLegs();
    this.buildTower();
    this.buildEntryRails();
    for (const z of START_ZONES) this.buildGate(z.id, z.center);
  }

  private buildStringers(): void {
    const paint = this.lib.paint('#4d94a4', 'frame');
    for (const side of [-1, 1]) {
      const geo = sweepAlongSlide(boxProfile(0.022, -0.012, -0.115), {
        sMin: 0.02,
        sMax: SLIDE_LENGTH - 0.02,
        segments: 90,
        uScale: 0.6,
        vScale: 0.3,
      });
      geo.translate(0, 0, side * (RAIL_Z - 0.02));
      const m = new Mesh(geo, paint);
      m.castShadow = true;
      m.receiveShadow = true;
      this.root.add(m);
    }
  }

  private buildLegs(): void {
    const paint = this.lib.paint('#4d94a4', 'frame');
    const legGeo = new CylinderGeometry(0.026, 0.03, 1, 10, 1);
    for (const s of [1.62, 3.05]) {
      const p = slidePoint(s);
      for (const side of [-1, 1]) {
        const top = p.y - 0.1;
        const h = top;
        const leg = new Mesh(legGeo, paint);
        leg.scale.set(1, h, 1);
        leg.position.set(p.x + 0.02, h / 2, side * (RAIL_Z - 0.03));
        leg.castShadow = true;
        leg.receiveShadow = true;
        this.root.add(leg);
        // Splayed foot plate.
        const foot = new Mesh(new CylinderGeometry(0.06, 0.07, 0.02, 12), paint);
        foot.position.set(p.x + 0.02, 0.012, side * (RAIL_Z - 0.03));
        foot.receiveShadow = true;
        this.root.add(foot);
      }
      // Cross brace.
      const brace = new Mesh(new CylinderGeometry(0.016, 0.016, (RAIL_Z - 0.03) * 2, 8), paint);
      brace.rotation.x = Math.PI / 2;
      brace.position.set(p.x + 0.02, p.y * 0.42, 0);
      brace.castShadow = true;
      this.root.add(brace);
    }
  }

  private buildTower(): void {
    const paint = this.lib.paint('#4d94a4', 'frame');
    const wood = this.lib.wood();
    const deckY = TOP_HEIGHT;
    const postGeo = new CylinderGeometry(0.03, 0.034, 1, 12, 1);

    for (const x of [-0.76, 0.02]) {
      for (const z of [-0.37, 0.37]) {
        const h = deckY + 0.66;
        const post = new Mesh(postGeo, paint);
        post.scale.set(1, h, 1);
        post.position.set(x, h / 2, z);
        post.castShadow = true;
        post.receiveShadow = true;
        this.root.add(post);
        const cap = new Mesh(new SphereGeometry(0.032, 12, 8), paint);
        cap.position.set(x, h, z);
        cap.castShadow = true;
        this.root.add(cap);
      }
    }

    // Deck boards, laid across the walking direction with drainage gaps.
    const boards = 6;
    const span = 0.84;
    const bw = span / boards - 0.014;
    for (let i = 0; i < boards; i++) {
      const b = new Mesh(new BoxGeometry(bw, 0.038, 0.76), wood);
      b.position.set(-0.79 + (i + 0.5) * (span / boards), deckY - 0.019, 0);
      b.castShadow = true;
      b.receiveShadow = true;
      this.root.add(b);
    }
    // Bearers under the deck.
    for (const z of [-0.32, 0.32]) {
      const bearer = new Mesh(new BoxGeometry(0.9, 0.05, 0.06), paint);
      bearer.position.set(-0.37, deckY - 0.062, z);
      bearer.castShadow = true;
      this.root.add(bearer);
    }

    // Hand rails on both sides of the deck, open towards the slide.
    for (const z of [-0.37, 0.37]) {
      for (const y of [deckY + 0.62, deckY + 0.32]) {
        const rail = new Mesh(new CylinderGeometry(0.019, 0.019, 0.78, 10), paint);
        rail.rotation.z = Math.PI / 2;
        rail.position.set(-0.37, y, z);
        rail.castShadow = true;
        this.root.add(rail);
      }
    }
    // Back rail behind the ladder opening.
    const back = new Mesh(new CylinderGeometry(0.019, 0.019, 0.74, 10), paint);
    back.rotation.x = Math.PI / 2;
    back.position.set(-0.76, deckY + 0.62, 0);
    back.castShadow = true;
    this.root.add(back);

    this.buildLadder(deckY, paint, wood);
  }

  private buildLadder(deckY: number, paint: MeshPhysicalMaterial, wood: MeshPhysicalMaterial): void {
    const foot = new Vector3(-1.34, 0, 0);
    const head = new Vector3(-0.79, deckY + 0.06, 0);
    for (const z of [-0.26, 0.26]) {
      const a = foot.clone().setZ(z);
      const b = head.clone().setZ(z);
      const len = a.distanceTo(b);
      const rail = new Mesh(new CylinderGeometry(0.024, 0.024, len, 10), paint);
      rail.position.copy(a).lerp(b, 0.5);
      rail.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
      rail.castShadow = true;
      rail.receiveShadow = true;
      this.root.add(rail);
    }
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 0.35);
      const p = foot.clone().lerp(head, t);
      const step = new Mesh(new BoxGeometry(0.12, 0.032, 0.52), wood);
      step.position.set(p.x, p.y, 0);
      step.castShadow = true;
      step.receiveShadow = true;
      this.root.add(step);
    }
  }

  /** The pair of grab rails at the mouth of the slide. */
  private buildEntryRails(): void {
    const paint = this.lib.paint('#ee8b45', 'grab');
    for (const side of [-1, 1]) {
      const pts: Vector3[] = [];
      // Kept short so they never cross in front of the object at the gate.
      for (let i = 0; i <= 8; i++) {
        const s = (i / 8) * 0.5;
        const lift = 0.55 * Math.pow(1 - i / 8, 1.35) + 0.12;
        pts.push(slideSurface(s, side * (RAIL_Z + 0.012), lift));
      }
      pts.unshift(new Vector3(-0.1, TOP_HEIGHT + 0.66, side * 0.37));
      const rail = new Mesh(tubeThrough(pts, 0.019, 8), paint);
      rail.castShadow = true;
      this.root.add(rail);
    }
  }

  private buildGate(id: StartZoneId, arc: number): void {
    const paint = this.lib.paint('#ee8b45', 'grab');
    const boomPaint = this.lib.paint('#ee8b45', 'grab');
    const root = new Group();
    root.position.copy(slideSurface(arc, 0, 0));
    root.quaternion.copy(slideFrame(arc));
    this.root.add(root);

    // Two little posts either side of the bed carry the boom.
    for (const side of [-1, 1]) {
      const post = new Mesh(new CylinderGeometry(0.015, 0.017, 0.085, 10), paint);
      post.position.set(0, 0.042, side * (RAIL_Z - 0.012));
      post.castShadow = true;
      root.add(post);
    }

    const pivot = new Object3D();
    // Deliberately low: tall enough to stop a dry leaf, short enough that it
    // never hides the object it is holding.
    pivot.position.set(0, 0.017, -(RAIL_Z - 0.012));
    root.add(pivot);

    const arm = new Group();
    pivot.add(arm);
    const bar = new Mesh(new BoxGeometry(0.03, 0.031, 0.6), boomPaint);
    bar.position.set(0, 0, 0.3);
    bar.castShadow = true;
    bar.receiveShadow = true;
    arm.add(bar);
    // Soft rubber face so the object rests against something believable.
    const pad = new Mesh(new BoxGeometry(0.012, 0.026, 0.52), this.lib.matte('#33383b', 0.72));
    pad.position.set(0.016, 0, 0.3);
    arm.add(pad);
    const tip = new Mesh(new SphereGeometry(0.017, 12, 8), paint);
    tip.position.set(0, 0, 0.6);
    tip.castShadow = true;
    arm.add(tip);

    this.gates.push({ id, arc, root, arm: pivot, open: 0, target: 0, available: id === 'top', latchNoise: 0 });
    root.visible = id === 'top';
  }

  gate(id: StartZoneId): Gate {
    return this.gates.find((g) => g.id === id) ?? this.gates[0];
  }

  setGateAvailable(id: StartZoneId, available: boolean): void {
    const g = this.gate(id);
    g.available = available;
    g.root.visible = available;
  }

  /** World position of a gate's boom tip, for the linkage rod. */
  gateLinkPoint(id: StartZoneId, out = new Vector3()): Vector3 {
    const g = this.gate(id);
    out.set(0, 0.02, 0.06);
    g.arm.localToWorld(out);
    return out;
  }

  update(dt: number): void {
    for (const g of this.gates) {
      const prev = g.open;
      g.open = damp(g.open, g.target, 0.22, dt);
      if (Math.abs(g.open - g.target) < 0.002) g.open = g.target;
      g.latchNoise = Math.abs(g.open - prev) / Math.max(1e-4, dt);
      g.arm.rotation.x = -g.open * deg(86);
    }
    this.surface.flush();
  }

  get material(): MeshPhysicalMaterial {
    return this.bedMaterial;
  }

  /** Slide-surface point for placing an object of the given radius. */
  restPoint(arc: number, lateral: number, radius: number, out = new Vector3()): Vector3 {
    return slideSurface(arc, lateral, radius, out);
  }

  slopeAt(arc: number): number {
    return slideSlope(clamp(arc, 0, SLIDE_LENGTH));
  }
}

/**
 * Injects the live surface state — water film, sprinkled sand, laid rubber —
 * into the bed's PBR shading. The same texture drives friction, so what the
 * child wipes off is exactly what the object stops feeling.
 */
function patchSurfaceShader(mat: MeshPhysicalMaterial, surface: SlideSurface): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSurfaceState = { value: surface.texture };
    shader.vertexShader =
      'attribute vec2 aSlide;\nvarying vec2 vSlideParam;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n\tvSlideParam = aSlide;',
    );

    const head = /* glsl */ `
      uniform sampler2D uSurfaceState;
      varying vec2 vSlideParam;
      float slHash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float slNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = slHash(i), b = slHash(i + vec2(1.0, 0.0));
        float c = slHash(i + vec2(0.0, 1.0)), d = slHash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      vec3 slCoverage() {
        vec4 st = texture2D(uSurfaceState, vec2(clamp(vSlideParam.x, 0.004, 0.996), 0.5));
        float lat = vSlideParam.y;
        // The film pools towards the middle of the pan and dries at the edges,
        // and its boundary is ragged rather than a straight line.
        float pool = 1.0 - smoothstep(0.34, 1.0, abs(lat));
        float grain = slNoise(vec2(vSlideParam.x * 26.0, lat * 5.5));
        float wet = st.r * (0.35 + 0.75 * pool) * (0.72 + 0.62 * grain);
        wet = smoothstep(0.16, 0.46, wet);
        float sand = clamp(st.g * (0.5 + 0.85 * slNoise(vec2(vSlideParam.x * 40.0, lat * 9.0))), 0.0, 1.0);
        sand = smoothstep(0.1, 0.5, sand);
        return vec3(wet, sand, st.b);
      }
    `;
    shader.fragmentShader = head + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `#include <map_fragment>
        vec3 slCov = slCoverage();
        diffuseColor.rgb *= (1.0 - 0.22 * slCov.x);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.57, 0.41), slCov.y * 0.94);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.09, 0.1), slCov.z * 0.9);
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.055, slCov.x);
        roughnessFactor = mix(roughnessFactor, 0.94, slCov.y);
        roughnessFactor = mix(roughnessFactor, 0.72, slCov.z);
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      /* glsl */ `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.0, max(slCov.y, slCov.z));
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      /* glsl */ `#include <normal_fragment_maps>
        if (slCov.y > 0.01) {
          vec2 gp = vec2(vSlideParam.x * 420.0, vSlideParam.y * 90.0);
          vec3 grit = vec3(slNoise(gp) - 0.5, slNoise(gp + 19.7) - 0.5, 0.0);
          normal = normalize(normal + grit * slCov.y * 1.15);
        }
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_physical_fragment>',
      /* glsl */ `#include <lights_physical_fragment>
        // The water film behaves as a thin clear layer over the steel.
        material.clearcoat = max(material.clearcoat, slCov.x * 0.92);
        material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.045, slCov.x);
      `,
    );
  };
  mat.customProgramCacheKey = () => 'suberidai-slide-surface';
  mat.needsUpdate = true;
}
