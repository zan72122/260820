import * as THREE from 'three';
import { fbm, soilColor, soilRough, treeStrip } from './textures';
import { FIELD_L, FIELD_W } from '../game/constants';

/**
 * Sky, sun, and the three depth layers the picture is built from:
 *   near   – the worked paddy floor and its levees
 *   mid    – the neighbouring paddies, the farm track, poles and a shed
 *   far    – treeline and two mountain ridges dissolving into haze
 */
export class Environment {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  private sunTarget = new THREE.Object3D();

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    opts: { shadows: boolean; shadowMapSize: number }
  ) {
    scene.add(this.group);

    const horizon = new THREE.Color(0xb9c3c6);
    scene.fog = new THREE.Fog(horizon.getHex(), 60, 320);

    const sky = this.buildSky();
    this.group.add(sky);

    // Painted steel and chrome go black without something to reflect, so
    // bake the sky itself (plus a soil-coloured floor) into an IBL probe.
    this.buildEnvironment(scene, renderer, sky.material as THREE.ShaderMaterial);

    /* ---- light -------------------------------------------------- */
    // Late-morning autumn sun, raking from the left so the machine's
    // flank and the standing rice both get modelled by it.
    const hemi = new THREE.HemisphereLight(0xd3e3ec, 0x63563a, 1.15);
    scene.add(hemi);

    this.sun = new THREE.DirectionalLight(0xfff1d6, 3.3);
    this.sun.position.set(-28, 26, -6);
    scene.add(this.sun);
    scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;

    if (opts.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(opts.shadowMapSize, opts.shadowMapSize);
      const c = this.sun.shadow.camera;
      c.near = 1;
      c.far = 90;
      c.left = -16;
      c.right = 16;
      c.top = 16;
      c.bottom = -16;
      c.updateProjectionMatrix();
      this.sun.shadow.bias = -0.0009;
      this.sun.shadow.normalBias = 0.035;
    }

    const bounce = new THREE.DirectionalLight(0xa8bd94, 0.5);
    bounce.position.set(20, 7, 18);
    scene.add(bounce);

    /* ---- geometry ----------------------------------------------- */
    this.group.add(this.buildPaddyFloor());
    this.group.add(this.buildLevees());
    this.group.add(this.buildSurroundings());
    this.group.add(this.buildTreeline());
    this.group.add(this.buildRidges());
  }

  private buildEnvironment(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    skyMat: THREE.ShaderMaterial
  ) {
    const probe = new THREE.Scene();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), skyMat.clone());
    probe.add(dome);
    const floor = new THREE.Mesh(
      new THREE.SphereGeometry(39, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x6b6046, side: THREE.BackSide })
    );
    probe.add(floor);
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const rt = pmrem.fromScene(probe, 0.04, 1, 100);
    scene.environment = rt.texture;
    scene.environmentIntensity = 1.0;
    pmrem.dispose();
    dome.geometry.dispose();
    floor.geometry.dispose();
  }

  /** Keep the shadow frustum tight around wherever the machine is. */
  followShadow(x: number, z: number) {
    this.sun.position.set(x - 28, 26, z - 6);
    this.sunTarget.position.set(x, 0, z);
    this.sunTarget.updateMatrixWorld();
  }

  /* ------------------------------------------------------------------ */

  private buildSky(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(360, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x4d7fb5) },
        mid: { value: new THREE.Color(0xa9c2d4) },
        bottom: { value: new THREE.Color(0xc9cec4) },
        sunDir: { value: new THREE.Vector3(-28, 26, -6).normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -1.0, 1.0);
          vec3 col = h > 0.06
            ? mix(mid, top, pow(clamp((h - 0.06) / 0.94, 0.0, 1.0), 0.75))
            : mix(bottom, mid, clamp((h + 0.25) / 0.31, 0.0, 1.0));
          // broad sun haze, no hard disc: it reads as a bright autumn sky
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += vec3(1.0, 0.92, 0.74) * pow(s, 8.0) * 0.30;
          col += vec3(1.0, 0.95, 0.85) * pow(s, 64.0) * 0.55;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -1000;
    m.frustumCulled = false;
    return m;
  }

  /** The muddy floor of the paddy we are working, gently uneven. */
  private buildPaddyFloor(): THREE.Mesh {
    const pad = 6.0;
    const w = FIELD_W + pad * 2;
    const l = FIELD_L + pad * 2;
    const geo = new THREE.PlaneGeometry(w, l, 48, 60);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      // wheel-rutted, puddled ground: low frequency dish plus fine chop
      const h =
        (fbm(x * 0.06 + 5, z * 0.06 + 5, 3, 1, 3) - 0.5) * 0.16 +
        (fbm(x * 0.34, z * 0.34, 2, 1, 9) - 0.5) * 0.045;
      p.setY(i, h);
    }
    geo.computeVertexNormals();

    const map = soilColor().clone();
    map.repeat.set(w / 3.2, l / 3.2);
    map.needsUpdate = true;
    const rough = soilRough().clone();
    rough.repeat.copy(map.repeat);
    rough.needsUpdate = true;

    const mat = new THREE.MeshStandardMaterial({
      map,
      roughnessMap: rough,
      roughness: 1,
      metalness: 0,
      color: 0xbfb2a2,
    });
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    m.position.y = -0.01;
    return m;
  }

  /** Raised earth banks (畦) with dry grass on top — they frame the plot. */
  private buildLevees(): THREE.Group {
    const g = new THREE.Group();
    const map = soilColor().clone();
    map.repeat.set(10, 1);
    map.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 1, color: 0x9c8f7c });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x7a7a4a, roughness: 1 });

    const pad = 2.4;
    const make = (w: number, l: number, x: number, z: number) => {
      const bank = new THREE.Mesh(new THREE.BoxGeometry(w, 0.34, l), mat);
      bank.position.set(x, 0.14, z);
      bank.receiveShadow = true;
      bank.castShadow = true;
      g.add(bank);
      const grass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.1, l * 0.99), grassMat);
      grass.position.set(x, 0.33, z);
      grass.receiveShadow = true;
      g.add(grass);
    };
    const hw = FIELD_W / 2 + pad;
    const hl = FIELD_L / 2 + pad;
    make(hw * 2 + 1.0, 0.8, 0, hl);
    make(hw * 2 + 1.0, 0.8, 0, -hl);
    make(0.8, hl * 2, hw, 0);
    make(0.8, hl * 2, -hw, 0);
    return g;
  }

  /** Neighbouring paddies, the gravel track, poles and a distant shed. */
  private buildSurroundings(): THREE.Group {
    const g = new THREE.Group();

    // patchwork of other fields, painted once into a big canvas
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // blocky plots
        const px = Math.floor(u * 9);
        const py = Math.floor(v * 9);
        const id = ((px * 7 + py * 13) % 5) / 4;
        const n = fbm(u * 30, v * 30, 3, 1, 17);
        let r: number, gg: number, b: number;
        if (id < 0.3) { r = 150; gg = 138; b = 66; }      // ripe, uncut
        else if (id < 0.55) { r = 116; gg = 122; b = 60; } // green
        else if (id < 0.8) { r = 128; gg = 116; b = 84; }  // stubble
        else { r = 96; gg = 82; b = 60; }                  // ploughed
        const k = 0.82 + n * 0.36;
        // levee lines between plots
        const edge = Math.min(
          Math.abs(u * 9 - px - 0.5),
          Math.abs(v * 9 - py - 0.5)
        );
        const lev = edge > 0.455 ? 1 : 0;
        const i = (y * size + x) * 4;
        d[i] = Math.min(255, (r * k) + lev * 40);
        d[i + 1] = Math.min(255, (gg * k) + lev * 34);
        d[i + 2] = Math.min(255, (b * k) + lev * 24);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(9, 9);

    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 560),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1, color: 0xb9b2a0 })
    );
    outer.rotateX(-Math.PI / 2);
    outer.position.y = -0.07;
    g.add(outer);

    // gravel farm track running past the near levee
    const track = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 260),
      new THREE.MeshStandardMaterial({ color: 0x8d8776, roughness: 1 })
    );
    track.rotateX(-Math.PI / 2);
    track.position.set(FIELD_W / 2 + 11, 0.02, 0);
    g.add(track);

    // concrete utility poles with a couple of wires: cheap, strong depth cue
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x9a978e, roughness: 0.85 });
    const wireMat = new THREE.LineBasicMaterial({ color: 0x2a2a28 });
    const poleXs = [FIELD_W / 2 + 15];
    for (const px of poleXs) {
      for (let i = -3; i <= 3; i++) {
        const z = i * 34;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 9.5, 6), poleMat);
        pole.position.set(px, 4.75, z);
        pole.castShadow = false;
        g.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.1), poleMat);
        arm.position.set(px, 8.9, z);
        g.add(arm);
        if (i < 3) {
          for (const off of [-0.6, 0.6]) {
            const pts: THREE.Vector3[] = [];
            for (let s = 0; s <= 8; s++) {
              const t = s / 8;
              const zz = z + t * 34;
              pts.push(new THREE.Vector3(px + off, 8.9 - Math.sin(t * Math.PI) * 0.9, zz));
            }
            g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
          }
        }
      }
    }

    // a corrugated shed and a stack of already-wrapped bales, far off
    const shedMat = new THREE.MeshStandardMaterial({ color: 0x7c8383, roughness: 0.7, metalness: 0.35 });
    const shed = new THREE.Mesh(new THREE.BoxGeometry(14, 5.2, 9), shedMat);
    shed.position.set(-46, 2.6, 52);
    g.add(shed);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0x5e6360, roughness: 0.6, metalness: 0.4 }));
    roof.position.set(-46, 5.35, 52);
    g.add(roof);
    const wrapMat = new THREE.MeshStandardMaterial({ color: 0xdfe2da, roughness: 0.42 });
    for (let i = 0; i < 7; i++) {
      const row = i < 4 ? 0 : 1;
      const k = i < 4 ? i : i - 4;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.1, 14), wrapMat);
      b.rotation.z = Math.PI / 2;
      b.position.set(-36 + k * 1.2, 0.62 + row * 1.2, 47 + row * 0.0);
      g.add(b);
    }

    return g;
  }

  /** Alpha-tested canopy strips ringing the horizon. */
  private buildTreeline(): THREE.Group {
    const g = new THREE.Group();
    const tex = treeStrip().clone();
    tex.repeat.set(6, 1);
    tex.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.35,
      depthWrite: true,
      side: THREE.DoubleSide,
      color: 0x7e8c78,
    });
    const R = 128;
    const H = 17;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.2, H), mat);
      m.position.set(Math.sin(a) * R, H / 2 - 2.6, Math.cos(a) * R);
      m.lookAt(0, H / 2 - 2.6, 0);
      g.add(m);
    }
    return g;
  }

  /** Two hazy ridges — the picture needs something behind the trees. */
  private buildRidges(): THREE.Group {
    const g = new THREE.Group();
    for (let layer = 0; layer < 2; layer++) {
      const dist = 250 + layer * 55;
      const segs = 120;
      const height = 46 - layer * 4;
      const pts: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const a = t * Math.PI * 2;
        const n =
          fbm(t * 9 + layer * 4.7, layer * 2.2, 4, 1, 31 + layer) * 0.72 +
          fbm(t * 26 + layer, 1.3, 3, 1, 47) * 0.28;
        const y = n * height;
        const x = Math.sin(a) * dist;
        const z = Math.cos(a) * dist;
        pts.push(x, -6, z, x, y, z);
      }
      for (let i = 0; i < segs; i++) {
        const a0 = i * 2;
        idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      geo.setIndex(idx);
      const col = layer === 0 ? 0x6f8290 : 0x8ea0ab;
      const mat = new THREE.MeshBasicMaterial({ color: col, fog: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = -900;
      g.add(m);
    }
    return g;
  }
}
