import * as THREE from 'three';
import { lakeTexture } from './textures';
import { WATER_Y } from './underwater';
import { makeRng } from '../util/math';

/**
 * 冬の湖の外景。低い冬空、遠い湖岸、湖面、静かな降雪。
 * 遠景は低LODシルエットと空気遠近で分離する。
 */
export class Exterior {
  root = new THREE.Group();
  private snow: THREE.Points;
  private snowBase: Float32Array;

  constructor() {
    // 低い冬空（グラデーションドーム）
    const skyGeo = new THREE.SphereGeometry(120, 24, 12);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vPos;
        void main() {
          float h = clamp(vPos.y / 120.0, 0.0, 1.0);
          vec3 horizon = vec3(0.78, 0.82, 0.85);
          vec3 zenith = vec3(0.42, 0.49, 0.56);
          vec3 col = mix(horizon, zenith, pow(h, 0.55));
          // 低い雲の帯
          float band = sin(vPos.y * 0.14 + vPos.x * 0.02) * 0.5 + 0.5;
          col = mix(col, vec3(0.62, 0.67, 0.72), band * 0.12 * (1.0 - h));
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.root.add(new THREE.Mesh(skyGeo, skyMat));

    // 湖面
    const lake = new THREE.Mesh(
      new THREE.CircleGeometry(120, 40),
      new THREE.MeshStandardMaterial({
        map: lakeTexture(),
        roughness: 0.28,
        metalness: 0.0,
        color: 0x8b979c
      })
    );
    lake.rotation.x = -Math.PI / 2;
    lake.position.y = WATER_Y - 0.02;
    this.root.add(lake);

    // 遠い湖岸（重なる低い尾根のシルエット、雪をのせる）
    const rng = makeRng(101);
    const ridgeColors = [0x5d6b74, 0x6c7a83, 0x7e8b93];
    for (let ring = 0; ring < 3; ring++) {
      const dist = 46 + ring * 24;
      const mat = new THREE.MeshBasicMaterial({ color: ridgeColors[ring] });
      const snowMat = new THREE.MeshBasicMaterial({ color: 0xdfe5e8 });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + ring * 0.23 + rng() * 0.2;
        const h = 4 + rng() * (9 - ring * 2);
        const w = 14 + rng() * 18;
        const hill = new THREE.Mesh(new THREE.ConeGeometry(w, h, 7), mat);
        hill.position.set(Math.cos(a) * dist, WATER_Y + h / 2 - 0.4, Math.sin(a) * dist);
        hill.rotation.y = rng() * Math.PI;
        this.root.add(hill);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.32, h * 0.3, 7), snowMat);
        cap.position.set(hill.position.x, WATER_Y + h - h * 0.15, hill.position.z);
        this.root.add(cap);
      }
    }

    // 降雪
    const count = 900;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rng() - 0.5) * 40;
      pos[i * 3 + 1] = rng() * 14;
      pos[i * 3 + 2] = (rng() - 0.5) * 40;
    }
    this.snowBase = pos.slice();
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(
      snowGeo,
      new THREE.PointsMaterial({
        color: 0xe8edf0,
        size: 0.05,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
      })
    );
    this.root.add(this.snow);
  }

  update(time: number) {
    const attr = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const fall = (time * (0.35 + ((i / 3) % 5) * 0.06)) % 14;
      arr[i + 1] = 14 - fall + (this.snowBase[i + 1] % 1);
      arr[i] = this.snowBase[i] + Math.sin(time * 0.4 + i) * 0.4;
      arr[i + 2] = this.snowBase[i + 2] + Math.cos(time * 0.3 + i * 0.7) * 0.3;
    }
    attr.needsUpdate = true;
  }
}
