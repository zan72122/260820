import * as THREE from 'three';

/**
 * Autumn afternoon sky used both as a visible dome and as the IBL source.
 * A gradient + a soft sun disc is enough to key the whole palette; a real
 * HDR file would cost a download we do not need on a phone.
 */
const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const skyFrag = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uSunDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunColor;
  uniform float uIntensity;

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.62));
    // haze thickens toward the horizon: this is what sells depth on the far rows
    col = mix(col, uGround, clamp(-h * 3.0, 0.0, 1.0));
    float sd = max(dot(d, normalize(uSunDir)), 0.0);
    col += uSunColor * pow(sd, 420.0) * 6.0;          // disc
    col += uSunColor * pow(sd, 8.0) * 0.30;           // forward scatter
    col += uSunColor * pow(sd, 2.0) * 0.06;
    // thin high cloud, just enough to break a flat gradient
    float band = smoothstep(0.02, 0.30, h) * (1.0 - smoothstep(0.30, 0.85, h));
    float c = sin(d.x * 7.0 + d.z * 3.0) * 0.5 + 0.5;
    c *= sin(d.z * 11.0 - d.x * 5.0) * 0.5 + 0.5;
    col += vec3(0.16, 0.15, 0.14) * band * smoothstep(0.45, 1.0, c);
    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`;

export type SkyResult = {
  sky: THREE.Mesh;
  envMap: THREE.Texture;
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
};

export function buildSky(renderer: THREE.WebGLRenderer): SkyResult {
  const sunDir = new THREE.Vector3(-0.62, 0.58, -0.53).normalize();
  const sunColor = new THREE.Color(0xffe9c9);

  const mat = new THREE.ShaderMaterial({
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSunDir: { value: sunDir.clone() },
      uZenith: { value: new THREE.Color(0x5a8fcb) },
      uHorizon: { value: new THREE.Color(0xd2d5c9) },
      uGround: { value: new THREE.Color(0x9a9382) },
      uSunColor: { value: sunColor.clone() },
      uIntensity: { value: 1.0 },
    },
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), mat);
  sky.name = 'sky';
  sky.frustumCulled = false;

  // Render the same dome once into a PMREM so materials get matching ambient.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(sky.geometry, mat.clone());
  (envSky.material as THREE.ShaderMaterial).uniforms.uIntensity.value = 2.1;
  envScene.add(envSky);
  const rt = pmrem.fromScene(envScene, 0.04);
  const envMap = rt.texture;
  pmrem.dispose();
  envSky.geometry = sky.geometry;

  return { sky, envMap, sunDir, sunColor };
}
