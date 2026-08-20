// ---------------------------------------------------------------------------
// 環境マップ。画像を読み込まず、小さな手続きシーンから PMREM を焼く。
// 厚いガラスの反射・氷・金属の説得力はほぼこれで決まる。
// ---------------------------------------------------------------------------
import * as THREE from '../vendor/three/three.module.min.js';

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;

const SKY_FS = /* glsl */`
varying vec3 vDir;
uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunColor;
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col;
  if (h > 0.0) {
    col = mix(uHorizon, uZenith, pow(clamp(h,0.0,1.0), 0.55));
  } else {
    col = mix(uHorizon, uGround, pow(clamp(-h,0.0,1.0), 0.35));
  }
  // 太陽まわりのにじみ
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(s, 12.0) * 0.9 + pow(s, 220.0) * 26.0);
  gl_FragColor = vec4(col, 1.0);
}`;

export const SUN_DIR = new THREE.Vector3(0.42, 0.78, -0.46).normalize();

export function buildEnvironment(renderer) {
  const envScene = new THREE.Scene();

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(12, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: SKY_VS,
      fragmentShader: SKY_FS,
      uniforms: {
        uZenith:   { value: new THREE.Color(0x2f6fc0).multiplyScalar(1.05) },
        uHorizon:  { value: new THREE.Color(0xcfe2ef).multiplyScalar(1.35) },
        uGround:   { value: new THREE.Color(0x8a7c5e).multiplyScalar(0.75) },
        uSunDir:   { value: SUN_DIR.clone() },
        uSunColor: { value: new THREE.Color(0xfff2d0) },
      },
    }),
  );
  envScene.add(sky);

  // 木立の照り返し（緑）と縁台の照り返し（暖色）
  const patch = (color, pos, scale, intensity) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }),
    );
    m.position.copy(pos); m.scale.copy(scale);
    envScene.add(m);
  };
  patch(0x4e7a3a, new THREE.Vector3(-6, 1.2, -5), new THREE.Vector3(4, 2.2, 2), 0.55);
  patch(0x3f6a34, new THREE.Vector3(5.5, 1.6, -6), new THREE.Vector3(3.4, 2.6, 2), 0.5);
  patch(0xa08a70, new THREE.Vector3(0, -1.6, 0), new THREE.Vector3(9, 0.4, 9), 0.72);
  patch(0xc23a30, new THREE.Vector3(-4.5, 2.4, 6), new THREE.Vector3(2.4, 1.0, 0.4), 0.42); // 暖簾
  patch(0xfff6dd, new THREE.Vector3(SUN_DIR.x * 9, SUN_DIR.y * 9, SUN_DIR.z * 9), new THREE.Vector3(1.5, 1.5, 1.5), 22);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(envScene, 0.02, 0.5, 40);
  pmrem.dispose();
  sky.geometry.dispose();
  sky.material.dispose();
  return target.texture;
}
