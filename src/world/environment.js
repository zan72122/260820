/**
 * The beach.
 *
 * Detail budget: everything here is background. Sand is a tiling detail
 * material on a gently undulating plane, the sea is a vertex-displaced shader
 * (no fluid simulation), distant people and the breakwater are simplified
 * geometry with no shadow casting.
 */
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { makeSandMaps, makeSheetMaps, makeFoamTexture, makeBlobAlpha, makeRng } from '../textures.js';

export const SHORE_Z = -15.5;      // where dry sand turns into wet sand
export const SEA_LEVEL = -0.16;

/** Beach profile: flat where the game is played, dipping into the sea. */
export function sandHeight(x, z) {
  // 1 out at sea, 0 up the dry beach
  const dip = 1 - THREE.MathUtils.smoothstep(z, SHORE_Z - 7.0, SHORE_Z + 3.0);
  // only long dunes live in the height field; ripples are a normal map, and the
  // play area itself stays flat so props sit cleanly on it
  const dune = Math.sin(x * 0.06) * 0.09 + Math.sin(z * 0.05 + 1.3) * 0.07;
  const far = THREE.MathUtils.smoothstep(Math.abs(z), 9, 42);
  return -dip * 1.15 + dune * far;
}

export function buildEnvironment(scene, renderer, quality) {
  const group = new THREE.Group();
  scene.add(group);

  /* ---------------- sky + sun ---------------- */
  const sky = new Sky();
  sky.scale.setScalar(20000);
  const u = sky.material.uniforms;
  u.turbidity.value = 2.4;
  u.rayleigh.value = 2.85;
  u.mieCoefficient.value = 0.0035;
  u.mieDirectionalG.value = 0.82;
  if (u.cloudCoverage) {
    u.cloudCoverage.value = 0.42;      // fair-weather summer cumulus
    u.cloudDensity.value = 0.55;
    u.cloudScale.value = 0.00016;
    u.cloudSpeed.value = 0.00004;
    u.cloudElevation.value = 0.34;
  }
  // early afternoon, high summer sun
  const elevation = THREE.MathUtils.degToRad(54);
  const azimuth = THREE.MathUtils.degToRad(146);
  const sunDir = new THREE.Vector3(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth),
  );
  u.sunPosition.value.copy(sunDir);
  group.add(sky);

  // sky-only environment map (the sun disc would burn a hot spot into it)
  const pmrem = new THREE.PMREMGenerator(renderer);
  if (u.showSunDisc) u.showSunDisc.value = 0;
  group.remove(sky);
  const skyScene = new THREE.Scene();
  skyScene.add(sky);
  const envRT = pmrem.fromScene(skyScene, 0, 1, 30000);
  skyScene.remove(sky);
  group.add(sky);
  if (u.showSunDisc) u.showSunDisc.value = 1;
  scene.environment = envRT.texture;
  // low on purpose: the Preetham sky is very bright, and at a higher weight
  // it flattens the sand to grey and washes the sun shadows out entirely
  scene.environmentIntensity = 0.16;
  pmrem.dispose();

  /* ---------------- lights ---------------- */
  const sun = new THREE.DirectionalLight(0xfff2d8, 3.30);
  sun.position.copy(sunDir).multiplyScalar(60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  // tight frustum: only the play area needs real-time shadows
  const s = 6.5;
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
  sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 20; sun.shadow.camera.far = 110;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.012;
  scene.add(sun);
  scene.add(sun.target);

  // bounce from bright sand + open sky
  // the environment map already supplies sky ambient; this only warms the underside
  const bounce = new THREE.HemisphereLight(0xa8d6f5, 0xc9b189, 0.10);
  scene.add(bounce);

  scene.fog = new THREE.Fog(0xbcd9e8, 55, 260);

  /* ---------------- sand ---------------- */
  const sandMaps = makeSandMaps(quality.sandTexture);
  const sandGeo = new THREE.PlaneGeometry(360, 360, 140, 140);
  sandGeo.rotateX(-Math.PI / 2);
  {
    const pos = sandGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, sandHeight(pos.getX(i), pos.getZ(i)));
    }
    sandGeo.computeVertexNormals();
  }
  const sandMat = new THREE.MeshStandardMaterial({
    map: sandMaps.map,
    normalMap: sandMaps.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.96,
    metalness: 0.0,
    color: 0xffffff,
  });
  // wet sand near the water: darker, glossier, faded in through vertex colours
  sandMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWet;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvWet = 1.0 - smoothstep(' + (SHORE_Z - 3.5).toFixed(2) +
        ', ' + (SHORE_Z + 2.6).toFixed(2) + ', position.z);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWet;')
      .replace('#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.52, vWet);')
      .replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.16, vWet);');
  };
  const sand = new THREE.Mesh(sandGeo, sandMat);
  sand.receiveShadow = true;
  group.add(sand);

  /* ---------------- sea ---------------- */
  const sea = buildSea(quality, sunDir);
  group.add(sea.mesh);

  const foam = buildShoreFoam(quality);
  group.add(foam.mesh);

  /* ---------------- distant scenery ---------------- */
  group.add(buildBreakwater());
  const crowd = buildDistantCrowd(quality);
  group.add(crowd.mesh);
  group.add(buildParasols());
  group.add(buildDebris(quality));

  return {
    group, sun, sky, sunDir, sand,
    update(t) {
      sea.update(t);
      foam.update(t);
      if (u.time) u.time.value = t;
    },
  };
}

