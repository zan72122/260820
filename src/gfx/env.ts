import * as THREE from 'three';

/**
 * Soft morning light just after rain: high thin cloud, a bright but diffuse
 * sun patch, and a damp earth-toned ground bounce. Rendered once into a
 * PMREM so every PBR material gets real environment reflection.
 */
const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uSunDir;

float hash(vec3 p){ p = fract(p*0.3183099+vec3(0.71,0.113,0.419)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                 mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                 mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=0.5;} return s; }

void main() {
  vec3 d = normalize(vDir);
  float up = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);

  // damp overcast gradient: cool zenith -> pale warm horizon
  vec3 zenith  = vec3(0.42, 0.52, 0.64);
  vec3 horizon = vec3(0.76, 0.755, 0.72);
  vec3 ground  = vec3(0.20, 0.175, 0.148);

  vec3 col = mix(horizon, zenith, pow(clamp(d.y, 0.0, 1.0), 0.62));
  col = mix(col, ground, smoothstep(0.02, -0.28, d.y));

  // broken cloud so reflections get structure instead of a flat dome
  float cl = fbm(d * 3.1 + vec3(0.0, 1.7, 0.0));
  cl = smoothstep(0.35, 0.85, cl) * smoothstep(-0.05, 0.35, d.y);
  col = mix(col, vec3(0.93, 0.93, 0.92), cl * 0.5);

  // diffuse sun disc glowing through the cloud deck
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += vec3(1.0, 0.92, 0.78) * pow(sd, 26.0) * 2.6;
  col += vec3(0.95, 0.88, 0.76) * pow(sd, 4.0) * 0.32;

  gl_FragColor = vec4(col, 1.0);
}
`;

export function buildEnvironment(renderer: THREE.WebGLRenderer, sunDir: THREE.Vector3) {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: { uSunDir: { value: sunDir.clone().normalize() } },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 24), mat);
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromScene(scene, 0.02, 0.1, 200);
  pmrem.dispose();
  sky.geometry.dispose();
  mat.dispose();

  // A visible backdrop dome (cheap, no post) so the horizon is not black.
  const domeMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: { uSunDir: { value: sunDir.clone().normalize() } },
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: true,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 18), domeMat);
  dome.frustumCulled = false;

  return { envMap: rt.texture, dome };
}
