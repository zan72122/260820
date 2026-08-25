import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

fs.mkdirSync('e2e-artifacts',{recursive:true});
const errors=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});

async function drawCircle(page,{cx,cy,r,segments=104,onSample=async()=>{}}){
  await page.mouse.move(cx+r,cy);await page.mouse.down();
  for(let i=1;i<=segments;i++){
    const a=i/segments*Math.PI*2;
    await page.mouse.move(cx+Math.cos(a)*r,cy+Math.sin(a)*r,{steps:1});
    await onSample(i);
  }
  await page.mouse.up();
}

try{
  const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1,hasTouch:true,isMobile:false});
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.goto('http://127.0.0.1:8000/?e2e=1',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__NAMBU_GAME__&&window.__NAMBU_E2E__&&window.__NAMBU_VISUAL_REVISION__==='4.0',null,{timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('#loading')?.classList.contains('active'),null,{timeout:10000});

  const loading=await page.evaluate(()=>window.__NAMBU_E2E__.loadingState());
  assert.equal(loading.display,'none','the loading layer must leave layout after boot');
  assert.equal(loading.pointerEvents,'none','the loading layer must not intercept touch after boot');

  const beforeBuild=await page.evaluate(()=>window.__NAMBU_E2E__.setAuto(7,.06));
  await page.waitForTimeout(180);await page.screenshot({path:'e2e-artifacts/01-before-forming.png'});
  const middleBuild=await page.evaluate(()=>window.__NAMBU_E2E__.setAuto(7,.52));
  await page.waitForTimeout(180);await page.screenshot({path:'e2e-artifacts/02-sand-building.png'});
  const readyBuild=await page.evaluate(()=>window.__NAMBU_E2E__.setAuto(7,1));
  await page.waitForTimeout(180);await page.screenshot({path:'e2e-artifacts/03-rough-mound-ready.png'});
  assert.equal(readyBuild.surfaceType,'continuous-mesh','the sand body must be one continuous deformable mesh');
  assert.ok(beforeBuild.builtLevels<middleBuild.builtLevels,'sand body must grow during the auto step');
  assert.ok(middleBuild.builtLevels<readyBuild.builtLevels,'sand body must keep growing to the end');
  assert.ok(beforeBuild.topHeight<middleBuild.topHeight&&middleBuild.topHeight<readyBuild.topHeight,'the top surface must rise continuously');

  await page.evaluate(()=>window.__NAMBU_E2E__.startStep(8));
  await page.waitForFunction(()=>window.__NAMBU_GAME__.game.currentStep?.n===8&&window.__NAMBU_GAME__.game.mode==='play',null,{timeout:15000});
  const cx=235,cy=505,r=122,segments=104;
  const hit=await page.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);return{id:e?.id||'',tag:e?.tagName||''}},{x:cx+r,y:cy});
  assert.equal(hit.id,'gameCanvas','the visible workshop, not a transparent overlay, must receive the gesture');
  const start=await page.evaluate(()=>({game:window.__NAMBU_GAME__.game.localProgress,visual:window.__NAMBU_E2E__.snapshot()}));
  let firstMove=null,early=null,half=null;
  await drawCircle(page,{cx,cy,r,segments,onSample:async i=>{
    if(i===2){await page.waitForTimeout(35);firstMove=await page.evaluate(()=>({game:window.__NAMBU_GAME__.game.localProgress,visual:window.__NAMBU_E2E__.snapshot()}))}
    if(i===8){await page.waitForTimeout(50);early=await page.evaluate(()=>({game:window.__NAMBU_GAME__.game.localProgress,visual:window.__NAMBU_E2E__.snapshot()}))}
    if(i===52){half=await page.evaluate(()=>({game:window.__NAMBU_GAME__.game.localProgress,visual:window.__NAMBU_E2E__.snapshot()}));await page.waitForTimeout(120);await page.screenshot({path:'e2e-artifacts/04-half-turned.png'})}
  }});
  assert.ok(firstMove.game>.003,'the first few centimetres of movement must immediately change progress');
  assert.ok(Math.abs(firstMove.visual.averageRadius-start.visual.averageRadius)>.0025,'the central object radius must change on the first movement');
  assert.ok(early.game>firstMove.game,'visible progress must continue during the first arc');
  assert.ok(early.visual.firstMotionSeen,'the material model must record real tool motion');
  assert.ok(early.visual.freshCutOpacity>.01,'a physical freshly-cut sand trace must appear during movement');
  assert.ok(half.game>early.game,'gesture progress must continue increasing');
  assert.ok(Math.abs(half.visual.maxRadius-half.visual.minRadius)>.38,'the half-turned object must already have a strongly readable kettle silhouette');
  await page.waitForFunction(()=>window.__NAMBU_GAME__.store.save.completedSteps.includes(8),null,{timeout:15000});
  const roughDone=await page.evaluate(()=>window.__NAMBU_E2E__.snapshot());
  assert.ok(roughDone.rough>.98,'rough turning must reach the finished profile');
  assert.equal(roughDone.surfaceType,'continuous-mesh');
  await page.waitForTimeout(160);await page.screenshot({path:'e2e-artifacts/05-rough-turn-complete.png'});

  await page.evaluate(()=>window.__NAMBU_E2E__.startStep(11));
  await page.waitForFunction(()=>window.__NAMBU_GAME__.game.currentStep?.n===11&&window.__NAMBU_GAME__.game.mode==='play',null,{timeout:15000});
  const fineStart=await page.evaluate(()=>window.__NAMBU_E2E__.snapshot());
  let fineHalf=null;
  await drawCircle(page,{cx:760,cy:465,r:118,segments,onSample:async i=>{
    if(i===52){await page.waitForTimeout(80);fineHalf=await page.evaluate(()=>window.__NAMBU_E2E__.snapshot());await page.screenshot({path:'e2e-artifacts/06-fine-surface-half.png'})}
  }});
  assert.ok(fineHalf.fine>.2,'fine true-mud must begin changing during the gesture');
  assert.ok(fineHalf.materialRoughness<fineStart.materialRoughness-.035,'fine turning must visibly reduce surface roughness');
  assert.ok(fineHalf.materialBumpScale<fineStart.materialBumpScale-.006,'fine turning must reduce coarse surface relief');
  assert.ok(fineHalf.angularVariation<fineStart.angularVariation,'fine turning must reduce angular surface irregularity');
  await page.waitForFunction(()=>window.__NAMBU_GAME__.store.save.completedSteps.includes(11),null,{timeout:15000});
  const fineDone=await page.evaluate(()=>window.__NAMBU_E2E__.snapshot());
  await page.waitForTimeout(140);await page.screenshot({path:'e2e-artifacts/07-fine-surface-complete.png'});

  const evidence={loading,beforeBuild,middleBuild,readyBuild,start,firstMove,early,half,roughDone,fineStart,fineHalf,fineDone,errors};
  fs.writeFileSync('e2e-artifacts/state.json',JSON.stringify(evidence,null,2));
  assert.deepEqual(errors,[],'browser must not report runtime errors');
  console.log(JSON.stringify(evidence,null,2));
}finally{await browser.close()}
