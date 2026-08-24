import { Page, expect } from '@playwright/test';

export interface MonoState {
  phase: string;
  t: number;
  lockExt: number;
  lockedSide: string;
  lever: number;
  firstRunDone: boolean;
  runCount: number;
  occupied: boolean;
  hint: number;
  metrics: { fps: number; ms: number; calls: number; tris: number; dpr: number };
}

export async function boot(page: Page, opts: { fast?: number; w?: number; h?: number } = {}): Promise<void> {
  if (opts.w && opts.h) await page.setViewportSize({ width: opts.w, height: opts.h });
  await page.goto(`/?e2e=1&fast=${opts.fast ?? 1}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!(window as any).__mono);
  await page.waitForTimeout(600);
}

export function state(page: Page): Promise<MonoState> {
  return page.evaluate(() => {
    const m = (window as any).__mono;
    return {
      phase: m.phase, t: m.t, lockExt: m.lockExt, lockedSide: m.lockedSide,
      lever: m.lever, firstRunDone: m.firstRunDone, runCount: m.runCount,
      occupied: m.occupied, hint: m.hint, metrics: m.metrics,
    };
  });
}

/** one-finger slide; dir -1 = towards the straight route, +1 = curve */
export async function slide(page: Page, dir: 1 | -1, opts: { frac?: number; diagonal?: number; steps?: number } = {}): Promise<void> {
  const vp = page.viewportSize()!;
  const frac = opts.frac ?? 0.45;
  const cx = vp.width / 2, cy = vp.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const steps = opts.steps ?? 10;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      cx + dir * (i / steps) * vp.width * frac,
      cy + (opts.diagonal ?? 0) * (i / steps),
      { steps: 1 },
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

export async function waitPhase(page: Page, phase: string, timeout = 60_000): Promise<void> {
  await page.waitForFunction((p) => (window as any).__mono.phase === p, phase, { timeout });
}

/** run one full conversion (idle -> ... -> locked/idle), no train wait */
export async function convert(page: Page, dir: 1 | -1): Promise<void> {
  await slide(page, dir);
  await waitPhase(page, 'traverse');
  await page.waitForFunction(() => ['signal', 'train', 'idle'].includes((window as any).__mono.phase), null, { timeout: 60_000 });
}

export async function setSpeed(page: Page, x: number): Promise<void> {
  await page.evaluate((v) => (window as any).__mono.setTimeScale(v), x);
}
