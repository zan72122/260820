import * as THREE from 'three';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize( position );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
void main() {
  float h = vDir.y;
  vec3 col = mix( uHorizon, uTop, pow( clamp( h, 0.0, 1.0 ), 0.62 ) );
  col = mix( col, uGround, smoothstep( 0.0, -0.16, h ) );
  float sun = max( dot( normalize( vDir ), uSunDir ), 0.0 );
  col += uSunColor * pow( sun, 220.0 ) * 1.5;
  col += uSunColor * pow( sun, 7.0 ) * 0.16;
  gl_FragColor = vec4( col, 1.0 );
  #include <colorspace_fragment>
}`;

export interface SkyRig {
  mesh: THREE.Mesh;
  /** miniature copy of the sky, for baking an environment map */
  envScene: THREE.Scene;
  sun: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  fogColor: THREE.Color;
}

export function buildSky(scene: THREE.Scene): SkyRig {
  const sunDir = new THREE.Vector3(-0.42, 0.6, 0.68).normalize();
  const fogColor = new THREE.Color(0xc3cfd1);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(0x4e86bd) },
      uHorizon: { value: new THREE.Color(0xd6dcd6) },
      uGround: { value: new THREE.Color(0x8c8672) },
      uSunDir: { value: sunDir },
      uSunColor: { value: new THREE.Color(0xfff0d2) },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  scene.add(mesh);

  const envScene = new THREE.Scene();
  const envSphere = new THREE.Mesh(new THREE.SphereGeometry(8, 20, 14), mat);
  envScene.add(envSphere);
  // a warm ground bounce card so downward-facing surfaces are not lit by sky alone
  const bounce = new THREE.Mesh(
    new THREE.SphereGeometry(7.5, 16, 10, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48),
    new THREE.MeshBasicMaterial({ color: 0x9a8262, side: THREE.BackSide }),
  );
  envScene.add(bounce);

  scene.fog = new THREE.Fog(fogColor, 24, 150);

  const sun = new THREE.DirectionalLight(0xfff3de, 2.9);
  sun.position.copy(sunDir).multiplyScalar(30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 46;
  sun.shadow.camera.left = -4.2;
  sun.shadow.camera.right = 4.2;
  sun.shadow.camera.top = 4.2;
  sun.shadow.camera.bottom = -4.2;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.022;
  scene.add(sun);
  scene.add(sun.target);

  // cool bounce from the camera side so the white root never goes to silhouette
  const fill = new THREE.DirectionalLight(0xd6e6f2, 0.5);
  fill.position.set(9, 5, -8);
  scene.add(fill);

  const hemi = new THREE.HemisphereLight(0xc7dcec, 0x7a6142, 0.55);
  scene.add(hemi);

  return { mesh, envScene, sun, fill, hemi, fogColor };
}

/** Keep the shadow frustum tight around the machine — the field is far too big to cover. */
export function followShadow(rig: SkyRig, focus: THREE.Vector3) {
  rig.sun.target.position.copy(focus);
  rig.sun.position.copy(focus).add(new THREE.Vector3(-0.42, 0.6, 0.68).multiplyScalar(22));
  rig.sun.target.updateMatrixWorld();
  rig.mesh.position.set(focus.x, 0, focus.z);
}
