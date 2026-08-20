import { open } from './harness.mjs';
const size = process.argv[2] || 'phone';
const app = await open(size, { fast: false, dpr: 1 });
await app.sim(3.3, true); await app.shot(`hint-${size}-3s`);
await app.sim(3.2, true); await app.shot(`hint-${size}-6s`);
await app.sim(3.4, true); await app.shot(`hint-${size}-9s`);
console.log(app.logs.filter((l)=>!l.includes('toNonIndexed')).join('\n') || 'clean');
await app.close();
