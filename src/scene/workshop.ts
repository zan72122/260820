import * as THREE from 'three';

/**
 * A quiet conservation workshop in the forest. Every object earns its place:
 * a low trestle rest for the head, one work table, a drain tray, daylight
 * from a single window. Room surfaces are procedurally textured; the forest
 * outside recedes by contrast and color temperature, not by blur.
 */

function canvasTex(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, s: number) => void,
  srgb = true
): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  draw(ctx, size);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function woodTexture(base: string, dark: string, plank = false): THREE.CanvasTexture {
  return canvasTex(512, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    // grain
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * s;
      const amp = 2 + Math.random() * 6;
      ctx.strokeStyle = `rgba(60,42,26,${0.05 + Math.random() * 0.1})`;
      ctx.lineWidth = 0.6 + Math.random() * 1.8;
      ctx.beginPath();
      for (let x = 0; x <= s; x += 8) {
        const yy = y + Math.sin(x * 0.03 + i) * amp + Math.sin(x * 0.011 + i * 3) * amp * 0.6;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // knots
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = 4 + Math.random() * 9;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, dark);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (plank) {
      ctx.strokeStyle = 'rgba(30,20,12,0.55)';
      ctx.lineWidth = 3;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (s / 5) * i);
        ctx.lineTo(s, (s / 5) * i);
        ctx.stroke();
      }
    }
  });
}

