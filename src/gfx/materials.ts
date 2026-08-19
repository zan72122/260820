import * as THREE from 'three';
import {
  bakeSoil,
  bakeSoilProfile,
  bakeLeaf,
  bakeDaikonSkin,
  bakeRubber,
  bakePaint,
  bakeSteel,
  bakeDust,
  bakeCrack,
  type TextureSet,
} from './textures';

/** Shared uniforms for the "look inside the soil" window used during close-ups. */
export interface SoilWindowUniforms {
  uCutCenter: { value: THREE.Vector3 };
  uCutRadius: { value: THREE.Vector2 };
  uCutAmount: { value: number };
  uCutSide: { value: number };
}

function cloneSet(set: TextureSet, repeatX: number, repeatY: number): TextureSet {
  const out: TextureSet = { map: set.map.clone() };
  out.map.repeat.set(repeatX, repeatY);
  out.map.needsUpdate = true;
  if (set.normalMap) {
    out.normalMap = set.normalMap.clone();
    out.normalMap.repeat.set(repeatX, repeatY);
    out.normalMap.needsUpdate = true;
  }
  if (set.roughnessMap) {
    out.roughnessMap = set.roughnessMap.clone();
    out.roughnessMap.repeat.set(repeatX, repeatY);
    out.roughnessMap.needsUpdate = true;
  }
  return out;
}

export class Materials {
  readonly soilWindow: SoilWindowUniforms = {
    uCutCenter: { value: new THREE.Vector3(0, 0, 0) },
    uCutRadius: { value: new THREE.Vector2(1.1, 1.6) },
    uCutAmount: { value: 0 },
    uCutSide: { value: 1 },
  };

  soilSet!: TextureSet;
  profileSet!: TextureSet;
  leafSet!: TextureSet;
  skinSet!: TextureSet;
  rubberSet!: TextureSet;
  paintSet!: TextureSet;
  steelSet!: TextureSet;

  dustTex!: THREE.DataTexture;
  crackTex!: THREE.DataTexture;

  ground!: THREE.MeshStandardMaterial;
  bed!: THREE.MeshStandardMaterial;
  bedSection!: THREE.MeshStandardMaterial;
  farmland!: THREE.MeshStandardMaterial;
  leaf!: THREE.MeshStandardMaterial;
  leafCut!: THREE.MeshStandardMaterial;
  daikon!: THREE.MeshStandardMaterial;
  daikonCutFace!: THREE.MeshStandardMaterial;
  rubber!: THREE.MeshStandardMaterial;
  bodyPaint!: THREE.MeshStandardMaterial;
  bodyPaintDark!: THREE.MeshStandardMaterial;
  frameSteel!: THREE.MeshStandardMaterial;
  blade!: THREE.MeshStandardMaterial;
  share!: THREE.MeshStandardMaterial;
  tyre!: THREE.MeshStandardMaterial;
  crate!: THREE.MeshStandardMaterial;
  glass!: THREE.MeshStandardMaterial;
  trunk!: THREE.MeshStandardMaterial;
  foliage!: THREE.MeshStandardMaterial;
  clod!: THREE.MeshStandardMaterial;
  crackDecal!: THREE.MeshBasicMaterial;
  dustSprite!: THREE.SpriteMaterial;

  private soilMaterials: THREE.MeshStandardMaterial[] = [];

  /** Bakes textures. Split into steps so the loader can yield to the browser. */
  bakeSteps(aniso: number): Array<{ label: string; run: () => void }> {
    return [
      { label: '土をこねています', run: () => (this.soilSet = bakeSoil(aniso)) },
      { label: '土の断面をつくっています', run: () => (this.profileSet = bakeSoilProfile(aniso)) },
      { label: '葉っぱを育てています', run: () => (this.leafSet = bakeLeaf(aniso)) },
      { label: 'だいこんを白くしています', run: () => (this.skinSet = bakeDaikonSkin(aniso)) },
      { label: 'ゴムベルトを張っています', run: () => (this.rubberSet = bakeRubber(aniso)) },
      { label: '機械を塗装しています', run: () => (this.paintSet = bakePaint(aniso)) },
      {
        label: '刃を研いでいます',
        run: () => {
          this.steelSet = bakeSteel(aniso);
          this.dustTex = bakeDust();
          this.crackTex = bakeCrack();
        },
      },
      { label: '畑をならしています', run: () => this.buildMaterials() },
    ];
  }

