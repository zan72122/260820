import {
  BackSide, BoxGeometry, Color, Mesh, MeshBasicMaterial, PMREMGenerator,
  Scene, ShaderMaterial, SphereGeometry, Texture, WebGLRenderer,
} from 'three';

/**
 * A procedural workshop environment baked to a PMREM cubemap.
 *
 * The crystals live or die on their reflections, and shipping an HDR file would
 * cost load time on cellular. A tiny hand-built scene — warm window, cool fill,
 * dark wood floor — gives them something believable to reflect for ~0 bytes.
 */
export function buildEnvironment(renderer: WebGLRenderer): Texture {
  const scene = new Scene();

  const sky = new Mesh(
    new SphereGeometry(12, 24, 16),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          float y = vDir.y * 0.5 + 0.5;
          vec3 floorC = vec3(0.055, 0.040, 0.030);
          vec3 midC   = vec3(0.130, 0.110, 0.100);
          vec3 topC   = vec3(0.180, 0.190, 0.225);
          vec3 c = mix(floorC, midC, smoothstep(0.0, 0.5, y));
          c = mix(c, topC, smoothstep(0.5, 1.0, y));
          // faint warm bounce from the bench, front-left
          c += vec3(0.10, 0.062, 0.030) * pow(max(0.0, dot(vDir, normalize(vec3(-0.5, -0.35, 0.8)))), 3.0);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(sky);

  const light = (w: number, h: number, d: number, color: number, intensity: number,
                 x: number, y: number, z: number) => {
    const m = new Mesh(
      new BoxGeometry(w, h, d),
      new MeshBasicMaterial({ color: new Color(color).multiplyScalar(intensity) }),
    );
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };

  // Warm window, upper-left — the key light the whole scene is lit by.
  light(3.4, 4.6, 0.1, 0xfff0d2, 7.0, -6.4, 4.2, -2.0);
  // Cool sky fill from the right so wet stone reads as wet, not just dark.
  light(5.0, 3.0, 0.1, 0xbcd6ff, 1.35, 6.6, 3.0, 1.2);
  // Low warm bounce off the bench for the underside of the crystals.
  light(6.0, 0.1, 6.0, 0xffc98a, 0.55, 0, -3.2, 0);
  // Two small speculars so facets get discrete glints instead of a smear.
  light(0.55, 0.55, 0.1, 0xffffff, 16.0, -2.4, 5.4, 3.2);
  light(0.4, 0.4, 0.1, 0xdff0ff, 9.0, 3.6, 4.8, -3.4);

  const pmrem = new PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromScene(scene, 0.035, 0.1, 40);
  pmrem.dispose();

  sky.geometry.dispose();
  (sky.material as ShaderMaterial).dispose();
  scene.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && m !== sky) {
      m.geometry.dispose();
      (m.material as MeshBasicMaterial).dispose();
    }
  });

  return rt.texture;
}
