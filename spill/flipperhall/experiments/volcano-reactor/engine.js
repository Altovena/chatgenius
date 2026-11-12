/* Volcano Reactor v1.1 — isolated prototype physics, not wired into Flipperhall 1.0. */
(function(root,factory){
  const engine=factory();
  if(typeof module==='object'&&module.exports)module.exports=engine;
  else root.VolcanoReactor=engine;
})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const W=460,H=800,R=7;
const BUMPERS=[{x:125,y:215,r:24},{x:184,y:320,r:25},{x:342,y:225,r:23}];
const VALVES=[{x:316,y:392,r:18},{x:369,y:487,r:18}];
const CORE={x:235,y:178,r:23};
const GATE={ax:194,ay:278,bx:289,by:278};
const RAILS=[
  [35,55,35,664],[425,55,425,658],[35,665,111,713],[425,661,348,713],
  // Wide, asymmetric left orbit, with a sloping return into the center.
  [77,475,73,323],[73,323,99,250],[99,250,96,152],[96,152,139,114],
  [139,114,181,135],[181,135,211,216],
  // Right-side valve chute directs a ball into the gate approach.
  [401,295,380,349],[380,349,405,426],[405,426,393,563],
  [393,563,351,604],[81,585,126,629]
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function newGame(){
  return {mode:'volcano',width:W,height:H,ball:{x:412,y:692,vx:0,vy:0,r:R},
    playing:true,paused:false,ended:false,ballNo:1,launched:false,shooter:false,
    left:false,right:false,leftAngle:0,rightAngle:0,leftStrikeAt:-99,rightStrikeAt:-99,
    leftSpeed:0,rightSpeed:0,tick:0,score:0,best:0,combo:0,gateOpen:false,
    gateTicks:0,valves:[false,false],missionComplete:false,coreHits:0,
    lastEvent:'READY',lastValveTouch:[-100,-100],lastCoreTouch:-100,
    slowFrames:0,trapFrames:0,trapMinX:Infinity,trapMaxX:-Infinity,
    trapMinY:Infinity,trapMaxY:-Infinity,bumperTouch:[-100,-100,-100]};
}
function event(g,message,points=0){g.lastEvent=message;g.score+=points;g.best=Math.max(g.best,g.score)}
function launch(g){
  if(!g.playing||g.paused||g.ended||g.launched)return false;
  g.launched=true;g.shooter=true;g.ball.x=412;g.ball.y=692;g.ball.vx=0;g.ball.vy=-17;
  g.lastEvent='BALL IN PLAY';return true;
}
function setFlippers(g,left,right){g.left=!!left&&g.playing&&!g.paused;g.right=!!right&&g.playing&&!g.paused}
function pause(g){if(!g.playing||g.ended)return;g.paused=true;setFlippers(g,false,false)}
function resume(g){if(!g.playing||g.ended)return;g.paused=false}
function nudge(g){if(!g.launched||g.paused)return;g.ball.vx+=(g.ball.x<230?1:-1)*1.1;g.ball.vy-=.65}
function segment(g,x1,y1,x2,y2,restitution=.72){
  const b=g.ball,dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy;
  const t=clamp(((b.x-x1)*dx+(b.y-y1)*dy)/len2,0,1);
  const cx=x1+t*dx,cy=y1+t*dy,vx=b.x-cx,vy=b.y-cy,dist=Math.hypot(vx,vy);
  if(dist>=R+4||dist<.001)return false;
  const nx=vx/dist,ny=vy/dist,normal=b.vx*nx+b.vy*ny;
  b.x=cx+nx*(R+4.2);b.y=cy+ny*(R+4.2);
  if(normal<0){b.vx-=(1+restitution)*normal*nx;b.vy-=(1+restitution)*normal*ny}
  return true;
}
function circle(g,c,restitution=1.05){
  const b=g.ball,dx=b.x-c.x,dy=b.y-c.y,dist=Math.hypot(dx,dy),min=R+c.r;
  if(dist>=min||dist<.001)return false;
  const nx=dx/dist,ny=dy/dist,normal=b.vx*nx+b.vy*ny;
  b.x=c.x+nx*(min+.4);b.y=c.y+ny*(min+.4);
  if(normal<0){b.vx-=(1+restitution)*normal*nx;b.vy-=(1+restitution)*normal*ny}
  b.vx+=nx*.65;b.vy+=ny*.65;
  return true;
}
function flipper(g,side){
  const left=side==='left',angle=left?g.leftAngle:g.rightAngle;
  const p={x:left?119:341,y:690},length=86,a=left?.07-angle*.83:Math.PI-.07+angle*.83;
  return {x1:p.x,y1:p.y,x2:p.x+Math.cos(a)*length,y2:p.y+Math.sin(a)*length};
}
function rotateFlippers(g){
  for(const [side,active] of [['left',g.left],['right',g.right]]){
    const k=side+'Angle',sk=side+'Speed',old=g[k];
    g[k]+=clamp(((active?1:0)-old)*.46,-.27,.27);
    g[sk]=g[k]-old;
  }
}
function checkFlipper(g,side){
  const f=flipper(g,side),b=g.ball,dx=f.x2-f.x1,dy=f.y2-f.y1;
  const t=clamp(((b.x-f.x1)*dx+(b.y-f.y1)*dy)/(dx*dx+dy*dy),0,1);
  const px=f.x1+t*dx,py=f.y1+t*dy,dist=Math.hypot(b.x-px,b.y-py);
  if(dist>=R+10||b.y>718)return;
  const nx=(b.x-px)/Math.max(dist,.001),ny=(b.y-py)/Math.max(dist,.001);
  b.x=px+nx*(R+10.5);b.y=py+ny*(R+10.5);
  const impact=b.vx*nx+b.vy*ny;
  if(impact<0){b.vx-=1.6*impact*nx;b.vy-=1.6*impact*ny}
  if(g[side+'Speed']>.045&&g.tick-g[side+'StrikeAt']>9){
    b.vy=Math.min(b.vy,-(6.5+t*6));b.vx+=(side==='left'?1:-1)*(1.5+t*3);
    g[side+'StrikeAt']=g.tick;
  }
}
function triggerValve(g,index){
  if(!g.launched||g.valves[index])return false;
  g.valves[index]=true;event(g,index===0?'PRESSURE VALVE A':'PRESSURE VALVE B',350);
  if(g.valves.every(Boolean)&&!g.gateOpen){
    g.gateOpen=true;g.gateTicks=450;event(g,'REACTOR GATE OPEN',900);
  }
  return true;
}
function hitCore(g){
  if(!g.launched||!g.gateOpen||g.gateTicks===0)return false;
  g.coreHits++;g.missionComplete=true;event(g,'VOLCANO REACTOR ACTIVATED!',5000);
  g.gateOpen=false;g.gateTicks=0;g.valves=[false,false];
  return true;
}
function loseBall(g){
  g.launched=false;g.shooter=false;g.left=false;g.right=false;
  g.ball={x:412,y:692,vx:0,vy:0,r:R};
  g.gateOpen=false;g.gateTicks=0;g.valves=[false,false];
  g.slowFrames=0;g.trapFrames=0;g.trapMinX=Infinity;g.trapMaxX=-Infinity;g.trapMinY=Infinity;g.trapMaxY=-Infinity;
  if(g.ballNo>=3){g.ended=true;g.playing=false;event(g,'GAME OVER')}
  else{g.ballNo++;event(g,'BALL '+g.ballNo+' — PRESS LAUNCH')}
}
function step(g){
  if(!g.playing||g.paused)return g;
  rotateFlippers(g);
  if(!g.launched)return g;
  for(let sub=0;sub<2;sub++){
    if(!g.playing||!g.launched)break;
    g.tick++;
    if(g.shooter){
      g.ball.x=412;g.ball.y-=8.5;
      if(g.ball.y<=116){g.shooter=false;g.ball.x=371;g.ball.y=105;g.ball.vx=-5.1;g.ball.vy=-5.5}
      continue;
    }
    const b=g.ball;
    if(g.gateTicks>0){g.gateTicks--;if(g.gateTicks===0){g.gateOpen=false;g.valves=[false,false];event(g,'REACTOR PRESSURE RESET')}}
    b.vy+=.10;b.vx*=.9989;b.vy*=.9989;
    b.x+=b.vx*.5;b.y+=b.vy*.5;
    if(b.x<39){b.x=39;b.vx=Math.abs(b.vx)*.8}
    if(b.x>421){b.x=421;b.vx=-Math.abs(b.vx)*.8}
    if(b.y<40){b.y=40;b.vy=Math.abs(b.vy)*.8}
    for(const [x1,y1,x2,y2] of RAILS)segment(g,x1,y1,x2,y2);
    // Dynamic reactor gate: this exact segment disappears from collisions while open.
    if(!g.gateOpen)segment(g,GATE.ax,GATE.ay,GATE.bx,GATE.by,.66);
    BUMPERS.forEach((c,i)=>{if(circle(g,c,1.2)&&g.tick-g.bumperTouch[i]>18){
      g.bumperTouch[i]=g.tick;event(g,'BUMPER',125)}});
    VALVES.forEach((c,i)=>{if(circle(g,c,.8)&&g.tick-g.lastValveTouch[i]>32){
      g.lastValveTouch[i]=g.tick;triggerValve(g,i)}});
    if(circle(g,CORE,.9)&&g.tick-g.lastCoreTouch>25){
      g.lastCoreTouch=g.tick;
      if(g.gateOpen)hitCore(g);
      else event(g,'CORE LOCKED',0);
    }
    checkFlipper(g,'left');checkFlipper(g,'right');
    // Free true stalls without teleporting or granting points.
    if(Math.hypot(b.vx,b.vy)<.4)g.slowFrames++;else g.slowFrames=0;
    if(g.slowFrames>220){b.vx=b.x<230?3.5:-3.5;b.vy=b.y<425?5.5:-3;g.slowFrames=0}
    g.trapMinX=Math.min(g.trapMinX,b.x);g.trapMaxX=Math.max(g.trapMaxX,b.x);
    g.trapMinY=Math.min(g.trapMinY,b.y);g.trapMaxY=Math.max(g.trapMaxY,b.y);
    if(++g.trapFrames>=360){
      if(g.trapMaxX-g.trapMinX<22&&g.trapMaxY-g.trapMinY<22&&b.y<630){
        b.vx=b.x<230?4:-4;b.vy=b.y<420?7:-4;
      }
      g.trapFrames=0;g.trapMinX=Infinity;g.trapMaxX=-Infinity;g.trapMinY=Infinity;g.trapMaxY=-Infinity;
    }
    b.vx=clamp(b.vx,-17,17);b.vy=clamp(b.vy,-20,20);
    if(b.y>805)loseBall(g);
  }
  return g;
}
return {newGame,step,launch,pause,resume,setFlippers,nudge,triggerValve,hitCore,
  flipper,RAILS,BUMPERS,VALVES,CORE,GATE,WIDTH:W,HEIGHT:H};
});
