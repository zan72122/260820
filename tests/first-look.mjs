import { launch, shot, state } from './shot.mjs';
const { browser, page, logs } = await launch(process.argv[2] || 'desk');
console.log(JSON.stringify(await state(page), null, 1));
await shot(page, 'first-' + (process.argv[2] || 'desk'));
await page.waitForTimeout(4000);
await shot(page, 'first-hint-' + (process.argv[2] || 'desk'));
console.log(logs.slice(0, 25).join('\n'));
await browser.close();
