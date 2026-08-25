import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

fs.mkdirSync('e2e-artifacts',{recursive:true});
const errors=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
try{
  const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1,hasTouch:true,isMobile:false});
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.goto('http://127.0.0.1:8000/?e2e=1',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__NAMBU_GAME__&&window.__NAMBU_E2E__&&window.__NAMBU_VISUAL_REVISION__==='3.0',null,{timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('#loading')?.classList.contains('active'),null,{timeout:10000});

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
  const start=await page.evaluate(()=>({game:window.__NAMBU_GAME__.game.localProgress,visual:window.__NAMBU_E2E__.snapshot()}));
  const cx=235,cy=505,r=122,segments=104;
  await page.mouse.move(cx+r,cy);await page.mouse.down();
  let early=null,half=null;
  for(let i=1;i<=segments;i++){
    const a=i/segments*Math.PI*2;
    await page.mouse.move(cx+Math.cos(a)*r,cy+Math.sin(a)*r,{steps:1});
    if(i===8)early=await page.evaluate(()=>({game:window.__NAMBU_GAME__.game.localProgress,visual:window.__NAMBU_E2E__.snapshot()}));
    if(i===52){half=await page.evaluate(()=>({game:window.__NAMBU_GAME__.game.localProgress,visual:window.__NAMBU_E2E__.snapshot()}));await page.waitForTimeout(120);await page.screenshot({path:'e2e-artifacts/04-half-turned.png'})}
  }
  await page.mouse.up();
  assert.ok(early.game>.005,'the first few centimetres of movement must immediately change progress');
  assert.ok(Math.abs(early.visual.averageRadius-start.visual.averageRadius)>.001,'the central object radius must change immediately');
  assert.ok(half.game>early.game,'gesture progress must continue increasing');
  assert.ok(Math.abs(half.visual.maxRadius-half.visual.minRadius)>.25,'the half-turned object must already have a readable silhouette');
  await page.waitForFunction(()=>window.__NAMBU_GAME__.store.save.completedSteps.includes(8),null,{timeout:15000});
  const done=await page.evaluate(()=>window.__NAMBU_E2E__.snapshot());
  assert.ok(done.rough>.98,'rough turning must reach the finished profile');
  assert.equal(done.surfaceType,'continuous-mesh');
  await page.waitForTimeout(160);await page.screenshot({path:'e2e-artifacts/05-rough-turn-complete.png'});
  assert.deepEqual(errors,[],'browser must not report runtime errors');
  console.log(JSON.stringify({beforeBuild,middleBuild,readyBuild,start,early,half,done},null,2));
}finally{await browser.close()}
