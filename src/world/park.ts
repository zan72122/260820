import * as THREE from 'three';
import { contactShadow, deckTiles, roughnessCloud } from '../core/textures';
import { mergeGeoms, softBox, transformed } from './geomUtil';
import type { ShopMaterials } from './materials';
import type { Slide } from './slide';

/**
 * The water park before opening: hosed decks, still water, nobody about.
 *
 * Everything here exists to give the flume a believable scale and to keep the
 * exterior camera shots readable; it is intentionally low polygon and unlit by
 * shadow maps.
 */
export class Park {
  readonly group = new THREE.Group();
  readonly exitGlow: THREE.Mesh;
  readonly exitLight: THREE.PointLight;
  readonly bench = new THREE.Group();
  readonly leverPivot = new THREE.Group();

  constructor(
    private slide: Slide,
    private mat: ShopMaterials,
    envMap: THREE.Texture,
  ) {
    this.group.name = 'park';

    const tiles = deckTiles();
    tiles.repeat.set(150, 150);
    const deck = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({
        color: 0xd9e3e0,
        map: tiles,
        roughness: 0.42,
        roughnessMap: roughnessCloud(0.4, 0.22, 41, 'deckRough'),
        metalness: 0,
        envMap,
        envMapIntensity: 0.7,
      }),
    );
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = -0.02;
    this.group.add(deck);

    this.group.add(this.buildPool(envMap));
    this.group.add(this.buildPylons());
    this.group.add(this.buildTower());
    this.group.add(this.buildBench());
    this.group.add(this.buildParasols(envMap));
    this.group.add(this.buildFence());

    const exit = this.slide.frame(1);
    this.exitGlow = new THREE.Mesh(
      new THREE.CircleGeometry(this.slide.radius * 0.98, 28),
      new THREE.MeshBasicMaterial({
        color: 0xfff0d4,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.exitGlow.position.copy(exit.p).addScaledVector(exit.t, 0.12);
    this.exitGlow.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().lookAt(new THREE.Vector3(), exit.t, new THREE.Vector3(0, 1, 0)),
    );
    this.exitGlow.renderOrder = 2;
    this.group.add(this.exitGlow);

    this.exitLight = new THREE.PointLight(0xffe4bb, 12, 14, 1.5);
    this.exitLight.position.copy(exit.p).addScaledVector(exit.t, -1.1);
    this.group.add(this.exitLight);
  }

  private buildPool(envMap: THREE.Texture): THREE.Group {
    const g = new THREE.Group();
    const exit = this.slide.frame(1);
    const cx = exit.p.x + exit.t.x * 5;
    const cz = exit.p.z + exit.t.z * 5;

    const basin = new THREE.Mesh(
      softBox(15, 1.3, 11, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xe8eeef, roughness: 0.5, envMap }),
    );
    basin.position.set(cx, 0.4, cz);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 10, 1, 1),
      new THREE.MeshPhysicalMaterial({
        color: 0x11748f,
        roughness: 0.05,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMap,
        envMapIntensity: 1,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, 0.92, cz);
    g.add(basin, water);
    g.name = 'splash-pool';
    return g;
  }

  private buildPylons(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'pylons';
    const geoms: THREE.BufferGeometry[] = [];
    for (const u of [0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.82, 0.94]) {
      const f = this.slide.frame(u);
      const top = f.p.y - this.slide.radius - this.slide.wall;
      if (top <= 0.4) continue;
      for (const side of [-1, 1]) {
        const x = f.p.x + f.r.x * side * 1.1;
        const z = f.p.z + f.r.z * side * 1.1;
        geoms.push(
          transformed(new THREE.CylinderGeometry(0.14, 0.17, top, 8), [x, top / 2, z]),
        );
      }
      geoms.push(
        transformed(new THREE.BoxGeometry(2.4, 0.16, 0.16), [f.p.x, top * 0.55, f.p.z], [
          0,
          Math.atan2(f.r.x, f.r.z) + Math.PI / 2,
          0,
        ]),
      );
    }
    const mesh = new THREE.Mesh(mergeGeoms(geoms), this.mat.galv);
    g.add(mesh);
    return g;
  }

  private buildTower(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'tower';
    const f = this.slide.frame(0);
    const base = new THREE.Vector3(f.p.x, 0, f.p.z - 2.4);
    const h = f.p.y - 1.5;

    const legs: THREE.BufferGeometry[] = [];
    for (const dx of [-2, 2]) {
      for (const dz of [-2, 2]) {
        legs.push(
          transformed(new THREE.CylinderGeometry(0.14, 0.17, h, 8), [
            base.x + dx,
            h / 2,
            base.z + dz,
          ]),
        );
      }
    }
    for (let i = 1; i <= 4; i++) {
      const y = (h * i) / 5;
      legs.push(transformed(new THREE.BoxGeometry(4.2, 0.12, 0.12), [base.x, y, base.z - 2]));
      legs.push(transformed(new THREE.BoxGeometry(4.2, 0.12, 0.12), [base.x, y, base.z + 2]));
      legs.push(transformed(new THREE.BoxGeometry(0.12, 0.12, 4.2), [base.x - 2, y, base.z]));
    }
    g.add(new THREE.Mesh(mergeGeoms(legs), this.mat.galv));

    const deckMat = this.mat.plastic(0xdfe8e6);
    const platform = new THREE.Mesh(softBox(5.6, 0.22, 5.6, 0.06), deckMat);
    platform.position.set(base.x, h, base.z);
    g.add(platform);

    const rails: THREE.BufferGeometry[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = -2.6 + (5.2 * i) / 10;
      rails.push(transformed(new THREE.CylinderGeometry(0.045, 0.045, 1.05, 6), [
        base.x + t,
        h + 0.63,
        base.z - 2.7,
      ]));
      rails.push(transformed(new THREE.CylinderGeometry(0.045, 0.045, 1.05, 6), [
        base.x - 2.7,
        h + 0.63,
        base.z + t,
      ]));
    }
    rails.push(transformed(new THREE.BoxGeometry(5.5, 0.08, 0.08), [base.x, h + 1.13, base.z - 2.7]));
    rails.push(transformed(new THREE.BoxGeometry(0.08, 0.08, 5.5), [base.x - 2.7, h + 1.13, base.z]));
    g.add(new THREE.Mesh(mergeGeoms(rails), this.mat.plastic(0x4fbdd2)));

    const steps: THREE.BufferGeometry[] = [];
    const n = 26;
    for (let i = 0; i < n; i++) {
      const y = ((i + 1) * h) / n;
      steps.push(
        transformed(new THREE.BoxGeometry(1.6, 0.09, 0.34), [base.x + 3.4, y, base.z - 2.4 + i * 0.3]),
      );
    }
    g.add(new THREE.Mesh(mergeGeoms(steps), deckMat));
    return g;
  }

