import { Page, expect } from '@playwright/test';

/** ?e2e=1: RAF はシミュレーションを進めず、step() でのみ進む決定的モード */
export async function boot(page: Page, query = '?e2e=1&fast=1'): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => !!window.__game, undefined, { timeout: 15_000 });
}

export async function api<T>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    ({ fn, args }) => {
      const g = window.__game as unknown as Record<string, (...a: unknown[]) => unknown>;
      return g[fn](...args) as never;
    },
    { fn, args },
  );
}

export async function step(page: Page, seconds: number): Promise<void> {
  await api(page, 'step', seconds);
}

/** phase が目標になるまで step を繰り返す(決定的・最大 maxSimSeconds) */
export async function stepUntilPhase(
  page: Page,
  phase: string,
  maxSimSeconds = 120,
): Promise<void> {
  for (let t = 0; t < maxSimSeconds; t += 2) {
    const p = await api<string>(page, 'phase');
    if (p === phase) return;
    await step(page, 2);
  }
  expect(await api<string>(page, 'phase')).toBe(phase);
}

/** イントロ〜調律〜カーテン学習を早送りして、試験2の経路描画まで進める */
export async function fastForwardToTrial2(page: Page): Promise<void> {
  await api(page, 'startGame');
  await stepUntilPhase(page, 'lensPrompt', 90);
  await api(page, 'openLens');
  await stepUntilPhase(page, 'calibrate', 90);
  await api(page, 'setDepth', 1.9);
  await step(page, 0.5);
  await api(page, 'closeLens');
  await stepUntilPhase(page, 'trialDraw', 180);
}
