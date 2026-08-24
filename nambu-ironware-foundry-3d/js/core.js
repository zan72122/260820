(function(){
  'use strict';
  const N=window.Nambu;
  const U=N.util={
    $:s=>document.querySelector(s),
    $$:s=>Array.from(document.querySelectorAll(s)),
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    lerp:(a,b,t)=>a+(b-a)*t,
    invLerp:(a,b,v)=>a===b?0:(v-a)/(b-a),
    smooth:t=>t*t*(3-2*t),
    damp:(a,b,lambda,dt)=>THREE.MathUtils.lerp(a,b,1-Math.exp(-lambda*dt)),
    sleep:ms=>new Promise(r=>setTimeout(r,ms)),
    formatTime:s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`,
    setVisible:(el,show)=>el.classList.toggle('hidden',!show)
  };

  class RNG{
    constructor(seed=0x1735){this.seed=seed>>>0}
    next(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296}
    range(a,b){return a+(b-a)*this.next()}
    pick(arr){return arr[Math.floor(this.next()*arr.length)]}
  }
  N.RNG=RNG;

  function defaultSettings(){
    const out={};
    N.SETTING_GROUPS.forEach(g=>g.items.forEach(i=>out[i.key]=i.value));
    return out;
  }

  class Store{
    constructor(){
      this.settings=defaultSettings();
      this.save={version:2,scene:0,completedSteps:[],completedScenes:[],seed:1735,playSeconds:0,bestPrecision:{},finished:false};
      try{Object.assign(this.settings,JSON.parse(localStorage.getItem('nambu-complete-settings')||'{}'))}catch(_){/* ignore */}
      try{Object.assign(this.save,JSON.parse(localStorage.getItem('nambu-complete-save')||'{}'))}catch(_){/* ignore */}
      const settingDefs=N.SETTING_GROUPS.flatMap(group=>group.items);for(const def of settingDefs){const value=this.settings[def.key];if(def.type==='toggle')this.settings[def.key]=!!value;else{const number=Number(value);this.settings[def.key]=Number.isFinite(number)?U.clamp(number,def.min,def.max):def.value}}
      const validScenes=new Set(N.SCENES.map(scene=>scene.id));this.save.version=3;this.save.scene=U.clamp(Number(this.save.scene)||0,0,N.SCENES.length-1);this.save.completedSteps=Array.from(new Set(Array.isArray(this.save.completedSteps)?this.save.completedSteps.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=48):[])).sort((a,b)=>a-b);this.save.completedScenes=Array.from(new Set(Array.isArray(this.save.completedScenes)?this.save.completedScenes.filter(id=>validScenes.has(id)):[]));this.save.seed=(Number(this.save.seed)||1735)>>>0;this.save.playSeconds=Math.max(0,Number(this.save.playSeconds)||0);this.save.finished=!!this.save.finished;this.save.bestPrecision=this.save.bestPrecision&&typeof this.save.bestPrecision==='object'?this.save.bestPrecision:{};for(const [key,value] of Object.entries(this.save.bestPrecision)){const n=Number(key),q=Number(value);if(!Number.isInteger(n)||n<1||n>48||!Number.isFinite(q))delete this.save.bestPrecision[key];else this.save.bestPrecision[key]=U.clamp(q,0,1)}
    }
    persistSettings(){try{localStorage.setItem('nambu-complete-settings',JSON.stringify(this.settings))}catch(_){/* ignore */}}
    persistSave(){try{localStorage.setItem('nambu-complete-save',JSON.stringify(this.save))}catch(_){/* ignore */}}
    resetGame(keepSeed=false){
      const seed=keepSeed?((this.save.seed+7919)>>>0):1735;
      this.save={version:2,scene:0,completedSteps:[],completedScenes:[],seed,playSeconds:0,bestPrecision:{},finished:false};
      this.persistSave();
    }
  }
  N.Store=Store;

  class AudioEngine{
    constructor(store){this.store=store;this.ctx=null;this.master=null;this.ambience=null;this.started=false;this.noise=null;this.nodes=[]}
    ensure(){
      if(this.started)return true;
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return false;
      this.ctx=new AC();
      this.master=this.ctx.createGain();
      this.master.gain.value=(this.store.settings.sound||0)/100*.36;
      this.master.connect(this.ctx.destination);
      this.noise=this.makeNoise(2);
      this.started=true;
      this.startAmbience();
      return true;
    }
    resume(){if(this.ensure()&&this.ctx.state==='suspended')this.ctx.resume().catch(()=>{})}
    setVolume(v){if(this.master)this.master.gain.setTargetAtTime(v/100*.36,this.ctx.currentTime,.05)}
    makeNoise(seconds){
      const rate=this.ctx.sampleRate,buf=this.ctx.createBuffer(1,rate*seconds,rate),d=buf.getChannelData(0);
      let last=0;for(let i=0;i<d.length;i++){const white=Math.random()*2-1;last=last*.985+white*.015;d[i]=last*.8+white*.2}return buf;
    }
    startAmbience(){
      if(!this.ctx||this.ambience)return;
      const mix=this.ctx.createGain();mix.gain.value=.28;mix.connect(this.master);
      const rumble=this.ctx.createOscillator(),rg=this.ctx.createGain();rumble.type='sine';rumble.frequency.value=42;rg.gain.value=.07;rumble.connect(rg).connect(mix);rumble.start();
      const fire=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),fg=this.ctx.createGain();fire.buffer=this.noise;fire.loop=true;filter.type='bandpass';filter.frequency.value=520;filter.Q.value=.42;fg.gain.value=.07;fire.connect(filter).connect(fg).connect(mix);fire.start();
      const tick=()=>{if(!this.ctx)return;filter.frequency.setTargetAtTime(380+Math.random()*480,this.ctx.currentTime,.08);fg.gain.setTargetAtTime(.035+Math.random()*.075,this.ctx.currentTime,.06);this._ambTimer=setTimeout(tick,150+Math.random()*260)};tick();
      this.ambience={mix,rumble,fire};
    }
    tone(freq=220,duration=.15,type='sine',gain=.12,slide=1){
      if(!this.ensure()||this.store.settings.sound<=0)return;
      const now=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(24,freq*slide),now+duration);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(gain,now+.008);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(g).connect(this.master);o.start(now);o.stop(now+duration+.02);
    }
    burst(duration=.18,gain=.11,low=500,high=3500){
      if(!this.ensure()||this.store.settings.sound<=0)return;
      const now=this.ctx.currentTime,s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();s.buffer=this.noise;f.type='bandpass';f.frequency.value=(low+high)/2;f.Q.value=.7;g.gain.setValueAtTime(gain,now);g.gain.exponentialRampToValueAtTime(.0001,now+duration);s.connect(f).connect(g).connect(this.master);s.start(now);s.stop(now+duration);
    }
    metal(strength=1){this.tone(170,.16,'triangle',.13*strength,.56);setTimeout(()=>this.tone(430,.08,'sine',.045*strength,.72),22)}
    sand(strength=1){this.burst(.14,.06*strength,250,1800)}
    fire(strength=1){this.burst(.25,.075*strength,420,3500);this.tone(75,.18,'sine',.04*strength,.8)}
    pour(strength=1){this.burst(.18,.045*strength,600,5000);this.tone(96,.16,'sine',.025*strength,1.05)}
    water(strength=1){this.burst(.25,.035*strength,900,6000)}
    reward(){this.metal(.8);setTimeout(()=>this.tone(294,.42,'sine',.07,1.5),120)}
  }
  N.AudioEngine=AudioEngine;

  function canvasTexture(draw,size=512,repeat=[1,1]){
    const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d',{alpha:false});draw(x,size);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat[0],repeat[1]);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
  }
  function noiseTexture(base,opts={}){
    const size=opts.size||512,grain=opts.grain||1,streak=opts.streak||0,seed=opts.seed||71,rng=new RNG(seed);
    return canvasTexture((x,s)=>{
      x.fillStyle=base;x.fillRect(0,0,s,s);
      const image=x.getImageData(0,0,s,s),d=image.data;
      for(let i=0;i<d.length;i+=4){const n=(rng.next()-.5)*grain*54;d[i]=U.clamp(d[i]+n,0,255);d[i+1]=U.clamp(d[i+1]+n*.92,0,255);d[i+2]=U.clamp(d[i+2]+n*.75,0,255)}x.putImageData(image,0,0);
      if(streak){x.globalAlpha=.12;for(let i=0;i<180;i++){x.strokeStyle=rng.next()>.5?'#fff':'#000';x.lineWidth=rng.range(.4,2);x.beginPath();const y=rng.range(0,s);x.moveTo(rng.range(-s*.2,s*.3),y);x.lineTo(rng.range(s*.5,s*1.2),y+rng.range(-streak,streak));x.stroke()}x.globalAlpha=1}
    },size,opts.repeat||[1,1]);
  }
  function bumpTexture(opts={}){
    const size=opts.size||512,rng=new RNG(opts.seed||99);
    return canvasTexture((x,s)=>{
      x.fillStyle='#777';x.fillRect(0,0,s,s);const image=x.getImageData(0,0,s,s),d=image.data;
      for(let i=0;i<d.length;i+=4){const n=118+rng.range(-42,42)+Math.sin(i/4%size*.17)*6;d[i]=d[i+1]=d[i+2]=n}x.putImageData(image,0,0);
      for(let i=0;i<90;i++){x.strokeStyle=`rgba(35,35,35,${rng.range(.03,.16)})`;x.lineWidth=rng.range(.4,2.2);x.beginPath();const px=rng.range(0,s),py=rng.range(0,s);x.moveTo(px,py);x.bezierCurveTo(px+rng.range(-30,30),py+rng.range(-20,20),px+rng.range(-45,45),py+rng.range(-35,35),px+rng.range(-60,60),py+rng.range(-50,50));x.stroke()}
    },size,opts.repeat||[1,1]);
  }

  class Core{
    constructor(store){
      this.store=store;this.settings=store.settings;this.rng=new RNG(store.save.seed);this.clock=new THREE.Clock();this.time=0;this.dt=.016;this.paused=false;
      this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',stencil:false});
      this.renderer.setSize(innerWidth,innerHeight);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.domElement.id='gameCanvas';this.renderer.domElement.setAttribute('aria-label','南部鉄器の3D工房');this.renderer.domElement.tabIndex=0;document.querySelector('#app').prepend(this.renderer.domElement);
      this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x080705);this.scene.fog=new THREE.FogExp2(0x0b0907,.029);
      this.camera=new THREE.PerspectiveCamera(this.settings.fov,innerWidth/innerHeight,.04,120);this.camera.position.set(6,3.2,8.4);
      this.root=new THREE.Group();this.scene.add(this.root);
      this.audio=new AudioEngine(store);
      this.textures=this.makeTextures();this.materials=this.makeMaterials();
      this.targetDpr=Math.min(devicePixelRatio||1,2);this.fpsSamples=[];this.lastQualityChange=0;this.setQuality(this.settings.quality);
      this.applySettings();
      addEventListener('resize',()=>this.resize(),{passive:true});
      document.addEventListener('visibilitychange',()=>{this.paused=document.hidden;if(!document.hidden)this.clock.getDelta()});
    }
    makeTextures(){
      const maxAniso=this.renderer.capabilities.getMaxAnisotropy();
      const sand=noiseTexture('#796b58',{grain:1.15,seed:11,repeat:[5,5]}),sandBump=bumpTexture({seed:12,repeat:[5,5]});
      const iron=noiseTexture('#242523',{grain:.8,seed:23,repeat:[4,3]}),ironBump=bumpTexture({seed:24,repeat:[5,4]});
      const wood=noiseTexture('#5b3d27',{grain:.5,streak:4,seed:41,repeat:[4,1]}),brick=noiseTexture('#4b2c20',{grain:.65,seed:51,repeat:[5,3]}),floor=noiseTexture('#302820',{grain:.9,streak:2,seed:61,repeat:[7,7]}),wall=noiseTexture('#28241e',{grain:.7,streak:3,seed:63,repeat:[6,3]});
      [sand,iron,wood,brick,floor,wall].forEach(t=>t.anisotropy=Math.min(8,maxAniso));return{sand,sandBump,iron,ironBump,wood,brick,floor,wall};
    }
    makeMaterials(){
      const t=this.textures;
      return{
        sand:new THREE.MeshStandardMaterial({map:t.sand,bumpMap:t.sandBump,bumpScale:.045,color:0x887965,roughness:.96,metalness:0}),
        sandDark:new THREE.MeshStandardMaterial({map:t.sand,bumpMap:t.sandBump,bumpScale:.055,color:0x5e5344,roughness:.99,metalness:0}),
        sandBurned:new THREE.MeshStandardMaterial({map:t.sand,bumpMap:t.sandBump,bumpScale:.04,color:0x40372e,roughness:.98,metalness:0}),
        iron:new THREE.MeshStandardMaterial({map:t.iron,bumpMap:t.ironBump,bumpScale:.018,color:0x252724,roughness:.76,metalness:.78}),
        ironRaw:new THREE.MeshStandardMaterial({map:t.iron,bumpMap:t.ironBump,bumpScale:.035,color:0x373734,roughness:.93,metalness:.67}),
        ironBlack:new THREE.MeshStandardMaterial({map:t.iron,bumpMap:t.ironBump,bumpScale:.012,color:0x111413,roughness:.5,metalness:.72}),
        steel:new THREE.MeshStandardMaterial({color:0x383a39,roughness:.48,metalness:.92}),
        steelDark:new THREE.MeshStandardMaterial({color:0x20211f,roughness:.67,metalness:.88}),
        refractory:new THREE.MeshStandardMaterial({color:0x8b7965,roughness:.99,metalness:0}),
        wood:new THREE.MeshStandardMaterial({map:t.wood,color:0x6b472e,roughness:.84}),
        brick:new THREE.MeshStandardMaterial({map:t.brick,color:0x5b3425,roughness:.96}),
        floor:new THREE.MeshStandardMaterial({map:t.floor,color:0x3b3127,roughness:.98}),
        wall:new THREE.MeshStandardMaterial({map:t.wall,color:0x302a23,roughness:.99}),
        cloth:new THREE.MeshStandardMaterial({color:0x4d4942,roughness:.97}),
        apron:new THREE.MeshStandardMaterial({color:0x302a24,roughness:.9}),
        leather:new THREE.MeshStandardMaterial({color:0x4a3124,roughness:.92}),
        skin:new THREE.MeshStandardMaterial({color:0x8e6950,roughness:.86}),
        molten:new THREE.MeshStandardMaterial({color:0xff9e28,emissive:0xff4500,emissiveIntensity:3.6,roughness:.16,metalness:.08}),
        water:new THREE.MeshPhysicalMaterial({color:0xc8dce2,roughness:.08,transmission:.45,transparent:true,opacity:.66,ior:1.33,depthWrite:false})
      };
    }
    mesh(geometry,material,position=[0,0,0],rotation=[0,0,0],cast=true,receive=true){
      const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.rotation.set(...rotation);m.castShadow=cast;m.receiveShadow=receive;return m;
    }
    group(name=''){const g=new THREE.Group();g.name=name;return g}
    applySettings(){
      const s=this.settings;this.camera.fov=s.fov;this.camera.updateProjectionMatrix();this.renderer.toneMappingExposure=s.exposure/100;this.scene.fog.density=.018+s.darkness/3400;this.materials.sand.roughness=s.sandRoughness/100;this.materials.sandDark.roughness=Math.min(1,s.sandRoughness/100+.04);this.materials.ironBlack.roughness=U.lerp(.72,.25,s.lacquerGloss/100);this.setQuality(s.quality);this.audio.setVolume(s.sound);
    }
    setQuality(level){
      const q=Number(level);this.settings.quality=q;const dpr=q===0?Math.min(1,devicePixelRatio||1):q===1?Math.min(1.5,devicePixelRatio||1):Math.min(2,devicePixelRatio||1);this.targetDpr=dpr;this.renderer.setPixelRatio(dpr);this.renderer.shadowMap.enabled=q>0;this.resize();
    }
    resize(){this.renderer.setSize(innerWidth,innerHeight,false);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix()}
    tick(){this.dt=Math.min(.05,this.clock.getDelta()||.016);this.time+=this.dt;return this.dt}
    adaptiveQuality(){
      if(this.settings.quality!==2||this.time-this.lastQualityChange<8)return;const fps=1/Math.max(.001,this.dt);this.fpsSamples.push(fps);if(this.fpsSamples.length>180)this.fpsSamples.shift();if(this.fpsSamples.length===180){const avg=this.fpsSamples.reduce((a,b)=>a+b,0)/180;if(avg<38){this.setQuality(1);this.store.persistSettings();this.lastQualityChange=this.time;N.ui?.toast('描画を軽くしました')}}
    }
    haptic(pattern=18){if(this.settings.haptics&&navigator.vibrate)try{navigator.vibrate(pattern)}catch(_){/* ignore */}}
  }
  N.Core=Core;
})();