  /** Injects the local soil-transparency window into a soil material. */
  private attachWindow(mat: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    const u = this.soilWindow;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uCutCenter = u.uCutCenter;
      shader.uniforms.uCutRadius = u.uCutRadius;
      shader.uniforms.uCutAmount = u.uCutAmount;
      shader.uniforms.uCutSide = u.uCutSide;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSoilWorld;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvSoilWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vSoilWorld;
uniform vec3 uCutCenter;
uniform vec2 uCutRadius;
uniform float uCutAmount;
uniform float uCutSide;`,
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
if ( uCutAmount > 0.001 ) {
  vec2 rel = ( vSoilWorld.xz - uCutCenter.xz ) / uCutRadius;
  float rad = length( rel );
  float w = ( 1.0 - smoothstep( 0.48, 1.0, rad ) ) * uCutAmount;
  w *= smoothstep( 0.07, -0.03, ( vSoilWorld.x - uCutCenter.x ) * uCutSide );
  float rim = ( 1.0 - smoothstep( 0.6, 0.92, rad ) ) - ( 1.0 - smoothstep( 0.4, 0.66, rad ) );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb * 0.3, w );
  gl_FragColor.rgb += vec3( 0.2, 0.13, 0.07 ) * max( rim, 0.0 ) * uCutAmount;
  gl_FragColor.a *= 1.0 - w * 0.86;
}`,
        );
    };
    this.soilMaterials.push(mat);
    return mat;
  }

  /** Toggle blend state on soil materials while the window is open. */
  setWindowOpen(open: boolean) {
    for (const m of this.soilMaterials) {
      if (m.transparent === open) continue;
      m.transparent = open;
      m.depthWrite = !open;
      m.needsUpdate = true;
    }
  }

  private buildMaterials() {
    const soilBig = cloneSet(this.soilSet, 26, 26);
    const soilBed = cloneSet(this.soilSet, 1.35, 34);

    this.ground = this.attachWindow(
      new THREE.MeshStandardMaterial({
        map: soilBig.map,
        normalMap: soilBig.normalMap,
        roughnessMap: soilBig.roughnessMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughness: 1,
        metalness: 0,
        color: 0xffffff,
      }),
    );

    this.bed = this.attachWindow(
      new THREE.MeshStandardMaterial({
        map: soilBed.map,
        normalMap: soilBed.normalMap,
        roughnessMap: soilBed.roughnessMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughness: 1,
        metalness: 0,
        color: 0xfaf3ea,
      }),
    );

    const prof = cloneSet(this.profileSet, 3, 1);
    this.bedSection = new THREE.MeshStandardMaterial({
      map: prof.map,
      normalMap: prof.normalMap,
      roughnessMap: prof.roughnessMap,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    const soilFar = cloneSet(this.soilSet, 60, 60);
    this.farmland = new THREE.MeshStandardMaterial({
      map: soilFar.map,
      roughness: 1,
      metalness: 0,
      color: 0xbfb5a4,
    });

    this.leaf = new THREE.MeshStandardMaterial({
      map: this.leafSet.map,
      normalMap: this.leafSet.normalMap,
      roughnessMap: this.leafSet.roughnessMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
      side: THREE.DoubleSide,
      roughness: 0.84,
      metalness: 0,
      color: 0xffffff,
      alphaTest: 0.5,
    });
    this.leafCut = this.leaf.clone();
    this.leafCut.color = new THREE.Color(0xe6eddc);

    this.daikon = new THREE.MeshStandardMaterial({
      map: this.skinSet.map,
      normalMap: this.skinSet.normalMap,
      roughnessMap: this.skinSet.roughnessMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.4,
      metalness: 0,
      color: 0xfdfbf4,
      emissive: 0x39362c,
      emissiveIntensity: 0.05,
    });

    this.daikonCutFace = new THREE.MeshStandardMaterial({
      color: 0xf6f8f2,
      roughness: 0.3,
      metalness: 0,
    });

    this.rubber = new THREE.MeshStandardMaterial({
      map: this.rubberSet.map,
      normalMap: this.rubberSet.normalMap,
      roughnessMap: this.rubberSet.roughnessMap,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughness: 0.94,
      metalness: 0,
      color: 0xf0f0f0,
    });

    const paint = cloneSet(this.paintSet, 1, 1);
    this.bodyPaint = new THREE.MeshStandardMaterial({
      map: paint.map,
      normalMap: paint.normalMap,
      roughnessMap: paint.roughnessMap,
      normalScale: new THREE.Vector2(0.5, 0.5),
      color: 0xc9502c,
      roughness: 0.46,
      metalness: 0.25,
    });
    this.bodyPaintDark = this.bodyPaint.clone();
    this.bodyPaintDark.color = new THREE.Color(0x50565c);
    this.bodyPaintDark.metalness = 0.4;
    this.bodyPaintDark.roughness = 0.55;

    const frame = cloneSet(this.paintSet, 2, 2);
    this.frameSteel = new THREE.MeshStandardMaterial({
      map: frame.map,
      normalMap: frame.normalMap,
      roughnessMap: frame.roughnessMap,
      color: 0x8f938f,
      roughness: 0.72,
      metalness: 0.28,
    });

    this.blade = new THREE.MeshStandardMaterial({
      map: this.steelSet.map,
      normalMap: this.steelSet.normalMap,
      roughnessMap: this.steelSet.roughnessMap,
      color: 0xd2d8dc,
      roughness: 0.3,
      metalness: 0.95,
    });

    this.share = new THREE.MeshStandardMaterial({
      map: this.steelSet.map,
      normalMap: this.steelSet.normalMap,
      color: 0x4f4a42,
      roughness: 0.95,
      metalness: 0.25,
    });

    this.tyre = new THREE.MeshStandardMaterial({
      map: this.rubberSet.map,
      normalMap: this.rubberSet.normalMap,
      color: 0xcccccc,
      roughness: 0.96,
      metalness: 0,
    });

    this.crate = new THREE.MeshStandardMaterial({
      map: cloneSet(this.paintSet, 3, 3).map,
      color: 0x3f7fb8,
      roughness: 0.5,
      metalness: 0.05,
    });

    this.glass = new THREE.MeshStandardMaterial({
      color: 0xbcd2d8,
      roughness: 0.16,
      metalness: 0.1,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.trunk = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.95, metalness: 0 });
    this.foliage = new THREE.MeshStandardMaterial({
      color: 0x4d6f3c,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    });

    this.clod = new THREE.MeshStandardMaterial({
      color: 0x5d452c,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });

    this.crackDecal = new THREE.MeshBasicMaterial({
      map: this.crackTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
      opacity: 0,
    });


    this.dustSprite = new THREE.SpriteMaterial({
      map: this.dustTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
      color: 0xd8c6ac,
    });
  }
}
