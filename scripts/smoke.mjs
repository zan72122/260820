/**
 * Chromium smoke run against the production build. It plays the game the way a
 * hand would - a real swipe on the canvas, a real press on the lever's touch
 * zone - then drives the remaining runs through the deterministic test hooks,
 * and captures the framing at phone and tablet sizes in both orientations.
 *
 * Software GL only: this checks behaviour, never frame rate or visual polish.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4178;
const BASE = `http://127.0.0.1:${PORT}/?fast=1`;
const SHOTS = new URL('../shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', () => {});
server.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`));

const fail = [];
const note = (m) => console.log(m);
const check = (cond, label, detail = '') => {
  if (cond) note(`  ok   ${label} ${detail}`);
  else {
    fail.push(`${label} ${detail}`);
    note(`  FAIL ${label} ${detail}`);
  }
};

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(400);
  }
  throw new Error('preview server did not start');
}

const VIEWPORTS = {
  'iphone-landscape': { width: 844, height: 390 },
  'iphone-portrait': { width: 390, height: 844 },
  'ipad-portrait': { width: 820, height: 1180 },
  'ipad-landscape': { width: 1180, height: 820 },
};

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: VIEWPORTS['iphone-landscape'],
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__wb), null, { timeout: 30000 });
  await sleep(1000);

  const ev = (fn, arg) => page.evaluate(fn, arg);
  const api = {
    state: () => ev(() => window.__wb.state()),
    shot: () => ev(() => window.__wb.shot()),
    raft: () => ev(() => window.__wb.raft()),
    run: () => ev(() => window.__wb.run()),
    bags: () => ev(() => window.__wb.bags()),
    crests: () => ev(() => window.__wb.crests()),
    finishes: () => ev(() => window.__wb.finishes()),
    charge: () => ev(() => window.__wb.charge()),
    contact: () => ev(() => window.__wb.contact()),
    history: () => ev(() => window.__wb.history()),
    step: (s) => ev((sec) => window.__wb.step(sec), s),
    press: (v) => ev((p) => window.__wb.press(p), v),
    swipe: () => ev(() => window.__wb.swipe()),
    replay: () => ev(() => window.__wb.replay()),
    hints: () => ev(() => window.__wb.hints()),
    audio: () => ev(() => window.__wb.audio()),
    bagPoints: () => ev(() => window.__wb.bagWorldPoints()),
  };

  /** Drag a ballast bag with the pointer, the way a hand would. */
  async function dragBagToDeck() {
    const box = await page.locator('#stage').boundingBox();
    const toScreen = (p) => ({
      x: box.x + ((p.x + 1) / 2) * box.width,
      y: box.y + ((1 - p.y) / 2) * box.height,
    });
    const bags = await api.bagPoints();
    const onBench = bags.find((b) => b.state === 'bench');
    if (!onBench) return false;
    const raftDeck = bags.find((b) => b.state === 'deck');
    const from = toScreen(onBench);
    // Aim at the raft: either an existing deck bag, or the middle of the ramp.
    const to = raftDeck ? toScreen(raftDeck) : { x: box.x + box.width * 0.52, y: box.y + box.height * 0.42 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 14 });
    await page.mouse.up();
    return true;
  }
  const shot = async (name, settle = 0) => {
    // Optionally let the rail settle into the shot before capturing it.
    if (settle) await api.step(settle);
    await sleep(260);
    await page.screenshot({ path: `${SHOTS}${name}.png` });
  };

  /** Step the simulation until a predicate holds, or give up. */
  async function stepUntil(pred, budget = 30, chunk = 0.25) {
    let spent = 0;
    while (spent < budget) {
      if (await pred()) return true;
      await api.step(chunk);
      spent += chunk;
    }
    return pred();
  }
  const inState = (...names) => async () => names.includes(await api.state());

  // Real gestures, on the real elements.
  /** Push the raft itself forward, starting the gesture on the raft. */
  async function realSwipe() {
    const box = await page.locator('#stage').boundingBox();
    const p = await ev(() => window.__wb.raftScreen());
    const x = box.x + ((p.x + 1) / 2) * box.width;
    const y = box.y + ((1 - p.y) / 2) * box.height;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + box.width * 0.22, y + 6, { steps: 8 });
    await page.mouse.up();
  }
  async function realLever(down) {
    const box = await page.locator('.lever-zone').boundingBox();
    if (down) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.down();
    } else {
      await page.mouse.up();
    }
    return box;
  }

  note('\n— run 1: the mystery —');
  check((await api.state()) === 'OBSERVE_VALLEY', 'boots into OBSERVE_VALLEY', await api.state());
  await shot('01-observe-valley', 1.6);
  await stepUntil(inState('RELEASE_TEST_RAFT'), 8);
  check((await api.state()) === 'RELEASE_TEST_RAFT', 'moves to staging', await api.state());
  check((await api.bags()) === 1, 'first run carries one test bag', `bags=${await api.bags()}`);
  await shot('02-staging-run1', 1.6);

  note('\n— ballast by hand —');
  await api.step(2.5); // let the staging framing settle before aiming
  const bagsBefore = await api.bags();
  const massBefore = (await api.raft()).mass;
  const dragged = await dragBagToDeck();
  await api.step(0.5);
  check(dragged, 'a bag can be picked up from the bench');
  check(
    (await api.bags()) === bagsBefore + 1,
    'dragging a bag near the deck snaps it aboard',
    `bags ${bagsBefore} -> ${await api.bags()}`,
  );
  check(
    (await api.raft()).mass > massBefore,
    'the extra bag makes the raft heavier',
    `${massBefore}kg -> ${(await api.raft()).mass}kg`,
  );
  await shot('02b-ballast-dragged', 0.6);
  // Put it back so the scripted first run is the designed one.
  await ev(() => window.__wb.setBags(1));
  await api.step(0.4);
  check((await api.bags()) === 1, 'rig can reset the ballast for the run', `bags=${await api.bags()}`);

  note('\n— run 1 continued —');
  await realSwipe();
  await sleep(250);
  check((await api.state()) === 'RAFT_COASTS', 'a real swipe releases the raft', await api.state());
  await api.step(3.2);
  await shot('03-coasting', 0);

  await stepUntil(inState('RAFT_RESTS_BEFORE_HILL', 'DISCOVER_NOZZLES'), 26);
  let raft = await api.raft();
  check((await api.crests()) === 0, 'raft cannot climb without water', `x=${raft.x.toFixed(1)}`);
  check(raft.x < 32, 'raft stalls part way up the hill', `x=${raft.x.toFixed(1)}`);
  check(
    ['RAFT_RESTS_BEFORE_HILL', 'DISCOVER_NOZZLES'].includes(await api.state()),
    'settles in the waiting dimple',
    await api.state(),
  );
  await shot('04-rests-before-hill', 1.4);

  const hintsBefore = await api.hints();
  await api.step(3.0);
  check(
    (await api.hints()) > hintsBefore,
    'the rig gives its quiet hint while the raft waits',
    `hints ${hintsBefore} -> ${await api.hints()}`,
  );

  note('\n— run 1: the rule —');
  const leverBox = await realLever(true);
  check(leverBox.width > 90 && leverBox.height > 90, 'lever touch area is large', `${Math.round(leverBox.width)}x${Math.round(leverBox.height)}`);
  await api.step(0.4);
  check((await api.charge()) > 0.3, 'pressure rises while held', `charge=${(await api.charge()).toFixed(2)}`);
  await api.step(0.8);
  check(
    ['PRESS_BLAST_CONTROL', 'JETS_FILL', 'RAFT_ACCELERATES'].includes(await api.state()),
    'a real press on the lever fills the jets',
    await api.state(),
  );
  check((await api.contact()) > 0.05, 'water is landing on the raft', `contact=${(await api.contact()).toFixed(2)}`);
  check(
    (await api.shot()) === 'nozzleClose',
    'the contact moment stays on the close framing',
    await api.shot(),
  );
  await shot('05a-contact-close');
  await api.step(0.9);
  raft = await api.raft();
  check(raft.v > 0.5, 'raft climbs while the water is on', `v=${raft.v.toFixed(2)}`);

  await realLever(false);
  const before = (await api.raft()).v;
  await api.step(1.0);
  const after = (await api.raft()).v;
  check(after < before, 'letting go slows the raft', `${before.toFixed(2)} -> ${after.toFixed(2)}`);
  const resume = (await api.raft()).v;
  await realLever(true);
  await api.step(1.2);
  await shot('05-jets-push');
  check(
    (await api.raft()).v > resume,
    'pressing again speeds it up',
    `${resume.toFixed(2)} -> ${(await api.raft()).v.toFixed(2)}`,
  );

  await stepUntil(async () => (await api.crests()) > 0, 14);
  check((await api.crests()) === 1, 'raft gets over the top', `x=${(await api.raft()).x.toFixed(1)}`);
  await shot('06-crest', 0);
  await realLever(false);
  await stepUntil(async () => (await api.finishes()) > 0, 14);
  check((await api.finishes()) === 1, 'raft lands in the runout', await api.state());
  await shot('07-splash-finish', 1.2);

  await api.step(2.6);
  check(
    (await api.shot()) === 'review',
    'the run ends by looking back down the line it drew',
    await api.shot(),
  );
  await shot('07b-trail-review');

  note('\n— run 2: one bag lighter —');
  await stepUntil(inState('RELEASE_TEST_RAFT'), 22);
  check((await api.run()) === 1, 'second run selected', `run=${await api.run()}`);
  check((await api.bags()) === 0, 'rig took the bag off: lighter raft', `bags=${await api.bags()}`);
  const lightMass = (await api.raft()).mass;
  await shot('08-staging-run2-light', 1.4);
  await api.swipe();
  await stepUntil(inState('RAFT_RESTS_BEFORE_HILL', 'DISCOVER_NOZZLES'), 26);
  await api.press(true);
  await api.step(1.9);
  await api.press(false);
  await stepUntil(async () => (await api.crests()) > 1, 12);
  check((await api.crests()) === 2, 'a short blast is enough for the light raft', 'held 1.9s from rest');
  await stepUntil(async () => (await api.finishes()) > 1, 16);

  note('\n— run 3: two bags heavier —');
  await stepUntil(inState('RELEASE_TEST_RAFT'), 22);
  check((await api.run()) === 2, 'third run selected', `run=${await api.run()}`);
  check((await api.bags()) === 2, 'rig loaded two bags', `bags=${await api.bags()}`);
  const heavyMass = (await api.raft()).mass;
  check(heavyMass > lightMass, 'heavy raft really is heavier', `${lightMass}kg -> ${heavyMass}kg`);
  await shot('09-staging-run3-heavy', 1.4);
  await api.swipe();
  await stepUntil(inState('RAFT_RESTS_BEFORE_HILL', 'DISCOVER_NOZZLES'), 26);
  await api.press(true);
  await api.step(1.9);
  await api.press(false);
  await api.step(6);
  check((await api.crests()) === 2, 'the same short blast does not lift the heavy raft', `x=${(await api.raft()).x.toFixed(1)}`);
  await stepUntil(inState('RAFT_RESTS_BEFORE_HILL', 'DISCOVER_NOZZLES'), 26);
  await api.press(true);
  await stepUntil(async () => (await api.crests()) > 2, 18);
  check((await api.crests()) === 3, 'holding longer gets the heavy raft over', '');
  await api.press(false);
  await stepUntil(async () => (await api.finishes()) > 2, 16);

  note('\n— run 4: two blast zones —');
  await stepUntil(inState('RELEASE_TEST_RAFT'), 22);
  check((await api.run()) === 3, 'fourth run selected', `run=${await api.run()}`);
  check((await api.bags()) === 2, 'same weight as run three', `bags=${await api.bags()}`);
  await shot('10-staging-run4-split', 1.4);
  await api.swipe();
  await stepUntil(inState('RAFT_RESTS_BEFORE_HILL', 'DISCOVER_NOZZLES'), 26);
  await api.press(true);
  await stepUntil(async () => (await api.crests()) > 3, 20);
  check((await api.crests()) === 4, 'holding through both zones crests', '');
  await api.press(false);
  await stepUntil(async () => (await api.finishes()) > 3, 16);
  check((await api.finishes()) === 4, 'run four finishes', await api.state());
  await shot('11-run4-finish', 1.2);

  note('\n— replay path —');
  await api.replay();
  await api.step(0.4);
  const afterReplay = await api.state();
  await stepUntil(inState('RELEASE_TEST_RAFT'), 8);
  check(
    (await api.state()) === 'RELEASE_TEST_RAFT',
    'replay control returns to staging in one tap',
    `${afterReplay} -> ${await api.state()}`,
  );
  check(
    (await api.run()) === 2,
    'after the fourth run the sequence keeps offering one changed variable',
    `run=${await api.run()} bags=${await api.bags()}`,
  );

  note('\n— screen sizes —');
  // Rotate while a raft is actually running, so state preservation is real.
  await api.swipe();
  await api.step(2.4);
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    const raftBefore = (await api.raft()).s;
    const stateBefore = await api.state();
    await page.setViewportSize(size);
    for (let i = 0; i < 30; i++) {
      const w = await page.evaluate(() => window.__wb.windowSize());
      if (w.w === size.width && w.h === size.height) break;
      await sleep(200);
    }
    await sleep(350);
    await api.step(0.3);
    const info = await page.evaluate(() => ({
      canvas: window.__wb.canvasSize(),
      win: window.__wb.windowSize(),
      portrait: window.__wb.portrait(),
      s: window.__wb.raft().s,
    }));
    check(
      info.canvas.w === size.width && info.canvas.h === size.height,
      `renders at ${name}`,
      `${info.canvas.w}x${info.canvas.h} win=${info.win.w}x${info.win.h} portrait=${info.portrait}`,
    );
    check(
      info.portrait === size.height >= size.width,
      `orientation understood at ${name}`,
      `portrait=${info.portrait}`,
    );
    check(
      Math.abs(info.s - raftBefore) < 6 && info.s > 1,
      `keeps the run going through the rotation to ${name}`,
      `${stateBefore} s ${raftBefore.toFixed(1)} -> ${info.s.toFixed(1)}`,
    );
    await shot(`12-${name}`);
  }

  note('\n— boot —');
  note(`  note scene build took ${Math.round(await ev(() => window.__wb.bootMs()))} ms (software GL)`);

  note('\n— audio —');
  note(`  note audio context running: ${await api.audio()}`);

  note('\n— console and coverage —');
  const filtered = errors.filter((e) => !/Failed to load resource: net::ERR_/.test(e));
  check(filtered.length === 0, 'no console errors', filtered.slice(0, 4).join(' | '));

  const history = await api.history();
  const required = [
    'OBSERVE_VALLEY',
    'RELEASE_TEST_RAFT',
    'RAFT_COASTS',
    'RAFT_RESTS_BEFORE_HILL',
    'DISCOVER_NOZZLES',
    'PRESS_BLAST_CONTROL',
    'JETS_FILL',
    'RAFT_ACCELERATES',
    'CREST',
    'SPLASH_FINISH',
    'CHANGE_ONE_VARIABLE',
    'REPLAY',
  ];
  const missing = required.filter((s) => !history.includes(s));
  check(missing.length === 0, 'every state in the machine was reached', missing.join(','));
} catch (err) {
  fail.push(`exception: ${err?.stack ?? err}`);
  console.error(err);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

if (fail.length) {
  console.log(`\n${fail.length} check(s) failed:`);
  for (const f of fail) console.log(` - ${f}`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
// The preview server keeps the event loop alive; the run is over.
process.exit(0);
