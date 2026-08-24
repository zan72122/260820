import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const backing=new Map([
  ['nambu-complete-settings',JSON.stringify({scale:999,assist:-50,autoAdvance:0,quality:'1'})],
  ['nambu-complete-save',JSON.stringify({scene:999,completedSteps:[1,1,0,49,'2'],completedScenes:['turn','missing','turn'],seed:'44',playSeconds:-3,bestPrecision:{1:4,2:-1,bad:'x'},finished:1})]
]);
const localStorage={getItem:key=>backing.get(key)??null,setItem:(key,value)=>backing.set(key,String(value))};
const window={localStorage};window.window=window;
const context={window,localStorage,document:{querySelector:()=>null,querySelectorAll:()=>[]},navigator:{},THREE:{MathUtils:{lerp:(a,b,t)=>a+(b-a)*t}},setTimeout,clearTimeout,console};
vm.createContext(context);
for(const file of ['js/data.js','js/core.js','js/game.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const N=window.Nambu;
const store=new N.Store();
assert.equal(store.settings.scale,128,'numeric settings are clamped');
assert.equal(store.settings.assist,0,'lower setting bound is enforced');
assert.equal(store.settings.autoAdvance,false,'toggle settings are normalized');
assert.equal(store.settings.quality,1,'numeric strings are normalized');
assert.equal(store.save.scene,N.SCENES.length-1,'scene is clamped');
assert.deepEqual(Array.from(store.save.completedSteps),[1,2],'completed steps are deduplicated and sanitized');
assert.deepEqual(Array.from(store.save.completedScenes),['turn'],'completed scenes are sanitized');
assert.equal(store.save.seed,44);
assert.equal(store.save.playSeconds,0);
assert.equal(store.save.bestPrecision[1],1);
assert.equal(store.save.bestPrecision[2],0);
assert.equal(store.save.bestPrecision.bad,undefined);
assert.equal(store.save.finished,true);
assert.equal(typeof N.Game.prototype.startScene,'function');
assert.equal(typeof N.Game.prototype.completeGame,'function');
console.log('Validated persistence migration, bounds, and completion state model.');
