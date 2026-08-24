(function(){
  'use strict';
  const N=window.Nambu;
  try{
    const store=new N.Store();
    const core=new N.Core(store);
    const world=new N.World(core);
    const game=new N.Game(core,world,store);
    const ui=new N.UI(core,world,game,store);
    N.store=store;N.core=core;N.world=world;N.game=game;N.ui=ui;

    document.querySelector('#fallbackArt').style.opacity='0';
    ui.applyUiStrength();
    ui.ready();

    function frame(){
      requestAnimationFrame(frame);
      if(core.paused)return;
      const dt=core.tick();
      game.update(dt);
      core.adaptiveQuality();
      core.renderer.render(core.scene,core.camera);
    }
    frame();

    if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
      addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}),{once:true});
    }

    window.addEventListener('error',event=>{console.error('Runtime error:',event.error||event.message)});
    window.__NAMBU_GAME__={store,core,world,game,ui,version:'1.0.0'};
  }catch(error){
    console.error(error);
    const loading=document.querySelector('#loading'),fatal=document.querySelector('#fatal');loading.classList.remove('active');fatal.classList.remove('hidden');fatal.querySelector('p').textContent=`工房の初期化に失敗しました。${error&&error.message?' '+error.message:''}`;
  }
})();
