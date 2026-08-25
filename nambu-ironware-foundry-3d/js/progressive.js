(function(){
  'use strict';
  const N=window.Nambu,U=N.util,F=N.FormingMath;
  if(!N||!N.World||!N.Game||!F)throw new Error('Progressive forming dependencies are unavailable');

  const wetColor=new THREE.Color(0x665744),shapedColor=new THREE.Color(0x80715d),fineColor=new THREE.Color(0x91816b),firedColor=new THREE.Color(0x42382e);
  N.SCENES[0].instruction='画面のどこでも、大きくぐるっと回す';
  N.SCENES[0].sub='動かした分だけ、粗い砂山が鉄瓶の輪郭へ変わります';

  function makeLine(points,color=0xd3b47b,opacity=.9){
    const geometry=new THREE.BufferGeometry().setFromPoints(points),material=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false});
    const line=new THREE.Line(geometry,material);line.renderOrder=8;return line;
  }
  function makePaperTexture(){
    const c=document.createElement('canvas');c.width=768;c.height=512;const x=c.getContext('2d');
    x.fillStyle='#332a20';x.fillRect(0,0,c.width,c.height);x.strokeStyle='rgba(213,184,126,.10)';x.lineWidth=1;
    for(let i=0;i<c.width;i+=32){x.beginPath();x.moveTo(i,0);x.lineTo(i,c.height);x.stroke()}
    for(let j=0;j<c.height;j+=32){x.beginPath();x.moveTo(0,j);x.lineTo(c.width,j);x.stroke()}
    x.strokeStyle='rgba(226,199,145,.32)';x.lineWidth=2;x.strokeRect(18,18,c.width-36,c.height-36);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
  }
  function cylinder(core,r,h,mat,y=0){return core.mesh(new THREE.CylinderGeometry(1,1,h,72,1,false),mat,[0,y,0])}

  const originalBuildMold=N.World.prototype.buildMold;
  N.World.prototype.buildMold=function(){
    originalBuildMold.call(this);
    this.buildProgressiveTurningScene();
  };

  N.World.prototype.buildProgressiveTurningScene=function(){
    const core=this.core,m=this.m,t=this.turnEvolution={};
    this.profilePlate.material=this.profilePlate.material.clone();
    t.group=core.group('progressive first chapter');t.group.visible=false;this.mold.add(t.group);
    t.support=this.mesh(new THREE.CylinderGeometry(1.74,1.82,.18,72),m.refractory,[0,.18,0]);t.group.add(t.support);
    t.axis=this.mesh(new THREE.CylinderGeometry(.06,.07,2.05,18),m.steelDark,[0,1.08,0]);t.group.add(t.axis);
    t.ringGroup=core.group('continuously formed sand body');t.group.add(t.ringGroup);
    t.rings=[];t.tracks=[];const bands=28,height=.052,base=.26;
    for(let i=0;i<bands;i++){
      const y=base+i*height,tNorm=i/(bands-1),mat=m.sand.clone();mat.color.copy(wetColor);mat.roughness=.995;mat.bumpScale=.068;
      const ring=cylinder(core,1,height*1.08,mat,y);ring.userData={index:i,t:tNorm,seed:(i*17%31)/31,raw:F.roughRadius(tNorm,i),target:F.profileRadius(tNorm)};ring.castShadow=true;ring.receiveShadow=true;t.ringGroup.add(ring);t.rings.push(ring);
      const trackMat=new THREE.MeshBasicMaterial({color:0x382f26,transparent:true,opacity:0,depthWrite:false});const track=this.mesh(new THREE.TorusGeometry(ring.userData.target,.009,5,72),trackMat,[0,y+height*.48,0],[Math.PI/2,0,0],false,false);track.renderOrder=4;t.group.add(track);t.tracks.push(track);
    }
    t.chunks=[];for(let i=0;i<72;i++){
      const y=base+this.rng.range(0,bands*height),a=this.rng.range(0,Math.PI*2),r=this.rng.range(1.52,1.72);const chunk=this.mesh(new THREE.IcosahedronGeometry(this.rng.range(.035,.09),1),m.sandDark,[Math.cos(a)*r,y,Math.sin(a)*r]);chunk.userData={threshold:this.rng.next(),base:chunk.position.clone(),scale:chunk.scale.clone(),phase:this.rng.range(0,Math.PI*2)};chunk.scale.set(this.rng.range(.7,1.5),this.rng.range(.35,.8),this.rng.range(.7,1.4));t.group.add(chunk);t.chunks.push(chunk);
    }

    t.scrapePoint=this.mesh(new THREE.SphereGeometry(.045,14,10),m.steel,[1.55,.7,.03]);t.scrapePoint.visible=false;t.group.add(t.scrapePoint);
    t.profileGhost=makeLine(Array.from({length:44},(_,i)=>{const q=i/43;return new THREE.Vector3(F.profileRadius(q),base+q*(bands-1)*height,.035)}),0xe7c88c,.42);t.profileGhost.visible=false;t.group.add(t.profileGhost);

    t.blueprint=core.group('full scale drawing');t.blueprint.position.set(0,1.28,1.62);t.group.add(t.blueprint);
    const paperMat=new THREE.MeshStandardMaterial({map:makePaperTexture(),color:0xffffff,roughness:.9,metalness:0});t.blueprint.add(this.mesh(new THREE.BoxGeometry(3.35,2.2,.075),paperMat));
    const outline=[];for(let i=0;i<=38;i++){const q=i/38;outline.push(new THREE.Vector3(-F.profileRadius(q)*.63,-.73+q*1.48,.055))}for(let i=38;i>=0;i--){const q=i/38;outline.push(new THREE.Vector3(F.profileRadius(q)*.63,-.73+q*1.48,.055))}outline.push(outline[0].clone());
    t.draftLine=makeLine(outline,0xe1bd79,.95);t.draftLine.geometry.setDrawRange(0,1);t.blueprint.add(t.draftLine);
    const centerLine=makeLine([new THREE.Vector3(0,-.82,.054),new THREE.Vector3(0,.84,.054)],0xa98d5d,.55);t.blueprint.add(centerLine);
    t.blueprint.visible=false;

    t.plateBlank=this.mesh(new THREE.BoxGeometry(1.22,1.72,.075),new THREE.MeshStandardMaterial({color:0x303331,roughness:.47,metalness:.94,transparent:true,opacity:.92}),[0,1.12,1.54]);t.plateBlank.visible=false;t.group.add(t.plateBlank);
    t.offcuts=[];for(const x of [-.46,.46]){const piece=this.mesh(new THREE.BoxGeometry(.34,.62,.07),m.steelDark,[x,1.12,1.58]);piece.visible=false;t.group.add(piece);t.offcuts.push(piece)}

    t.seedForms=core.group('spout lug and knob seed forms');t.seedForms.position.set(1.92,.46,.95);t.group.add(t.seedForms);
    const seedMat=m.sand.clone();seedMat.color.set(0x7d6d58);seedMat.roughness=.99;t.seedMaterial=seedMat;
    const seedSpout=this.mesh(new THREE.CylinderGeometry(.10,.23,.92,24),seedMat,[0,.48,0],[0,0,-.72]);t.seedForms.add(seedSpout);
    t.seedForms.add(this.mesh(new THREE.SphereGeometry(.13,20,14),seedMat,[-.42,.18,0]));
    for(const x of [-.72,-.25])t.seedForms.add(this.mesh(new THREE.TorusGeometry(.13,.035,8,28,Math.PI*1.55),seedMat,[x,.55,0],[0,Math.PI/2,0]));
    t.seedForms.visible=false;

    t.sandTrays=core.group('three grades of mold sand');t.sandTrays.position.set(-2.15,.12,.72);t.group.add(t.sandTrays);t.sandTrays.visible=false;
    [0x574b3c,0x746451,0x9a8972].forEach((color,i)=>{const tray=this.mesh(new THREE.CylinderGeometry(.42,.48,.16,32),m.steelDark,[i*.72,.08,0]);const fill=this.mesh(new THREE.CylinderGeometry(.37,.4,.10,32),new THREE.MeshStandardMaterial({map:core.textures.sand,bumpMap:core.textures.sandBump,bumpScale:.05-i*.012,color,roughness:1}),[i*.72,.19,0]);t.sandTrays.add(tray,fill)});

    t.spoutForm=core.group('spout form attached to body');t.spoutForm.position.set(1.06,.78,.02);t.spoutForm.rotation.z=-.68;t.group.add(t.spoutForm);t.spoutForm.add(this.mesh(new THREE.CylinderGeometry(.13,.30,1.05,32),m.sand,[0,.48,0]));t.spoutForm.add(this.mesh(new THREE.CylinderGeometry(.10,.15,.45,28),m.sand,[0,1.18,0],[0,0,-.18]));t.spoutForm.visible=false;
    t.lugForms=[];for(const x of [-1.14,1.14]){const lug=this.mesh(new THREE.TorusGeometry(.16,.045,10,32,Math.PI*1.55),m.sand,[x,1.20,0],[0,Math.PI/2,x<0?-.8:.8]);lug.visible=false;t.group.add(lug);t.lugForms.push(lug)}
    t.bottomMold=this.mesh(new THREE.CylinderGeometry(.78,1.16,.24,64),m.sandDark,[0,.15,0]);t.bottomMold.visible=false;t.group.add(t.bottomMold);
    t.lidMold=core.group('separate lid mold');t.lidMold.position.set(-1.92,.23,.56);t.group.add(t.lidMold);t.lidMold.add(this.mesh(new THREE.CylinderGeometry(.59,.69,.18,64),m.sand,[0,.09,0]));t.lidMold.add(this.mesh(new THREE.SphereGeometry(.12,20,12),m.sand,[0,.30,0]));t.lidMold.visible=false;

    const markGeo=new THREE.SphereGeometry(.018,7,5,0,Math.PI*2,0,Math.PI*.55),markMat=new THREE.MeshStandardMaterial({color:0x54483a,roughness:1}),count=196,marks=new THREE.InstancedMesh(markGeo,markMat,count),dummy=new THREE.Object3D();t.skinMarkTransforms=[];let k=0;
    for(let band=0;band<14;band++){const q=.13+band*.055,r=F.profileRadius(q)+.012,n=14;for(let j=0;j<n;j++){const a=(j+(band%2)*.5)/n*Math.PI*2;dummy.position.set(Math.cos(a)*r,base+q*(bands-1)*height,Math.sin(a)*r);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a),.04,Math.sin(a)).normalize());t.skinMarkTransforms.push({position:dummy.position.clone(),quaternion:dummy.quaternion.clone()});dummy.scale.setScalar(0);dummy.updateMatrix();marks.setMatrixAt(k++,dummy.matrix)}}marks.instanceMatrix.needsUpdate=true;t.skinMarks=marks;t.group.add(marks);

    t.build=0;t.rough=0;t.fine=0;t.texture=0;t.spin=0;t.motion=0;t.activeStep=0;t.lastDust=0;t.milestone=0;
    this.poses.turnDraft={p:[3.5,2.35,4.45],t:[0,1.18,.46]};
    this.poses.turnForm={p:[3.65,2.18,4.55],t:[.05,.92,-.02]};
    this.poses.moldClose=this.poses.turnForm;
    this.setTurningEvolution({build:0,rough:0,fine:0,texture:0,spin:0});
  };

  N.World.prototype.restoreBaseMoldVisibility=function(){
    this.moldLeft.visible=true;this.moldRight.visible=true;this.moldCap.visible=true;this.moldBoard.visible=true;this.clamps.forEach(c=>c.visible=true);
    if(this.turnEvolution)this.turnEvolution.group.visible=false;
  };

  const originalSetStage=N.World.prototype.setStage;
  N.World.prototype.setStage=function(id){
    if(this.turnEvolution)this.restoreBaseMoldVisibility();
    originalSetStage.call(this,id);
    if(id==='turn'&&this.turnEvolution){
      const t=this.turnEvolution;t.group.visible=true;this.moldLeft.visible=false;this.moldRight.visible=false;this.moldCap.visible=false;this.clamps.forEach(c=>c.visible=false);this.turnRig.position.set(0,.22,0);this.turnRig.visible=false;this.setCameraPose('turnDraft');this.resetTurningEvolution();
    }
  };

  N.World.prototype.resetTurningEvolution=function(){
    const t=this.turnEvolution;if(!t)return;t.activeStep=0;t.blueprint.visible=false;t.blueprint.position.set(0,1.28,1.62);t.blueprint.rotation.set(0,0,0);t.blueprint.scale.setScalar(1);t.plateBlank.visible=false;t.plateBlank.material.opacity=.92;t.offcuts.forEach(o=>o.visible=false);t.seedForms.visible=false;t.seedMaterial.color.set(0x7d6d58);t.sandTrays.visible=false;t.spoutForm.visible=false;t.lugForms.forEach(o=>o.visible=false);t.bottomMold.visible=false;t.lidMold.visible=false;t.profileGhost.visible=false;t.scrapePoint.visible=false;this.turnRig.visible=false;this.setTurningTexture(0);this.setTurningEvolution({build:0,rough:0,fine:0,texture:0,spin:0});
  };

  N.World.prototype.setTurningTexture=function(progress){
    const t=this.turnEvolution;if(!t)return;t.texture=U.clamp(progress,0,1);const dummy=new THREE.Object3D(),count=t.skinMarks.count;for(let i=0;i<count;i++){const base=t.skinMarkTransforms[i],threshold=i/count,scale=threshold<t.texture?1:0;dummy.position.copy(base.position);dummy.quaternion.copy(base.quaternion);dummy.scale.setScalar(scale);dummy.updateMatrix();t.skinMarks.setMatrixAt(i,dummy.matrix)}t.skinMarks.instanceMatrix.needsUpdate=true;
  };

  N.World.prototype.setTurningEvolution=function(state={}){
    const t=this.turnEvolution;if(!t)return;t.build=state.build===undefined?t.build:U.clamp(state.build,0,1);t.rough=state.rough===undefined?t.rough:U.clamp(state.rough,0,1);t.fine=state.fine===undefined?t.fine:U.clamp(state.fine,0,1);t.spin=state.spin===undefined?t.spin:state.spin;
    const bands=t.rings.length,base=.26,height=.052;
    t.rings.forEach((ring,i)=>{
      const q=i/(bands-1),buildBand=U.smooth(U.clamp(t.build*1.30-q*.30,0,1)),formed=F.bandFormation(t.rough,q),radius=F.bandRadius(t.rough,t.fine,q,ring.userData.seed),micro=1+Math.sin(i*2.73+t.spin*.18)*.012*(1-t.fine)*formed;
      ring.visible=buildBand>.005;ring.scale.set(radius*micro,Math.max(.02,buildBand)*(1+t.fine*.035),radius*micro);ring.position.y=base+i*height+(1-buildBand)*-.12;
      ring.material.color.copy(wetColor).lerp(shapedColor,formed).lerp(fineColor,t.fine*formed);ring.material.roughness=U.lerp(.995,.925,formed);ring.material.roughness=U.lerp(ring.material.roughness,.865,t.fine);ring.material.bumpScale=U.lerp(.068,.041,formed);ring.material.bumpScale=U.lerp(ring.material.bumpScale,.021,t.fine);
      const track=t.tracks[i];track.visible=formed>.05;track.material.opacity=formed*(1-t.fine*.74)*.20;
    });
    t.chunks.forEach((chunk,i)=>{const d=U.clamp((t.rough-chunk.userData.threshold)*5,0,1);chunk.visible=t.build>.65&&d<.99;chunk.position.copy(chunk.userData.base);chunk.position.y-=d*(.16+.28*(i%5)/5);chunk.position.x+=Math.sin(chunk.userData.phase)*d*.18;chunk.position.z+=Math.cos(chunk.userData.phase)*d*.18;chunk.scale.copy(chunk.userData.scale).multiplyScalar(1-d*.86)});
    t.ringGroup.rotation.y=-t.spin*.34;t.profileGhost.visible=t.build>.86&&t.rough<.95;t.profileGhost.material.opacity=.20+.26*(1-t.rough);
    const contactQ=U.clamp(.08+t.rough*.84,0,1),contactR=F.profileRadius(contactQ);t.scrapePoint.position.set(contactR,base+contactQ*(bands-1)*height,.03);t.scrapePoint.visible=t.motion>.04&&t.rough<1;
  };

  N.World.prototype.setTurningAttachments=function(spout=0,lugs=0,bottom=0,lid=0){
    const t=this.turnEvolution;if(!t)return;spout=U.clamp(spout,0,1);t.spoutForm.visible=spout>.01;t.spoutForm.scale.setScalar(Math.max(.001,U.smooth(spout)));t.lugForms.forEach((lug,i)=>{const p=U.clamp(lugs-i*.12,0,1);lug.visible=p>.01;lug.scale.setScalar(Math.max(.001,U.smooth(p)))});t.bottomMold.visible=bottom>.01;t.bottomMold.scale.set(1,U.smooth(bottom),1);t.lidMold.visible=lid>.01;t.lidMold.scale.setScalar(Math.max(.001,U.smooth(lid)));t.lidMold.rotation.y=lid*Math.PI*.55;
  };

  N.World.prototype.configureTurningHistory=function(stepNumber){
    const t=this.turnEvolution;if(!t)return;t.blueprint.visible=stepNumber<=3;t.draftLine.geometry.setDrawRange(0,stepNumber<=1?1:t.draftLine.geometry.attributes.position.count);t.plateBlank.visible=stepNumber===3;t.seedForms.visible=stepNumber>=4&&stepNumber<=6;t.sandTrays.visible=stepNumber>=6&&stepNumber<=8;this.turnRig.visible=stepNumber>=3;
    const build=stepNumber>=8?1:0,rough=stepNumber>=9?1:0,fine=stepNumber>=12?1:0;this.setTurningEvolution({build,rough,fine,spin:t.spin});this.setTurningAttachments(stepNumber>=10?1:0,stepNumber>=11?1:0,stepNumber>=13?1:0,stepNumber>=14?1:0);this.setTurningTexture(stepNumber>=15?1:0);
  };

  N.World.prototype.applyFirstChapterAutoStep=function(step,p){
    const t=this.turnEvolution;if(!t||this.stage!=='turn')return;if(t.activeStep!==step.n){t.activeStep=step.n;this.configureTurningHistory(step.n)}p=U.smooth(U.clamp(p,0,1));
    if(step.n===1){this.setCameraPose('turnDraft');t.blueprint.visible=true;t.blueprint.scale.setScalar(.82+.18*p);t.blueprint.position.z=1.72-.10*p;t.draftLine.geometry.setDrawRange(0,Math.max(1,Math.floor(t.draftLine.geometry.attributes.position.count*.28*p)))}
    else if(step.n===2){t.blueprint.visible=true;t.draftLine.geometry.setDrawRange(0,Math.max(1,Math.floor(t.draftLine.geometry.attributes.position.count*(.28+.72*p))));t.blueprint.rotation.z=Math.sin(p*Math.PI)*.018}
    else if(step.n===3){t.blueprint.visible=true;t.blueprint.position.x=-2.15*p;t.blueprint.position.y=1.28+.42*p;t.blueprint.scale.setScalar(1-.33*p);t.plateBlank.visible=true;t.plateBlank.material.opacity=.92-.76*p;this.turnRig.visible=true;this.profilePlate.scale.setScalar(.18+.82*p);t.offcuts.forEach((o,i)=>{o.visible=p>.35;o.position.x=(i?1:-1)*(.46+p*.58);o.position.y=1.12-p*.22;o.rotation.z=(i?1:-1)*p*.5})}
    else if(step.n===4){this.setCameraPose('turnDraft');t.blueprint.visible=false;t.plateBlank.visible=false;t.seedForms.visible=true;t.seedForms.scale.setScalar(Math.max(.001,p));t.seedForms.rotation.y=p*.42}
    else if(step.n===5){t.seedForms.visible=true;t.seedMaterial.color.copy(shapedColor).lerp(firedColor,p);t.seedMaterial.roughness=U.lerp(.99,.95,p);if(Math.random()<.10)this.spawn('steam',t.seedForms.getWorldPosition(new THREE.Vector3()),1,.65)}
    else if(step.n===6){this.setCameraPose('turnForm');t.seedForms.visible=false;t.sandTrays.visible=true;t.sandTrays.scale.setScalar(.35+.65*p);this.setTurningEvolution({build:.12*p,rough:0,fine:0,spin:t.spin});if(Math.random()<.10)this.spawn('dust',this.mold.localToWorld(new THREE.Vector3(0,.34,.2)),2,.65)}
    else if(step.n===7){this.setCameraPose('turnForm');t.blueprint.visible=false;t.sandTrays.visible=true;this.turnRig.visible=true;this.setTurningEvolution({build:p,rough:0,fine:0,spin:t.spin+p*.8});if(Math.random()<.14)this.spawn('sand',this.mold.localToWorld(new THREE.Vector3(this.rng.range(-1.1,1.1),.25+p*1.2,this.rng.range(-.5,.5))),2,.7)}
    else if(step.n===9){this.setTurningEvolution({build:1,rough:1,fine:0,spin:t.spin});this.setTurningAttachments(p,0,0,0)}
    else if(step.n===10){this.setTurningAttachments(1,p,0,0)}
    else if(step.n===12){this.setTurningEvolution({build:1,rough:1,fine:1,spin:t.spin});this.setTurningAttachments(1,1,p,0);t.ringGroup.rotation.x=Math.sin(p*Math.PI)*.025}
    else if(step.n===13){this.setTurningAttachments(1,1,1,p)}
    else if(step.n===14){this.setTurningAttachments(1,1,1,1);this.setTurningTexture(p);t.rings.forEach(r=>{r.material.bumpScale=U.lerp(.021,.027,p);r.material.color.copy(fineColor).lerp(new THREE.Color(0x887762),p*.35)})}
  };

  N.World.prototype.prepareTurningInteractive=function(stepNumber){
    const t=this.turnEvolution;if(!t)return;t.activeStep=stepNumber;this.setCameraPose('turnForm');t.blueprint.visible=false;t.plateBlank.visible=false;t.offcuts.forEach(o=>o.visible=false);t.seedForms.visible=false;t.sandTrays.visible=false;this.turnRig.visible=true;this.turnRig.position.set(0,.22,0);if(stepNumber===8){this.setTurningEvolution({build:1,rough:0,fine:0,spin:0});this.setTurningAttachments(0,0,0,0)}else{this.setTurningEvolution({build:1,rough:1,fine:0,spin:t.spin});this.setTurningAttachments(1,1,0,0)}
  };

  N.World.prototype.turningSnapshot=function(){
    const t=this.turnEvolution;if(!t)return null;const visible=t.rings.filter(r=>r.visible),radii=visible.map(r=>r.scale.x);return{build:t.build,rough:t.rough,fine:t.fine,texture:t.texture,visibleBands:visible.length,averageRadius:radii.length?radii.reduce((a,b)=>a+b,0)/radii.length:0,minRadius:radii.length?Math.min(...radii):0,maxRadius:radii.length?Math.max(...radii):0,spin:t.spin,motion:t.motion};
  };

  const originalWorldUpdate=N.World.prototype.update;
  N.World.prototype.update=function(dt,visual){
    originalWorldUpdate.call(this,dt,visual);const t=this.turnEvolution;if(!t||this.stage!=='turn')return;t.motion=U.damp(t.motion,0,5.6,dt);t.spin+=dt*(.08+t.motion*2.2);if(t.build>.02)t.ringGroup.rotation.y=-t.spin*.34;this.turnRig.rotation.y=t.spin*.74;this.profilePlate.material.emissive.set(0x2a1b0e);this.profilePlate.material.emissiveIntensity=t.motion*.12;if(t.motion>.22&&this.core.time-t.lastDust>.055){t.lastDust=this.core.time;const q=U.clamp(.08+t.rough*.84,0,1),r=F.profileRadius(q),p=new THREE.Vector3(Math.cos(t.spin*.74)*r,.26+q*1.404,Math.sin(t.spin*.74)*r);this.mold.localToWorld(p);this.spawn('sand',p,1,.55);this.spawn('dust',p,1,.7)}
  };

  const originalApplyAuto=N.Game.prototype.applyAutoVisual;
  N.Game.prototype.applyAutoVisual=function(step,p){if(step.n<=14&&this.world.stage==='turn')this.world.applyFirstChapterAutoStep(step,p);else originalApplyAuto.call(this,step,p)};

  const originalRunAuto=N.Game.prototype.runAutoStep;
  N.Game.prototype.runAutoStep=function(step){const promise=originalRunAuto.call(this,step);if(step.n<=14)this.autoDuration=(step.n===7?1.55:step.n===5?1.25:1.05)*(86/this.core.settings.speed);return promise};

  const originalInitialize=N.Game.prototype.initializeStepVisual;
  N.Game.prototype.initializeStepVisual=function(step){originalInitialize.call(this,step);if(step.n===8||step.n===11)this.world.prepareTurningInteractive(step.n)};

  const originalBegin=N.Game.prototype.beginInteractiveStep;
  N.Game.prototype.beginInteractiveStep=function(step){originalBegin.call(this,step);if(step.n===8||step.n===11){this.interaction.turnTracker=new N.CircularGestureTracker({assist:this.core.settings.assist/100});this.interaction.turnMilestone=0;this.interaction.turnSoundAt=0;this.world.prepareTurningInteractive(step.n)}};

  const originalPointerDown=N.Game.prototype.pointerDown;
  N.Game.prototype.pointerDown=function(e){originalPointerDown.call(this,e);if(this.mode==='play'&&(this.currentStep?.n===8||this.currentStep?.n===11)){if(!this.interaction.turnTracker)this.interaction.turnTracker=new N.CircularGestureTracker({assist:this.core.settings.assist/100});this.interaction.turnTracker.assist=this.core.settings.assist/100;this.interaction.turnTracker.begin(e.clientX,e.clientY,innerWidth,innerHeight)}};

  const originalPointerUp=N.Game.prototype.pointerUp;
  N.Game.prototype.pointerUp=function(e){if(this.mode==='play'&&(this.currentStep?.n===8||this.currentStep?.n===11)&&this.interaction.turnTracker)this.interaction.turnTracker.end();originalPointerUp.call(this,e)};

  const originalHandleGesture=N.Game.prototype.handleGesture;
  N.Game.prototype.handleGesture=function(dx,dy,da,e){
    const step=this.currentStep;if(!(step&&(step.n===8||step.n===11)))return originalHandleGesture.call(this,dx,dy,da,e);
    const tracker=this.interaction.turnTracker||(this.interaction.turnTracker=new N.CircularGestureTracker({assist:this.core.settings.assist/100}));const sample=tracker.move(e.clientX,e.clientY,innerWidth,innerHeight);if(sample.distance<=0)return;
    this.localProgress=sample.progress;const t=this.world.turnEvolution;t.motion=Math.max(t.motion,U.clamp(sample.distance/18,0,1));t.spin+=sample.distance*.006*(sample.totalTurn<0?-1:1);if(step.n===8)this.world.setTurningEvolution({build:1,rough:this.localProgress,fine:0,spin:t.spin});else this.world.setTurningEvolution({build:1,rough:1,fine:this.localProgress,spin:t.spin});
    const milestone=Math.floor(this.localProgress*4);if(milestone>this.interaction.turnMilestone&&milestone<4){this.interaction.turnMilestone=milestone;this.core.haptic(10+milestone*3);this.core.audio.metal(.10+milestone*.03)}
    if(this.core.time-(this.interaction.turnSoundAt||0)>.07){this.interaction.turnSoundAt=this.core.time;this.core.audio.sand(.13+.16*sample.shapeScore)}
    N.ui.setHoldProgress(this.localProgress);if(this.localProgress>=1)this.finishInteractiveStep();
  };

  const originalCompleteStep=N.Game.prototype.completeStep;
  N.Game.prototype.completeStep=function(step,quality){if(step.n===8)this.world.setTurningEvolution({build:1,rough:1,fine:0,spin:this.world.turnEvolution.spin});if(step.n===11)this.world.setTurningEvolution({build:1,rough:1,fine:1,spin:this.world.turnEvolution.spin});originalCompleteStep.call(this,step,quality)};

  const originalStartFromTitle=N.Game.prototype.startFromTitle;
  N.Game.prototype.startFromTitle=function(){
    const save=this.store.save;if(!save.finished&&save.scene===0&&!save.completedScenes.includes('turn')&&Number(save.turnVisualRevision||0)<2){save.completedSteps=save.completedSteps.filter(n=>n>14);save.turnVisualRevision=2;this.store.persistSave()}
    return originalStartFromTitle.call(this);
  };

  N.Game.prototype.debugFirstScene=function(stepNumber=8){
    this.store.save.completedSteps=Array.from({length:Math.max(0,stepNumber-1)},(_,i)=>i+1);this.store.save.completedScenes=this.store.save.completedScenes.filter(id=>id!=='turn');this.store.save.scene=0;this.store.persistSave();return this.startScene(0,true);
  };

  window.__NAMBU_VISUAL_REVISION__='2.0';
  window.__NAMBU_E2E__={
    snapshot:()=>N.world?.turningSnapshot()||null,
    setAuto:(step,p)=>{if(!N.world)return null;N.ui?.hideTitle();N.world.setStage('turn');N.world.applyFirstChapterAutoStep(N.STEPS[step-1],p);return N.world.turningSnapshot()},
    startStep:async(step=8)=>{if(!N.game)return false;N.ui?.hideTitle();await N.game.debugFirstScene(step);return true}
  };
})();
