import * as THREE from 'three'

/**
 * The thin dark line that opens up between cake and pan as the palette knife
 * travels. Purely azimuthal — the shader reveals exactly the arc already
 * traced, so the child sees their own stroke leaving a mark.
 */
export class SeparationLine {
  readonly mesh: THREE.Mesh
  private uniforms = {
    uFrom: { value: 0 },
    uTo: { value: 0 },
    uOn: { value: 0 },
  }

  constructor(radius: number, height: number, y: number, taperTop = 1.0) {
    const geo = new THREE.CylinderGeometry(radius * taperTop, radius, height, 96, 1, true)
    geo.translate(0, y, 0)
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec3 vLocal;
        void main() {
          vLocal = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float uFrom; uniform float uTo; uniform float uOn;
        varying vec3 vLocal;
        void main() {
          float a = atan(vLocal.x, vLocal.z);
          float span = uTo - uFrom;
          float d = mod(a - uFrom, 6.2831853);
          float inside = step(d, span) * step(0.0, span);
          float tip = smoothstep(span, span - 0.22, d);
          float alpha = inside * uOn * (0.55 + 0.45 * tip);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(0.10, 0.07, 0.05, alpha);
        }`,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.renderOrder = 3
    this.mesh.name = 'separation-line'
    this.mesh.visible = false
  }

  reset() {
    this.uniforms.uFrom.value = 0
    this.uniforms.uTo.value = 0
    this.uniforms.uOn.value = 0
    this.mesh.visible = false
  }

  /** Reveal from a starting azimuth through `span` radians. */
  set(from: number, span: number) {
    this.uniforms.uFrom.value = from
    this.uniforms.uTo.value = from + Math.min(Math.PI * 2, Math.max(0, span))
    this.uniforms.uOn.value = 1
    this.mesh.visible = span > 0.001
  }
}
