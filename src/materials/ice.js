// The ice block. A physical (transmissive) shell so it genuinely refracts the
// shop behind it, plus a short object-space raymarch through a baked 3D volume
// for the frozen milk-white core and the trapped bubbles.

import { MeshPhysicalMaterial, Color, Vector3 } from 'three';

export function createIceMaterial({ volume, envMap, sun, quality }) {
  const uniforms = {
    tVolume: { value: volume },
    uVolMin: { value: new Vector3(-0.075, -0.09, -0.075) },
    uVolSize: { value: new Vector3(0.15, 0.18, 0.15) },
    uObjCam: { value: new Vector3(0, 0, 1) },
    uSunDir: { value: sun.clone().normalize() },
    uMarch: { value: 0.115 },
    uCloud: { value: 3.2 },
    uMilk: { value: new Color(0.93, 0.96, 0.99) },
    uWet: { value: 0.0 },
    uTime: { value: 0 },
  };

  const mat = new MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.038,
    envMap,
    envMapIntensity: 1.15,
    transmission: quality.transmission ? 1.0 : 0.0,
    transparent: !quality.transmission,
    opacity: quality.transmission ? 1.0 : 0.55,
    thickness: 0.030,
    ior: 1.309,
    attenuationColor: new Color(0.70, 0.86, 0.93),
    attenuationDistance: 0.55,
    clearcoat: 0.9,
    clearcoatRoughness: 0.055,
    specularIntensity: 1.0,
  });

  const STEPS = quality.iceSteps;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObjPos;
        varying vec3 vObjNrm;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vObjPos = position;
        vObjNrm = normal;`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        precision highp sampler3D;
        uniform sampler3D tVolume;
        uniform vec3 uVolMin;
        uniform vec3 uVolSize;
        uniform vec3 uObjCam;
        uniform vec3 uSunDir;
        uniform vec3 uMilk;
        uniform float uMarch;
        uniform float uCloud;
        uniform float uWet;
        uniform float uTime;
        varying vec3 vObjPos;
        varying vec3 vObjNrm;`)
      .replace('#include <opaque_fragment>', `
        {
          // march inward from the surface along the eye ray, in object space, so
          // the cloudy core stays locked to the block while the block rotates.
          vec3 rd = normalize(vObjPos - uObjCam);
          vec3 nrm = normalize(vObjNrm);
          rd = normalize(refract(rd, nrm, 0.76) + rd * 0.35);
          float stepLen = uMarch / float(${STEPS});
          vec3 p = vObjPos + rd * stepLen * 0.5;
          float acc = 0.0;
          float bub = 0.0;
          for (int i = 0; i < ${STEPS}; i++) {
            vec3 uvw = (p - uVolMin) / uVolSize;
            vec3 cl = clamp(uvw, 0.0, 1.0);
            float inside = step(0.0001, 1.0 - max(max(abs(uvw.x-0.5), abs(uvw.y-0.5)), abs(uvw.z-0.5)) * 2.0);
            vec2 s = texture(tVolume, cl).rg;
            acc += s.r * inside;
            bub = max(bub, s.g * inside);
            p += rd * stepLen;
          }
          acc /= float(${STEPS});
          float cloud = 1.0 - exp(-acc * uCloud);

          float ndl = max(dot(geometryNormal, uSunDir), 0.0);
          // cloudy ice scatters hard: the core must out-shine what is behind the block,
          // or it reads as tinted glass instead of frozen white
          vec3 milk = uMilk * (0.62 + 1.34 * ndl + 0.55 * pow(ndl, 6.0));
          outgoingLight = mix(outgoingLight, milk, cloud * 0.93) + totalSpecular * cloud * 0.5;

          // bubbles: tiny bright lenses, brightest when the sun is behind them
          float bb = smoothstep(0.22, 0.95, bub);
          outgoingLight += vec3(0.93, 0.97, 1.0) * bb * (0.22 + 0.34 * pow(1.0 - ndl, 2.0));

          // the melting outer film: a wet fresnel sheen that reads as "cold and dripping"
          float fres = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 4.0);
          outgoingLight += vec3(0.84, 0.92, 1.0) * fres * (0.34 + uWet * 0.5);
          // the sawn faces stay a touch frosted where they have started to melt
          float frost = smoothstep(0.70, 1.0, acc * 2.0) * 0.05;
          outgoingLight += vec3(0.95, 0.98, 1.0) * frost;
        }
        #include <opaque_fragment>`);

    mat.userData.shader = shader;
  };

  mat.customProgramCacheKey = () => 'ice' + STEPS;
  mat.userData.uniforms = uniforms;
  return mat;
}
