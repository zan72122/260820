import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const required=['index.html','styles.css','manifest.webmanifest','sw.js','js/bootstrap.js','js/data.js','js/core.js','js/models.js','js/game.js','js/ui.js','js/main.js','icons/icon.svg','icons/maskable.svg','README.md','THIRD_PARTY_NOTICES.md'];
for(const file of required)assert.ok(fs.existsSync(path.join(root,file)),`missing ${file}`);
const context={window:{}};context.window.window=context.window;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'js/data.js'),'utf8'),context,{filename:'data.js'});
const N=context.window.Nambu;
assert.equal(N.STEPS.length,48,'manufacturing process must contain 48 steps');
assert.equal(N.CHAPTERS.length,4,'must contain 4 chapters');
assert.ok(N.SCENES.length>=13,'must contain at least 13 interactive scenes');
assert.deepEqual([...N.STEPS].map(s=>s.n),Array.from({length:48},(_,i)=>i+1),'step numbering must be contiguous');
assert.equal(new Set(N.SCENES.map(s=>s.id)).size,N.SCENES.length,'scene ids must be unique');
assert.equal(new Set(N.STEPS.filter(s=>s.mode==='interactive').map(s=>s.scene)).size,N.SCENES.length,'every scene must own an interactive step');
for(const scene of N.SCENES){assert.ok(scene.steps.length>0,`${scene.id} has no steps`);for(const n of scene.steps)assert.ok(n>=1&&n<=48,`${scene.id} references invalid step ${n}`)}
const assigned=[...N.SCENES].flatMap(s=>[...s.steps]);const covered=new Set(assigned);assert.equal(assigned.length,48,'every step must be assigned exactly once');assert.equal(covered.size,48,'all 48 steps must be assigned to a scene');
for(const step of N.STEPS.filter(s=>s.mode==='interactive')){const owner=N.SCENES.find(scene=>scene.steps.includes(step.n));assert.equal(owner?.id,step.scene,`interactive step ${step.n} must match its scene`)}
for(const [index,chapter] of N.CHAPTERS.entries()){const steps=N.STEPS.filter(step=>step.chapter===index).map(step=>step.n);assert.equal(Math.min(...steps),chapter.start,`${chapter.id} start mismatch`);assert.equal(Math.max(...steps),chapter.end,`${chapter.id} end mismatch`)}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const id of ['titleScreen','startButton','hud','instruction','settingsPanel','processPanel','completion'])assert.match(html,new RegExp(`id="${id}"`),`missing #${id}`);const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length,'HTML ids must be unique');for(const ref of [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]).filter(ref=>!ref.startsWith('http')&&!ref.startsWith('#'))){assert.ok(fs.existsSync(path.join(root,ref)),`missing referenced asset ${ref}`)}
for(const file of required.filter(f=>/\.(js|html|css|mjs)$/.test(f))){const text=fs.readFileSync(path.join(root,file),'utf8');assert.ok(!/\bTODO\b|\bFIXME\b/.test(text),`${file} contains unfinished marker`)}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));assert.equal(manifest.display,'standalone');assert.equal(manifest.lang,'ja');
console.log(`Validated ${N.STEPS.length} steps, ${N.SCENES.length} interactive scenes, ${N.CHAPTERS.length} chapters.`);