function plasterTexture(): THREE.CanvasTexture {
  return canvasTex(512, (ctx, s) => {
    ctx.fillStyle = '#cfc4b0';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const l = Math.random() > 0.5;
      ctx.fillStyle = l ? 'rgba(236,228,212,0.16)' : 'rgba(150,138,118,0.10)';
      ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    // faint watermark stains near bottom
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * s;
      const y = s * 0.7 + Math.random() * s * 0.3;
      const r = 25 + Math.random() * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(140,126,104,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

/** Painted forest: layered silhouettes receding by value and temperature. */
function forestTexture(): THREE.CanvasTexture {
  return canvasTex(1024, (ctx, s) => {
    // morning sky
    const sky = ctx.createLinearGradient(0, 0, 0, s);
    sky.addColorStop(0, '#cfe0e8');
    sky.addColorStop(0.55, '#e2e8dd');
    sky.addColorStop(1, '#eef0e2');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, s, s);
    const layer = (baseY: number, color: string, jag: number, trunks: boolean) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, s);
      let y = baseY;
      for (let x = 0; x <= s; x += 10) {
        y = baseY + Math.sin(x * 0.02) * jag * 0.4 + (Math.random() - 0.5) * jag;
        ctx.lineTo(x, y);
        // conifer tips
        if (Math.random() < 0.15) {
          ctx.lineTo(x + 4, y - jag * (1 + Math.random()));
          ctx.lineTo(x + 8, y);
        }
      }
      ctx.lineTo(s, s);
      ctx.closePath();
      ctx.fill();
      if (trunks) {
        for (let i = 0; i < 7; i++) {
          const x = Math.random() * s;
          ctx.fillStyle = color;
          ctx.fillRect(x, baseY, 6 + Math.random() * 10, s - baseY);
        }
      }
    };
    layer(s * 0.38, 'rgba(168,186,182,0.8)', 16, false); // far ridge: cool, pale
    // mist band between ridges
    let mist = ctx.createLinearGradient(0, s * 0.4, 0, s * 0.52);
    mist.addColorStop(0, 'rgba(226,232,222,0)');
    mist.addColorStop(0.5, 'rgba(228,234,224,0.55)');
    mist.addColorStop(1, 'rgba(226,232,222,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, s * 0.38, s, s * 0.16);
    layer(s * 0.5, 'rgba(118,144,124,0.9)', 26, false);
    mist = ctx.createLinearGradient(0, s * 0.55, 0, s * 0.68);
    mist.addColorStop(0, 'rgba(222,230,216,0)');
    mist.addColorStop(0.5, 'rgba(224,231,217,0.4)');
    mist.addColorStop(1, 'rgba(222,230,216,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, s * 0.55, s, s * 0.16);
    layer(s * 0.66, 'rgba(64,92,66,0.98)', 36, false); // near: warmer, darker
    // a few close trunks with foliage clumps (the forest is right outside)
    for (let i = 0; i < 4; i++) {
      const x = s * (0.1 + i * 0.26) + Math.random() * 40;
      ctx.fillStyle = 'rgba(52,66,48,0.95)';
      ctx.fillRect(x, s * 0.3, 10 + Math.random() * 8, s * 0.7);
      for (let b = 0; b < 6; b++) {
        const bx = x + (Math.random() - 0.5) * 90;
        const by = s * (0.3 + Math.random() * 0.3);
        const br = 24 + Math.random() * 36;
        const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        bg.addColorStop(0, 'rgba(58,78,54,0.85)');
        bg.addColorStop(1, 'rgba(58,78,54,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(bx - br, by - br, br * 2, br * 2);
      }
    }
    // sunlit haze from upper left
    const haze = ctx.createRadialGradient(s * 0.25, s * 0.12, 0, s * 0.25, s * 0.12, s * 0.85);
    haze.addColorStop(0, 'rgba(255,248,225,0.4)');
    haze.addColorStop(1, 'rgba(255,248,225,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, s, s);
  });
}

export interface WorkshopRefs {
  group: THREE.Group;
  padTop: number;
  tableTop: THREE.Vector3;
  prismRail: { y: number; x: number; zMin: number; zMax: number };
  spectrumWall: THREE.Mesh;
  windowCenter: THREE.Vector3;
  tray: THREE.Mesh;
}

export function buildWorkshop(): WorkshopRefs {
  const g = new THREE.Group();

  const wood = woodTexture('#8a6a48', 'rgba(50,34,20,0.5)');
  const woodDark = woodTexture('#6d5238', 'rgba(40,26,14,0.6)');
  const floorTex = woodTexture('#7d603f', 'rgba(45,30,16,0.5)', true);
  floorTex.repeat.set(5, 5);
  const plaster = plasterTexture();
  plaster.repeat.set(2, 1);

  // ---- room shell
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 5.6),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.86 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(-0.2, 0, -0.2);
  floor.receiveShadow = true;
  g.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.94 });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.8), wallMat);
  backWall.position.set(-0.2, 1.4, -2.0);
  g.add(backWall);

  const rightWallMat = new THREE.MeshStandardMaterial({
    map: plaster.clone(),
    roughness: 0.94,
    color: 0xf5efe2,
  });
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.8), rightWallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(1.75, 1.4, -0.2);
  rightWall.receiveShadow = true;
  g.add(rightWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.8), wallMat.clone());
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-2.9, 1.4, -0.2);
  g.add(leftWall);

  // ceiling with two beams (mostly out of frame)
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 5.6),
    new THREE.MeshStandardMaterial({ color: 0xbfb49e, roughness: 0.95 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(-0.2, 2.8, -0.2);
  g.add(ceil);
  for (const bx of [-1.5, 0.6]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.22, 5.6),
      new THREE.MeshStandardMaterial({ map: woodDark, roughness: 0.9 })
    );
    beam.position.set(bx, 2.68, -0.2);
    g.add(beam);
  }

  // ---- window on the back wall + forest beyond
  const winW = 1.15;
  const winH = 1.25;
  const winC = new THREE.Vector3(-0.85, 1.55, -1.99);
  const frameMat = new THREE.MeshStandardMaterial({ map: woodDark, roughness: 0.8 });
  const frame = new THREE.Group();
  const mkBar = (w: number, h: number, d: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    m.position.set(x, y, 0);
    frame.add(m);
  };
  mkBar(winW + 0.12, 0.07, 0.09, 0, winH / 2);
  mkBar(winW + 0.12, 0.09, 0.09, 0, -winH / 2); // sill slightly deeper
  mkBar(0.07, winH, 0.09, -winW / 2, 0);
  mkBar(0.07, winH, 0.09, winW / 2, 0);
  mkBar(0.045, winH, 0.06, 0, 0); // single mullion
  frame.position.copy(winC);
  g.add(frame);
  // window hole: cover the wall behind the window with the forest view
  const forest = new THREE.Mesh(
    new THREE.PlaneGeometry(winW + 1.6, winH + 1.2),
    new THREE.MeshBasicMaterial({ map: forestTexture() })
  );
  forest.position.set(winC.x, winC.y + 0.1, -2.85);
  g.add(forest);
  // punch the "hole": draw a dark window reveal box around forest
  const revealMat = new THREE.MeshStandardMaterial({ color: 0x8d8271, roughness: 0.95 });
  const mkReveal = (w: number, h: number, x: number, y: number, rotY: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), revealMat);
    m.position.set(winC.x + x, winC.y + y, -2.0 - 0.14);
    m.rotation.y = rotY;
    g.add(m);
  };
  mkReveal(0.28, winH, -winW / 2, 0, Math.PI / 2 - 0.001);
  mkReveal(0.28, winH, winW / 2, 0, -Math.PI / 2 + 0.001);
  // wall pieces masking outside the window opening (back wall already there;
  // cut illusion via frame + reveal is sufficient at our camera angles)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(winW, winH),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.06,
      roughness: 0.05,
      envMapIntensity: 1.2,
      depthWrite: false,
    })
  );
  glass.position.copy(winC);
  g.add(glass);

  // cut the back wall visually: dark opening plane just behind frame (prevents
  // plaster from showing through the glass)
  const opening = new THREE.Mesh(
    new THREE.PlaneGeometry(winW, winH),
    new THREE.MeshBasicMaterial({ colorWrite: false })
  );
  opening.position.set(winC.x, winC.y, -1.995);
  // simplest robust approach: shift the backWall into two flanking pieces
  backWall.geometry = new THREE.PlaneGeometry(5.4, 2.8);
  backWall.updateMatrix();
  // draw wall with hole via alphaMap
  const holeAlpha = canvasTex(
    512,
    (ctx, s) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, s, s);
      // map window rect into wall plane UV space
      const wallW = 5.4;
      const wallH = 2.8;
      const u0 = (winC.x - -0.2 + wallW / 2 - winW / 2) / wallW;
      const u1 = u0 + winW / wallW;
      const v0 = (winC.y - winH / 2) / wallH;
      const v1 = v0 + winH / wallH;
      ctx.fillStyle = '#000000';
      ctx.fillRect(u0 * s, (1 - v1) * s, (u1 - u0) * s, (v1 - v0) * s);
    },
    false
  );
  const wallHoleMat = new THREE.MeshStandardMaterial({
    map: plaster,
    roughness: 0.94,
    alphaMap: holeAlpha,
    transparent: false,
    alphaTest: 0.5,
  });
  backWall.material = wallHoleMat;
  void opening;

  // ---- head rest: low trestle, wood + leather, cushion dented where the jaw lies
  const rest = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85 });
  const mkLeg = (x: number, z: number, lean: number) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.56, 0.09), legMat);
    leg.position.set(x, 0.28, z);
    leg.rotation.z = lean;
    leg.castShadow = true;
    rest.add(leg);
  };
  mkLeg(-0.16, -0.13, 0.1);
  mkLeg(-0.16, 0.13, 0.1);
  mkLeg(0.16, -0.13, -0.1);
  mkLeg(0.16, 0.13, -0.1);
  const crossBar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.08), legMat);
  crossBar.position.set(0, 0.2, 0);
  rest.add(crossBar);
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.3), legMat);
  topBar.position.set(0, 0.555, 0);
  topBar.castShadow = true;
  rest.add(topBar);

  // leather cushion with a dent baked where the jaw settles
  const cushGeo = new THREE.BoxGeometry(0.44, 0.09, 0.28, 22, 6, 14);
  {
    const p = cushGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      if (y > 0.02) {
        // rounded pillow top, pressed down in the middle where the jaw lies
        const d = Math.exp(-((x - 0.02) * (x - 0.02)) / 0.02 - (z * z) / 0.012);
        p.setY(i, y + 0.012 - d * 0.028);
      }
      // slight barrel sides
      p.setX(i, x * (1 + 0.06 * (y + 0.045)));
      p.setZ(i, z * (1 + 0.06 * (y + 0.045)));
    }
    cushGeo.computeVertexNormals();
  }
  const leatherTex = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#5c4028';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(70,48,30,0.28)' : 'rgba(110,80,52,0.2)';
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    // worn darker sheen in the pressed center (heads have rested here for years)
    const gg = ctx.createRadialGradient(s * 0.55, s * 0.5, 0, s * 0.55, s * 0.5, s * 0.4);
    gg.addColorStop(0, 'rgba(48,32,20,0.4)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, s, s);
    // stitch line
    ctx.strokeStyle = 'rgba(190,160,120,0.4)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(s * 0.06, s * 0.08, s * 0.88, s * 0.84);
  });
  const cushion = new THREE.Mesh(
    cushGeo,
    new THREE.MeshStandardMaterial({ map: leatherTex, roughness: 0.62 })
  );
  cushion.position.set(0, 0.635, 0);
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  rest.add(cushion);
  rest.position.set(0.02, 0, 0.1);
  g.add(rest);
  const padTop = 0.66;

  // ---- work table (tools live here; wear marks where they rest)
  const table = new THREE.Group();
  const topTex = woodTexture('#93714c', 'rgba(50,34,20,0.5)');
  const tableTopMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.05, 0.62),
    new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.8 })
  );
  tableTopMesh.position.y = 0.72;
  tableTopMesh.castShadow = true;
  tableTopMesh.receiveShadow = true;
  table.add(tableTopMesh);
  // wear: darker patches + a water ring, drawn on an overlay decal
  const wearTex = canvasTex(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const spots: [number, number, number, number][] = [
      [0.25, 0.4, 0.16, 0.1],
      [0.6, 0.62, 0.2, 0.12],
      [0.78, 0.3, 0.1, 0.08],
    ];
    for (const [x, y, r, a] of spots) {
      const gg = ctx.createRadialGradient(x * s, y * s, 0, x * s, y * s, r * s);
      gg.addColorStop(0, `rgba(40,26,14,${a})`);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(0, 0, s, s);
    }
    ctx.strokeStyle = 'rgba(50,32,18,0.28)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s * 0.42, s * 0.68, s * 0.08, 0, Math.PI * 2);
    ctx.stroke();
  });
  const wear = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 0.6),
    new THREE.MeshBasicMaterial({ map: wearTex, transparent: true, depthWrite: false })
  );
  wear.rotation.x = -Math.PI / 2;
  wear.position.y = 0.7462;
  table.add(wear);
  for (const [lx, lz] of [
    [-0.44, -0.24],
    [-0.44, 0.24],
    [0.44, -0.24],
    [0.44, 0.24],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), legMat);
    leg.position.set(lx, 0.35, lz);
    table.add(leg);
  }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.5), legMat);
  shelf.position.y = 0.22;
  table.add(shelf);
  // folded spare cloths on the shelf
  for (let i = 0; i < 2; i++) {
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.035, 0.15),
      new THREE.MeshStandardMaterial({ color: i ? 0xd8cfc0 : 0xc9c2b2, roughness: 1 })
    );
    c.position.set(-0.2 + i * 0.24, 0.255, 0.05 - i * 0.08);
    c.rotation.y = i * 0.4 - 0.15;
    table.add(c);
  }
  table.position.set(0.82, 0, -0.62);
  table.rotation.y = 0.12;
  g.add(table);
  const tableTop = new THREE.Vector3(0.82, 0.745, -0.62);

  // ---- drain tray: shallow brushed-metal tray under the working area
  const trayGeo = new THREE.BoxGeometry(0.4, 0.035, 0.26, 8, 2, 6);
  {
    const p = trayGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0) {
        const x = p.getX(i);
        const z = p.getZ(i);
        const inner = Math.max(Math.abs(x) / 0.2, Math.abs(z) / 0.13);
        if (inner < 0.82) p.setY(i, y - 0.024);
      }
    }
    trayGeo.computeVertexNormals();
  }
  const tray = new THREE.Mesh(
    trayGeo,
    new THREE.MeshStandardMaterial({ color: 0x9aa0a4, metalness: 0.85, roughness: 0.42 })
  );
  tray.position.set(0.44, 0.035, 0.2);
  tray.castShadow = true;
  tray.receiveShadow = true;
  g.add(tray);
  // standing water film in the tray
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.17),
    new THREE.MeshPhysicalMaterial({
      color: 0x8fa3a8,
      transparent: true,
      opacity: 0.5,
      roughness: 0.05,
      envMapIntensity: 1.4,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0.44, 0.047, 0.2);
  g.add(water);

  // ---- prism rail on the right wall: a simple wooden track the prism slides on
  const railY = 1.34;
  const railX = 1.62;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 1.15), legMat);
  rail.position.set(railX + 0.05, railY - 0.055, 0.06);
  rail.castShadow = true;
  g.add(rail);
  const railBrace1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.06), legMat);
  railBrace1.position.set(railX + 0.06, railY - 0.08, -0.38);
  const railBrace2 = railBrace1.clone();
  railBrace2.position.z = 0.5;
  g.add(railBrace1, railBrace2);

  // ---- spectrum receiving wall: subtly cleaner plaster patch where light lands
  const spectrumWall = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.0),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
  );
  spectrumWall.rotation.y = -Math.PI / 2;
  spectrumWall.position.set(1.745, 1.25, 0.1);
  g.add(spectrumWall);

  return {
    group: g,
    padTop,
    tableTop,
    prismRail: { y: railY, x: railX, zMin: -0.34, zMax: 0.46 },
    spectrumWall,
    windowCenter: winC,
    tray,
  };
}
