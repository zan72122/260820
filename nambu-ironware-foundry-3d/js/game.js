(function(){
  'use strict';
  const N=window.Nambu,U=N.util;

  class Game{
    constructor(core,world,store){
      this.core=core;this.world=world;this.store=store;this.mode='loading';this.sceneIndex=U.clamp(store.save.scene||0,0,N.SCENES.length-1);this.timelineIndex=0;this.currentStep=null;this.localProgress=0;this.stepStartedAt=0;this.autoElapsed=0;this.autoDuration=1.15;this.autoResolve=null;this.autoSkipped=false;this.chapterShown=new Set();this.pointer=new Map();this.dragDistance=0;this.lastPointer={x:0,y:0};this.interaction={};this.lookYaw=0;this.lookPitch=0;this.idle=0;this.completedThisRun=0;this.precision=[];this._finishTimer=null;this._advanceTimer=null;this._returnCue=false;this.bindInput();
    }

    bindInput(){
      const el=this.core.renderer.domElement;
      el.addEventListener('pointerdown',e=>this.pointerDown(e),{passive:false});
      el.addEventListener('pointermove',e=>this.pointerMove(e),{passive:false});
      el.addEventListener('pointerup',e=>this.pointerUp(e),{passive:false});
      el.addEventListener('pointercancel',e=>this.pointerUp(e),{passive:false});
      el.addEventListener('contextmenu',e=>e.preventDefault());
    }

    pointerDown(e){
      if(!['play','title','free'].includes(this.mode))return;e.preventDefault();this.core.audio.resume();this.pointer.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,time:performance.now()});this.lastPointer={x:e.clientX,y:e.clientY};this.dragDistance=0;this.idle=0;this.interaction.holding=true;this.interaction.holdTime=0;this.interaction.lastAngle=Math.atan2(e.clientY-innerHeight*.52,e.clientX-innerWidth*.5);try{e.currentTarget.setPointerCapture(e.pointerId)}catch(_){/* ignore */}
      if(this.mode==='title')this.world.setCameraPose('title');
    }

    pointerMove(e){
      const p=this.pointer.get(e.pointerId);if(!p||!['play','title','free'].includes(this.mode))return;e.preventDefault();const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;this.dragDistance+=Math.hypot(dx,dy);this.idle=0;
      if(this.mode==='title'||this.mode==='free'){this.lookYaw=U.clamp(this.lookYaw-dx*.0026,-.65,.65);this.lookPitch=U.clamp(this.lookPitch+dy*.0016,-.28,.28);return}
      const angle=Math.atan2(e.clientY-innerHeight*.52,e.clientX-innerWidth*.5),da=Math.atan2(Math.sin(angle-this.interaction.lastAngle),Math.cos(angle-this.interaction.lastAngle));this.interaction.lastAngle=angle;this.handleGesture(dx,dy,da,e);
    }

    pointerUp(e){
      const p=this.pointer.get(e.pointerId);if(!p)return;e.preventDefault();const elapsed=performance.now()-p.time,dist=Math.hypot(e.clientX-p.startX,e.clientY-p.startY);this.pointer.delete(e.pointerId);if(dist<13&&elapsed<480&&this.mode==='play')this.handleTap(e.clientX,e.clientY);if(this.pointer.size===0)this.interaction.holding=false;
    }

    startFromTitle(){
      this.core.audio.resume();if(this.store.save.finished){this.store.resetGame(true);this.resetRandomness();this.sceneIndex=0}else this.sceneIndex=U.clamp(this.store.save.scene||0,0,N.SCENES.length-1);this.completedThisRun=0;N.ui.hideTitle();this.startScene(this.sceneIndex,true);
    }

    startNew(){this.store.resetGame(true);this.resetRandomness();this.sceneIndex=0;this.chapterShown.clear();this.completedThisRun=0;N.ui.hideTitle();this.startScene(0,false)}


    resetRandomness(){this.core.rng=new N.RNG(this.store.save.seed);this.world.rng=this.core.rng}

    async startScene(index,continuing=false){
      clearTimeout(this._advanceTimer);this.sceneIndex=U.clamp(index,0,N.SCENES.length-1);this.store.save.scene=this.sceneIndex;this.store.persistSave();const scene=N.SCENES[this.sceneIndex];this.timelineIndex=0;this.localProgress=0;this.interaction={};this.precision=[];this.mode='transition';N.ui.setHudScene(scene);N.ui.showGameHud();this.world.setStage(scene.id);this.lookYaw=0;this.lookPitch=0;
      if(!this.chapterShown.has(scene.chapter)&&(!continuing||this.sceneIndex===0||this.sceneIndex===4||this.sceneIndex===8||this.sceneIndex===11)){
        this.chapterShown.add(scene.chapter);await N.ui.showChapter(N.CHAPTERS[scene.chapter]);
      }
      await this.advanceTimeline();
    }

    sceneTimeline(){const ids=N.SCENES[this.sceneIndex].steps;return ids.map(n=>N.STEPS[n-1])}

    async advanceTimeline(){
      const timeline=this.sceneTimeline();
      while(this.timelineIndex<timeline.length){
        const step=timeline[this.timelineIndex];this.currentStep=step;N.ui.setCurrentStep(step);N.ui.updateProgress(this.overallProgress());
        if(this.store.save.completedSteps.includes(step.n)){this.timelineIndex++;continue}
        if(step.mode==='auto'){
          await this.runAutoStep(step);this.completeStep(step,1);this.timelineIndex++;continue;
        }
        this.beginInteractiveStep(step);return;
      }
      await this.completeScene();
    }

    runAutoStep(step){
      this.mode='auto';this.autoElapsed=0;this.autoSkipped=false;this.autoDuration=(.85+Math.min(1.1,step.detail.length/62))*(86/this.core.settings.speed);N.ui.showAutoStep(step);return new Promise(resolve=>{this.autoResolve=resolve});
    }

    skipAuto(){if(this.mode==='auto')this.autoSkipped=true}

    beginInteractiveStep(step){
      this.mode='play';this.localProgress=0;this.stepStartedAt=this.core.time;this.interaction={holding:false,holdTime:0,travel:0,taps:0,stability:0,error:0,phase:0,coreX:.82,coreZ:.38,ladleLift:0,ladleX:-1.8,tilt:0,moldOpen:0,finish:0,handle:0,pour:0,returnWait:0,returnFlow:0};N.ui.hideAutoStep();N.ui.showInstruction(N.SCENES[this.sceneIndex]);this.initializeStepVisual(step);
    }

    initializeStepVisual(step){
      const w=this.world;
      if(step.n===8||step.n===11){w.turnRig.rotation.y=0}
      if(step.n===15){w.updateMoldArare(0)}
      if(step.n===18||step.n===19){w.bellowsLever.rotation.z=Math.PI/2}
      if(step.n===23){w.updateCorePosition(.82,.38)}
      if(step.n===24){w.coreObject.position.y=.72;w.coreSpout.position.y=1.15+.72}
      if(step.n===29){w.ladleRig.position.set(-1.9,1.05,1.75)}
      if(step.n===30){w.ladleRig.position.set(-2.15,2.1,1.75)}
      if(step.n===31){w.ladleRig.position.set(-.62,2.12,1.55);w.ladle.rotation.z=0}if(step.n===32){this.interaction.tilt=.43;w.ladleRig.position.set(-.62,2.12,1.55);w.ladle.rotation.z=-.43;w.updateMoltenStream(.65,0)}
      if(step.n===34||step.n===35){w.ladleRig.position.set(-.3,1.45,1.55);w.ladle.rotation.z=-.25;this._returnCue=false}
      if(step.n===37){w.moldLeft.position.x=0;w.moldRight.position.x=0;w.moldCracks.forEach(l=>l.material.opacity=0)}
      if(step.n===38){w.setCleanProgress(0)}
      if(step.n===40){w.grinder.position.set(.55,1.05,1.45)}
      if(step.n===42||step.n===44||step.n===45){w.applyFinish(step.n===42?0:step.n===44?.28:.58)}
      if(step.n===47){w.handle.position.y=1.55}
      if(step.n===48){w.kettle.rotation.z=0;w.updateWaterStream(0)}
    }

    handleGesture(dx,dy,da,e){
      const s=this.currentStep;if(!s)return;const w=this.world,assist=this.core.settings.assist/100,speed=this.core.settings.speed/78,weight=this.core.settings.weight/86;
      if(s.n===8||s.n===11){
        const motion=Math.abs(da)*1.2+(Math.abs(dx)+Math.abs(dy))*.0018;this.interaction.travel+=motion;w.turnRig.rotation.y+=da+dx*.004;w.mold.rotation.y+=dx*.0015;this.localProgress=U.clamp(this.interaction.travel/(s.n===8?5.6:4.2),0,1);const fine=s.n===11?this.localProgress:0;this.core.materials.sand.bumpScale=U.lerp(.075,.038,fine);if(Math.random()<motion*.45)w.spawn('dust',w.mold.position.clone().add(new THREE.Vector3(0,1.2,1.45)),1,.7);this.core.audio.sand(.45);
      }else if(s.n===18||s.n===19){
        const motion=Math.abs(dx)*.006+Math.abs(dy)*.002;this.interaction.travel+=motion;const cycle=Math.sin(this.interaction.travel*3.2);w.bellows.children[0].rotation.z=.08+cycle*.09;w.bellows.children[1].rotation.z=-.08-cycle*.09;w.bellowsSkin.scale.y=.72+Math.abs(cycle)*.28;w.bellowsLever.rotation.z=Math.PI/2+cycle*.18;this.localProgress=U.clamp(this.interaction.travel/(s.n===18?7.2:4.2),0,1);if(Math.random()<motion*.8)w.spawn(s.n===18?'embers':'steam',w.mold.position.clone().add(new THREE.Vector3(-1.0,1.2,-.5)),1,1);this.core.audio.fire(.45);
      }else if(s.n===23){
        const scale=.005*(1+assist*.35);this.interaction.coreX=U.clamp(this.interaction.coreX+dx*scale,-1.1,1.1);this.interaction.coreZ=U.clamp(this.interaction.coreZ+dy*scale,-.75,.75);w.updateCorePosition(this.interaction.coreX,this.interaction.coreZ);const dist=Math.hypot(this.interaction.coreX,this.interaction.coreZ);this.localProgress=U.clamp(1-dist/1.05,0,1);if(dist<.12+.14*assist){this.interaction.holdTime+=(Math.abs(dx)+Math.abs(dy)<8?.055:0);if(this.interaction.holdTime>.28)this.localProgress=1}else this.interaction.holdTime=0;
      }else if(s.n===24){
        this.interaction.travel+=Math.max(0,dy)*.0048*speed;this.localProgress=U.clamp(this.interaction.travel,0,1);w.coreObject.position.y=U.lerp(.72,.22,this.localProgress);w.coreSpout.position.y=U.lerp(1.87,1.15,this.localProgress);w.runnerGroup.scale.setScalar(U.lerp(.96,1,this.localProgress));
      }else if(s.n===29){
        const hands=this.pointer.size>=2?1:.58+.42*assist;this.interaction.ladleLift=U.clamp(this.interaction.ladleLift-dy*.0038*speed/weight*hands,0,1);this.localProgress=this.interaction.ladleLift;w.ladleRig.position.y=U.lerp(1.05,2.1,this.localProgress);w.animateWorkers(this.localProgress,0,0);if(dy<0)this.core.audio.metal(.15);
      }else if(s.n===30){
        this.interaction.ladleX=U.clamp(this.interaction.ladleX+dx*.0048*speed/weight,-2.15,-.48);w.ladleRig.position.x=this.interaction.ladleX;const err=Math.abs(this.interaction.ladleX+.62);this.localProgress=U.clamp(1-err/1.53,0,1);this.interaction.error+=Math.abs(dy)*.001;w.animateWorkers(1,0,U.invLerp(-2.15,-.48,this.interaction.ladleX));if(err<.12+.18*assist)this.localProgress=1;
      }else if(s.n===31){
        this.interaction.tilt=U.clamp(this.interaction.tilt+dy*.0038*speed/weight,0,.68);w.ladle.rotation.z=-this.interaction.tilt;const flow=U.clamp((this.interaction.tilt-.16)/.42,0,1);w.updateMoltenStream(flow,(w.ladleRig.position.x+.62)*(.18*(1-assist)));this.localProgress=U.clamp(flow*1.35,0,1);this.interaction.error+=Math.abs(dx)*.0007;this.core.audio.pour(flow*.12);
      }else if(s.n===32){
        this.interaction.tilt=U.clamp(this.interaction.tilt+dy*.0025*speed/weight,.22,.72);w.ladle.rotation.z=-this.interaction.tilt;const ideal=.47,err=Math.abs(this.interaction.tilt-ideal),flow=U.clamp((this.interaction.tilt-.15)/.43,0,1);w.updateMoltenStream(flow,(w.ladleRig.position.x+.62)*(.12*(1-assist)));if(err<.095+.08*assist)this.interaction.stability+=.022;else{this.interaction.stability=Math.max(0,this.interaction.stability-.012);this.interaction.error+=err*.02}this.localProgress=U.clamp(this.interaction.stability/1.35,0,1);this.core.audio.pour(flow*.1);
      }else if(s.n===34){
        if(dy<0&&this.interaction.returnWait<.64){this.interaction.returnWait=Math.max(.25,this.interaction.returnWait-.15);N.ui.toast('もう少し、待つ');this.core.haptic([18,35,18])}else if(dy<0){this.localProgress=1}
      }else if(s.n===35){
        this.interaction.returnFlow=U.clamp(this.interaction.returnFlow-dy*.0035*speed/weight,0,1);this.localProgress=this.interaction.returnFlow;w.mold.rotation.z=-this.interaction.returnFlow*.17;w.updateReturnStream(Math.sin(this.interaction.returnFlow*Math.PI));this.core.audio.pour(.08);
      }else if(s.n===37){
        if(this.interaction.taps<3)return;const move=Math.abs(dx)*.0034+Math.max(0,Math.abs(dx)-Math.abs(dy))*.002;this.interaction.moldOpen=U.clamp(this.interaction.moldOpen+move*speed/weight,0,1);this.localProgress=this.interaction.moldOpen;w.moldLeft.position.x=-this.localProgress*1.45;w.moldRight.position.x=this.localProgress*1.45;w.moldCracks.forEach((l,i)=>l.material.opacity=U.clamp(this.localProgress*1.8-i*.035,0,.7));if(Math.random()<move*.8)w.spawn('sand',w.mold.position.clone().add(new THREE.Vector3(w.rng.range(-1,1),1,.5)),2,.8);
      }else if(s.n===38){
        const motion=Math.hypot(dx,dy);this.interaction.travel+=motion*.0019*speed;this.localProgress=U.clamp(this.interaction.travel,0,1);w.setCleanProgress(this.localProgress);w.spawn('sand',w.kettle.position.clone().add(new THREE.Vector3((e.clientX/innerWidth-.5)*1.7,1.1,.9)),Math.random()<.35?1:0,.7);this.core.audio.sand(.18);
      }else if(s.n===40){
        const motion=Math.hypot(dx,dy);this.interaction.travel+=motion*.00165*speed;this.localProgress=U.clamp(this.interaction.travel,0,1);w.grinder.position.x=U.clamp(w.grinder.position.x+dx*.003,-.75,.9);w.grinder.position.y=U.clamp(w.grinder.position.y-dy*.003,.45,1.55);w.grinder.rotation.z+=motion*.03;this.core.materials.ironRaw.roughness=U.lerp(.93,.68,this.localProgress);this.core.materials.ironRaw.bumpScale=U.lerp(.035,.019,this.localProgress);if(Math.random()<motion*.012)w.spawn('embers',w.grinder.position.clone(),1,.4);this.core.audio.metal(.08);
      }else if(s.n===44||s.n===45){
        const motion=Math.hypot(dx,dy);this.interaction.travel+=motion*.00165*speed;this.localProgress=U.clamp(this.interaction.travel,0,1);const base=s.n===44?.28:.58,span=s.n===44?.3:.42;w.applyFinish(base+this.localProgress*span);w.brush.position.x=U.clamp(w.brush.position.x+dx*.003,-.8,.9);w.brush.position.y=U.clamp(w.brush.position.y-dy*.003,.35,1.55);w.brush.rotation.z=-dx*.003;if(Math.random()<motion*.008)w.spawn('steam',w.brush.getWorldPosition(new THREE.Vector3()),1,.4);this.core.audio.sand(.1);
      }else if(s.n===47){
        this.interaction.handle=U.clamp(this.interaction.handle+dy*.0036*speed/weight,0,1);this.localProgress=this.interaction.handle;w.handle.position.y=U.lerp(1.55,0,this.localProgress);w.handle.rotation.z=Math.sin(this.localProgress*Math.PI)*.03;if(this.localProgress>.96)this.core.audio.metal(.25);
      }else if(s.n===48){
        this.interaction.pour=U.clamp(this.interaction.pour+dy*.0034*speed/weight,0,1);this.localProgress=this.interaction.pour;w.kettle.rotation.z=-this.localProgress*.63;w.updateWaterStream(U.clamp((this.localProgress-.24)/.56,0,1));this.core.audio.water(.08);
      }
      N.ui.setHoldProgress(this.localProgress);if(this.localProgress>=1)this.finishInteractiveStep();
    }

    handleTap(x,y){
      const s=this.currentStep;if(!s)return;const w=this.world;
      if(s.n===15){this.interaction.taps++;const p=U.clamp(this.interaction.taps/8,0,1);this.localProgress=p;const a=(this.interaction.taps-1)/8*Math.PI*1.15-.55;w.arareTool.position.set(Math.sin(a)*1.38,.55+this.interaction.taps*.075,Math.cos(a)*1.38);w.arareTool.rotation.z=Math.sin(a)*.55;w.updateMoldArare(.18*p);this.core.audio.metal(.5);this.core.haptic(12);if(p>=1){let wave=0;const timer=setInterval(()=>{wave+=.08;w.updateMoldArare(.18+.82*U.clamp(wave,0,1));if(wave>=1)clearInterval(timer)},35);this.finishInteractiveStep()}}
      else if(s.n===37&&this.interaction.taps<3){this.interaction.taps++;const hit=this.interaction.taps/3;w.hammer.rotation.z=-.45;setTimeout(()=>w.hammer.rotation.z=0,100);w.wedges.forEach((wd,i)=>wd.position.y=1.25-hit*(.18+i*.02));w.moldCracks.forEach((l,i)=>l.material.opacity=i<this.interaction.taps*4?.28:0);w.spawn('sand',w.mold.position.clone().add(new THREE.Vector3(this.interaction.taps%2?1.25:-1.25,1.1,.7)),6,.8);this.core.audio.metal(.85);this.core.haptic([22,35,12]);N.ui.showInstruction({...N.SCENES[this.sceneIndex],instruction:this.interaction.taps<3?`あと ${3-this.interaction.taps} 回たたく`:'左右へ、ゆっくり開く'})}
    }

    finishInteractiveStep(){
      if(this.mode!=='play'||this._finishTimer)return;this.mode='settling';this.localProgress=1;N.ui.setHoldProgress(1);const step=this.currentStep;this._finishTimer=setTimeout(()=>{this._finishTimer=null;const quality=U.clamp(1-(this.interaction.error||0),.45,1);this.completeStep(step,quality);this.timelineIndex++;this.advanceTimeline()},360*(86/this.core.settings.speed));
    }

    completeStep(step,quality=1){
      if(!this.store.save.completedSteps.includes(step.n))this.store.save.completedSteps.push(step.n);this.store.save.completedSteps.sort((a,b)=>a-b);this.store.save.bestPrecision[step.n]=Math.max(this.store.save.bestPrecision[step.n]||0,quality);this.store.persistSave();this.precision.push(quality);N.ui.markStepDone(step.n);N.ui.updateProgress(this.overallProgress());
    }

    async completeScene(){
      const scene=N.SCENES[this.sceneIndex];this.mode='reward';if(!this.store.save.completedScenes.includes(scene.id))this.store.save.completedScenes.push(scene.id);this.store.save.scene=Math.min(this.sceneIndex+1,N.SCENES.length-1);this.store.persistSave();this.completedThisRun++;this.core.audio.reward();this.core.haptic([20,45,28]);await N.ui.showReward(scene.reward,`${scene.steps.length}工程`);
      const isChapterEnd=this.sceneIndex===3||this.sceneIndex===7||this.sceneIndex===10||this.sceneIndex===13;
      if(this.sceneIndex>=N.SCENES.length-1){this.completeGame();return}
      if(isChapterEnd){const next=N.SCENES[this.sceneIndex+1];await N.ui.showChapter(N.CHAPTERS[next.chapter]);this.chapterShown.add(next.chapter)}
      if(this.core.settings.autoAdvance){this._advanceTimer=setTimeout(()=>this.startScene(this.sceneIndex+1,false),280)}else{this.mode='pause';N.ui.showContinue(()=>this.startScene(this.sceneIndex+1,false))}
    }

    completeGame(){
      this.mode='completion';this.store.save.finished=true;this.store.save.scene=N.SCENES.length-1;this.store.persistSave();this.world.setStage('first-pour');this.world.kettle.rotation.z=0;this.world.updateWaterStream(0);this.world.setCameraPose('final');N.ui.showCompletion(this.store.save);this.core.audio.reward();
    }

    goTitle(){
      clearTimeout(this._advanceTimer);this.mode='title';this.world.setStage('title');this.lookYaw=0;this.lookPitch=0;N.ui.showTitle(this.store.save);
    }

    freeView(){this.mode='free';N.ui.hideCompletion();N.ui.showGameHud(false);this.world.setStage('title');this.world.setCameraPose('free');this.lookYaw=0;this.lookPitch=0}

    overallProgress(){
      const completed=this.store.save.completedSteps.length;let fractional=0;if(this.currentStep&&!this.store.save.completedSteps.includes(this.currentStep.n))fractional=this.localProgress;return U.clamp((completed+fractional)/48,0,1);
    }

    applyAutoVisual(step,p){
      const w=this.world,a=step.action;
      if(a==='draft'){w.turnRig.visible=true;w.turnRig.rotation.y=p*Math.PI*.5;w.profilePlate.rotation.y=p*.25}
      else if(a==='tool'){w.turnRig.visible=true;w.profilePlate.position.y=U.lerp(.25,-.15,p);w.profilePlate.rotation.z=Math.sin(p*Math.PI)*.08}
      else if(a==='sand'){w.mold.visible=true;w.m.sand.color.lerpColors(new THREE.Color(0x6a5d4d),new THREE.Color(0x887965),p);if(Math.random()<.08)w.spawn('dust',w.mold.position.clone().add(new THREE.Vector3(0,1.2,.8)),1,.8)}
      else if(a==='dry'||a==='repair'){if(Math.random()<.08)w.spawn('steam',w.mold.position.clone().add(new THREE.Vector3(w.rng.range(-1,1),1.25,w.rng.range(-.5,.5))),1,.9)}
      else if(a==='assemble'||a==='turnover'){w.moldCap.position.y=Math.sin(p*Math.PI)*.12;w.mold.rotation.y=Math.sin(p*Math.PI)*.18}
      else if(a==='texture'){w.mold.rotation.y=p*.25}
      else if(a==='core'){w.coreObject.visible=true;w.coreSpout.visible=true;w.coreObject.position.y=U.lerp(.9,.22,p);w.coreSpout.position.y=U.lerp(1.8,1.15,p)}
      else if(a==='runner'){w.runnerGroup.visible=true;w.runnerGroup.scale.setScalar(U.lerp(.1,1,p))}
      else if(a==='clamp'){w.clamps.forEach((c,i)=>c.position.y+=(i%2?-.001:.001)*Math.sin(p*Math.PI))}
      else if(a==='charge'||a==='melt'){w.fireLight.intensity=45+p*18;if(Math.random()<.13)w.spawn('embers',new THREE.Vector3(-5.2,1.5,-3.4),2,1.2)}
      else if(a==='brace'){w.workerLeft.group.rotation.z=.08*Math.sin(p*Math.PI);w.workerRight.group.rotation.z=-.08*Math.sin(p*Math.PI)}
      else if(a==='cool'){w.moltenSurface.material.emissiveIntensity=U.lerp(3.6,.35,p);w.moltenSurface.material.color.lerpColors(new THREE.Color(0xff9e28),new THREE.Color(0x5b1d0c),p)}
      else if(a==='trim'){w.grinder.visible=true;w.grinder.rotation.z=p*Math.PI*4;if(Math.random()<.08)w.spawn('embers',w.kettle.position.clone().add(new THREE.Vector3(.7,.9,.7)),1,.6)}
      else if(a==='fit'){w.lid.position.y=U.lerp(1.8,1.53,p);w.lid.rotation.y=p*Math.PI*.4}
      else if(a==='straighten'){w.kettle.scale.x=1+Math.sin(p*Math.PI)*.015}
      else if(a==='forge-handle'){w.handle.visible=true;w.handle.position.y=U.lerp(1.7,1.55,p);w.handle.material.color.lerpColors(new THREE.Color(0x7b220d),new THREE.Color(0x20211f),p);if(Math.random()<.1)w.spawn('embers',w.kettle.position.clone().add(new THREE.Vector3(0,2.2,0)),1,.7)}
    }

    update(dt){
      this.idle+=dt;this.store.save.playSeconds=(this.store.save.playSeconds||0)+(this.mode==='play'||this.mode==='auto'?dt:0);if(Math.floor(this.core.time)%10===0&&this.core.time%10<dt)this.store.persistSave();
      if(this.mode==='auto'){
        this.autoElapsed+=dt*(this.autoSkipped?8:1);const p=U.clamp(this.autoElapsed/this.autoDuration,0,1);this.applyAutoVisual(this.currentStep,U.smooth(p));N.ui.setAutoProgress(p);if(p>=1&&this.autoResolve){const r=this.autoResolve;this.autoResolve=null;N.ui.hideAutoStep();r()}
      }
      if(this.mode==='play'&&this.currentStep){
        if(this.interaction.holding&&this.currentStep.n!==42)this.interaction.holdTime=(this.interaction.holdTime||0)+dt;
        if(this.currentStep.n===34){this.interaction.returnWait=U.clamp((this.interaction.returnWait||0)+dt*(.42+this.core.settings.speed/180),0,1);this.localProgress=U.clamp(this.interaction.returnWait*.72,0,.72);N.ui.setHoldProgress(this.interaction.returnWait);const heat=1-this.interaction.returnWait;this.world.m.sand.color.lerpColors(new THREE.Color(0x5b3428),new THREE.Color(0x403a34),this.interaction.returnWait);if(this.interaction.returnWait>.64&&!this._returnCue){this._returnCue=true;this.core.audio.tone(112,.35,'sine',.08,.66);this.core.haptic(18);N.ui.toast('いま')};if(this.interaction.returnWait>.96)this.localProgress=1}
        if(this.currentStep.n===42&&this.interaction.holding){this.interaction.holdTime+=dt;this.localProgress=U.clamp(this.interaction.holdTime/2.25,0,1);this.world.applyFinish(this.localProgress*.28);if(Math.random()<.08)this.world.spawn('steam',this.world.kettle.position.clone().add(new THREE.Vector3(this.world.rng.range(-.8,.8),1.25,this.world.rng.range(-.5,.5))),1,.7);N.ui.setHoldProgress(this.localProgress);if(this.localProgress>=1)this.finishInteractiveStep()}
      }
      if(this.mode==='title'&&this.idle>13){this.world.setCameraPose('titleMacro');this.lookYaw=U.damp(this.lookYaw,.12,1.2,dt)}
      this.updateSceneVisual(dt);this.world.updateCamera(dt,this.lookYaw,this.lookPitch);this.world.update(dt,{heat:this.currentStep&&(this.currentStep.n===18||this.currentStep.n===19)?this.localProgress:0});
    }

    updateSceneVisual(dt){
      const w=this.world,s=this.currentStep;if(!s)return;
      if(s.n===29)w.animateWorkers(this.localProgress,0,0);
      if(s.n===30)w.animateWorkers(1,0,U.invLerp(-2.15,-.48,w.ladleRig.position.x));
      if(s.n===31||s.n===32)w.animateWorkers(1,this.interaction.tilt||0,1);
      if(s.n===34||s.n===35)w.animateWorkers(1,.2,1);
      if(s.n===42)document.querySelector('#heatOverlay').style.opacity=(this.localProgress*.55).toFixed(2);else document.querySelector('#heatOverlay').style.opacity='0';
    }
  }
  N.Game=Game;
})();
