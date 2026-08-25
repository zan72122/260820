(function(){
  'use strict';
  const N=window.Nambu=window.Nambu||{};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;

  class CircularGestureTracker{
    constructor(options={}){
      this.assist=clamp(Number(options.assist)||0,0,1);
      this.reset();
    }
    reset(){
      this.active=false;this.progress=0;this.totalWork=0;this.totalLength=0;this.totalTurn=0;this.absTurn=0;this.spin=0;this.loopBonus=false;this.last=null;this.startPoint=null;this.prevVector=null;this.bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};return this;
    }
    begin(x,y,width=1024,height=768){
      this.active=true;this.last={x,y};this.startPoint={x,y};this.prevVector=null;this.strokeLength=0;this.strokeTurn=0;this.strokeAbsTurn=0;this.bounds={minX:x,maxX:x,minY:y,maxY:y};this.viewport={width,height};return this.snapshot();
    }
    move(x,y,width=this.viewport?.width||1024,height=this.viewport?.height||768){
      if(!this.active||!this.last)this.begin(x,y,width,height);
      const dx=x-this.last.x,dy=y-this.last.y,distance=Math.hypot(dx,dy);
      if(distance<1.35)return {...this.snapshot(),delta:0,distance:0};
      this.bounds.minX=Math.min(this.bounds.minX,x);this.bounds.maxX=Math.max(this.bounds.maxX,x);this.bounds.minY=Math.min(this.bounds.minY,y);this.bounds.maxY=Math.max(this.bounds.maxY,y);
      let turn=0;
      if(this.prevVector){
        const dot=this.prevVector.x*dx+this.prevVector.y*dy;
        const cross=this.prevVector.x*dy-this.prevVector.y*dx;
        turn=Math.atan2(cross,dot);
        if(Math.abs(turn)>1.35)turn=Math.sign(turn)*1.35;
        const weighted=Math.sign(turn)*Math.min(Math.abs(turn),.52)*Math.min(1,distance/5);
        this.totalTurn+=weighted;this.strokeTurn+=weighted;this.absTurn+=Math.abs(weighted);this.strokeAbsTurn+=Math.abs(weighted);this.spin+=weighted;
      }
      this.prevVector={x:dx,y:dy};this.last={x,y};this.totalLength+=distance;this.strokeLength+=distance;

      const minDim=Math.max(320,Math.min(width,height));
      const spanX=this.bounds.maxX-this.bounds.minX,spanY=this.bounds.maxY-this.bounds.minY;
      const spanScore=clamp(Math.min(spanX,spanY)/(minDim*.18),0,1);
      const curveScore=clamp(this.strokeAbsTurn/(Math.PI*1.65),0,1);
      const directionScore=clamp(Math.abs(this.strokeTurn)/(this.strokeAbsTurn+.001),0,1);
      const maxSpan=Math.max(36,spanX,spanY);
      const closure=1-clamp(Math.hypot(x-this.startPoint.x,y-this.startPoint.y)/(maxSpan*.78),0,1);
      const shapeScore=clamp(.16+spanScore*.30+curveScore*.31+directionScore*.15+closure*.08,0,1);
      const forgiving=lerp(shapeScore,1,this.assist*.42);
      const required=minDim*(.94-this.assist*.24);
      const delta=distance/required*(.52+.48*forgiving);
      this.totalWork+=delta;

      const loopReady=Math.abs(this.strokeTurn)>Math.PI*1.52&&spanScore>.58&&closure>.34&&directionScore>.52;
      if(loopReady&&!this.loopBonus){this.totalWork+=.15+this.assist*.07;this.loopBonus=true}
      this.progress=clamp(this.totalWork,0,1);
      return {...this.snapshot(),delta,distance,turn,shapeScore,spanScore,curveScore,directionScore,closure};
    }
    end(){this.active=false;this.last=null;this.startPoint=null;this.prevVector=null;this.strokeLength=0;this.strokeTurn=0;this.strokeAbsTurn=0;this.loopBonus=false;return this.snapshot()}
    snapshot(){return{progress:this.progress,totalWork:this.totalWork,totalLength:this.totalLength,totalTurn:this.totalTurn,absTurn:this.absTurn,spin:this.spin,active:this.active}}
  }

  const PROFILE=[[0,.69],[.08,.82],[.18,1.08],[.35,1.40],[.52,1.51],[.67,1.46],[.80,1.26],[.91,.94],[1,.68]];
  function profileRadius(t){
    t=clamp(t,0,1);for(let i=1;i<PROFILE.length;i++)if(t<=PROFILE[i][0]){const a=PROFILE[i-1],b=PROFILE[i],p=(t-a[0])/(b[0]-a[0]);return lerp(a[1],b[1],p)}return PROFILE[PROFILE.length-1][1];
  }
  function roughRadius(t,seed=0){return 1.56+Math.sin((t*17.3+seed*.71))*0.065+Math.sin((t*39.1+seed*.37))*0.028}
  function bandFormation(progress,t){const p=clamp(progress,0,1);return clamp((p*1.38)-((1-t)*.38),0,1)**2*(3-2*clamp((p*1.38)-((1-t)*.38),0,1))}
  function bandRadius(progress,fine,t,seed=0){const formed=bandFormation(progress,t),target=profileRadius(t),rough=roughRadius(t,seed);const micro=(Math.sin(seed*8.13+t*31.7)*.022)*(1-clamp(fine,0,1));return lerp(rough,target*(1+micro),formed)}
  N.CircularGestureTracker=CircularGestureTracker;
  N.FormingMath={profileRadius,roughRadius,bandFormation,bandRadius};
})();
