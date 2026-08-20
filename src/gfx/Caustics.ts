import { AdditiveBlending, Color, Mesh, PlaneGeometry, ShaderMaterial, type IUniform } from 'three';

/**
 * The pay-off of holding the stone up to the light: coloured caustics crawling
 * across the bench and the wall. Faked with an animated additive pattern —
 * real refraction would cost a render pass the phone cannot spare, and this is
 * more art-directable anyway.
 */
export class Caustics {
  readonly bench: Mesh;
  readonly wall: Mesh;
  readonly uIntensity: IUniform<number> = { value: 0 };
  readonly uColor: IUniform<Color> = { value: new Color(0.7, 0.45, 1) };
  readonly uSweep: IUniform<number> = { value: 0 };

  private material: ShaderMaterial;

  constructor(uTime: IUniform<number>) {
    this.material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime, uIntensity: this.uIntensity, uColor: this.uColor, uSweep: this.uSweep,
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uIntensity, uSweep;
        uniform vec3 uColor;
        varying vec2 vUv;

        vec2 h22(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.xx + p3.yz) * p3.zy);
        }
        // Worley F2-F1 makes convincing caustic filaments.
        float cells(vec2 p, float t) {
          vec2 ip = floor(p), fp = fract(p);
          float f1 = 8.0, f2 = 8.0;
          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              vec2 g = vec2(float(x), float(y));
              vec2 o = h22(ip + g);
              o = 0.5 + 0.5 * sin(t * 0.9 + 6.2831 * o);
              float d = length(g + o - fp);
              if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
            }
          }
          return f2 - f1;
        }

        void main() {
          vec2 uvc = vUv - 0.5;
          float t = uTime * 0.55 + uSweep * 2.4;
          vec2 p = uvc * 7.0 + vec2(uSweep * 1.4, 0.0);
          float c = cells(p, t);
          float fil = smoothstep(0.42, 0.02, c);
          float c2 = cells(p * 1.9 + 13.0, t * 1.4);
          fil = max(fil, smoothstep(0.30, 0.02, c2) * 0.55);

          // Soft elliptical pool so the projection has an edge.
          float falloff = smoothstep(0.52, 0.10, length(uvc * vec2(1.0, 1.25)));
          float a = fil * falloff * uIntensity;
          if (a < 0.004) discard;
          vec3 col = mix(uColor, vec3(1.0), fil * 0.35);
          gl_FragColor = vec4(col * a, a);
        }`,
    });

    this.bench = new Mesh(new PlaneGeometry(2.6, 2.0), this.material);
    this.bench.rotation.x = -Math.PI / 2;
    this.bench.renderOrder = 3;
    this.bench.visible = false;

    this.wall = new Mesh(new PlaneGeometry(3.2, 2.4), this.material);
    this.wall.renderOrder = 3;
    this.wall.visible = false;
  }

  update(): void {
    const on = this.uIntensity.value > 0.004;
    this.bench.visible = on;
    this.wall.visible = on;
  }

  dispose(): void {
    this.bench.geometry.dispose();
    this.wall.geometry.dispose();
    this.material.dispose();
  }
}
