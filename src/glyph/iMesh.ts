/**
 * Glyph I as hardware: fixed bottom bar bolted to the plate, a laminated
 * stack of rigid stem plates that shears like a drafting parallelogram,
 * and a top bar that both translates and tips with the slant. Two flat
 * aluminum links with visible pins make the mechanism legible; an arc
 * guide behind the top bar shows the constrained travel.
 *
 * Everything is rigid: slant only re-poses parts, no vertex rewrites.
 */
import * as THREE from 'three';
import { I_SPEC, iShearAngle, iTrackTilt } from './spec';
import type { LabMaterials } from '../core/materials';

export interface IGlyph {
  group: THREE.Group;
  topBar: THREE.Group; // ball track parent — its matrix carries the ball
  setSlant(s: number): void;
  /** local x of the track surface centerline origin */
  trackHalfLength: number;
  trackSurfaceY: number; // local y (in topBar frame) of the track surface
}

export function makeIGlyph(mats: LabMaterials): IGlyph {
  const S = I_SPEC;
  const group = new THREE.Group();
  const linkLen = S.stemTopY - S.stemBottomY + S.topBarH / 2; // pivot to pivot

  // bottom bar (fixed, bolted)
  const baseBar = new THREE.Mesh(
    new THREE.BoxGeometry(S.baseBarW, S.baseBarH, S.extrudeDepth + 0.02),
    mats.blackSteel,
  );
  baseBar.position.y = S.baseBarH / 2;
  baseBar.castShadow = true;
  baseBar.receiveShadow = true;
  group.add(baseBar);
  const boltGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.014, 6);
  for (const sx of [-1, 1]) {
    const bolt = new THREE.Mesh(boltGeo, mats.castIronWorn);
    bolt.position.set(sx * (S.baseBarW / 2 - 0.06), S.baseBarH + 0.007, 0);
    group.add(bolt);
  }

  // laminated stem plates
  const plateH = 0.064;
  const pitch = (S.stemTopY - S.stemBottomY) / S.laminations;
  const plateGeo = new THREE.BoxGeometry(S.stemW, plateH, S.stemDepth);
  const plates: THREE.Mesh[] = [];
  for (let i = 0; i < S.laminations; i++) {
    const m = new THREE.Mesh(plateGeo, i % 2 ? mats.blackSteel : mats.blackSteelSlide);
    m.castShadow = true;
    m.receiveShadow = true;
    plates.push(m);
    group.add(m);
  }

  // top bar with ball track
  const topBar = new THREE.Group();
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(S.topBarW, S.topBarH, S.extrudeDepth + 0.02),
    mats.blackSteel,
  );
  bar.castShadow = true;
  bar.receiveShadow = true;
  topBar.add(bar);
  const railBack = new THREE.Mesh(
    new THREE.BoxGeometry(S.topBarW, 0.03, 0.016),
    mats.aluminumDark,
  );
  railBack.position.set(0, S.topBarH / 2 + 0.015, -(S.extrudeDepth / 2) + 0.02);
  topBar.add(railBack);
  const railFront = new THREE.Mesh(
    new THREE.BoxGeometry(S.topBarW, 0.018, 0.014),
    mats.aluminumDark,
  );
  railFront.position.set(0, S.topBarH / 2 + 0.009, S.extrudeDepth / 2 - 0.02);
  topBar.add(railFront);
  // shallow center detent — a visible dished seat in the track
  const detent = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.062, 0.008, 18),
    mats.blackSteelSlide,
  );
  detent.position.set(0, S.topBarH / 2 + 0.004, 0);
  topBar.add(detent);
  // head block: the stem's top plate pins into this under the bar center
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(S.stemW + 0.02, 0.05, S.stemDepth + 0.01),
    mats.blackSteelSlide,
  );
  head.position.set(0, -S.topBarH / 2 - 0.02, 0);
  topBar.add(head);
  // roller riding the rear arc guide
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12), mats.brass);
  roller.rotation.x = Math.PI / 2;
  roller.position.set(0, 0, -(S.extrudeDepth / 2) - 0.055);
  topBar.add(roller);
  group.add(topBar);

  // parallelogram links (front and rear faces) with pins
  const links: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const lg = new THREE.Group();
      const flat = new THREE.Mesh(new THREE.BoxGeometry(0.046, linkLen, 0.014), mats.aluminum);
      flat.position.y = linkLen / 2;
      flat.castShadow = true;
      lg.add(flat);
      const pinBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.034, 10), mats.brass);
      pinBottom.rotation.x = Math.PI / 2;
      lg.add(pinBottom);
      const pinTop = pinBottom.clone();
      pinTop.position.y = linkLen;
      lg.add(pinTop);
      lg.position.set(sx * (S.stemW / 2 + 0.04), S.stemBottomY, sz * (S.extrudeDepth / 2 + 0.014));
      group.add(lg);
      links.push(lg);
    }
  }

  // rear arc guide (torus segment centered on the base pivot height)
  const arcSpan = (S.slantMaxDeg * 2.4 * Math.PI) / 180;
  const guide = new THREE.Mesh(
    new THREE.TorusGeometry(linkLen, 0.014, 8, 24, arcSpan),
    mats.aluminum,
  );
  guide.position.set(0, S.stemBottomY, -(S.extrudeDepth / 2) - 0.055);
  guide.rotation.z = Math.PI / 2 - arcSpan / 2;
  group.add(guide);
  const guidePost = new THREE.Mesh(new THREE.BoxGeometry(0.05, S.stemBottomY + 0.72, 0.03), mats.aluminumDark);
  guidePost.position.set(0.3, (S.stemBottomY + 0.72) / 2, -(S.extrudeDepth / 2) - 0.075);
  guidePost.castShadow = true;
  group.add(guidePost);
  const guideBrace = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.03), mats.aluminumDark);
  guideBrace.position.set(0.16, S.stemBottomY + 0.7, -(S.extrudeDepth / 2) - 0.075);
  group.add(guideBrace);

  const setSlant = (s: number) => {
    const th = iShearAngle(s);
    const sin = Math.sin(th);
    const cos = Math.cos(th);
    for (let i = 0; i < S.laminations; i++) {
      const l = (i + 0.5) * pitch;
      plates[i].position.set(sin * l, S.stemBottomY + cos * l, 0);
    }
    const lTop = linkLen;
    topBar.position.set(sin * lTop, S.stemBottomY + cos * lTop, 0);
    topBar.rotation.z = iTrackTilt(s);
    for (const lg of links) lg.rotation.z = -th;
  };
  setSlant(0);

  return {
    group,
    topBar,
    setSlant,
    trackHalfLength: S.topBarW / 2 - 0.04,
    trackSurfaceY: S.topBarH / 2,
  };
}
