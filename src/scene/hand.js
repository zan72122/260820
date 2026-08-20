import * as THREE from 'three';
import { NOISE3, SCENE_LIGHT } from '../gfx/glsl.js';
import { tubeGeometry, blobGeometry, mergeAll } from './geo.js';

// An adult's hand, generated from a handful of curves.
//
// Almost all of it is out of frame and in darkness. What has to be right is the
// two fingertips pinching the cord: their silhouette, the way the bead lights
// them from below, and the fact that a fingertip a centimetre from a burning
// bead glows red *through* the skin. That last one is the detail that makes a
// hand look alive rather than modelled.

const VERT = /* glsl */ `
attribute float thin;
varying vec3 vNormalW;
varying vec3 vPosW;
varying float vThin;
void main(){
  vThin = thin;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vPosW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAG = /* glsl */ `
precision highp float;
${NOISE3}
${SCENE_LIGHT}

uniform vec3 uSkin;
uniform vec3 uSkinTip;
uniform float uRough;
uniform float uDetail;
uniform float uSpecular;
uniform float uSSS;

varying vec3 vNormalW;
varying vec3 vPosW;
varying float vThin;

float ggx(vec3 n, vec3 v, vec3 l, float rough){
  vec3 h = normalize(v + l);
  float a = max(rough * rough, 1e-3);
  float ndh = max(dot(n, h), 0.0);
  float ndv = max(dot(n, v), 1e-4);
  float ndl = max(dot(n, l), 0.0);
  float a2 = a * a;
  float d = ndh * ndh * (a2 - 1.0) + 1.0;
  d = a2 / (3.14159265 * d * d);
  float k = a * 0.5;
  float gv = ndv / (ndv * (1.0 - k) + k);
  float gl = ndl / (ndl * (1.0 - k) + k);
  return d * gv * gl / (4.0 * ndv * max(ndl, 1e-4)) * ndl;
}

