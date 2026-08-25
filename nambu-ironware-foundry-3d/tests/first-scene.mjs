import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const window={};window.window=window;const context={window,Math};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'js/gesture.js'),'utf8'),context,{filename:'gesture.js'});
const {CircularGestureTracker,FormingMath}=window.Nambu;

const tracker=new CircularGestureTracker({assist:.62});
const width=1024,height=768,cx=185,cy=505,r=120,points=96;
tracker.begin(cx+r,cy,width,height);let previous=0,quarter=0,firstMove=0;
for(let i=1;i<=points;i++){
  const a=i/points*Math.PI*2;const sample=tracker.move(cx+Math.cos(a)*r,cy+Math.sin(a)*r,width,height);
  assert.ok(sample.progress>=previous-1e-9,'progress must be monotonic');
  previous=sample.progress;if(i===1)firstMove=sample.progress;if(i===Math.floor(points/4))quarter=sample.progress;
}
assert.ok(firstMove>.005,'the very first meaningful movement must change progress');
assert.ok(quarter>.08,'the object must react during the first quarter turn');
assert.ok(tracker.progress>.95,'one large off-centre circle must complete the forming gesture');

const partial=new CircularGestureTracker({assist:.62});partial.begin(700,250,width,height);for(let i=1;i<=18;i++){const a=i/72*Math.PI*2;partial.move(700+Math.cos(a)*110,250+Math.sin(a)*110,width,height)}assert.ok(partial.progress>.03&&partial.progress<.65,'partial movement must visibly progress without instantly completing');

const line=new CircularGestureTracker({assist:.62});line.begin(120,400,width,height);for(let i=1;i<=50;i++)line.move(120+i*10,400,width,height);assert.ok(line.progress<tracker.progress,'a straight swipe must be less effective than a circle');

const q=.55,raw=FormingMath.bandRadius(0,0,q,.3),half=FormingMath.bandRadius(.5,0,q,.3),formed=FormingMath.bandRadius(1,0,q,.3),fine=FormingMath.bandRadius(1,1,q,.3),target=FormingMath.profileRadius(q);
assert.notEqual(raw,half,'radius must change during rough turning');
assert.notEqual(half,formed,'radius must continue changing to the end');
assert.ok(Math.abs(fine-target)<Math.abs(formed-target)+1e-9,'fine turning must converge on the target profile');
assert.ok(Math.abs(raw-target)>.04,'the unturned mound must be visibly different from the final silhouette');

const rawA=FormingMath.surfaceRadius(0,0,.52,0,.33),rawB=FormingMath.surfaceRadius(0,0,.52,Math.PI*.4,.33),turnedA=FormingMath.surfaceRadius(1,0,.52,0,.33),fineA=FormingMath.surfaceRadius(1,1,.52,0,.33),fineB=FormingMath.surfaceRadius(1,1,.52,Math.PI*.4,.33);
assert.ok(Math.abs(rawA-rawB)>.008,'packed sand must begin with readable angular irregularity');
assert.ok(Math.abs(fineA-fineB)<Math.abs(rawA-rawB),'fine turning must reduce angular surface noise');
assert.ok(Math.abs(turnedA-FormingMath.profileRadius(.52))<Math.abs(rawA-FormingMath.profileRadius(.52)),'rough turning must move the continuous surface toward the kettle profile');
assert.ok(FormingMath.formationAt(.04,1)>0,'the first meaningful movement must deform the top of the body immediately');
console.log('Validated off-centre circular gesture, first-movement response, and continuous rough/fine shape transformation.');