/* ------------------------------------------------------------------ */

function buildSea(quality, sunDir) {
  const geo = new THREE.PlaneGeometry(600, 420, quality.seaSegments, quality.seaSegments >> 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, SHORE_Z - 205);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: sunDir.clone() },
      uDeep: { value: new THREE.Color(0x0d4a6b) },
      uShallow: { value: new THREE.Color(0x2fa5b8) },
      uSky: { value: new THREE.Color(0xa9d6ee) },
      uShore: { value: SHORE_Z },
      uFog: { value: new THREE.Color(0xbcd9e8) },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3 vW;
      varying vec3 vN;
      varying float vCrest;

      // three shallow-water sine trains standing in for a full simulation
      vec3 waveSum(vec2 p, out vec3 n){
        vec3 acc = vec3(0.0);
        vec2 dxz = vec2(0.0);
        float y = 0.0;
        // dir, wavelength, amplitude, speed
        const int N = 4;
        vec2 dirs[4]; float lens[4]; float amps[4]; float spd[4];
        dirs[0]=vec2(0.10,-1.0);  lens[0]=17.0; amps[0]=0.20; spd[0]=1.5;
        dirs[1]=vec2(0.42,-0.92); lens[1]=8.5;  amps[1]=0.11; spd[1]=1.9;
        dirs[2]=vec2(-0.35,-1.0); lens[2]=4.1;  amps[2]=0.055;spd[2]=2.4;
        dirs[3]=vec2(0.85,-0.42); lens[3]=2.05; amps[3]=0.022;spd[3]=3.1;
        for(int i=0;i<N;i++){
          vec2 d = normalize(dirs[i]);
          float k = 6.28318 / lens[i];
          float ph = dot(d, p) * k + uTime * spd[i];
          y += sin(ph) * amps[i];
          dxz += d * cos(ph) * amps[i] * k;
        }
        n = normalize(vec3(-dxz.x, 1.0, -dxz.y));
        acc.y = y;
        return acc;
      }

      void main(){
        vec3 p = position;
        vec3 n;
        vec3 w = waveSum(p.xz, n);
        p.y += w.y;
        vN = n;
        vCrest = smoothstep(0.06, 0.24, w.y);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uSun, uDeep, uShallow, uSky, uFog;
      uniform float uShore;
      varying vec3 vW; varying vec3 vN; varying float vCrest;

      void main(){
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vN);
        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);

        float shallow = smoothstep(uShore - 42.0, uShore + 2.0, vW.z);
        vec3 body = mix(uDeep, uShallow, shallow * 0.92 + 0.08);
        vec3 col = mix(body, uSky, clamp(fres, 0.0, 0.85));

        // sun glitter
        vec3 H = normalize(uSun + V);
        float spec = pow(max(dot(N, H), 0.0), 220.0) * 1.6
                   + pow(max(dot(N, H), 0.0), 26.0) * 0.16;
        col += vec3(1.0, 0.96, 0.86) * spec;

        // white water on the crests, thicker as the swell reaches the shore
        col = mix(col, vec3(0.95, 0.98, 1.0), vCrest * (0.10 + shallow * 0.55));

        float d = length(cameraPosition - vW);
        col = mix(col, uFog, smoothstep(55.0, 260.0, d));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = SEA_LEVEL;
  mesh.renderOrder = -1;
  return { mesh, update: (t) => { mat.uniforms.uTime.value = t; } };
}

