// E2E から「実際の指の動き」を再現するための道具。
export async function waitReady(page) {
  await page.waitForFunction(() => window.__TAKENOKO__ && window.__TAKENOKO__.ready, null, { timeout: 30000 });
}

export const state = (page) => page.evaluate(() => window.__TAKENOKO__.state());
export const advance = (page, s) => page.evaluate((sec) => window.__TAKENOKO__.advance(sec), s);
export const siteScreen = (page, i) => page.evaluate((n) => window.__TAKENOKO__.siteScreen(n), i);
export const siteRadiusPx = (page, i) => page.evaluate((n) => window.__TAKENOKO__.siteRadiusPx(n), i);
export const siteInfo = (page, i) => page.evaluate((n) => window.__TAKENOKO__.siteInfo(n), i);
export const focusScreen = (page) => page.evaluate(() => window.__TAKENOKO__.focusScreen());

/** 指定の状態になるまで論理時間を進める */
export async function waitState(page, want, maxSeconds = 14) {
  const wanted = Array.isArray(want) ? want : [want];
  for (let t = 0; t < maxSeconds * 10; t++) {
    const s = await state(page);
    if (wanted.includes(s.state) && !s.locked) return s;
    await advance(page, 0.1);
  }
  const s = await state(page);
  throw new Error(`状態 ${wanted.join('|')} にならなかった: ${JSON.stringify(s)}`);
}

export async function tapAt(page, x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
}

/** こするように払う */
export async function brushOver(page, cx, cy, r) {
  await page.mouse.move(cx - r, cy);
  await page.mouse.down();
  for (let pass = 0; pass < 6; pass++) {
    const yy = cy - r * 0.8 + (pass / 5) * r * 1.6;
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = pass % 2 === 0 ? i / steps : 1 - i / steps;
      await page.mouse.move(cx - r * 1.1 + t * r * 2.2, yy);
    }
  }
  await page.mouse.up();
}

/** 円を描いて掘る。turns 周ぶん */
export async function circleDrag(page, cx, cy, r, turns = 3, stepsPerTurn = 26) {
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let i = 1; i <= turns * stepsPerTurn; i++) {
    const a = (i / stepsPerTurn) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62);
  }
  await page.mouse.up();
}

export async function swipeH(page, cx, cy, dist) {
  await page.mouse.move(cx - dist / 2, cy);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) await page.mouse.move(cx - dist / 2 + (dist * i) / 16, cy);
  await page.mouse.up();
}

export async function swipeUp(page, cx, cy, dist) {
  await page.mouse.move(cx, cy + dist / 2);
  await page.mouse.down();
  for (let i = 1; i <= 18; i++) await page.mouse.move(cx, cy + dist / 2 - (dist * i) / 18);
  await page.mouse.up();
}
