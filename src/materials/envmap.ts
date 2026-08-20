import * as THREE from 'three';

/**
 * Procedural environment.
 *
 * The pavilion is half-outdoor, so metal and water need something real to
 * reflect: bright sky above, warm practical lights under the roof, dull earth
 * below. We build a tiny scene describing exactly that and pre-filter it once
 * with PMREM, then reuse the result as `scene.environment` for the whole
 * session — no HDR download, no per-frame cost.
 */

const SKY_ZENITH = new THREE.Color(0x7d9dc4);
const SKY_HORIZON = new THREE.Color(0xd8d2c4);
const EARTH = new THREE.Color(0x5c554a);

const skyVert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFrag = /* glsl */ `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 earth;
  uniform vec3 sunDir;
  varying vec3 vWorld;

  void main() {
    vec3 dir = normalize(vWorld);
    float h = dir.y;
    // Tight band at the horizon, slow falloff into the zenith.
    float up = smoothstep(0.0, 0.62, h);
    vec3 sky = mix(horizon, zenith, up);
    float down = smoothstep(0.0, -0.22, h);
    sky = mix(sky, earth, down);
    // A broad, hazy sun disc — an overcast-bright day rather than a hard sun.
    float sun = pow(max(dot(dir, normalize(sunDir)), 0.0), 220.0);
    float glow = pow(max(dot(dir, normalize(sunDir)), 0.0), 6.0);
    sky += vec3(1.0, 0.94, 0.82) * (sun * 3.2 + glow * 0.22);
    gl_FragColor = vec4(sky, 1.0);
  }
`;

export const SUN_DIRECTION = new THREE.Vector3(-0.42, 0.78, 0.46).normalize();

/** The visible background dome. Kept separate from the PMREM source scene. */
export function createSkyDome() {
  const geo = new THREE.SphereGeometry(90, 32, 20);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      zenith: { value: SKY_ZENITH.clone() },
      horizon: { value: SKY_HORIZON.clone() },
      earth: { value: EARTH.clone() },
      sunDir: { value: SUN_DIRECTION.clone() },
    },
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky';
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * Build the pre-filtered environment map. Runs once at boot; the intermediate
 * scene and its geometry are disposed immediately afterwards.
 */
export function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const src = new THREE.Scene();
  const dome = createSkyDome();
  dome.scale.setScalar(0.1);
  src.add(dome);

  const disposables: Array<THREE.BufferGeometry | THREE.Material> = [
    dome.geometry,
    dome.material as THREE.Material,
  ];

  const addPanel = (
    w: number,
    h: number,
    color: number,
    intensity: number,
    pos: [number, number, number],
    rot: [number, number, number]
  ) => {
    const g = new THREE.PlaneGeometry(w, h);
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    m.color.multiplyScalar(intensity);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    src.add(mesh);
    disposables.push(g, m);
  };

  // Roof plane overhead: blocks the sky directly above and re-emits a dimmer,
  // warmer bounce, which is what gives the metals their horizontal banding.
  addPanel(9, 9, 0xb4a893, 0.34, [0, 3.4, 0], [Math.PI / 2, 0, 0]);
  // Two practical strip lights under the roof.
  addPanel(3.4, 0.28, 0xfff0d6, 3.0, [0, 3.25, -1.1], [Math.PI / 2, 0, 0]);
  addPanel(3.4, 0.28, 0xfff0d6, 3.0, [0, 3.25, 1.1], [Math.PI / 2, 0, 0]);
  // Ground bounce: dry earth returning warm light into the underside of things.
  addPanel(26, 26, 0x6d6252, 0.5, [0, -0.9, 0], [-Math.PI / 2, 0, 0]);
  // A back wall keeps one side of every metal ball dark, so its form reads.
  addPanel(9, 3.6, 0x5d5750, 0.42, [0, 1.4, -4.4], [0, 0, 0]);

  const target = pmrem.fromScene(src, 0.02);
  const texture = target.texture;

  for (const d of disposables) d.dispose();
  pmrem.dispose();

  return texture;
}