/** Breaking foam sliding up and down the wet sand. */
function buildShoreFoam(quality) {
  const tex = makeFoamTexture(quality.foamTexture);
  const geo = new THREE.PlaneGeometry(340, 15, 90, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uTex: { value: tex } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vW;
      uniform float uTime;
      void main(){
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.x * 0.06 + uTime * 0.7) * 1.6;
        vec4 wp = modelMatrix * vec4(p,1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uTex; uniform float uTime;
      varying vec2 vUv; varying vec3 vW;
      void main(){
        vec2 uv1 = vUv * vec2(14.0, 1.0) + vec2(uTime * 0.012, uTime * 0.05);
        vec2 uv2 = vUv * vec2(7.0, 0.7) - vec2(uTime * 0.008, uTime * 0.03);
        float a = texture2D(uTex, uv1).a * texture2D(uTex, uv2).a * 2.6;
        // the swash line advances and retreats
        float edge = 0.5 + sin(uTime * 0.42) * 0.16;
        a *= (1.0 - smoothstep(edge, edge + 0.42, vUv.y)) * smoothstep(edge - 0.5, edge - 0.16, vUv.y);
        float d = length(cameraPosition - vW);
        a *= 1.0 - smoothstep(90.0, 240.0, d);
        gl_FragColor = vec4(vec3(0.98, 0.99, 1.0), clamp(a, 0.0, 0.92));
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, SEA_LEVEL + 0.05, SHORE_Z - 0.6);
  mesh.renderOrder = 1;
  return { mesh, update: (t) => { mat.uniforms.uTime.value = t; } };
}

/** Concrete blocks and a low jetty far down the beach. */
function buildBreakwater() {
  const g = new THREE.Group();
  const rng = makeRng(4242);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8f8b82, roughness: 0.95 });
  const box = new THREE.BoxGeometry(1, 1, 1);

  // a low breakwater running out into the water; the blocks sit half submerged
  const jetty = new THREE.Mesh(box, mat);
  jetty.position.set(-62, SEA_LEVEL + 0.55, SHORE_Z - 34);
  jetty.scale.set(5, 1.6, 66);
  jetty.rotation.y = 0.06;
  g.add(jetty);

  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(box, mat);
    const t = i / 25;
    m.position.set(
      -62 + (rng() - 0.5) * 8,
      SEA_LEVEL + 0.15 + rng() * 0.5,
      SHORE_Z - 6 - t * 60 + (rng() - 0.5) * 4,
    );
    const sc = 1.4 + rng() * 1.5;
    m.scale.set(sc, sc * 0.8, sc);
    m.rotation.set(rng() * 0.5, rng() * 3.14, rng() * 0.5);
    g.add(m);
  }

  // hazy headland closing the bay
  const hill = new THREE.Mesh(
    new THREE.SphereGeometry(46, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x7d9a86, roughness: 1, fog: true }),
  );
  hill.position.set(120, -6, SHORE_Z - 175);
  hill.scale.set(2.4, 0.55, 1.2);
  g.add(hill);

  return g;
}

