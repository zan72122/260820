(function(){
  'use strict';
  const N=window.Nambu,U=N?.util,F=N?.FormingMath;
  if(!N||!U||!F||!N.World||!N.Game)throw new Error('First-scene v4 dependencies are unavailable');

  const VISUAL_REVISION=4;
  const clamp=U.clamp;
  const baseProfile=F.profileRadius;
  const baseNoise=F.surfaceNoise;

  N.SCENES[0].instruction='画面のどこでも、大きくぐるっと回す';
  N.SCENES[0].sub='最初のひと動きから、粗い砂が胴・肩・首・底へ削れて変わります';

  // A profile board cuts the whole rotating surface. Make the silhouette react from
  // the first meaningful movement, then retain a smaller amount of real sand noise.
  F.formationAt=function(progress,t){
    const p=clamp(Number(progress)||0,0,1),q=clamp(Number(t)||0,0,1);
    if(p<=0)return 0;
    const early=Math.pow(p,.70);
    const shoulderEmphasis=.90+.10*Math.sin(q*Math.PI);
    return clamp(early*shoulderEmphasis,0,1);
  };
  F.surfaceRadius=function(progress,fine,t,angle=0,seed=0){
    const p=clamp(Number(progress)||0,0,1),f=clamp(Number(fine)||0,0,1),q=clamp(Number(t)||0,0,1);
    const noise=baseNoise(angle,q,seed);
    const rough=1.66+Math.sin(q*Math.PI)*.045+Math.sin(q*9.2+seed*4.7)*.032+noise*.047;
    const target=baseProfile(q),formed=F.formationAt(p,q);
    const cut=U.lerp(rough,target,formed);
    const grain=U.lerp(.073,.020,formed)*(1-f*.91)+.0026*f;
    const toolTrace=Math.sin(q*61+angle*.18+seed*3.2)*.0064*formed*(1-f*.88);
    return Math.max(.12,cut+noise*grain+toolTrace);
  };
  F.bandRadius=function(progress,fine,t,seed=0){return F.surfaceRadius(progress,fine,t,0,seed)};

  function makeFreshCutLine(world){
    const points=Array.from({length:48},()=>new THREE.Vector3());
    const geometry=new THREE.BufferGeometry().setFromPoints(points);
    const material=new THREE.LineBasicMaterial({
      color:0xd7b58a,
      transparent:true,
      opacity:0,
      depthTest:true,
      depthWrite:false
    });
    const line=new THREE.Line(geometry,material);
    line.name='fresh physical scrape on wet mold sand';
    line.renderOrder=4;
    world.turnEvolution.bodyGroup.add(line);
    return line;
  }

  const originalBuild=N.World.prototype.buildProgressiveTurningScene;
  N.World.prototype.buildProgressiveTurningScene=function(){
    originalBuild.call(this);
    const t=this.turnEvolution;
    t.freshCutLine=makeFreshCutLine(this);
    t.freshCutLine.visible=false;
    t.surfaceVariation=0;
    t.lastVisibleProgress=0;
    t.firstMotionSeen=false;
    t.shavingBed=this.core.group('fallen mold-sand shavings');
    t.group.add(t.shavingBed);
    for(let i=0;i<26;i++){
      const shaving=this.mesh(new THREE.IcosahedronGeometry(this.rng.range(.012,.032),0),this.m.sandDark,[0,0,0],[],false,true);
      shaving.userData={
        threshold:(i+1)/27,
        angle:this.rng.range(0,Math.PI*2),
        radius:this.rng.range(1.25,1.75),
        baseScale:new THREE.Vector3(this.rng.range(.8,1.8),this.rng.range(.18,.42),this.rng.range(.65,1.35))
      };
      shaving.scale.setScalar(0);
      t.shavingBed.add(shaving);
    }
  };

  N.World.prototype.updateFreshCutSurface=function(progress,fine){
    const t=this.turnEvolution;if(!t?.freshCutLine)return;
    const p=clamp(progress,0,1),f=clamp(fine,0,1),positions=t.freshCutLine.geometry.attributes.position.array;
    const contactAngle=.10;
    for(let i=0;i<48;i++){
      const q=i/47,r=F.surfaceRadius(p,f,q,contactAngle,t.form.seed)+.006,k=i*3;
      positions[k]=Math.sin(contactAngle)*r;
      positions[k+1]=t.form.base+q*t.form.totalHeight;
      positions[k+2]=Math.cos(contactAngle)*r;
    }
    t.freshCutLine.geometry.attributes.position.needsUpdate=true;
    t.freshCutLine.geometry.computeBoundingSphere();
    t.freshCutLine.visible=(t.activeStep===8||t.activeStep===11)&&p>.002;
    const radii=t.sampleRadii||[];
    t.surfaceVariation=radii.length?Math.max(...radii)-Math.min(...radii):0;
    const materialProgress=t.activeStep===11?f:p;
    t.shavingBed.children.forEach(shaving=>{
      const visible=materialProgress>shaving.userData.threshold;
      shaving.visible=visible;
      if(!visible){shaving.scale.setScalar(0);return}
      const a=shaving.userData.angle,r=shaving.userData.radius;
      shaving.position.set(Math.cos(a)*r,.305+Math.sin(a*2.4)*.008,Math.sin(a)*r);
      shaving.rotation.set(a*.17,a,a*.09);
      shaving.scale.copy(shaving.userData.baseScale).multiplyScalar(.72+materialProgress*.28);
    });
  };

  const originalSetEvolution=N.World.prototype.setTurningEvolution;
  N.World.prototype.setTurningEvolution=function(state={}){
    originalSetEvolution.call(this,state);
    const t=this.turnEvolution;if(!t)return;
    this.updateFreshCutSurface(t.rough,t.fine);
    const materialProgress=t.activeStep===11?t.fine:t.rough;
    // Wet coarse sand becomes lighter when freshly cut; fine true-mud loses the
    // coarse micro-shadow and gains a denser, still-matte surface.
    t.bodyMaterial.roughness=U.lerp(U.lerp(.997,.89,t.rough),.78,t.fine);
    t.bodyMaterial.bumpScale=U.lerp(U.lerp(.088,.036,t.rough),.010,t.fine);
    t.bodyMaterial.envMapIntensity=U.lerp(.18,.42,t.fine);
    t.lastVisibleProgress=materialProgress;
  };

  const originalPrepare=N.World.prototype.prepareTurningInteractive;
  N.World.prototype.prepareTurningInteractive=function(stepNumber){
    originalPrepare.call(this,stepNumber);
    const t=this.turnEvolution;if(!t)return;
    t.freshCutLine.visible=false;t.freshCutLine.material.opacity=0;t.firstMotionSeen=false;t.motion=0;
    t.shavingBed.children.forEach(shaving=>{shaving.visible=false;shaving.scale.setScalar(0)});
    this.updateFreshCutSurface(stepNumber===8?0:1,0);
  };

  const originalStage=N.World.prototype.setStage;
  N.World.prototype.setStage=function(id){
    const leavingTurn=this.stage==='turn'&&id!=='turn';
    originalStage.call(this,id);
    if(!this._firstSceneLightDefaults){
      this._firstSceneLightDefaults={work:this.workLight.intensity,exposure:this.core.renderer.toneMappingExposure,fog:this.core.scene.fog.density};
    }
    if(id==='turn'){
      this.workLight.intensity=Math.max(30,this._firstSceneLightDefaults.work);
      this.core.renderer.toneMappingExposure=Math.max(1.02,this.core.settings.exposure/100);
      this.core.scene.fog.density=Math.min(.026,this._firstSceneLightDefaults.fog);
    }else if(leavingTurn){
      this.workLight.intensity=this._firstSceneLightDefaults.work;
      this.core.renderer.toneMappingExposure=this.core.settings.exposure/100;
      this.core.scene.fog.density=.018+this.core.settings.darkness/3400;
    }
  };

  const originalWorldUpdate=N.World.prototype.update;
  N.World.prototype.update=function(dt,visual){
    originalWorldUpdate.call(this,dt,visual);
    const t=this.turnEvolution;if(!t||this.stage!=='turn')return;
    const target=(t.activeStep===8||t.activeStep===11)&&t.firstMotionSeen?(.12+t.motion*.58):0;
    t.freshCutLine.material.opacity=U.damp(t.freshCutLine.material.opacity,target,10,dt);
    t.freshCutLine.visible=t.freshCutLine.material.opacity>.008;
  };

  const originalHandle=N.Game.prototype.handleGesture;
  N.Game.prototype.handleGesture=function(dx,dy,da,e){
    const step=this.currentStep;
    if(!(step&&(step.n===8||step.n===11)))return originalHandle.call(this,dx,dy,da,e);
    const before=this.localProgress||0,distance=Math.hypot(dx,dy);
    originalHandle.call(this,dx,dy,da,e);
    if(distance<=1)return;
    const minimumGain=distance/Math.max(320,Math.min(innerWidth,innerHeight))*.56;
    const forced=clamp(Math.max(this.localProgress,before+minimumGain),0,1);
    if(forced>this.localProgress+1e-6){
      this.localProgress=forced;
      const tracker=this.interaction.turnTracker;
      if(tracker){tracker.totalWork=Math.max(tracker.totalWork,forced);tracker.progress=forced}
      const t=this.world.turnEvolution;
      if(step.n===8)this.world.setTurningEvolution({build:1,rough:forced,fine:0,spin:t.spin});
      else this.world.setTurningEvolution({build:1,rough:1,fine:forced,spin:t.spin});
      N.ui.setHoldProgress(forced);
      if(forced>=1)this.finishInteractiveStep();
    }
    const t=this.world.turnEvolution;t.firstMotionSeen=true;t.motion=Math.max(t.motion,clamp(distance/14,0,1));
  };

  const originalSnapshot=N.World.prototype.turningSnapshot;
  N.World.prototype.turningSnapshot=function(){
    const snap=originalSnapshot.call(this);if(!snap)return snap;const t=this.turnEvolution;
    const angularSamples=Array.from({length:18},(_,i)=>F.surfaceRadius(t.rough,t.fine,.56,i/18*Math.PI*2,t.form.seed));
    return Object.assign(snap,{
      materialRoughness:t.bodyMaterial.roughness,
      materialBumpScale:t.bodyMaterial.bumpScale,
      surfaceVariation:t.surfaceVariation,
      angularVariation:Math.max(...angularSamples)-Math.min(...angularSamples),
      freshCutOpacity:t.freshCutLine?.material.opacity||0,
      firstMotionSeen:!!t.firstMotionSeen,
      visualRevision:VISUAL_REVISION
    });
  };

  const originalStart=N.Game.prototype.startFromTitle;
  N.Game.prototype.startFromTitle=function(){
    const save=this.store.save;
    if(!save.finished&&save.scene===0&&!save.completedScenes.includes('turn')&&Number(save.turnVisualRevision||0)<VISUAL_REVISION){
      save.completedSteps=save.completedSteps.filter(n=>n>14);
      save.turnVisualRevision=VISUAL_REVISION;
      this.store.persistSave();
    }
    return originalStart.call(this);
  };

  window.__NAMBU_VISUAL_REVISION__='4.0';
  if(window.__NAMBU_E2E__){
    window.__NAMBU_E2E__.loadingState=()=>{const el=document.querySelector('#loading'),style=el?getComputedStyle(el):null;return{active:!!el?.classList.contains('active'),display:style?.display||'missing',pointerEvents:style?.pointerEvents||'missing'}};
  }
})();
