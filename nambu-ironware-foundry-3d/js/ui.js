(function(){
  'use strict';
  const N=window.Nambu,U=N.util;

  class UI{
    constructor(core,world,game,store){
      this.core=core;this.world=world;this.game=game;this.store=store;this.els={
        loading:U.$('#loading'),loadingText:U.$('#loadingText'),title:U.$('#titleScreen'),start:U.$('#startButton'),startLabel:U.$('#startLabel'),newGame:U.$('#newGameButton'),hud:U.$('#hud'),chapterName:U.$('#chapterName'),sceneName:U.$('#sceneName'),stepName:U.$('#stepName'),progress:U.$('#progressRail'),progressFill:U.$('#progressFill'),ticks:U.$('#chapterTicks'),instruction:U.$('#instruction'),gesture:U.$('#gestureIcon'),instructionMain:U.$('#instructionMain'),instructionSub:U.$('#instructionSub'),holdMeter:U.$('#holdMeter span'),autoStep:U.$('#autoStep'),autoNum:U.$('#autoStepNumber'),autoTitle:U.$('#autoStepTitle'),autoDetail:U.$('#autoStepDetail'),chapterCard:U.$('#chapterCard'),chapterNumber:U.$('#chapterNumber'),chapterTitle:U.$('#chapterTitle'),chapterPhrase:U.$('#chapterPhrase'),reward:U.$('#reward'),rewardText:U.$('#rewardText'),rewardDetail:U.$('#rewardDetail'),completion:U.$('#completion'),completionStats:U.$('#completionStats'),settings:U.$('#settingsPanel'),process:U.$('#processPanel'),processList:U.$('#processList'),settingControls:U.$('#settingControls'),pause:U.$('#pauseShade'),resume:U.$('#resumeButton'),flash:U.$('#flash'),toast:U.$('#toast'),fatal:U.$('#fatal')
      };
      this.panelMode=null;this.buildSettings();this.buildProcess();this.bind();this.makeChapterTicks();
    }

    bind(){
      this.els.start.onclick=()=>this.game.startFromTitle();this.els.newGame.onclick=()=>this.game.startNew();U.$('#homeButton').onclick=()=>this.game.goTitle();U.$('#settingsButton').onclick=()=>this.openPanel(this.els.settings);U.$('#processButton').onclick=()=>this.openPanel(this.els.process);U.$('#skipAutoButton').onclick=()=>this.game.skipAuto();U.$('#replayButton').onclick=()=>this.game.startNew();U.$('#freeViewButton').onclick=()=>this.game.freeView();
      U.$$('[data-close-panel]').forEach(b=>b.onclick=()=>this.closePanels());
      U.$$('[data-preset]').forEach(b=>b.onclick=()=>this.applyPreset(b.dataset.preset));
      U.$('#resetSettings').onclick=()=>this.resetSettings();U.$('#copySettings').onclick=()=>this.copySettings();
      document.addEventListener('keydown',e=>{if(e.key==='Escape')this.closePanels();if(e.key===' '&&this.game.mode==='auto')this.game.skipAuto()});
    }

    loading(text){this.els.loadingText.textContent=text||'工房に火を入れています';this.els.loading.classList.add('active')}
    ready(){this.els.loading.classList.remove('active');this.game.goTitle()}
    fatal(message){this.els.loading.classList.remove('active');this.els.fatal.classList.remove('hidden');if(message)this.els.fatal.querySelector('p').textContent=message}

    showTitle(save){
      this.hideCompletion();this.els.hud.classList.add('hidden');this.els.progress.classList.add('hidden');this.els.instruction.classList.add('hidden');this.els.autoStep.classList.add('hidden');this.els.title.classList.add('active');const hasProgress=save.completedSteps&&save.completedSteps.length>0&&!save.finished;this.els.startLabel.textContent=hasProgress?'つづきから':'はじめる';this.els.newGame.classList.toggle('hidden',!hasProgress);this.game.mode='title';
    }
    hideTitle(){this.els.title.classList.remove('active');this.els.completion.classList.remove('active')}
    showGameHud(show=true){this.els.hud.classList.toggle('hidden',!show);this.els.progress.classList.toggle('hidden',!show)}

    setHudScene(scene){const c=N.CHAPTERS[scene.chapter];this.els.chapterName.textContent=`第${c.number}章　${c.title}`;this.els.sceneName.textContent=scene.title;this.els.stepName.textContent='';this.showGameHud(true)}
    setCurrentStep(step){this.els.stepName.textContent=`${String(step.n).padStart(2,'0')} / 48　${step.title}`;this.highlightStep(step.n)}

    showInstruction(scene){
      const map={circle:'↻',tap:'☝︎',drag:'↔︎',up:'↑',horizontal:'↔︎',down:'↓',split:'↔︎',brush:'〰',tilt:'⌁'};this.els.gesture.textContent=map[scene.gesture]||'☝︎';this.els.instructionMain.textContent=scene.instruction;this.els.instructionSub.textContent=scene.sub;this.els.instruction.classList.remove('hidden');this.setHoldProgress(0)
    }
    setHoldProgress(p){this.els.holdMeter.style.width=`${U.clamp(p,0,1)*100}%`}

    showAutoStep(step){this.els.instruction.classList.add('hidden');this.els.autoNum.textContent=String(step.n).padStart(2,'0');this.els.autoTitle.textContent=step.title;this.els.autoDetail.textContent=step.detail;this.els.autoStep.classList.remove('hidden');this.els.autoStep.style.opacity='1'}
    hideAutoStep(){this.els.autoStep.classList.add('hidden')}
    setAutoProgress(p){this.els.autoStep.style.setProperty('--auto-progress',`${p*100}%`);this.els.autoStep.style.borderColor=`rgba(238,154,86,${.12+p*.36})`}

    showChapter(chapter){
      this.els.instruction.classList.add('hidden');this.els.autoStep.classList.add('hidden');this.els.chapterNumber.textContent=`第${chapter.number}章`;this.els.chapterTitle.textContent=chapter.title;this.els.chapterPhrase.textContent=chapter.phrase;this.els.chapterCard.classList.remove('hidden');requestAnimationFrame(()=>this.els.chapterCard.classList.add('show'));this.core.audio.tone(92,.7,'sine',.045,1.32);return new Promise(resolve=>setTimeout(()=>{this.els.chapterCard.classList.remove('show');setTimeout(()=>{this.els.chapterCard.classList.add('hidden');resolve()},570)},1500*(86/this.core.settings.speed)))}

    showReward(text,detail){
      this.els.instruction.classList.add('hidden');this.els.rewardText.textContent=text;this.els.rewardDetail.textContent=detail||'';this.els.reward.classList.remove('hidden');requestAnimationFrame(()=>this.els.reward.classList.add('show'));const level=this.core.settings.reward/100;this.els.flash.style.opacity=(level*.52).toFixed(2);return new Promise(resolve=>setTimeout(()=>{this.els.reward.classList.remove('show');this.els.flash.style.opacity='0';setTimeout(()=>{this.els.reward.classList.add('hidden');resolve()},360)},850+level*480))
    }

    updateProgress(p){this.els.progressFill.style.width=`${U.clamp(p,0,1)*100}%`}
    makeChapterTicks(){this.els.ticks.innerHTML='';[19/48,35/48,40/48].forEach(p=>{const i=document.createElement('i');i.style.left=`${p*100}%`;this.els.ticks.appendChild(i)})}

    buildProcess(){
      this.els.processList.innerHTML='';N.CHAPTERS.forEach((chapter,ci)=>{const box=document.createElement('section');box.className='process-chapter';const h=document.createElement('h3');h.textContent=`第${chapter.number}章　${chapter.title}`;box.appendChild(h);N.STEPS.filter(s=>s.chapter===ci).forEach(step=>{const row=document.createElement('button');row.type='button';row.className=`process-item ${step.mode}`;row.dataset.step=step.n;row.innerHTML=`<span class="step-no">${String(step.n).padStart(2,'0')}</span><span><strong>${step.title}</strong><small>${step.detail}</small></span><b aria-hidden="true"></b>`;row.onclick=()=>{if(!step.scene)return;const sceneIndex=N.SCENES.findIndex(s=>s.id===step.scene);const allowed=this.store.save.completedScenes.includes(step.scene)||sceneIndex===this.game.sceneIndex||this.store.save.finished;if(allowed){this.closePanels();this.game.startScene(sceneIndex,true)}else this.toast('この工程は、まだ先です')};box.appendChild(row)});this.els.processList.appendChild(box)});this.refreshProcess()
    }
    refreshProcess(){const done=new Set(this.store.save.completedSteps);U.$$('.process-item').forEach(row=>row.classList.toggle('done',done.has(+row.dataset.step)))}
    markStepDone(n){const row=U.$(`.process-item[data-step="${n}"]`);if(row)row.classList.add('done');this.refreshProcess()}
    highlightStep(n){U.$$('.process-item').forEach(r=>r.classList.toggle('current',+r.dataset.step===n));const row=U.$(`.process-item[data-step="${n}"]`);if(row&&this.els.process.classList.contains('open'))row.scrollIntoView({block:'center',behavior:'smooth'})}

    buildSettings(){
      this.els.settingControls.innerHTML='';N.SETTING_GROUPS.forEach(group=>{const sec=document.createElement('section');sec.className='setting-section';const h=document.createElement('h3');h.textContent=group.title;sec.appendChild(h);group.items.forEach(item=>{const wrap=document.createElement('div');wrap.className=`setting-control${item.type==='toggle'?' toggle':''}`;const label=document.createElement('label');label.htmlFor=`setting-${item.key}`;label.textContent=item.label;wrap.appendChild(label);if(item.type==='toggle'){const input=document.createElement('input');input.id=`setting-${item.key}`;input.type='checkbox';input.checked=!!this.store.settings[item.key];input.addEventListener('change',()=>this.changeSetting(item,input.checked));wrap.appendChild(input)}else{const output=document.createElement('output');output.id=`output-${item.key}`;label.appendChild(output);const input=document.createElement('input');input.id=`setting-${item.key}`;input.type='range';input.min=item.min;input.max=item.max;input.step=item.step||1;input.value=this.store.settings[item.key];input.addEventListener('input',()=>this.changeSetting(item,+input.value));wrap.appendChild(input);this.updateOutput(item,input.value)}sec.appendChild(wrap)});this.els.settingControls.appendChild(sec)})
    }
    updateOutput(item,value){const out=U.$(`#output-${item.key}`);if(!out)return;out.value=item.format?item.format(+value):`${value}${item.unit||''}`}
    changeSetting(item,value){this.store.settings[item.key]=value;this.store.persistSettings();this.updateOutput(item,value);this.core.applySettings();this.applyUiStrength();if(item.key==='sound')this.core.audio.setVolume(value)}
    applyUiStrength(){const u=this.store.settings.ui/100;this.els.hud.style.opacity=.4+u*.6;this.els.instruction.style.opacity=.22+u*.78;this.els.progress.style.opacity=.35+u*.65}
    applyPreset(name){const preset=N.PRESETS[name];if(!preset)return;Object.assign(this.store.settings,preset);this.store.persistSettings();N.SETTING_GROUPS.forEach(g=>g.items.forEach(item=>{const el=U.$(`#setting-${item.key}`);if(!el)return;if(item.type==='toggle')el.checked=!!this.store.settings[item.key];else{el.value=this.store.settings[item.key];this.updateOutput(item,el.value)}}));this.core.applySettings();this.applyUiStrength();this.toast(name==='real'?'写実優先':'調整しました')}
    resetSettings(){const defaults={};N.SETTING_GROUPS.forEach(g=>g.items.forEach(i=>defaults[i.key]=i.value));Object.assign(this.store.settings,defaults);this.store.persistSettings();this.buildSettings();this.core.applySettings();this.applyUiStrength();this.toast('初期値へ戻しました')}
    async copySettings(){const text=JSON.stringify(this.store.settings,null,2);try{await navigator.clipboard.writeText(text);this.toast('調整値をコピーしました')}catch(_){this.toast(text.slice(0,52)+'…')}}

    openPanel(panel){if(this.panelMode)return;this.panelMode=this.game.mode;this.game.mode='panel';panel.classList.add('open');this.refreshProcess()}
    closePanels(){this.els.settings.classList.remove('open');this.els.process.classList.remove('open');if(this.panelMode){this.game.mode=this.panelMode;this.panelMode=null}}

    showCompletion(save){
      this.els.hud.classList.add('hidden');this.els.progress.classList.add('hidden');this.els.instruction.classList.add('hidden');this.els.autoStep.classList.add('hidden');const vals=Object.values(save.bestPrecision||{});const precision=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*100):100;this.els.completionStats.textContent=`全48工程　静かな手つき ${precision}%　工房にいた時間 ${U.formatTime(save.playSeconds||0)}`;this.els.completion.classList.add('active')
    }
    hideCompletion(){this.els.completion.classList.remove('active')}

    showContinue(callback){this.els.pause.classList.remove('hidden');this.els.resume.onclick=()=>{this.els.pause.classList.add('hidden');callback()}}
    showGameHudForFree(){this.showGameHud(false)}
    toast(text){clearTimeout(this.toastTimer);this.els.toast.textContent=text;this.els.toast.style.opacity='1';this.toastTimer=setTimeout(()=>this.els.toast.style.opacity='0',900)}
  }

  N.UI=UI;
})();
