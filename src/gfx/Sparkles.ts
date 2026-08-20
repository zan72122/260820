import {
  AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Points,
  ShaderMaterial, Vector3, type IUniform,
} from 'three';

/**
 * Point sparkles anchored to crystal tips.
 *
 * The sparkle is deliberately *not* a global screen effect: only the tips
 * twinkle, so the crystals read as the one precious thing in an otherwise
 * matte, dusty workshop.
 */
export function createSparkles(
  tips: readonly Vector3[],
  uTime: IUniform<number>,
  uIntensity: IUniform<number>,
  color: Color,
  dpr: number,
): Points {
  const pos: number[] = [];
  const phase: number[] = [];
  const size: number[] = [];
  let s = 12345;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (const t of tips) {
    pos.push(t.x, t.y, t.z);
    phase.push(rnd() * Math.PI * 2);
    size.push(0.9 + rnd() * 2.1);
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new Float32BufferAttribute(phase, 1));
  geo.setAttribute('aSize', new Float32BufferAttribute(size, 1));
  geo.computeBoundingSphere();

  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime, uIntensity,
      uColor: { value: color },
      uDpr: { value: dpr },
    },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime;
      uniform float uIntensity;
      uniform float uDpr;
      varying float vTw;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Sharp, sparse twinkle: mostly dark with brief bright flashes.
        float w = sin(uTime * 2.1 + aPhase) * 0.5 + 0.5;
        float w2 = sin(uTime * 3.7 + aPhase * 2.3) * 0.5 + 0.5;
        float tw = pow(w * w2, 3.0);
        vTw = tw * uIntensity;
        float px = aSize * 9.0 * uDpr * tw * uIntensity;
        gl_PointSize = clamp(px * (2.4 / max(0.05, -mv.z)), 0.0, 42.0 * uDpr);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vTw;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d2 = dot(c, c);
        float core = exp(-d2 * 46.0);
        float star = (exp(-abs(c.x) * 34.0) + exp(-abs(c.y) * 34.0)) * exp(-d2 * 12.0) * 0.35;
        float a = (core + star) * vTw;
        if (a < 0.004) discard;
        gl_FragColor = vec4(mix(vec3(1.0), uColor, 0.45) * a, a);
      }`,
  });

  const points = new Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  return points;
}
