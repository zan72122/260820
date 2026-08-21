import * as THREE from 'three';

export interface EnvRig {
  envMap: THREE.Texture;
  sky: THREE.Mesh;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  sunDir: THREE.Vector3;
  dispose(): void;
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const SKY_FRAG = /* glsl */ `
precision mediump float;
varying vec3 vDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col;
  if (h >= 0.0) {
    float k = pow(clamp(h, 0.0, 1.0), 0.62);
    col = mix(uHorizon, uZenith, k);
  } else {
    float k = pow(clamp(-h * 2.2, 0.0, 1.0), 0.7);
    col = mix(uHorizon, uGround, k);
  }
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * pow(sd, 26.0) * 0.85;
  col += uSunColor * pow(sd, 4.0) * 0.16;
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Builds the dawn sky and derives image based lighting from it.
 *
 * All lighting comes from this prefiltered probe plus one warm key light; there
 * are no shadow maps in the default profile, which is the cheapest way to keep a
 * phone GPU inside its budget while still reading as a real morning.
 */
export function buildEnvironment(renderer: THREE.WebGLRenderer): EnvRig {
  const sunDir = new THREE.Vector3(-0.42, 0.3, 0.86).normalize();

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x2f6f9c).convertSRGBToLinear() },
      uHorizon: { value: new THREE.Color(0xf7c093).convertSRGBToLinear() },
      uGround: { value: new THREE.Color(0x4a4f55).convertSRGBToLinear() },
      uSunDir: { value: sunDir.clone() },
      uSunColor: { value: new THREE.Color(0xffd9a0).convertSRGBToLinear() },
    },
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 20), skyMat);
  sky.name = 'sky';
  sky.frustumCulled = false;

  // Probe scene: the same sky plus a bounce card standing in for the wet deck.
  const probeScene = new THREE.Scene();
  const probeSky = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), skyMat.clone());
  probeScene.add(probeSky);
  const bounce = new THREE.Mesh(
    new THREE.CircleGeometry(38, 24),
    new THREE.MeshBasicMaterial({ color: 0x9fb0ae, side: THREE.DoubleSide }),
  );
  bounce.rotation.x = -Math.PI / 2;
  bounce.position.y = -3.2;
  probeScene.add(bounce);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromScene(probeScene, 0.02, 0.5, 120);
  const envMap = target.texture;
  pmrem.dispose();
  probeSky.geometry.dispose();
  (probeSky.material as THREE.Material).dispose();
  bounce.geometry.dispose();
  (bounce.material as THREE.Material).dispose();

  const sun = new THREE.DirectionalLight(0xffe0b4, 2.1);
  sun.position.copy(sunDir).multiplyScalar(60);
  sun.target.position.set(0, 0, 20);

  const hemi = new THREE.HemisphereLight(0xbfe4f7, 0x6d6257, 0.5);

  return {
    envMap,
    sky,
    sun,
    hemi,
    sunDir,
    dispose(): void {
      target.dispose();
      sky.geometry.dispose();
      skyMat.dispose();
    },
  };
}