/** Far-away beachgoers: instanced, unlit detail, no shadows. */
function buildDistantCrowd(quality) {
  const rng = makeRng(909);
  const n = quality.crowdCount;
  const geo = new THREE.CapsuleGeometry(0.19, 0.85, 3, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8b79a, roughness: 0.9 });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const dummy = new THREE.Object3D();
  const colors = [0xe8695e, 0x4a86c8, 0xf2d34e, 0xffffff, 0x59b479, 0xf09ac0];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = 22 + rng() * 60;
    const x = Math.cos(a) * r;
    const z = SHORE_Z + 4 - Math.abs(Math.sin(a)) * r * 0.7;
    dummy.position.set(x, sandHeight(x, z) + 0.62, z);
    dummy.rotation.y = rng() * 6.28;
    const sc = 0.85 + rng() * 0.35;
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, new THREE.Color(colors[(rng() * colors.length) | 0]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return { mesh };
}

function buildParasols() {
  const g = new THREE.Group();
  const rng = makeRng(77);
  const poleGeo = new THREE.CylinderGeometry(0.022, 0.022, 2.0, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.5, metalness: 0.5 });
  const canopyGeo = new THREE.ConeGeometry(1.35, 0.5, 12, 1, true);
  const cols = [0xe95f4e, 0x3fa9d8, 0xf6c83a];
  const spots = [[-7.5, -6.0], [8.2, -7.4], [-11.5, 1.6]];
  spots.forEach((p, i) => {
    const sub = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.0;
    const canopy = new THREE.Mesh(canopyGeo, new THREE.MeshStandardMaterial({
      color: cols[i % cols.length], roughness: 0.85, side: THREE.DoubleSide,
    }));
    canopy.position.y = 1.95;
    canopy.castShadow = false;
    sub.add(pole, canopy);
    sub.position.set(p[0], sandHeight(p[0], p[1]), p[1]);
    sub.rotation.z = (rng() - 0.5) * 0.12;
    g.add(sub);
  });
  return g;
}

/** A handful of near-camera shells and pebbles — sand is never per-grain. */
function buildDebris(quality) {
  const rng = makeRng(31337);
  const g = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mats = [
    new THREE.MeshStandardMaterial({ color: 0xefe7d6, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: 0xb9a88d, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xd6cbb4, roughness: 0.75 }),
  ];
  const mesh = new THREE.InstancedMesh(geo, mats[0], quality.debrisCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < quality.debrisCount; i++) {
    const a = rng() * Math.PI * 2;
    const r = 1.2 + rng() * 7;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const sc = 0.008 + rng() * 0.022;
    dummy.position.set(x, sandHeight(x, z) + sc * 0.35, z);
    dummy.rotation.set(rng() * 6.28, rng() * 6.28, rng() * 6.28);
    dummy.scale.set(sc, sc * 0.6, sc);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, new THREE.Color(mats[(rng() * 3) | 0].color));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

/** The picnic sheet the melon is set down on. */
export function buildSheet(quality) {
  const maps = makeSheetMaps(quality.sheetTexture);
  const geo = new THREE.PlaneGeometry(1.9, 1.5, 26, 20);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const rng = makeRng(5150);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const edge = Math.max(Math.abs(x) / 0.95, Math.abs(z) / 0.75);
    // creases in the middle, lifted corners at the rim
    const h = Math.sin(x * 6.1) * 0.004 + Math.sin(z * 5.3 + 1.1) * 0.004
      + Math.pow(edge, 5) * 0.035 + rng() * 0.002;
    pos.setY(i, h);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: maps.map, normalMap: maps.normalMap,
    roughness: 0.62, metalness: 0.0, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** Soft darkening right under a prop — cheap contact occlusion. */
export function contactShadow(radius = 0.3, opacity = 0.5) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity,
    alphaMap: makeBlobAlpha(128, 0.7), depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}
