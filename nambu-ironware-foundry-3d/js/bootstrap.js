(function(){
  'use strict';
  const REV='1.2.0',loading=document.querySelector('#loadingText'),fatal=document.querySelector('#fatal');
  function load(src,timeout=14000){return new Promise((resolve,reject)=>{const s=document.createElement('script');let done=false;const timer=setTimeout(()=>{if(done)return;done=true;s.remove();reject(new Error(`timeout: ${src}`))},timeout);s.src=src.startsWith('http')?src:`${src}?v=${REV}`;s.async=false;s.onload=()=>{if(done)return;done=true;clearTimeout(timer);resolve()};s.onerror=()=>{if(done)return;done=true;clearTimeout(timer);s.remove();reject(new Error(`load failed: ${src}`))};document.head.appendChild(s)})}
  async function boot(){
    try{
      loading.textContent='3D工房を組み立てています';
      const threeSources=['https://cdn.jsdelivr.net/npm/three@0.154.0/build/three.min.js','https://unpkg.com/three@0.154.0/build/three.min.js'];let lastError=null;
      for(const src of threeSources){try{await load(src);if(window.THREE)break}catch(e){lastError=e}}
      if(!window.THREE)throw lastError||new Error('Three.js unavailable');
      const files=['js/data.js','js/core.js','js/models.js','js/gesture.js','js/game.js','js/progressive.js','js/ui.js','js/main.js'];
      for(let i=0;i<files.length;i++){loading.textContent=`工房を組み立てています　${i+1}/${files.length}`;await load(files[i],12000)}
    }catch(error){console.error(error);document.querySelector('#loading').classList.remove('active');fatal.classList.remove('hidden');fatal.querySelector('p').textContent='3Dライブラリまたはゲームデータを読み込めませんでした。通信を確認して再読み込みしてください。'}
  }
  boot();
})();
