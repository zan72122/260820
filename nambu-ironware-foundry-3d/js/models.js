(function(){
  'use strict';
  const N=window.Nambu,U=N.util;

  function taperedTube(curve,segments=72,radial=14,r0=.24,r1=.11){
    const frames=curve.computeFrenetFrames(segments,false),pos=[],norm=[],uv=[],idx=[];
    for(let i=0;i<=segments;i++){
      const t=i/segments,p=curve.getPointAt(t),radius=U.lerp(r0,r1,t)*(1+Math.sin(t*Math.PI)*.08);
      for(let j=0;j<=radial;j++){
        const v=j/radial*Math.PI*2,c=Math.cos(v),s=Math.sin(v);
        const n=frames.normals[i].clone().multiplyScalar(c).add(frames.binormals[i].clone().multiplyScalar(s)).normalize();
        const q=p.clone().addScaledVector(n,radius);pos.push(q.x,q.y,q.z);norm.push(n.x,n.y,n.z);uv.push(t,j/radial);
      }
    }
    for(let i=0;i<segments;i++)for(let j=0;j<radial;j++){const a=i*(radial+1)+j,b=(i+1)*(radial+1)+j,c=b+1,d=a+1;idx.push(a,b,d,b,c,d)}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeBoundingSphere();return g;
  }

  function latheProfile(points,segments=96){return new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),segments)}

  class World{
    constructor(core){
      this.core=core;this.scene=core.scene;this.root=core.root;this.m=core.materials;this.rng=core.rng;
      this.cameraRig={pose:'title',yaw:0,pitch:0,zoom:1,position:new THREE.Vector3(),target:new THREE.Vector3(),desiredPosition:new THREE.Vector3(),desiredTarget:new THREE.Vector3()};
      this.poses={
        title:{p:[5.8,2.65,7.6],t:[.4,1.18,-.15]},titleMacro:{p:[2.25,1.68,3.2],t:[.3,1.04,-.05]},
        moldClose:{p:[4.8,2.65,5.8],t:[.15,1.02,-.18]},moldMacro:{p:[2.45,1.65,3.0],t:[.1,1.02,-.1]},moldFire:{p:[3.6,2.25,5.25],t:[-1.15,1.12,-1.8]},core:{p:[4.4,2.65,5.35],t:[.08,1.1,-.08]},
        ladleWide:{p:[6.9,3.05,7.8],t:[-.35,1.45,.45]},ladleAim:{p:[5.1,2.65,5.9],t:[-.05,1.5,.1]},pour:{p:[4.55,2.75,5.15],t:[.05,1.48,.02]},pourClose:{p:[3.65,2.45,4.35],t:[.08,1.45,.02]},
        moldOpen:{p:[4.85,2.4,5.55],t:[.1,1.0,-.15]},kettleClose:{p:[3.65,2.0,4.4],t:[.15,1.0,-.12]},kettleMacro:{p:[2.45,1.58,3.05],t:[.25,1.02,-.08]},finishMacro:{p:[2.15,1.55,2.75],t:[.3,1.03,-.03]},handle:{p:[4.05,2.55,5.0],t:[.2,1.4,-.08]},final:{p:[5.1,2.55,6.2],t:[.25,1.28,-.12]},free:{p:[6.5,3.1,8.1],t:[.1,1.15,-.1]}
      };
      this.buildWorkshop();this.buildMold();this.buildKettle();this.buildLadleAndWorkers();this.buildTools();this.buildParticles();this.setStage('title');
    }

    add(mesh,parent=this.root){parent.add(mesh);return mesh}
    mesh(...args){return this.core.mesh(...args)}

    buildWorkshop(){
      const m=this.m;
      const floor=this.add(this.mesh(new THREE.PlaneGeometry(32,26),m.floor,[0,0,0],[-Math.PI/2,0,0],false,true));floor.name='stone floor';
      this.add(this.mesh(new THREE.PlaneGeometry(32,11),m.wall,[0,5.5,-8],[0,0,0],false,true));
      this.add(this.mesh(new THREE.PlaneGeometry(18,11),m.wall,[-9,5.5,0],[0,Math.PI/2,0],false,true));
      for(let i=-4;i<=4;i++)this.add(this.mesh(new THREE.BoxGeometry(.3,7.4,.34),m.wood,[i*3.45,3.7,-7.72]));
      for(let i=0;i<5;i++)this.add(this.mesh(new THREE.BoxGeometry(29,.23,.36),m.wood,[0,1.25+i*1.47,-7.7]));
      for(let i=-3;i<=3;i++)this.add(this.mesh(new THREE.BoxGeometry(.28,.28,17),m.wood,[i*4.2,7.15,-.5]));

      const windowGroup=this.core.group('cold window');windowGroup.position.set(4.7,3.15,-7.58);this.add(windowGroup);
      const glass=new THREE.MeshBasicMaterial({color:0xa9c0cd,transparent:true,opacity:.18});windowGroup.add(this.mesh(new THREE.PlaneGeometry(3.6,2.6),glass,[0,1.2,0],[],false,false));
      for(const x of [-1.8,0,1.8])windowGroup.add(this.mesh(new THREE.BoxGeometry(.07,2.7,.09),m.steelDark,[x,1.2,.04]));
      windowGroup.add(this.mesh(new THREE.BoxGeometry(3.65,.08,.09),m.steelDark,[0,1.2,.04]));

      this.forge=this.core.group('furnace');this.forge.position.set(-5.35,0,-4.75);this.add(this.forge);
      const base=this.mesh(new THREE.BoxGeometry(3.5,2.75,2.45),m.brick,[0,1.38,0]);this.forge.add(base);
      const archShape=new THREE.Shape();archShape.moveTo(-.9,-.65);archShape.lineTo(-.9,.2);archShape.absarc(0,.2,.9,Math.PI,0,false);archShape.lineTo(.9,-.65);archShape.closePath();
      const archGeo=new THREE.ExtrudeGeometry(archShape,{depth:.16,bevelEnabled:false});const archMat=new THREE.MeshStandardMaterial({color:0x1b0a04,emissive:0xff4b08,emissiveIntensity:2.4,roughness:.7});const arch=this.mesh(archGeo,archMat,[0,1.22,1.24]);arch.rotation.x=0;this.forge.add(arch);
      for(let i=0;i<7;i++){const brick=this.mesh(new THREE.BoxGeometry(.44,.18,.22),m.refractory,[-1.15+i*.38,2.58,.72],[0,.05*(i-3),0]);this.forge.add(brick)}
      const hood=this.mesh(new THREE.CylinderGeometry(.95,1.65,1.1,4,1,true),m.steelDark,[0,3.5,.05],[0,Math.PI/4,0]);hood.scale.z=.7;this.forge.add(hood);
      this.forge.add(this.mesh(new THREE.CylinderGeometry(.43,.58,3.2,18),m.steelDark,[0,5.6,.05]));
      this.fireLight=new THREE.PointLight(0xff681d,48,12,1.65);this.fireLight.position.set(-5.15,1.65,-3.45);this.fireLight.castShadow=true;this.scene.add(this.fireLight);
      this.workLight=new THREE.SpotLight(0xf2d2b0,21,18,.62,.55,1.2);this.workLight.position.set(1.5,7.6,4.5);this.workLight.target.position.set(.2,.7,-.2);this.workLight.castShadow=true;this.workLight.shadow.mapSize.set(1024,1024);this.scene.add(this.workLight,this.workLight.target);
      this.coolLight=new THREE.DirectionalLight(0xbfd6e7,1.75);this.coolLight.position.set(5.5,8,4);this.coolLight.castShadow=true;this.coolLight.shadow.mapSize.set(1024,1024);this.scene.add(this.coolLight);
      this.scene.add(new THREE.HemisphereLight(0x77899a,0x1c1009,.56));

      const rack=this.core.group('tool rack');rack.position.set(5.1,0,-5.7);this.add(rack);rack.add(this.mesh(new THREE.BoxGeometry(4.6,.18,.55),m.wood,[0,1.0,0]));rack.add(this.mesh(new THREE.BoxGeometry(4.6,.16,.55),m.wood,[0,2.2,0]));for(const x of [-2.1,2.1])rack.add(this.mesh(new THREE.BoxGeometry(.18,2.6,.55),m.wood,[x,1.3,0]));
      for(let i=0;i<7;i++){const tool=this.mesh(new THREE.CylinderGeometry(.025,.035,.7+this.rng.range(0,.5),8),i%2?m.steel:m.wood,[-1.75+i*.56,1.65,-.1],[0,0,this.rng.range(-.2,.2)]);rack.add(tool)}
      for(let i=0;i<9;i++){const g=this.core.group('stored mold');const x=3.6+(i%3)*1.48,z=-4.7+Math.floor(i/3)*1.42;g.add(this.mesh(new THREE.CylinderGeometry(.62,.68,.66,36),m.sandDark,[0,.33,0]));g.add(this.mesh(new THREE.TorusGeometry(.66,.045,8,42),m.steelDark,[0,.62,0],[Math.PI/2,0,0]));g.position.set(x,0,z);this.add(g)}
      const bucketMat=new THREE.MeshStandardMaterial({color:0x393a38,roughness:.62,metalness:.88});for(const [x,z] of [[-3.3,-5.8],[6.4,-2.7]]){const b=this.mesh(new THREE.CylinderGeometry(.34,.28,.52,24,1,true),bucketMat,[x,.26,z]);this.add(b)}
      for(let i=0;i<22;i++){const p=this.mesh(new THREE.IcosahedronGeometry(this.rng.range(.025,.07),0),m.sandDark,[this.rng.range(-6,6),.035,this.rng.range(-5,4)],[],false,true);p.scale.y=.35;this.add(p)}
    }

    buildMold(){
      const m=this.m;this.mold=this.core.group('main burned mold');this.mold.position.set(.15,0,-.18);this.add(this.mold);
      this.moldLeft=this.core.group('left mold half');this.moldRight=this.core.group('right mold half');this.mold.add(this.moldLeft,this.moldRight);
      const halfGeoA=new THREE.CylinderGeometry(1.52,1.62,1.5,72,3,false,-Math.PI/2,Math.PI);const halfGeoB=new THREE.CylinderGeometry(1.52,1.62,1.5,72,3,false,Math.PI/2,Math.PI);
      this.moldLeft.add(this.mesh(halfGeoA,m.sand,[0,.75,0]));this.moldRight.add(this.mesh(halfGeoB,m.sand,[0,.75,0]));
      this.moldLeft.add(this.mesh(new THREE.BoxGeometry(.12,1.48,3.02),m.sandDark,[0,.75,0]));this.moldRight.add(this.mesh(new THREE.BoxGeometry(.12,1.48,3.02),m.sandDark,[0,.75,0]));
      for(const part of [this.moldLeft,this.moldRight]){
        part.add(this.mesh(new THREE.TorusGeometry(1.57,.065,10,72),m.steelDark,[0,.22,0],[Math.PI/2,0,0]));part.add(this.mesh(new THREE.TorusGeometry(1.54,.06,10,72),m.steelDark,[0,1.18,0],[Math.PI/2,0,0]));
      }
      this.moldCap=this.core.group('mold top');this.mold.add(this.moldCap);
      this.moldCap.add(this.mesh(new THREE.CylinderGeometry(1.48,1.51,.24,72),m.sand,[0,1.57,0]));
      const funnelGeo=new THREE.CylinderGeometry(.52,.17,.32,48,1,true);this.basin=this.mesh(funnelGeo,m.sandDark,[0,1.83,0]);this.moldCap.add(this.basin);
      this.sprue=this.mesh(new THREE.CylinderGeometry(.115,.105,.37,24),new THREE.MeshStandardMaterial({color:0x1b1713,roughness:1}),[0,1.58,0]);this.moldCap.add(this.sprue);
      for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const x=Math.cos(a)*1.15,z=Math.sin(a)*1.15;this.moldCap.add(this.mesh(new THREE.CylinderGeometry(.032,.032,.21,10),m.steelDark,[x,1.78,z]))}
      this.clamps=[];for(const x of [-1.25,1.25])for(const z of [-.92,.92]){const bar=this.mesh(new THREE.BoxGeometry(.105,1.65,.15),m.steelDark,[x,.82,z]);const nut=this.mesh(new THREE.CylinderGeometry(.105,.105,.12,6),m.steel,[x,1.62,z],[Math.PI/2,0,0]);this.mold.add(bar,nut);this.clamps.push(bar,nut)}
      this.moldBoard=this.mesh(new THREE.BoxGeometry(4.2,.15,3.9),m.wood,[0,.08,0]);this.mold.add(this.moldBoard);

      const coreProfile=[[.44,.05],[.72,.15],[.92,.4],[.98,.72],[.9,1.02],[.73,1.24],[.5,1.34],[.42,1.43]];
      this.coreObject=this.mesh(latheProfile(coreProfile,72),m.sandDark,[0,.22,0]);this.coreObject.visible=false;this.mold.add(this.coreObject);
      this.coreSpout=this.mesh(new THREE.CylinderGeometry(.12,.23,1.15,24),m.sandDark,[.7,1.15,.02],[0,0,-.72]);this.coreSpout.visible=false;this.mold.add(this.coreSpout);
      this.runnerGroup=this.core.group('cutaway runners');this.runnerGroup.visible=false;this.mold.add(this.runnerGroup);
      const runnerMat=new THREE.MeshStandardMaterial({color:0x2a2119,roughness:.96,transparent:true,opacity:.82});this.runnerGroup.add(this.mesh(new THREE.CylinderGeometry(.095,.095,1.05,18),runnerMat,[0,1.18,0]));this.runnerGroup.add(this.mesh(new THREE.CylinderGeometry(.075,.075,1.35,18),runnerMat,[0,.68,0],[0,0,Math.PI/2]));

      this.turnRig=this.core.group('mold turning rig');this.turnRig.position.set(0,1.7,0);this.mold.add(this.turnRig);
      this.turnArm=this.mesh(new THREE.CylinderGeometry(.035,.045,2.35,12),m.steel,[-.06,.5,0],[0,0,.12]);this.turnRig.add(this.turnArm);
      const plateShape=new THREE.Shape();plateShape.moveTo(0,0);plateShape.bezierCurveTo(.45,.12,.68,.5,.77,.85);plateShape.bezierCurveTo(.86,1.16,.68,1.38,.48,1.48);plateShape.lineTo(.36,1.48);plateShape.bezierCurveTo(.58,1.22,.67,.98,.57,.7);plateShape.bezierCurveTo(.49,.42,.26,.19,0,.12);plateShape.closePath();
      this.profilePlate=this.mesh(new THREE.ExtrudeGeometry(plateShape,{depth:.055,bevelEnabled:false}),m.steelDark,[.02,-.15,.02],[0,Math.PI/2,0]);this.turnRig.add(this.profilePlate);
      this.turnRig.visible=false;

      this.moldArare=this.createMoldArare();this.moldArare.visible=false;this.mold.add(this.moldArare);
      this.arareTool=this.core.group('arare stamping tool');this.arareTool.visible=false;this.arareTool.add(this.mesh(new THREE.CylinderGeometry(.045,.06,.55,12),m.wood,[0,.28,0]));this.arareTool.add(this.mesh(new THREE.SphereGeometry(.055,14,10),m.steel,[0,0,0]));this.arareTool.position.set(0,1.05,1.58);this.mold.add(this.arareTool);

      this.bellows=this.core.group('bellows');this.bellows.visible=false;this.bellows.position.set(-2.55,.25,-1.3);this.mold.add(this.bellows);this.bellows.add(this.mesh(new THREE.BoxGeometry(1.1,.14,.65),m.wood,[0,.3,0],[0,0,.08]));this.bellows.add(this.mesh(new THREE.BoxGeometry(1.1,.14,.65),m.wood,[0,.68,0],[0,0,-.08]));const skin=new THREE.MeshStandardMaterial({color:0x493326,roughness:.96,side:THREE.DoubleSide});this.bellowsSkin=this.mesh(new THREE.CylinderGeometry(.36,.36,.95,4,1,true),skin,[0,.49,0],[0,0,Math.PI/2]);this.bellows.add(this.bellowsSkin);this.bellowsLever=this.mesh(new THREE.CylinderGeometry(.035,.045,1.8,10),m.wood,[-.9,.54,0],[0,0,Math.PI/2]);this.bellows.add(this.bellowsLever);

      this.wedges=[];for(const x of [-1.64,1.64]){const w=this.mesh(new THREE.ConeGeometry(.13,.58,4),m.steel,[x,1.25,-.2],[0,0,x<0?-.28:.28]);w.visible=false;this.add(w);this.wedges.push(w)}
      this.moldCracks=[];for(let i=0;i<14;i++){const pts=[];let p=new THREE.Vector3(this.rng.range(-1.35,1.35),this.rng.range(.25,1.36),1.48);for(let k=0;k<5;k++){pts.push(p.clone());p=p.clone().add(new THREE.Vector3(this.rng.range(-.12,.12),this.rng.range(-.08,.08),.01))}const g=new THREE.BufferGeometry().setFromPoints(pts);const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0x2c251e,transparent:true,opacity:0}));this.mold.add(l);this.moldCracks.push(l)}
    }

    createMoldArare(){
      const geo=new THREE.SphereGeometry(.032,8,5,0,Math.PI*2,0,Math.PI*.58),mat=new THREE.MeshStandardMaterial({color:0x352d25,roughness:1});const count=420,inst=new THREE.InstancedMesh(geo,mat,count),dummy=new THREE.Object3D();let idx=0;
      for(let band=0;band<14;band++){const y=.28+band*.075,r=1.51-band*.006,n=30;for(let j=0;j<n;j++){const a=(j+(band%2)*.5)/n*Math.PI*2;dummy.position.set(Math.cos(a)*r,y,Math.sin(a)*r);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a),0,Math.sin(a)));dummy.scale.setScalar(0);dummy.updateMatrix();inst.setMatrixAt(idx++,dummy.matrix)}}inst.instanceMatrix.needsUpdate=true;inst.userData.count=count;return inst;
    }

    updateMoldArare(progress){
      const inst=this.moldArare,dummy=new THREE.Object3D(),count=inst.userData.count,shown=Math.floor(progress*count),bands=14,n=30;let idx=0;
      for(let band=0;band<bands;band++){const y=.28+band*.075,r=1.51-band*.006;for(let j=0;j<n;j++){const a=(j+(band%2)*.5)/n*Math.PI*2;dummy.position.set(Math.cos(a)*r,y,Math.sin(a)*r);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a),0,Math.sin(a)));const s=idx<shown?1:0;dummy.scale.setScalar(s);dummy.updateMatrix();inst.setMatrixAt(idx++,dummy.matrix)}}inst.instanceMatrix.needsUpdate=true;
    }

    buildKettle(){
      this.kettle=this.core.group('Nambu iron kettle');this.kettle.position.set(.15,.14,-.18);this.add(this.kettle);
      const profile=[[.34,.02],[.58,.04],[.79,.13],[.94,.31],[1.02,.58],[1.01,.82],[.94,1.03],[.78,1.19],[.58,1.3],[.48,1.35],[.47,1.5]];
      this.kettleBody=this.mesh(latheProfile(profile,112),this.m.ironRaw,[0,0,0]);this.kettle.add(this.kettleBody);
      this.kettleBottom=this.mesh(new THREE.CylinderGeometry(.58,.72,.11,72),this.m.ironRaw,[0,.02,0]);this.kettle.add(this.kettleBottom);
      const neck=this.mesh(new THREE.CylinderGeometry(.48,.5,.2,72),this.m.ironRaw,[0,1.49,0]);this.kettle.add(neck);
      const lidProfile=[[0,.02],[.2,.035],[.44,.06],[.51,.13],[.47,.19],[.16,.23],[.08,.31]];this.lid=this.mesh(latheProfile(lidProfile,80),this.m.ironRaw,[0,1.53,0]);this.kettle.add(this.lid);this.lidKnob=this.mesh(new THREE.SphereGeometry(.11,24,16),this.m.ironRaw,[0,1.9,0]);this.lidKnob.scale.y=.65;this.kettle.add(this.lidKnob);
      const spoutCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(.78,.72,.02),new THREE.Vector3(1.12,.91,.02),new THREE.Vector3(1.38,1.26,.01),new THREE.Vector3(1.58,1.55,.02),new THREE.Vector3(1.77,1.64,.02)]);this.spout=this.mesh(taperedTube(spoutCurve,72,14,.27,.12),this.m.ironRaw);this.kettle.add(this.spout);
      this.spoutLip=this.mesh(new THREE.TorusGeometry(.125,.028,8,28),this.m.ironRaw,[1.77,1.64,.02],[0,Math.PI/2,0]);this.kettle.add(this.spoutLip);
      this.lugs=[];for(const x of [-.78,.78]){const lug=this.core.group('handle lug');lug.position.set(x,1.22,0);const ring=this.mesh(new THREE.TorusGeometry(.17,.045,10,32,Math.PI*1.55),this.m.ironRaw,[0,0,0],[0,Math.PI/2,x<0?-.78:.78]);lug.add(ring);this.kettle.add(lug);this.lugs.push(lug)}
      const hCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.79,1.25,0),new THREE.Vector3(-.98,2.04,0),new THREE.Vector3(-.55,2.62,0),new THREE.Vector3(0,2.82,0),new THREE.Vector3(.55,2.62,0),new THREE.Vector3(.98,2.04,0),new THREE.Vector3(.79,1.25,0)]);this.handle=this.mesh(new THREE.TubeGeometry(hCurve,96,.055,12,false),this.m.steelDark);this.handle.visible=false;this.kettle.add(this.handle);
      this.arare=this.createKettleArare(profile);this.kettle.add(this.arare);
      this.sandPatches=this.createSandPatches(profile);this.kettle.add(this.sandPatches.group);
      this.brush=this.makeBrush();this.brush.visible=false;this.kettle.add(this.brush);
      this.kettle.visible=false;
      this.kettleScaleVariant=1+this.rng.range(-.025,.03);this.kettle.scale.set(this.kettleScaleVariant,1/this.kettleScaleVariant,1);
    }

    radiusAt(y){
      const pts=[[.02,.34],[.04,.58],[.13,.79],[.31,.94],[.58,1.02],[.82,1.01],[1.03,.94],[1.19,.78],[1.3,.58],[1.35,.48],[1.5,.47]];
      if(y<=pts[0][0])return pts[0][1];for(let i=1;i<pts.length;i++)if(y<=pts[i][0]){const t=U.invLerp(pts[i-1][0],pts[i][0],y);return U.lerp(pts[i-1][1],pts[i][1],t)}return .47;
    }

    createKettleArare(){
      const geo=new THREE.SphereGeometry(.026,8,6),mat=this.m.ironRaw,count=480,inst=new THREE.InstancedMesh(geo,mat,count),d=new THREE.Object3D();let k=0;
      for(let band=0;band<16;band++){const y=.24+band*.061,r=this.radiusAt(y)+.012,n=30;for(let j=0;j<n;j++){const a=(j+(band%2)*.5)/n*Math.PI*2;const normal=new THREE.Vector3(Math.cos(a),.08*(.74-y),Math.sin(a)).normalize();d.position.set(Math.cos(a)*r,y,Math.sin(a)*r);d.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);d.scale.set(1,.55,1);d.updateMatrix();inst.setMatrixAt(k++,d.matrix)}}inst.instanceMatrix.needsUpdate=true;return inst;
    }

    createSandPatches(){
      const group=this.core.group('adhered mold sand'),items=[];for(let i=0;i<88;i++){const y=this.rng.range(.16,1.38),a=this.rng.range(0,Math.PI*2),r=this.radiusAt(y)+.025;const p=this.mesh(new THREE.IcosahedronGeometry(this.rng.range(.045,.13),1),this.m.sandBurned,[Math.cos(a)*r,y,Math.sin(a)*r]);p.scale.set(this.rng.range(.7,1.5),this.rng.range(.25,.65),this.rng.range(.7,1.4));p.userData.baseScale=p.scale.clone();p.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a),.12*(.7-y),Math.sin(a)).normalize());p.userData.threshold=this.rng.next();group.add(p);items.push(p)}return{group,items};
    }

    makeBrush(){const g=this.core.group('finishing brush');g.add(this.mesh(new THREE.BoxGeometry(.52,.08,.14),this.m.wood,[0,0,0]));const bristle=new THREE.MeshStandardMaterial({color:0x2b1b12,roughness:1});for(let i=-5;i<=5;i++)g.add(this.mesh(new THREE.CylinderGeometry(.009,.012,.22,6),bristle,[i*.04,-.14,0]));g.position.set(.2,1.22,1.45);return g}

    buildLadleAndWorkers(){
      this.ladleRig=this.core.group('two-person ladle rig');this.ladleRig.position.set(-1.9,2.1,1.75);this.add(this.ladleRig);
      this.ladle=this.core.group('lined ladle');this.ladleRig.add(this.ladle);
      const outerPts=[];for(let i=0;i<=22;i++){const y=-.7+i*(1.26/22),t=i/22,r=.37+.44*Math.sin(t*Math.PI*.86);outerPts.push([r,y])}
      this.ladleOuter=this.mesh(latheProfile(outerPts,80),new THREE.MeshStandardMaterial({map:this.core.textures.iron,bumpMap:this.core.textures.ironBump,bumpScale:.018,color:0x343431,roughness:.7,metalness:.75,side:THREE.DoubleSide}));this.ladle.add(this.ladleOuter);
      this.ladleLining=this.mesh(new THREE.CylinderGeometry(.67,.48,.75,64,1,true),this.m.refractory,[0,.12,0]);this.ladle.add(this.ladleLining);
      this.moltenSurface=this.mesh(new THREE.CylinderGeometry(.615,.615,.045,64),this.m.molten,[0,.49,0]);this.ladle.add(this.moltenSurface);
      this.ladleLip=this.mesh(new THREE.BoxGeometry(.38,.18,.3),this.m.steel,[.69,.39,0],[0,0,-.22]);this.ladle.add(this.ladleLip);
      this.handleBars=[];for(const z of [-.44,.44]){const bar=this.mesh(new THREE.CylinderGeometry(.038,.045,4.9,12),this.m.steelDark,[-2.15,.02,z],[0,0,Math.PI/2]);this.ladle.add(bar);this.handleBars.push(bar)}
      for(const x of [-4.55,.25])for(const z of [-.44,.44])this.ladle.add(this.mesh(new THREE.CylinderGeometry(.07,.07,.12,12),this.m.steel,[x,.02,z],[Math.PI/2,0,0]));
      this.ladle.scale.setScalar(.86);
      this.workerLeft=this.makeWorker(-4.75,0,.2,1);this.workerRight=this.makeWorker(.62,0,.2,-1);this.ladleRig.add(this.workerLeft.group,this.workerRight.group);
      this.ladleRig.visible=false;
      this.stream=null;this.returnStream=null;this.waterStream=null;this._streamFrame=0;
    }

    makeWorker(x,y,z,flip){
      const g=this.core.group('foundry worker');g.position.set(x,y,z);g.rotation.y=flip>0?.08:-.08;
      const pelvis=this.mesh(new THREE.CapsuleGeometry(.23,.42,7,14),this.m.cloth,[0,.8,0]);g.add(pelvis);
      const torso=this.mesh(new THREE.CapsuleGeometry(.33,.72,8,18),this.m.cloth,[0,1.48,0]);torso.scale.z=.72;g.add(torso);
      const apron=this.mesh(new THREE.BoxGeometry(.58,.9,.04),this.m.apron,[0,1.3,.31],[.08,0,0]);g.add(apron);
      const neck=this.mesh(new THREE.CylinderGeometry(.09,.105,.16,16),this.m.skin,[0,2.0,0]);g.add(neck);
      const head=this.mesh(new THREE.SphereGeometry(.225,24,18),this.m.skin,[0,2.18,0]);head.scale.z=.88;g.add(head);
      const cap=this.mesh(new THREE.SphereGeometry(.24,24,10,0,Math.PI*2,0,Math.PI/2),this.m.steelDark,[0,2.32,0]);cap.scale.y=.55;g.add(cap);
      const brim=this.mesh(new THREE.BoxGeometry(.38,.035,.17),this.m.steelDark,[flip*.09,2.31,.12]);g.add(brim);
      const arms=[];for(const side of [-1,1]){const shoulder=this.core.group('arm');shoulder.position.set(side*.34,1.73,0);const upper=this.mesh(new THREE.CapsuleGeometry(.09,.48,6,12),this.m.cloth,[0,-.22,0]);upper.rotation.z=side*.45;shoulder.add(upper);const elbow=this.core.group();elbow.position.set(side*.19,-.48,0);shoulder.add(elbow);const fore=this.mesh(new THREE.CapsuleGeometry(.075,.44,6,12),this.m.cloth,[0,-.2,0]);fore.rotation.z=side*.18;elbow.add(fore);const glove=this.mesh(new THREE.SphereGeometry(.105,14,10),this.m.leather,[side*.04,-.47,0]);elbow.add(glove);g.add(shoulder);arms.push({shoulder,elbow,upper,fore})}
      const legs=[];for(const side of [-1,1]){const hip=this.core.group('leg');hip.position.set(side*.16,.68,0);const leg=this.mesh(new THREE.CapsuleGeometry(.105,.68,6,12),this.m.cloth,[0,-.31,0]);leg.rotation.z=side*.05;hip.add(leg);const boot=this.mesh(new THREE.BoxGeometry(.24,.16,.44),this.m.leather,[0,-.72,.1]);hip.add(boot);g.add(hip);legs.push(hip)}
      return{group:g,torso,head,arms,legs};
    }

    buildTools(){
      this.grinder=this.core.group('grinding brush');this.grinder.visible=false;this.grinder.add(this.mesh(new THREE.CylinderGeometry(.17,.17,.07,32),this.m.steel,[0,0,0],[Math.PI/2,0,0]));this.grinder.add(this.mesh(new THREE.CylinderGeometry(.035,.04,.75,10),this.m.wood,[0,.42,0]));this.grinder.position.set(.55,1.1,1.45);this.add(this.grinder);
      this.hammer=this.core.group('mold hammer');this.hammer.visible=false;this.hammer.add(this.mesh(new THREE.BoxGeometry(.34,.18,.18),this.m.steel,[0,.65,0]));this.hammer.add(this.mesh(new THREE.CylinderGeometry(.035,.045,1.2,10),this.m.wood,[0,0,0]));this.hammer.position.set(1.9,1.2,.6);this.add(this.hammer);
      this.cup=this.core.group('first cup');this.cup.visible=false;const ceramic=new THREE.MeshStandardMaterial({color:0xd2c8b8,roughness:.73});this.cup.add(this.mesh(new THREE.CylinderGeometry(.29,.22,.42,32,1,true),ceramic,[0,.21,0]));this.cup.add(this.mesh(new THREE.TorusGeometry(.22,.025,8,32),ceramic,[0,.03,0],[Math.PI/2,0,0]));this.cup.position.set(2.05,.05,.4);this.add(this.cup);
    }

    buildParticles(){
      this.particlePools={dust:[],embers:[],steam:[],molten:[],sand:[]};
      const dustMat=new THREE.MeshBasicMaterial({color:0xb8a48b,transparent:true,opacity:.18,depthWrite:false});for(let i=0;i<100;i++){const p=this.mesh(new THREE.IcosahedronGeometry(this.rng.range(.009,.025),0),dustMat.clone(),[],[],false,false);p.visible=false;this.scene.add(p);this.particlePools.dust.push({m:p,v:new THREE.Vector3(),life:0,max:1})}
      const emberMat=new THREE.MeshBasicMaterial({color:0xff8a35,transparent:true,opacity:.8,depthWrite:false});for(let i=0;i<70;i++){const p=this.mesh(new THREE.SphereGeometry(this.rng.range(.008,.022),6,4),emberMat.clone(),[],[],false,false);p.visible=false;this.scene.add(p);this.particlePools.embers.push({m:p,v:new THREE.Vector3(),life:0,max:1})}
      const steamMat=new THREE.MeshBasicMaterial({color:0xc4c0b8,transparent:true,opacity:.12,depthWrite:false});for(let i=0;i<45;i++){const p=this.mesh(new THREE.SphereGeometry(this.rng.range(.03,.09),8,6),steamMat.clone(),[],[],false,false);p.visible=false;this.scene.add(p);this.particlePools.steam.push({m:p,v:new THREE.Vector3(),life:0,max:1})}
      for(let i=0;i<50;i++){const p=this.mesh(new THREE.SphereGeometry(this.rng.range(.018,.05),8,6),this.m.molten,[],[],false,false);p.visible=false;this.scene.add(p);this.particlePools.molten.push({m:p,v:new THREE.Vector3(),life:0,max:1})}
      for(let i=0;i<65;i++){const p=this.mesh(new THREE.IcosahedronGeometry(this.rng.range(.018,.055),0),this.m.sandBurned,[],[],false,false);p.visible=false;this.scene.add(p);this.particlePools.sand.push({m:p,v:new THREE.Vector3(),life:0,max:1})}
    }

    spawn(type,pos,count=1,power=1){
      const pool=this.particlePools[type];if(!pool)return;for(let k=0;k<count;k++){const p=pool.find(x=>x.life<=0);if(!p)break;p.life=p.max=this.rng.range(.5,1.25)*power;p.m.visible=true;p.m.position.copy(pos);if(type==='embers'||type==='molten')p.v.set(this.rng.range(-.7,.7),this.rng.range(.5,1.8),this.rng.range(-.7,.7));else if(type==='steam')p.v.set(this.rng.range(-.15,.15),this.rng.range(.22,.55),this.rng.range(-.15,.15));else p.v.set(this.rng.range(-.5,.5),this.rng.range(.16,.7),this.rng.range(-.5,.5));p.m.scale.setScalar(1)}
    }

    setCameraPose(name,instant=false){
      if(!this.poses[name])name='free';this.cameraRig.pose=name;const p=this.poses[name];this.cameraRig.desiredPosition.set(...p.p);this.cameraRig.desiredTarget.set(...p.t);if(instant){this.cameraRig.position.copy(this.cameraRig.desiredPosition);this.cameraRig.target.copy(this.cameraRig.desiredTarget);this.core.camera.position.copy(this.cameraRig.position);this.core.camera.lookAt(this.cameraRig.target)}
    }

    setStage(id){
      this.stage=id;this.mold.visible=false;this.kettle.visible=false;this.ladleRig.visible=false;this.turnRig.visible=false;this.moldArare.visible=false;this.arareTool.visible=false;this.bellows.visible=false;this.coreObject.visible=false;this.coreSpout.visible=false;this.runnerGroup.visible=false;this.wedges.forEach(w=>w.visible=false);this.grinder.visible=false;this.hammer.visible=false;this.cup.visible=false;this.handle.visible=false;this.brush.visible=false;
      this.makeMoldTransparent(1);this.mold.position.set(.15,0,-.18);this.mold.rotation.set(0,0,0);this.moldLeft.position.x=0;this.moldRight.position.x=0;this.moldCap.visible=true;this.kettle.position.set(.15,.14,-.18);this.kettle.rotation.set(0,0,0);this.handle.position.set(0,0,0);this.handle.rotation.set(0,0,0);this.kettleBody.material=this.m.ironRaw;this.kettleBottom.material=this.m.ironRaw;this.lid.material=this.m.ironRaw;this.lidKnob.material=this.m.ironRaw;this.spout.material=this.m.ironRaw;this.spoutLip.material=this.m.ironRaw;this.arare.material=this.m.ironRaw;this.sandPatches.items.forEach(p=>p.visible=true);this.moldCracks.forEach(l=>l.material.opacity=0);this.clearStreams();
      if(id==='title'){this.kettle.visible=true;this.handle.visible=true;this.applyFinish(1);this.setCameraPose('title',true)}
      else if(id==='turn'){this.mold.visible=true;this.turnRig.visible=true;this.setCameraPose('moldClose')}
      else if(id==='arare'){this.mold.visible=true;this.moldArare.visible=true;this.arareTool.visible=true;this.updateMoldArare(0);this.setCameraPose('moldMacro')}
      else if(id==='fire-mold'){this.mold.visible=true;this.bellows.visible=true;this.mold.position.set(-1.0,0,-1.35);this.setCameraPose('moldFire')}
      else if(id==='core-align'){this.mold.visible=true;this.coreObject.visible=true;this.coreSpout.visible=true;this.runnerGroup.visible=true;this.makeMoldTransparent(.33);this.setCameraPose('core')}
      else if(['lift','aim','pour','return'].includes(id)){this.mold.visible=true;this.ladleRig.visible=true;this.makeMoldTransparent(1);this.setCameraPose(id==='lift'?'ladleWide':id==='aim'?'ladleAim':id==='pour'?'pour':'pourClose')}
      else if(id==='open'){this.mold.visible=true;this.kettle.visible=true;this.kettle.position.copy(this.mold.position).add(new THREE.Vector3(0,.08,0));this.wedges.forEach(w=>w.visible=true);this.hammer.visible=true;this.moldCap.visible=false;this.setCameraPose('moldOpen')}
      else if(id==='clean'){this.kettle.visible=true;this.sandPatches.items.forEach(p=>p.visible=true);this.setCameraPose('kettleClose')}
      else if(id==='surface'){this.kettle.visible=true;this.sandPatches.items.forEach(p=>p.visible=false);this.grinder.visible=true;this.setCameraPose('kettleMacro')}
      else if(id==='finish'){this.kettle.visible=true;this.sandPatches.items.forEach(p=>p.visible=false);this.brush.visible=true;this.setCameraPose('finishMacro')}
      else if(id==='handle'){this.kettle.visible=true;this.sandPatches.items.forEach(p=>p.visible=false);this.applyFinish(1);this.handle.visible=true;this.handle.position.y=1.55;this.setCameraPose('handle')}
      else if(id==='first-pour'){this.kettle.visible=true;this.sandPatches.items.forEach(p=>p.visible=false);this.applyFinish(1);this.handle.visible=true;this.cup.visible=true;this.setCameraPose('final')}
    }

    makeMoldTransparent(opacity){
      [this.m.sand,this.m.sandDark,this.m.sandBurned].forEach(mat=>{mat.transparent=opacity<1;mat.opacity=opacity;mat.depthWrite=opacity>.55});
    }

    applyFinish(progress){
      const p=U.clamp(progress,0,1),mat=this.m.ironBlack;mat.color.setRGB(U.lerp(.15,.045,p),U.lerp(.15,.055,p),U.lerp(.14,.05,p));mat.roughness=U.lerp(.92,U.lerp(.62,.25,this.core.settings.lacquerGloss/100),p);mat.metalness=U.lerp(.66,.78,p);mat.bumpScale=U.lerp(.032,.012,p);[this.kettleBody,this.kettleBottom,this.lid,this.lidKnob,this.spout,this.spoutLip,...this.lugs.flatMap(l=>l.children),this.arare].forEach(o=>o.material=mat);
    }

    setCleanProgress(progress){
      const p=U.clamp(progress,0,1);this.sandPatches.items.forEach(item=>{const remaining=U.clamp((item.userData.threshold-p)*5,0,1);item.visible=remaining>.02;item.scale.copy(item.userData.baseScale).multiplyScalar(.58+.42*remaining)});this.kettleBody.material=this.m.ironRaw;
    }

    updateCorePosition(x,z){this.coreObject.position.x=x;this.coreObject.position.z=z;this.coreSpout.position.x=.7+x;this.coreSpout.position.z=.02+z}

    ladleLipWorld(){const p=new THREE.Vector3(.75,.39,0);this.ladle.localToWorld(p);return p}

    makeCurveStream(start,end,flow,returning=false){
      const turb=this.core.settings.turbulence/100,visc=this.core.settings.viscosity/100;const distance=start.distanceTo(end),side=Math.sin(this.core.time*8.7)*.035*turb+Math.sin(this.core.time*17.1)*.015*turb;let pts;
      if(returning){pts=[start,start.clone().add(new THREE.Vector3(.12,-.35,side)),end.clone().add(new THREE.Vector3(-.12,.38,-side)),end]}
      else{const sag=U.lerp(.35,.14,visc)+distance*.06;pts=[start,start.clone().add(new THREE.Vector3(.18,-.18,side)),end.clone().add(new THREE.Vector3(-.1,sag,-side)),end]}
      const curve=new THREE.CatmullRomCurve3(pts),radius=.035*(this.core.settings.streamWidth/78)*(0.55+flow*.55)*(1+Math.sin(this.core.time*12)*.025*turb);return this.mesh(new THREE.TubeGeometry(curve,36,radius,10,false),this.m.molten,[],[],false,false);
    }

    updateMoltenStream(flow,aimError=0){
      this._streamFrame++;if(this._streamFrame%2&&this.stream)return;if(this.stream){this.scene.remove(this.stream);this.stream.geometry.dispose();this.stream=null}if(flow<.02)return;
      const start=this.ladleLipWorld(),target=new THREE.Vector3(this.mold.position.x,this.mold.position.y+1.91,this.mold.position.z);target.x+=aimError;target.z+=aimError*.2;this.stream=this.makeCurveStream(start,target,flow,false);this.scene.add(this.stream);this.m.molten.emissiveIntensity=2.4+this.core.settings.moltenGlow/30;
      if(Math.random()<flow*.22){this.spawn('molten',target.clone().add(new THREE.Vector3(this.rng.range(-.12,.12),.02,this.rng.range(-.12,.12))),1,.7);this.spawn('embers',target,2,.7)}
    }

    updateReturnStream(flow){
      if(this.returnStream){this.scene.remove(this.returnStream);this.returnStream.geometry.dispose();this.returnStream=null}if(flow<.02)return;const start=new THREE.Vector3(this.mold.position.x+.47,this.mold.position.y+1.75,this.mold.position.z),end=this.ladleLipWorld().add(new THREE.Vector3(-.05,.05,0));this.returnStream=this.makeCurveStream(start,end,flow,true);this.scene.add(this.returnStream);
    }

    updateWaterStream(flow){
      if(this.waterStream){this.scene.remove(this.waterStream);this.waterStream.geometry.dispose();this.waterStream=null}if(flow<.02)return;const start=new THREE.Vector3(1.77,1.64,.02);this.kettle.localToWorld(start);const end=this.cup.localToWorld(new THREE.Vector3(0,.48,0));const c=new THREE.CatmullRomCurve3([start,start.clone().add(new THREE.Vector3(.28,-.28,0)),end.clone().add(new THREE.Vector3(0,.35,0)),end]);this.waterStream=this.mesh(new THREE.TubeGeometry(c,30,.032*(.65+flow*.35),9,false),this.m.water,[],[],false,false);this.scene.add(this.waterStream);if(Math.random()<flow*.2)this.spawn('steam',end,1,.6);
    }

    clearStreams(){for(const key of ['stream','returnStream','waterStream'])if(this[key]){this.scene.remove(this[key]);this[key].geometry.dispose();this[key]=null}}

    updateParticles(dt){
      const gravity={dust:-.08,embers:-1.4,steam:.08,molten:-4.2,sand:-1.8};for(const [type,pool] of Object.entries(this.particlePools)){for(const p of pool)if(p.life>0){p.life-=dt;p.v.y+=gravity[type]*dt;p.m.position.addScaledVector(p.v,dt);const a=U.clamp(p.life/p.max,0,1);p.m.material.opacity=type==='steam'?.11*a:type==='dust'?.16*a:type==='sand'?1:.8*a;p.m.scale.setScalar(type==='steam'?1+(1-a)*1.7:a>.35?1:a/.35);if(p.life<=0)p.m.visible=false}}
    }

    updateCamera(dt,lookYaw=0,lookPitch=0){
      const rig=this.cameraRig,p=this.poses[rig.pose]||this.poses.free,s=this.core.settings;rig.desiredPosition.set(...p.p);rig.desiredTarget.set(...p.t);const rel=rig.desiredPosition.clone().sub(rig.desiredTarget),yaw=lookYaw;rel.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);rig.desiredPosition.copy(rig.desiredTarget).add(rel);rig.desiredPosition.y*=s.cameraHeight/100;rig.desiredPosition.multiplyScalar(100/s.scale);rig.desiredTarget.y+=lookPitch*.6;
      rig.position.lerp(rig.desiredPosition,1-Math.exp(-3.1*dt));rig.target.lerp(rig.desiredTarget,1-Math.exp(-4.0*dt));this.core.camera.position.copy(rig.position);this.core.camera.lookAt(rig.target);
    }

    animateWorkers(lift,tilt,carry){
      const lean=.08+lift*.16+tilt*.08;this.workerLeft.torso.rotation.z=lean;this.workerRight.torso.rotation.z=-lean;this.workerLeft.group.position.y=-.12*(1-lift);this.workerRight.group.position.y=-.12*(1-lift);for(const w of [this.workerLeft,this.workerRight]){w.arms[0].shoulder.rotation.z=-.15-tilt*.12;w.arms[1].shoulder.rotation.z=.15+tilt*.12;w.legs[0].rotation.z=-carry*.06;w.legs[1].rotation.z=carry*.06}
    }

    update(dt,visual={}){
      const t=this.core.time;this.fireLight.intensity=43+Math.sin(t*7.7)*5+Math.sin(t*13.1)*2.5;this.fireLight.color.setHSL(.065+Math.sin(t*3.1)*.005,.96,.54);this.forge.children[1].material.emissiveIntensity=2.0+Math.sin(t*9)*.35;
      if(Math.random()<.055)this.spawn('embers',new THREE.Vector3(-5.2,1.45,-3.42),1,1.4);
      this.updateParticles(dt);this.arareTool.position.y=1.05+Math.sin(t*2.2)*.015;this.lidKnob.rotation.y=t*.06;
      if(this.stage==='title'){this.kettle.rotation.y=.12+Math.sin(t*.18)*.08;this.handle.rotation.z=Math.sin(t*.55)*.006}
      if(this.stage==='fire-mold'&&visual.heat){if(Math.random()<visual.heat*.12)this.spawn('steam',this.mold.position.clone().add(new THREE.Vector3(this.rng.range(-1,1),1.4,this.rng.range(-.7,.7))),1,1.2);this.m.sand.color.lerpColors(new THREE.Color(0x887965),new THREE.Color(0x43382d),visual.heat)}
    }
  }
  N.World=World;
})();
