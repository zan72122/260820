import * as THREE from 'three';

/**
 * Shallow water tray.
 *
 * Not a blue floor: the surface is nearly colourless and is identified by what
 * it *does* to light — it reflects the sky and the roof lights, you can see the
 * silted pan through it, and it answers an impact with expanding rings. There
 * is no fluid solver; a handful of decaying radial waves in the fragment shader
 * carries the whole read.
 */

const MAX_RIPPLES = 5;

export class WaterSurface {
  readonly mesh: THREE.Mesh;
  private material: THREE.MeshPhysicalMaterial;
  private uniforms: Record<string, THREE.IUniform> = {};
  private ripples: Float32Array; // xz centre, start time, amplitude
  private cursor = 0;
  private time = 0;

  constructor(radius: number, envMapIntensity = 1.4) {
    this.ripples = new Float32Array(MAX_RIPPLES * 4);
    for (let i = 0; i < MAX_RIPPLES; i++) this.ripples[i * 4 + 3] = 0;

    const geo = new THREE.CircleGeometry(radius, 96);
    geo.rotateX(-Math.PI / 2);

    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xdfe8ea,
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.42,
      envMapIntensity,
      side: THREE.FrontSide,
      depthWrite: false,
      // A touch of tint so depth reads without turning it into "blue floor".
      sheen: 0.2,
      sheenColor: new THREE.Color(0x9fb3ad),
    });

    this.uniforms.uTime = { value: 0 };
    this.uniforms.uRipples = { value: this.ripples };
    this.uniforms.uRadius = { value: radius };

    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uRipples = this.uniforms.uRipples;
      shader.uniforms.uRadius = this.uniforms.uRadius;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vLocalPos;\nvarying vec3 vSurfTanX;\nvarying vec3 vSurfTanZ;'
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vLocalPos = position;
           // View-space basis of the (flat, horizontal) water plane, so the
           // ripple slope can be applied without a normal matrix in the
           // fragment stage.
           vSurfTanX = normalize((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
           vSurfTanZ = normalize((modelViewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           uniform float uRadius;
           uniform vec4 uRipples[${MAX_RIPPLES}];
           varying vec3 vLocalPos;
           varying vec3 vSurfTanX;
           varying vec3 vSurfTanZ;

           // Height of the water surface at a point, from the ambient swell
           // plus every live impact ring.
           float waterHeight(vec2 p) {
             float h = 0.0;
             // Slow ambient breathing so the tray is never dead flat.
             h += sin(p.x * 26.0 + uTime * 0.9) * 0.0012;
             h += sin(p.y * 31.0 - uTime * 0.72) * 0.0011;
             h += sin((p.x + p.y) * 18.0 + uTime * 1.3) * 0.0008;
             for (int i = 0; i < ${MAX_RIPPLES}; i++) {
               vec4 r = uRipples[i];
               if (r.w <= 0.0) continue;
               float age = uTime - r.z;
               if (age < 0.0 || age > 2.6) continue;
               float d = distance(p, r.xy);
               // Ring front travels outward; the crest trails behind it.
               float front = age * 0.62;
               float band = d - front;
               float env = exp(-age * 1.35) * exp(-abs(band) * 26.0) * exp(-d * 1.1);
               h += sin(band * 118.0) * env * r.w;
             }
             return h;
           }`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
           {
             vec2 p = vLocalPos.xz;
             float e = 0.004;
             float hx = waterHeight(p + vec2(e, 0.0)) - waterHeight(p - vec2(e, 0.0));
             float hz = waterHeight(p + vec2(0.0, e)) - waterHeight(p - vec2(0.0, e));
             float sx = hx / (2.0 * e);
             float sz = hz / (2.0 * e);
             normal = normalize(normal - vSurfTanX * sx - vSurfTanZ * sz);
           }`
        )
        .replace(
          '#include <opaque_fragment>',
          `// Grazing angles reflect more and show less of the bed: the single
           // strongest cue that this is water and not a shiny floor.
           {
             float f = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 4.0);
             diffuseColor.a = mix(diffuseColor.a, 0.92, f);
           }
           #include <opaque_fragment>`
        );
    };
    this.material.customProgramCacheKey = () => 'water';

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = 3;
  }

  /** Register an impact ring at a surface-local point. */
  splash(lx: number, lz: number, strength: number) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_RIPPLES;
    this.ripples[i * 4] = lx;
    this.ripples[i * 4 + 1] = lz;
    this.ripples[i * 4 + 2] = this.time;
    this.ripples[i * 4 + 3] = Math.min(0.02, 0.004 + strength * 0.016);
  }

  update(dt: number) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
  }

  setEnvIntensity(v: number) {
    this.material.envMapIntensity = v;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