  /** The safe inspection station: the player stands here, never inside the flume. */
  private buildBench(): THREE.Group {
    const f = this.slide.frame(0);
    const g = this.bench;
    g.name = 'inspection-bench';
    // Stand the bench on the tower deck beside the mouth, at working height:
    // this is where the player is, and it has to read as outside the flume.
    const deckTop = f.p.y - 1.5 + 0.11;
    const origin = new THREE.Vector3()
      .copy(f.p)
      .addScaledVector(f.r, -2.55)
      .addScaledVector(f.t, -1.35);
    origin.y = deckTop + 0.92;

    const top = new THREE.Mesh(softBox(1.7, 0.09, 1.0, 0.03), this.mat.plastic(0xdfe8e6));
    top.position.copy(origin);
    const legs: THREE.BufferGeometry[] = [];
    for (const dx of [-0.72, 0.72]) {
      for (const dz of [-0.38, 0.38]) {
        legs.push(
          transformed(new THREE.CylinderGeometry(0.045, 0.045, 0.95, 6), [
            origin.x + dx,
            origin.y - 0.5,
            origin.z + dz,
          ]),
        );
      }
    }
    const legMesh = new THREE.Mesh(mergeGeoms(legs), this.mat.galv);

    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.34, 18),
      this.mat.glass,
    );
    tank.position.set(origin.x - 0.5, origin.y + 0.22, origin.z);
    const tankWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.2, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0x54c6e2,
        roughness: 0.05,
        transparent: true,
        opacity: 0.75,
        clearcoat: 1,
      }),
    );
    tankWater.position.set(origin.x - 0.5, origin.y + 0.15, origin.z);

    this.leverPivot.position.set(origin.x - 0.16, origin.y + 0.12, origin.z);
    const lever = new THREE.Mesh(softBox(0.05, 0.3, 0.05, 0.02), this.mat.plastic(0xe4643c));
    lever.position.y = 0.15;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), this.mat.grip);
    knob.position.y = 0.3;
    this.leverPivot.add(lever, knob);

    const caddy = new THREE.Mesh(softBox(0.42, 0.14, 0.3, 0.03), this.mat.plastic(0x4fbdd2));
    caddy.position.set(origin.x + 0.52, origin.y + 0.11, origin.z);

    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.0),
      new THREE.MeshBasicMaterial({
        map: contactShadow(),
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(origin.x, deckTop + 0.01, origin.z);

    g.add(top, legMesh, tank, tankWater, this.leverPivot, caddy, blob);
    return g;
  }

  private buildParasols(envMap: THREE.Texture): THREE.Group {
    const g = new THREE.Group();
    g.name = 'parasols';
    const canopy = new THREE.MeshStandardMaterial({
      color: 0xf3f0e4,
      roughness: 0.85,
      side: THREE.DoubleSide,
      envMap,
    });
    const spots: [number, number][] = [
      [-9, 8],
      [-13, 17],
      [10, 6],
      [13, 24],
      [-11, 31],
    ];
    const poles: THREE.BufferGeometry[] = [];
    for (const [x, z] of spots) {
      poles.push(transformed(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), [x, 1.2, z]));
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.55, 10, 1, true), canopy);
      c.position.set(x, 2.5, z);
      g.add(c);
      const blob = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 3.4),
        new THREE.MeshBasicMaterial({
          map: contactShadow(),
          transparent: true,
          depthWrite: false,
          opacity: 0.34,
        }),
      );
      blob.rotation.x = -Math.PI / 2;
      blob.position.set(x, 0.01, z);
      g.add(blob);
    }
    g.add(new THREE.Mesh(mergeGeoms(poles), this.mat.galv));
    return g;
  }

  private buildFence(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'fence';
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i <= 42; i++) {
      const z = -12 + i * 1.7;
      for (const x of [-19, 21]) {
        parts.push(transformed(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), [x, 0.55, z]));
      }
    }
    for (const x of [-19, 21]) {
      parts.push(transformed(new THREE.BoxGeometry(0.07, 0.07, 71), [x, 1.02, 23.5]));
      parts.push(transformed(new THREE.BoxGeometry(0.07, 0.07, 71), [x, 0.45, 23.5]));
    }
    g.add(new THREE.Mesh(mergeGeoms(parts), this.mat.plastic(0xbfd4d6)));
    return g;
  }

  /** Animates the dispenser lever when the player calls for a test droplet. */
  setLever(pull: number): void {
    this.leverPivot.rotation.x = pull * 0.85;
  }
}
