import { test, expect } from '@playwright/test';

/**
 * The listening mechanic is the game. These checks run the real Web Audio graph
 * behind a real user gesture — the same path iOS requires — and exercise every
 * synthesised call, so a broken node graph fails here instead of silently
 * leaving a blindfolded four-year-old with nothing to steer by.
 */
test('voices, cues and the impact all build a valid audio graph', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/?e2e=1');
  await page.waitForSelector('body[data-ready="1"]', { timeout: 90_000 });

  // a genuine tap: this is the gesture the AudioContext needs
  await page.click('#startBtn');
  await expect.poll(
    () => page.evaluate(() => window.__suika.audio.ctx?.state),
    { timeout: 10_000 },
  ).toBe('running');

  const result = await page.evaluate(async () => {
    const { audio, WORD_TEXT } = window.__suika;
    const words = Object.keys(WORD_TEXT);
    const src = audio.createSource('probe');
    const spoken = [];
    for (const w of words) {
      src.setSpatial(Math.random() * 2 - 1, 1 + Math.random() * 6, 1);
      spoken.push(audio.speak('probe', w, { f0: 300, formantScale: 1.2, excitement: 0.7 }));
    }
    audio.clap('probe', 0.5);
    audio.footstep();
    audio.whoosh();
    audio.impact();
    audio.splash();
    audio.hush();
    audio.unhush();
    return { words: words.length, spoken: spoken.filter(Boolean).length, sources: audio.sources.size };
  });

  expect(result.words).toBeGreaterThan(10);
  expect(result.spoken).toBe(result.words);   // every call produced a caption
  expect(result.sources).toBeGreaterThan(0);

  // let the scheduled nodes actually run
  await page.waitForTimeout(1200);
  expect(errors).toEqual([]);
});

test('a source to the left pans left, and turning brings it to the middle', async ({ page }) => {
  await page.goto('/?e2e=1');
  await page.waitForSelector('body[data-ready="1"]', { timeout: 90_000 });
  await page.click('#startBtn');
  await expect.poll(() => page.evaluate(() => window.__suika.audio.ctx?.state), { timeout: 10_000 })
    .toBe('running');

  const pans = await page.evaluate(() => {
    const g = window.__suika.game;
    const a = window.__suika.audio;
    // put a caller exactly to the avatar's left, then rotate to face it
    const f = g.friends[0];
    const read = () => f.source.pan;
    const yaw0 = g.avatar.yaw;
    // world bearing of the caller from the avatar
    const bearing = Math.atan2(
      f.ch.root.position.x - g.avatar.pos.x,
      f.ch.root.position.z - g.avatar.pos.z,
    );
    // increasing yaw turns the avatar left, so facing a quarter-turn clockwise
    // of the caller puts the caller off the avatar's left shoulder
    g.avatar.yaw = bearing - Math.PI / 2;
    g._updateAudioSpace();
    const whenLeft = read();
    g.avatar.yaw = bearing;               // now facing straight at them
    g._updateAudioSpace();
    const whenAhead = read();
    g.avatar.yaw = bearing + Math.PI / 2; // caller now off the right shoulder
    g._updateAudioSpace();
    const whenRight = read();
    g.avatar.yaw = yaw0;
    return { whenLeft, whenAhead, whenRight, ctx: a.ctx.state };
  });

  expect(pans.whenLeft).toBeLessThan(-0.7);
  expect(Math.abs(pans.whenAhead)).toBeLessThan(0.15);
  expect(pans.whenRight).toBeGreaterThan(0.7);
});
