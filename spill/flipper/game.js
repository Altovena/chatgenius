(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
const W=420,H=720,DPR=2;canvas.width=W*DPR;canvas.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);
const bg=new Image(),dragon=new Image();bg.src='/spill/flipper/art/castle-playfield.webp';dragon.src='/spill/flipper/art/dragon-target.webp';
let resumeGraceUntil=0,lastContinueTap=0;
let state='menu',balls=[],stock=3,score=0,best=0,level=1,last=0,frame=0,charge=0,muted=false,audio,tiltHeat=0,tilted=false,tiltDecay=0,dragonHits=0,combo=0,mode='READY',modeTime=0,flash=0,particles=[],ringLights=[false,false,false,false,false];
const key={left:false,right:false,launch:false};
const flipKickUntil={left:0,right:0};
let multiplier=1,targetHits=0,lockHits=0,extraAwarded=false;
try{best=Number(localStorage.getItem('chatgenius-castle-pinball-best')||0)}catch{}
const bumper=[{x:125,y:236,r:23,c:'#ff7cc6'},{x:276,y:251,r:25,c:'#77ebff'},{x:208,y:318,r:25,c:'#ffdc7b'}];
const scoreTargets=[{x:88,y:345,r:12,c:'#ffe08c',cd:0},{x:158,y:367,r:12,c:'#8cf5e5',cd:0},{x:266,y:365,r:12,c:'#ff92c9',cd:0},{x:324,y:350,r:12,c:'#a3b7ff',cd:0},{x:211,y:510,r:12,c:'#ffe08c',cd:0}];
const lockTarget={x:210,y:474,r:17};
const posts=[{x:91,y:529,r:9},{x:312,y:537,r:9},{x:198,y:453,r:8},{x:65,y:376,r:8},{x:324,y:406,r:8}];
const segments=[[[28,90],[28,541]],[[28,541],[125,638]],[[340,266],[340,534]],[[340,534],[283,638]],[[28,91],[100,57]],[[320,57],[393,96]],[[30,535],[119,619]],[[337,532],[292,614]]];
const ramps=[{x:89,y:424,r:31,name:'DRAGE-RAMPEN',to:[264,194],color:'#7ee6ff',n:0},{x:296,y:416,r:32,name:'KONGE-RAMPEN',to:[96,187],color:'#ffcc84',n:0}];
const orbits=[{x:57,y:298,r:22,name:'VENSTRE ORBIT',to:[297,138]},{x:315,y:307,r:22,name:'HØYRE ORBIT',to:[117,158]}];
// A genuine drain gap between the lower flippers; tips never overlap.
const flippers=[{x:142,y:619,l:50,left:true,upper:false},{x:278,y:619,l:50,left:false,upper:false},{x:118,y:406,l:49,left:true,upper:true},{x:289,y:382,l:47,left:false,upper:true}];
const bonusLoop={x:268,y:169,r:57,entry:{x:318,y:205,r:30},name:'TÅRNSLØYFEN'};
function tone(freq=500,duration=.09,type='square',vol=.027,delay=0){if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();let o=audio.createOscillator(),g=audio.createGain(),at=audio.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,at);o.frequency.exponentialRampToValueAtTime(Math.max(35,freq*.55),at+duration);g.gain.setValueAtTime(vol,at);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g).connect(audio.destination);o.start(at);o.stop(at+duration)}catch{}}
function fanfare(){tone(520,.12,'triangle',.045);tone(780,.13,'triangle',.045,.13);tone(1040,.2,'triangle',.045,.27)}
function hud(){$('score').textContent=String(score).padStart(7,'0');$('best').textContent=String(best).padStart(7,'0');$('balls').textContent=String(stock);$('tilt').textContent=tilted?'TILT!':tiltHeat>=1.7?'ADVARSEL':modeTime>0?mode:'KLAR';$('tilt').style.color=tilted?'#ff748a':modeTime>0?'#ffd47c':'#8df8d8'}
function setMode(name,duration=2){mode=name;modeTime=duration;hud()}
function scoreHit(n,x,y,label){if(tilted)return;score+=n*multiplier;combo++;if(score>best){best=score;try{localStorage.setItem('chatgenius-castle-pinball-best',String(best))}catch{}}for(let i=0;i<13;i++){let a=Math.random()*Math.PI*2,s=50+Math.random()*130;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:.65,c:i%3?'#ffcc81':'#8ef5ed'})}if(label)setMode(label,1.9);hud()}
function modal(k,t,m,b){$('kicker').textContent=k;$('heading').innerHTML=t;$('message').textContent=m;$('start').textContent=b;$('overlay').classList.remove('hidden')}
const makeBall=(x,y,vx=0,vy=0,inLane=false)=>({x,y,vx,vy,r:8,inLane,route:null,routeCd:0,hitCd:0,life:0,locked:0,lockCd:0});
function readyBall(){balls=[makeBall(369,644,0,0,true)];charge=0;tilted=false;tiltHeat=0;tiltDecay=0;hud()}
function start(){multiplier=1;targetHits=0;lockHits=0;extraAwarded=false;scoreTargets.forEach(t=>t.cd=0);score=0;stock=3;level=1;dragonHits=0;combo=0;ringLights=[false,false,false,false,false];particles=[];mode='READY';modeTime=0;readyBall();state='playing';$('overlay').classList.add('hidden');$('pause').disabled=false;hud();tone(650,.15)}
function gameOver(){state='over';$('pause').disabled=true;modal('GAME OVER','CASTLE<br>CHAOS',`Du fikk ${score.toLocaleString('no-NO')} poeng og nådde nivå ${level}. Spill igjen!`,'SPILL IGJEN ▶');tone(165,.43,'sawtooth')}
function pause(){if(state==='playing'){state='paused';key.left=key.right=key.launch=false;modal('PAUSE','PAUSE','Slottets magi venter.','FORTSETT ▶');$('pause').textContent='▶ FORTSETT'}else if(state==='paused'){state='playing';resumeGraceUntil=Date.now()+1600;key.left=key.right=key.launch=false;$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ PAUSE';last=performance.now()}}
function launch(){if(state!=='playing')return;let b=balls.find(b=>b.inLane&&b.vy===0);if(!b)return;b.vx=0;b.vy=-850-charge*6;charge=0;tone(160,.23,'sawtooth',.05);setMode('BALL I SPILL',1.1)}
function nudge(){if(state!=='playing'||!balls.some(b=>!b.inLane))return;tiltHeat+=1;tiltDecay=2.2;for(const b of balls)if(!b.inLane){b.vx+=(Math.random()-.5)*180;b.vy-=115}tone(115,.09,'triangle');if(tiltHeat>=3){tilted=true;setMode('TILT!',3);tone(90,.45,'sawtooth',.055)}hud()}
function collideCircle(b,o,boost=1){const dx=b.x-o.x,dy=b.y-o.y,d=Math.hypot(dx,dy),min=b.r+o.r;if(d>=min||d<.001)return false;let nx=dx/d,ny=dy/d,approach=b.vx*nx+b.vy*ny;b.x=o.x+nx*(min+.5);b.y=o.y+ny*(min+.5);if(approach<0){b.vx-=1.75*approach*nx;b.vy-=1.75*approach*ny;b.vx+=nx*boost;b.vy+=ny*boost;return true}return false}
function rail(b,a,z){const dx=z[0]-a[0],dy=z[1]-a[1],q=Math.max(0,Math.min(1,((b.x-a[0])*dx+(b.y-a[1])*dy)/(dx*dx+dy*dy))),px=a[0]+q*dx,py=a[1]+q*dy,nx=b.x-px,ny=b.y-py,d=Math.hypot(nx,ny);if(d>=b.r+3||d<.001)return;let ux=nx/d,uy=ny/d,dot=b.vx*ux+b.vy*uy;b.x=px+ux*(b.r+3.5);b.y=py+uy*(b.r+3.5);if(dot<0){b.vx-=1.7*dot*ux;b.vy-=1.7*dot*uy;if(b.hitCd<=0){tone(210,.035,'triangle',.008);b.hitCd=.07}}}
function flipperPoints(f){const active=f.left?key.left:key.right,angle=f.left?(active&&!tilted?-.57:.28):(active&&!tilted?Math.PI+.57:Math.PI-.28);return [f.x+Math.cos(angle)*f.l,f.y+Math.sin(angle)*f.l]}
function flipperCollision(b,f){const p=flipperPoints(f),dx=p[0]-f.x,dy=p[1]-f.y,q=Math.max(0,Math.min(1,((b.x-f.x)*dx+(b.y-f.y)*dy)/(dx*dx+dy*dy))),px=f.x+q*dx,py=f.y+q*dy,d=Math.hypot(b.x-px,b.y-py);if(d>=b.r+8)return;
const nx=d>.001?(b.x-px)/d:0,ny=d>.001?(b.y-py)/d:-1;
b.x=px+nx*(b.r+8.5);b.y=py+ny*(b.r+8.5);
const side=f.left?'left':'right',fresh=key[side]&&!tilted&&frame<flipKickUntil[side];
// Only an actively swinging bat transfers a strong impulse. A held bat reflects normally.
if(fresh&&b.y<=py+7&&b.vy>-70){const power=(f.upper?400:490)+(1-q)*150;b.vy=-Math.min(900,Math.max(power,Math.max(0,b.vy)*.65+270));b.vx+=(f.left?1:-1)*(f.upper?85:125);flipKickUntil[side]=frame-.001;if(b.hitCd<=0){tone(f.upper?410:320,.075,'square',.04);scoreHit(f.upper?75:25,b.x,b.y);b.hitCd=.12}}
else {const dot=b.vx*nx+b.vy*ny;if(dot<0){b.vx-=1.65*dot*nx;b.vy-=1.65*dot*ny;}if(b.vy>0&&b.y<py){b.vy=-Math.max(100,Math.abs(b.vy)*.62)}}}
function routeBall(b,points,duration,exit,name,pointsAward){b.route={time:0,duration,points,exit,name};b.routeCd=2.2;scoreHit(pointsAward,b.x,b.y,name);tone(760,.12,'sine',.045);tone(1100,.17,'triangle',.04,.13);flash=.2}
function enterRoute(b,entry,isOrbit=false){const left=entry.x<200,edge=left?54:328;routeBall(b,[[b.x,b.y],[edge,entry.y-80],[edge,210],[left?103:292,105],entry.to],isOrbit?1.15:1.35,[(entry.to[0]>210?-160:160),170],entry.name,isOrbit?500:850)}
function enterBonusLoop(b){const p=[[b.x,b.y],[325,202]];for(let i=0;i<=18;i++){const a=.65-i*Math.PI*2/12;p.push([bonusLoop.x+bonusLoop.r*Math.cos(a),bonusLoop.y+bonusLoop.r*Math.sin(a)])}p.push([236,282],[211,329]);routeBall(b,p,2.35,[-150,210],bonusLoop.name,1800);fanfare()}
function routePosition(points,t){const u=t*(points.length-1),i=Math.min(points.length-2,Math.floor(u)),f=u-i;const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];const smooth=(v0,v1,v2,v3)=>.5*((2*v1)+(-v0+v2)*f+(2*v0-5*v1+4*v2-v3)*f*f+(-v0+3*v1-3*v2+v3)*f*f*f);return [smooth(a[0],b[0],c[0],d[0]),smooth(a[1],b[1],c[1],d[1])]}
function dragonStrike(b){dragonHits++;scoreHit(1500,b.x,b.y,dragonHits%3===0?'DRAGE-MULTIBALL!':'DRAGEN TREFFET!');b.vy=Math.max(390,Math.abs(b.vy));b.vx=(Math.random()-.5)*390;tone(240,.2,'sawtooth',.055);tone(620,.23,'square',.04,.13);flash=.4;if(dragonHits%3===0&&!tilted){balls.push(makeBall(125,218,260,260),makeBall(290,229,-240,200));scoreHit(3000,210,178,'MULTIBALL');fanfare();level++}}
function updateBall(b,dt){b.life+=dt;b.lockCd=Math.max(0,b.lockCd-dt);if(b.locked>0){b.locked-=dt;b.x=lockTarget.x;b.y=lockTarget.y;if(b.locked<=0){b.locked=0;b.lockCd=2.5;b.vx=(Math.random()-.5)*260;b.vy=-450;setMode('BALL LOCK SLUPPET',1.1)}return}b.routeCd=Math.max(0,b.routeCd-dt);b.hitCd=Math.max(0,b.hitCd-dt);
if(b.route){const p=b.route;p.time+=dt;const t=Math.min(1,p.time/p.duration);[b.x,b.y]=routePosition(p.points,t);if(t>=1){b.route=null;[b.vx,b.vy]=p.exit}return}
if(b.inLane){if(b.vy!==0){b.vy+=600*dt;b.y+=b.vy*dt;if(b.y<=118){b.inLane=false;routeBall(b,[[369,118],[353,101],[334,94],[318,110],[304,133]],.37,[-205,185],'SKYTERAMPE',100);b.routeCd=.8;tone(840,.13,'triangle')}else if(b.y>660){b.y=644;b.vy=0}}return}
b.vy+=790*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.vx*=1-.12*dt;
// Side outlanes: a ball trapped outside the lower pivots must drain, never rattle forever.
if(b.y>615&&(b.x<75||b.x>335)){b.vy=Math.max(260,b.vy);b.y+=260*dt;return}
if(b.x<36){b.x=36;b.vx=Math.abs(b.vx)*.86}if(b.x>332&&b.y>248){b.x=332;b.vx=-Math.abs(b.vx)*.85}if(b.x>383){b.x=383;b.vx=-Math.abs(b.vx)*.8}if(b.y<60){b.y=60;b.vy=Math.abs(b.vy)*.85}
for(const [a,z] of segments)rail(b,a,z);
for(const o of bumper)if(collideCircle(b,o,550)&&b.hitCd<=0){scoreHit(150+combo%10*20,o.x,o.y,'BUMPER!');tone(710+Math.random()*180,.11,'sine',.055);b.hitCd=.09;flash=.09}
for(const o of posts)if(collideCircle(b,o,120)&&b.hitCd<=0){tone(340,.04,'triangle',.018);b.hitCd=.08}
for(const f of flippers)flipperCollision(b,f);
for(const t of scoreTargets){t.cd=Math.max(0,t.cd-dt);if(t.cd<=0&&collideCircle(b,t,220)){t.cd=.36;targetHits++;scoreHit(250,t.x,t.y,'TREFFMÅL!');tone(840,.08,'triangle',.045);const next=targetHits>=9?10:targetHits>=6?5:targetHits>=3?2:1;if(next!==multiplier){multiplier=next;setMode('POENG '+multiplier+'X',2.4);fanfare()}if(targetHits>=12&&!extraAwarded){extraAwarded=true;stock++;setMode('EKSTRA BALL!',3);fanfare();hud()}}}
if(!b.locked&&b.lockCd<=0&&b.y>435&&Math.hypot(b.x-lockTarget.x,b.y-lockTarget.y)<lockTarget.r+b.r&&b.vy>20){b.locked=1.25;lockHits++;scoreHit(700,b.x,b.y,'BALL LOCK '+Math.min(lockHits,2)+'/2');b.vx=0;b.vy=0;tone(440,.28,'sine',.045);if(lockHits===2){lockHits=0;setMode('LOCK MULTIBALL!',2.8);balls.push(makeBall(145,470,200,-350));fanfare()}return}
if(b.routeCd<=0&&Math.hypot(b.x-bonusLoop.entry.x,b.y-bonusLoop.entry.y)<bonusLoop.entry.r&&b.vy<180){enterBonusLoop(b);return}
if(b.routeCd<=0&&b.vy<100){for(const r of ramps)if(Math.hypot(b.x-r.x,b.y-r.y)<r.r){enterRoute(b,r);return}for(const r of orbits)if(Math.hypot(b.x-r.x,b.y-r.y)<r.r){enterRoute(b,r,true);return}}
if(b.routeCd<=0&&Math.hypot(b.x-208,b.y-157)<33){dragonStrike(b);b.routeCd=1.2}
for(let i=0;i<ringLights.length;i++){let x=108+i*50;if(b.y<145&&Math.abs(b.x-x)<12&&!ringLights[i]){ringLights[i]=true;scoreHit(250,x,125,'RUNEBONUS');tone(1000,.07,'triangle');if(ringLights.every(Boolean)){scoreHit(2000,210,135,'KONGEBONUS');ringLights.fill(false);fanfare()}}}
const speed=Math.hypot(b.vx,b.vy);if(speed>1100){b.vx*=1100/speed;b.vy*=1100/speed}}
function update(dt){frame+=dt;flash=Math.max(0,flash-dt);modeTime=Math.max(0,modeTime-dt);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.t-=dt}particles=particles.filter(p=>p.t>0);if(state!=='playing')return;
tiltDecay=Math.max(0,tiltDecay-dt);if(!tiltDecay&&!tilted&&tiltHeat>0)tiltHeat=Math.max(0,tiltHeat-dt*.8);if(key.launch)charge=Math.min(25,charge+dt*15);
const steps=Math.max(1,Math.ceil(dt/.0035));for(let i=0;i<steps;i++){for(const b of balls)updateBall(b,dt/steps);balls=balls.filter(b=>b.inLane||b.y<H+15);if(!balls.length){stock--;if(stock>0){readyBall();setMode('NY BALL',1.5);tone(210,.15)}else gameOver();break}}
canvas.dataset.ballCount=String(balls.length);canvas.dataset.ballZone=balls[0]?.inLane?'shooter':balls[0]?.route?'route':'field';canvas.dataset.ballX=String(Math.round(balls[0]?.x||0));canvas.dataset.ballY=String(Math.round(balls[0]?.y||0));canvas.dataset.mode=mode;canvas.dataset.stock=String(stock);canvas.dataset.state=state;}
function neonText(s,x,y,size,color){ctx.font=`900 ${size}px system-ui`;ctx.textAlign='center';ctx.shadowColor=color;ctx.shadowBlur=12;ctx.fillStyle=color;ctx.fillText(s,x,y);ctx.shadowBlur=0}
function drawFlipper(f){const tip=flipperPoints(f),angle=Math.atan2(tip[1]-f.y,tip[0]-f.x),r=f.upper?7.1:9.1,len=f.l;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(angle);
// A tapered, rounded molded flipper bat with a raised rubber edge, enamel body and metal axle.
ctx.shadowColor='#020518';ctx.shadowBlur=11;ctx.shadowOffsetY=6;ctx.fillStyle='#11162b';ctx.beginPath();ctx.moveTo(1,-r-3);ctx.bezierCurveTo(len*.43,-r-3,len-7,-r*.76,len+2,-r*.35);ctx.quadraticCurveTo(len+8,0,len+2,r*.35);ctx.bezierCurveTo(len-7,r*.76,len*.43,r+3,1,r+3);ctx.arc(0,0,r+3,Math.PI/2,Math.PI*1.5);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
const edge=ctx.createLinearGradient(0,-r,0,r);edge.addColorStop(0,tilted?'#92929f':f.upper?'#b9fff9':'#fff1b3');edge.addColorStop(.24,tilted?'#5d5b70':f.upper?'#49caba':'#ffbb75');edge.addColorStop(.68,tilted?'#454456':f.upper?'#0c7b8f':'#a7465c');edge.addColorStop(1,'#301d3d');ctx.fillStyle=edge;ctx.beginPath();ctx.moveTo(1,-r);ctx.bezierCurveTo(len*.4,-r,len-5,-r*.8,len+1,-r*.32);ctx.quadraticCurveTo(len+5,0,len+1,r*.32);ctx.bezierCurveTo(len-5,r*.8,len*.4,r,1,r);ctx.arc(0,0,r,Math.PI/2,Math.PI*1.5);ctx.closePath();ctx.fill();
ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(5,-r+2.6);ctx.bezierCurveTo(len*.45,-r+3,len-7,-r*.55,len-2,-1.5);ctx.stroke();ctx.strokeStyle='rgba(45,21,49,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(5,r-2);ctx.quadraticCurveTo(len*.6,r-2,len-3,2);ctx.stroke();
let hub=ctx.createRadialGradient(-3,-3,1,0,0,r*.85);hub.addColorStop(0,'#ffffff');hub.addColorStop(.35,'#e9d4b9');hub.addColorStop(.7,'#816d92');hub.addColorStop(1,'#352442');ctx.fillStyle=hub;ctx.beginPath();ctx.arc(0,0,r*.72,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff0b9';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#443344';ctx.beginPath();ctx.arc(0,0,r*.24,0,Math.PI*2);ctx.fill();ctx.restore()}
function draw(){ctx.fillStyle='#0e0a24';ctx.fillRect(0,0,W,H);
if(bg.complete&&bg.naturalWidth){ctx.globalAlpha=.84;ctx.drawImage(bg,0,0,W,H);ctx.globalAlpha=1}else{let g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#251640');g.addColorStop(1,'#080e2d');ctx.fillStyle=g;ctx.fillRect(27,44,365,640)}
ctx.fillStyle='#081027a6';ctx.fillRect(26,520,367,155);ctx.fillStyle='#070d21bf';ctx.fillRect(343,250,48,422);ctx.strokeStyle='#a994c3';ctx.lineWidth=5;ctx.strokeRect(27,45,365,630);
// Open steel shooter lane: no rail across its top, and a visible upper exit gate.
ctx.strokeStyle='#e0ceef';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(343,260);ctx.lineTo(343,655);ctx.moveTo(391,95);ctx.lineTo(391,659);ctx.stroke();ctx.strokeStyle='#6df8e6';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(343,252);ctx.quadraticCurveTo(342,166,318,128);ctx.stroke();
for(const [a,z] of segments){ctx.lineCap='round';ctx.shadowColor='#02051b';ctx.shadowBlur=6;ctx.lineWidth=10;ctx.strokeStyle='#1b1c36';ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...z);ctx.stroke();ctx.shadowBlur=0;const chrome=ctx.createLinearGradient(a[0],a[1],z[0]+8,z[1]+8);chrome.addColorStop(0,'#e7eeff');chrome.addColorStop(.42,'#8d8fae');chrome.addColorStop(.72,'#f8e5c4');chrome.addColorStop(1,'#6d6283');ctx.strokeStyle=chrome;ctx.lineWidth=6;ctx.stroke();ctx.strokeStyle='#ffffffa8';ctx.lineWidth=1.5;ctx.stroke()}
ctx.save();ctx.strokeStyle='#ffb96e';ctx.shadowColor='#ff9d54';ctx.shadowBlur=12;ctx.lineWidth=3;for(const x of [102,307]){ctx.beginPath();ctx.moveTo(x,591);ctx.lineTo(x,626);ctx.stroke();ctx.beginPath();ctx.moveTo(x-6,621);ctx.lineTo(x,630);ctx.lineTo(x+6,621);ctx.stroke()}ctx.restore();
for(const r of ramps){let d=r.x<200?1:-1;ctx.strokeStyle='#090a28';ctx.lineWidth=23;ctx.beginPath();ctx.moveTo(r.x,r.y);ctx.bezierCurveTo(r.x+d*10,300,r.x+d*65,245,r.to[0],r.to[1]);ctx.stroke();ctx.strokeStyle=r.color;ctx.lineWidth=7;ctx.shadowColor=r.color;ctx.shadowBlur=13;ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle=r.color;ctx.beginPath();ctx.arc(r.x,r.y,13,0,Math.PI*2);ctx.fill()}
for(const o of orbits){ctx.strokeStyle='#efca78';ctx.lineWidth=8;ctx.beginPath();ctx.arc(o.x,o.y,o.r,Math.PI*.4,Math.PI*1.65);ctx.stroke()}
ctx.save();ctx.strokeStyle='#b98aff';ctx.lineWidth=10;ctx.shadowColor='#c58aff';ctx.shadowBlur=18;ctx.setLineDash([14,9]);ctx.beginPath();ctx.arc(bonusLoop.x,bonusLoop.y,bonusLoop.r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#f9e6ff';ctx.beginPath();ctx.arc(bonusLoop.entry.x,bonusLoop.entry.y,10,0,Math.PI*2);ctx.fill();ctx.font='900 10px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffedbd';ctx.shadowBlur=7;ctx.fillText('TÅRNSLØYFE',bonusLoop.x,bonusLoop.y-69);ctx.restore();
for(let i=0;i<ringLights.length;i++){let x=108+i*50;ctx.fillStyle=ringLights[i]?'#ffffff':'#ad79c7';ctx.shadowColor='#d6a6ff';ctx.shadowBlur=ringLights[i]?18:6;ctx.fillRect(x-10,119,19,10);ctx.shadowBlur=0}
if(dragon.complete&&dragon.naturalWidth){ctx.drawImage(dragon,164,112,89,85)}else{ctx.fillStyle='#a74e8e';ctx.beginPath();ctx.arc(208,157,27,0,Math.PI*2);ctx.fill()}
for(const o of bumper){ctx.save();ctx.shadowColor=o.c;ctx.shadowBlur=20;const base=ctx.createRadialGradient(o.x-7,o.y-10,3,o.x,o.y,o.r+8);base.addColorStop(0,'#ffffff');base.addColorStop(.4,'#e4d5e8');base.addColorStop(.7,'#61506f');base.addColorStop(1,'#141128');ctx.fillStyle=base;ctx.beginPath();ctx.arc(o.x,o.y,o.r+7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;let glow=ctx.createRadialGradient(o.x-7,o.y-9,2,o.x,o.y,o.r);glow.addColorStop(0,'#ffffff');glow.addColorStop(.24,'#fff5e6');glow.addColorStop(.64,o.c);glow.addColorStop(1,'#5a285d');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(o.x,o.y,o.r-1,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f9e5b9';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#ffffffb3';ctx.beginPath();ctx.ellipse(o.x-7,o.y-10,9,4,-.6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#392544';ctx.font='900 14px serif';ctx.textAlign='center';ctx.fillText('✦',o.x,o.y+5);ctx.restore()}
for(const t of scoreTargets){ctx.save();ctx.shadowColor=t.c;ctx.shadowBlur=14;ctx.fillStyle='#1c1539';ctx.strokeStyle=t.c;ctx.lineWidth=4;ctx.beginPath();ctx.arc(t.x,t.y,t.r+4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=t.c;ctx.beginPath();ctx.arc(t.x,t.y,5,0,Math.PI*2);ctx.fill();ctx.restore()}
ctx.save();ctx.shadowColor='#8ef5db';ctx.shadowBlur=13;ctx.strokeStyle='#9cf6d6';ctx.lineWidth=4;ctx.fillStyle='#15324b';ctx.beginPath();ctx.arc(lockTarget.x,lockTarget.y,lockTarget.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.textAlign='center';ctx.font='800 9px system-ui';ctx.fillStyle='#e8fff8';ctx.fillText('LOCK',lockTarget.x,lockTarget.y+3);ctx.restore();
for(const o of posts){ctx.fillStyle='#fbd07a';ctx.shadowColor='#ff9f56';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
for(const f of flippers)drawFlipper(f);
ctx.fillStyle='#3c3152';ctx.fillRect(349,585,34,82);ctx.fillStyle='#e8d9f5';ctx.fillRect(364,579,5,77);ctx.fillStyle='#fbc87a';ctx.fillRect(352,659-charge,29,8);
for(const b of balls){if(b.route){ctx.shadowColor='#d4f8ff';ctx.shadowBlur=22}ctx.fillStyle='#ebf5ff';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(b.x-2.5,b.y-2.5,2,0,Math.PI*2);ctx.fill()}
for(const p of particles){ctx.globalAlpha=Math.min(1,p.t*2);ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,3,3)}ctx.globalAlpha=1;
ctx.fillStyle='#070b22bb';ctx.fillRect(65,12,289,42);neonText('CASTLE CHAOS',210,41,23,'#fff0b7');
ctx.textAlign='center';ctx.font='900 10px monospace';ctx.fillStyle='#ffeea9';ctx.fillText('MÅL '+targetHits+'/12  •  '+multiplier+'X  •  LOCK '+lockHits+'/2',210,684);
if(modeTime>0){ctx.fillStyle='#0c113bcc';ctx.fillRect(75,78,270,29);neonText(mode,210,98,13,'#fff2a1')}
if(tilted){ctx.fillStyle='#ff668b';ctx.font='900 40px monospace';ctx.fillText('TILT!',210,390)}if(flash>0){ctx.fillStyle=`rgba(255,230,175,${flash*.24})`;ctx.fillRect(28,55,363,612)}}
function loop(t){const dt=Math.min(.032,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
function bind(id,k){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.classList.add('active');el.setPointerCapture(e.pointerId);if(k==='tilt')nudge();else {if((k==='left'||k==='right')&&!key[k])flipKickUntil[k]=frame+.15;key[k]=true}});for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>{el.classList.remove('active');if(k==='launch'){if(key.launch)launch();key.launch=false}else if(k!=='tilt')key[k]=false})}
for(const k of ['left','right','launch','tilt'])bind(k,k);
const map={ArrowLeft:'left',z:'left',Z:'left',ArrowRight:'right',x:'right',X:'right','/':'right'};
window.addEventListener('keydown',e=>{if(map[e.key]){const side=map[e.key];if(!key[side])flipKickUntil[side]=frame+.15;key[side]=true;e.preventDefault()}if(e.key===' '){key.launch=true;e.preventDefault()}if(['t','T','ArrowUp'].includes(e.key)){if(!e.repeat)nudge();e.preventDefault()}if(['p','P','Escape'].includes(e.key))pause()});
window.addEventListener('keyup',e=>{if(map[e.key])key[map[e.key]]=false;if(e.key===' '){if(key.launch)launch();key.launch=false}});
window.addEventListener('blur',()=>{key.left=key.right=key.launch=false;if(state==='playing'&&Date.now()>resumeGraceUntil)pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing'&&Date.now()>resumeGraceUntil)pause()});
function continueOrStart(e){if(e)e.preventDefault();const now=Date.now();if(now-lastContinueTap<500)return;lastContinueTap=now;if(state==='paused')pause();else if(state==='menu'||state==='over')start()}
$('start').addEventListener('pointerup',e=>{if(e.pointerType==='touch'||e.pointerType==='pen')continueOrStart(e)});
$('start').addEventListener('click',continueOrStart);
$('pause').addEventListener('click',()=>{if(Date.now()>resumeGraceUntil)pause()});
// Keep rapid pinball taps in the game. Browser/system edge gestures may still be reserved by iOS.
for(const el of document.querySelectorAll('.controls,.control,.playfield')){
 el.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
}
document.addEventListener('gesturestart',e=>{if(e.target.closest?.('.shell'))e.preventDefault()},{passive:false});$('sound').addEventListener('click',()=>{muted=!muted;$('sound').textContent=muted?'AV':'PÅ ♪'});hud();})();
