import { open } from './harness.mjs';
const app = await open('phone');
await app.sim(0.6);
// audio must start from a user gesture, not before
const before = await app.page.evaluate(() => (window.AudioContext ? 'available' : 'missing'));
await app.page.mouse.click(200, 500);
await app.sim(0.4);
await app.page.click('#gearBtn');
await app.sim(0.2, true);
await app.shot('settings-open');
const state0 = await app.page.evaluate(() => JSON.parse(localStorage.getItem('imo.settings.v1') || '{}'));
await app.page.click('#motionToggle');
await app.page.click('#hapticToggle');
await app.page.evaluate(() => {
  const v = document.getElementById('vol');
  v.value = '25';
  v.dispatchEvent(new Event('input', { bubbles: true }));
});
await app.sim(0.3, true);
const state1 = await app.page.evaluate(() => JSON.parse(localStorage.getItem('imo.settings.v1') || '{}'));
await app.shot('settings-changed');
// panel closes when tapping the field
await app.page.mouse.click(200, 700);
await app.sim(0.3);
const open2 = await app.page.evaluate(() => document.getElementById('panel').classList.contains('open'));
console.log('AudioContext', before);
console.log('before', JSON.stringify(state0), '\nafter ', JSON.stringify(state1));
console.log('panel closed on field tap:', !open2);
console.log('errors:', (await app.page.evaluate(() => window.__imo.errors)).length);
await app.close();
