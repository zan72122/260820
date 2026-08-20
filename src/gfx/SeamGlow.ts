import {
  AdditiveBlending, Camera, Color, Mesh, PlaneGeometry, ShaderMaterial, type IUniform,
} from 'three';

/**
 * The light escaping the crack — the single most important image in the game.
 *
 * A camera-facing additive quad rather than real volumetrics: a phone can draw
 * this at any resolution for free, and the art director controls the shape of
 * the leak exactly instead of hoping a light shaft lands well.
 */
export class SeamGlow {
  readonly mesh: Mesh;
  readonly uGap: IUniform<number>;
  readonly uIntensity: IUniform<number>;
  readonly uColor: IUniform<Color>;

  constructor(size: number, uTime: IUniform<number>) {
    this.uGap = { value: 0 };
    this.uIntensity = { value: 0 };
    this.uColor = { value: new Color(0.7, 0.4, 1.0) };

    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      uniforms: { uGap: this.uGap, uIntensity: this.uIntensity, uColor: this.uColor, uTime },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uGap, uIntensity, uTime;
        uniform vec3 uColor;
        varying vec2 vUv;

        float hash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        void main() {
          vec2 c = vUv - 0.5;
          float g = max(uGap, 0.004);

          // The lit band itself, exactly as tall as the crack is open.
          float band = exp(-pow(abs(c.y) / g, 1.7));
          // Ragged edge: the break is not a machined slot.
          float rag = 0.75 + 0.5 * hash(vec2(floor(vUv.x * 42.0), 3.0));
          band *= rag;

          // Horizontal flare bleeding sideways out of the crack.
          float flare = exp(-abs(c.y) / (g * 5.0 + 0.02));
          // Fade toward the silhouette so light seems to come from inside.
          float sides = smoothstep(0.5, 0.10, abs(c.x));
          float streak = pow(sides, 0.55);

          float breathe = 0.88 + 0.12 * sin(uTime * 3.1);
          float a = (band * 1.35 + flare * 0.45 * streak) * sides * uIntensity * breathe;
          vec3 col = mix(uColor, vec3(1.0), clamp(band * 0.85, 0.0, 1.0));
          gl_FragColor = vec4(col * a, a);
        }`,
    });

    this.mesh = new Mesh(new PlaneGeometry(size * 3.1, size * 3.1), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
  }

  update(camera: Camera): void {
    this.mesh.visible = this.uIntensity.value > 0.002;
    if (!this.mesh.visible) return;
    // Billboard toward the camera, keeping the crack horizontal on screen.
    this.mesh.quaternion.copy(camera.quaternion);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as ShaderMaterial).dispose();
  }
}