void main(){
  vec3 n = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);

  // Micro-relief: pores and fine creases at roughly a millimetre.
  float micro = 0.0;
  if (uDetail > 0.5) {
    // ~2mm features at a fingertip that is a couple of centimetres across.
    // The noise is squashed along the finger, which turns it into the fine
    // transverse creases skin actually has instead of generic bumpiness.
    vec3 q = vPosW * vec3(300.0, 820.0, 300.0);
    float e = 0.75;
    float c = fbm3(q, 2);
    float gx = fbm3(q + vec3(e, 0.0, 0.0), 2) - c;
    float gy = fbm3(q + vec3(0.0, e, 0.0), 2) - c;
    float gz = fbm3(q + vec3(0.0, 0.0, e), 2) - c;
    n = normalize(n - vec3(gx, gy, gz) * 0.42 * uDetail);
    micro = c;
  }

  // Fingertips run redder than the back of the hand.
  vec3 albedo = mix(uSkin, uSkinTip, clamp(vThin, 0.0, 1.0));
  float blotch = fbm3(vPosW * 34.0, 2);
  albedo *= 0.90 + blotch * 0.20;
  albedo *= 0.96 + micro * 0.08;

  vec3 toEmber = uEmberPos - vPosW;
  float d = length(toEmber);
  vec3 L = toEmber / max(d, 1e-5);
  float atten = emberFalloff(d);

  vec3 lit = albedo * hemisphere(n);
  lit += albedo * uKeyColor * wrapDiffuse(n, uKeyDir, 0.7);
  lit += albedo * uEmberColor * wrapDiffuse(n, L, 0.35) * atten;

  // Subsurface. A fingertip held over an ember glows at its edges because the
  // light is coming through it, not off it.
  float back = pow(clamp(dot(-V, L) * 0.5 + 0.5, 0.0, 1.0), 3.0);
  float edge = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 1.7);
  float through = (back * 0.75 + edge * 0.55) * clamp(vThin, 0.0, 1.0);
  lit += vec3(1.0, 0.26, 0.10) * uEmberColor * through * atten * uSSS;

  // Skin is never matte: a broad, slightly oily highlight.
  float rough = clamp(uRough + (micro - 0.5) * 0.22, 0.08, 0.95);
  float spec = ggx(n, V, L, rough) * atten * uSpecular;
  spec += ggx(n, V, normalize(uKeyDir), rough) * 0.9;
  lit += uEmberColor * spec;

  gl_FragColor = vec4(lit, 1.0);
}
`;

function curve(points) {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.4);
}

// Fingers taper toward the tip and bulge a little at the joints.
function fingerRadius(base, tipScale) {
  const CAP = 0.075;
  return (t) => {
    const taper = tipScale + (1 - tipScale) * Math.pow(t, 0.75);
    const joints =
      Math.exp(-Math.pow((t - 0.30) / 0.10, 2)) * 0.055 +
      Math.exp(-Math.pow((t - 0.62) / 0.11, 2)) * 0.07;
    // Round the very tip off instead of leaving an open pipe pointed at camera.
    const u = Math.min(1, t / CAP);
    const cap = Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
    return base * (taper + joints) * cap;
  };
}

export function buildHand(lightRig, detail = 1) {
  const parts = [];
  const seg = detail >= 2 ? 26 : 16;
  const radial = detail >= 2 ? 14 : 9;

  // t = 0 is the fingertip, t = 1 is where the finger meets the hand.
  const index = curve([
    [0.0062, 0.0035, 0.0055],
    [0.0098, 0.0140, 0.0080],
    [0.0122, 0.0290, 0.0140],
    [0.0136, 0.0455, 0.0225],
    [0.0140, 0.0640, 0.0300],
    [0.0138, 0.0790, 0.0345],
  ]);
  const thumb = curve([
    [-0.0058, 0.0042, 0.0088],
    [-0.0150, 0.0130, 0.0135],
    [-0.0248, 0.0250, 0.0195],
    [-0.0328, 0.0430, 0.0255],
    [-0.0352, 0.0640, 0.0302],
  ]);
  const middle = curve([
    [0.0300, 0.0300, 0.0295],
    [0.0332, 0.0300, 0.0180],
    [0.0348, 0.0410, 0.0100],
    [0.0338, 0.0560, 0.0160],
    [0.0318, 0.0720, 0.0270],
  ]);
  const ring = curve([
    [0.0452, 0.0378, 0.0300],
    [0.0486, 0.0378, 0.0205],
    [0.0498, 0.0480, 0.0135],
    [0.0486, 0.0605, 0.0195],
    [0.0462, 0.0740, 0.0288],
  ]);
  const little = curve([
    [0.0578, 0.0455, 0.0292],
    [0.0606, 0.0455, 0.0218],
    [0.0616, 0.0538, 0.0165],
    [0.0604, 0.0640, 0.0215],
    [0.0552, 0.0762, 0.0292],
  ]);

  const thinTip = (t) => Math.max(0.06, Math.pow(1 - t, 2.0));
  const thinBack = (t) => Math.max(0.05, Math.pow(1 - t, 2.4) * 0.55);

  parts.push(tubeGeometry(index, seg, radial, fingerRadius(0.0082, 0.72), thinTip));
  parts.push(tubeGeometry(thumb, seg, radial, fingerRadius(0.0105, 0.70), thinTip));
  parts.push(tubeGeometry(middle, seg, radial, fingerRadius(0.0084, 0.74), thinBack));
  parts.push(tubeGeometry(ring, seg, radial, fingerRadius(0.0079, 0.74), thinBack));
  parts.push(tubeGeometry(little, seg, radial, fingerRadius(0.0068, 0.74), thinBack));

  // Palm mass and wrist. Almost entirely out of frame; they exist so the
  // silhouette at the top edge is a hand and not five floating sausages.
  const palm = blobGeometry(0.0345, 0.0330, 0.0195, detail >= 2 ? 22 : 14, detail >= 2 ? 16 : 10, 0.1);
  palm.applyMatrix4(
    new THREE.Matrix4()
      .makeRotationX(-0.34)
      .setPosition(0.0245, 0.0855, 0.0250)
  );
  parts.push(palm);

  const thenar = blobGeometry(0.0165, 0.0235, 0.0140, 14, 10, 0.16);
  thenar.applyMatrix4(new THREE.Matrix4().makeRotationZ(0.35).setPosition(-0.0195, 0.0700, 0.0290));
  parts.push(thenar);

  const wrist = tubeGeometry(
    curve([
      [0.0230, 0.1000, 0.0245],
      [0.0215, 0.1300, 0.0225],
      [0.0200, 0.1700, 0.0200],
    ]),
    8,
    radial,
    () => 0.0268,
    () => 0.05
  );
  parts.push(wrist);

  const geometry = mergeAll(parts);
  for (const p of parts) p.dispose();

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: lightRig.bind({
      uSkin: { value: new THREE.Color(0.300, 0.176, 0.132) },
      uSkinTip: { value: new THREE.Color(0.372, 0.163, 0.124) },
      uRough: { value: 0.46 },
      uDetail: { value: detail >= 2 ? 1 : 0 },
      uSpecular: { value: 0.30 },
      uSSS: { value: 0.85 },
    }),
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;

  // Nails: two small plates, shinier and cooler than skin. At macro range a
  // single specular glint off a nail does a lot of work.
  const nailGeo = mergeAll([
    nail(0.0074, 0.0102, [0.0058, 0.0092, 0.0004], [-0.30, 0.0, -0.12]),
    nail(0.0086, 0.0106, [-0.0092, 0.0110, 0.0052], [-0.22, 0.55, 0.45]),
  ]);
  const nailMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: lightRig.bind({
      uSkin: { value: new THREE.Color(0.400, 0.270, 0.230) },
      uSkinTip: { value: new THREE.Color(0.480, 0.330, 0.290) },
      uRough: { value: 0.19 },
      uDetail: { value: 0 },
      uSpecular: { value: 1.5 },
      uSSS: { value: 0.40 },
    }),
  });
  const nails = new THREE.Mesh(nailGeo, nailMat);
  nails.frustumCulled = false;
  nails.renderOrder = 4;

  const group = new THREE.Group();
  group.add(mesh, nails);

  return {
    group,
    mesh,
    nails,
    material,
    nailMaterial: nailMat,
    setDetail(d) {
      material.uniforms.uDetail.value = d >= 2 ? 1 : 0;
    },
    dispose() {
      geometry.dispose();
      nailGeo.dispose();
      material.dispose();
      nailMat.dispose();
    },
  };
}

function nail(rx, ry, pos, rot) {
  const g = blobGeometry(rx, ry, 0.0034, 12, 8, 0.5);
  const m = new THREE.Matrix4();
  const e = new THREE.Euler(rot[0], rot[1], rot[2]);
  m.makeRotationFromEuler(e);
  m.setPosition(pos[0], pos[1], pos[2]);
  g.applyMatrix4(m);
  return g;
}
