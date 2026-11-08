(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
const W=420,H=720,DPR=2;canvas.width=W*DPR;canvas.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);
const bg=new Image(),dragon=new Image();bg.src='/spill/flipper/art/castle-playfield.webp';dragon.src='/spill/flipper/art/dragon-target.webp';
let state='menu',balls=[],stock=3,score=0,best=0,level=1,last=0,frame=0,charge=0,muted=false,audio,tiltHeat=0,tilted=false,tiltDecay=0,dragonHits=0,combo=0,mode='READY',modeTime=0,flash=0,particles=[],ringLights=[false,false,false,false,false];
const key={left:false,right:false,launch:false};
try{best=Number(localStorage.getItem('chatgenius-castle-pinball-best')||0)}catch{}
const bumper=[{x:125,y:236,r:23,c:'#ff7cc6'},{x:276,y:251,r:25,c:'#77ebff'},{x:208,y:318,r:25,c:'#ffdc7b'}];
const posts=[{x:91,y:529,r:9},{x:312,y:537,r:9},{x:198,y:453,r:8},{x:65,y:376,r:8},{x:324,y:406,r:8}];
const segments=[[[28,90],[28,541]],[[28,541],[125,638]],[[340,266],[340,534]],[[340,534],[283,638]],[[28,91],[100,57]],[[320,57],[393,96]],[[30,535],[119,619]],[[337,532],[292,614]]];
const ramps=[{x:89,y:424,r:31,name:'DRAGE-RAMPEN',to:[264,194],color:'#7ee6ff',n:0},{x:296,y:416,r:32,name:'KONGE-RAMPEN',to:[96,187],color:'#ffcc84',n:0}];
const orbits=[{x:57,y:298,r:22,name:'VENSTRE ORBIT',to:[297,138]},{x:315,y:307,r:22,name:'HØYRE ORBIT',to:[117,158]}];
const flippers=[{x:145,y:618,l:74,left:true,upper:false},{x:278,y:618,l:74,left:false,upper:false},{x:118,y:406,l:53,left:true,upper:true},{x:289,y:382,l:51,left:false,upper:true}];
function tone(freq=500,duration=.09,type='square',vol=.027,delay=0){if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();let o=audio.createOscillator(),g=audio.createGain(),at=audio.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,at);o.frequency.exponentialRampToValueAtTime(Math.max(35,freq*.55),at+duration);g.gain.setValueAtTime(vol,at);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g).connect(audio.destination);o.start(at);o.stop(at+duration)}catch{}}
function fanfare(){tone(520,.12,'triangle',.045);tone(780,.13,'triangle',.045,.13);tone(1040,.2,'triangle',.045,.27)}
function hud(){$('score').textContent=String(score).padStart(7,'0');$('best').textContent=String(best).padStart(7,'0');$('balls').textContent=String(stock);$('tilt').textContent=tilted?'TILT!':tiltHeat>=1.7?'ADVARSEL':modeTime>0?mode:'KLAR';$('tilt').style.color=tilted?'#ff748a':modeTime>0?'#ffd47c':'#8df8d8'}
function setMode(name,duration=2){mode=name;modeTime=duration;hud()}
function scoreHit(n,x,y,label){if(tilted)return;score+=n;combo++;if(score>best){best=score;try{localStorage.setItem('chatgenius-castle-pinball-best',String(best))}catch{}}for(let i=0;i<13;i++){let a=Math.random()*Math.PI*2,s=50+Math.random()*130;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:.65,c:i%3?'#ffcc81':'#8ef5ed'})}if(label)setMode(label,1.9);hud()}
function modal(k,t,m,b){$('kicker').textContent=k;$('heading').innerHTML=t;$('message').textContent=m;$('start').textContent=b;$('overlay').classList.remove('hidden')}
const makeBall=(x,y,vx=0,vy=0,inLane=false)=>({x,y,vx,vy,r:8,inLane,route:null,routeCd:0,hitCd:0,life:0});
function readyBall(){balls=[makeBall(369,644,0,0,true)];charge=0;tilted=false;tiltHeat=0;tiltDecay=0;hud()}
function start(){score=0;stock=3;level=1;dragonHits=0;combo=0;ringLights=[false,false,false,false,false];particles=[];mode='READY';modeTime=0;readyBall();state='playing';$('overlay').classList.add('hidden');$('pause').disabled=false;hud();tone(650,.15)}
function gameOver(){state='over';$('pause').disabled=true;modal('GAME OVER','CASTLE<br>CHAOS',`Du fikk ${score.toLocaleString('no-NO')} poeng og nådde nivå ${level}. Spill igjen!`,'SPILL IGJEN ▶');tone(165,.43,'sawtooth')}
function pause(){if(state==='playing'){state='paused';modal('PAUSE','PAUSE','Slottets magi venter.','FORTSETT ▶');$('pause').textContent='▶ FORTSETT'}else if(state==='paused'){state='playing';$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ PAUSE'}}
function launch(){if(state!=='playing')return;let b=balls.find(b=>b.inLane&&b.vy===0);if(!b)return;b.vx=0;b.vy=-850-charge*6;charge=0;tone(160,.23,'sawtooth',.05);setMode('BALL I SPILL',1.1)}
function nudge(){if(state!=='playing'||!balls.some(b=>!b.inLane))return;tiltHeat+=1;tiltDecay=2.2;for(const b of balls)if(!b.inLane){b.vx+=(Math.random()-.5)*180;b.vy-=115}tone(115,.09,'triangle');if(tiltHeat>=3){tilted=true;setMode('TILT!',3);tone(90,.45,'sawtooth',.055)}hud()}
function collideCircle(b,o,boost=1){const dx=b.x-o.x,dy=b.y-o.y,d=Math.hypot(dx,dy),min=b.r+o.r;if(d>=min||d<.001)return false;let nx=dx/d,ny=dy/d,approach=b.vx*nx+b.vy*ny;b.x=o.x+nx*(min+.5);b.y=o.y+ny*(min+.5);if(approach<0){b.vx-=1.88*approach*nx;b.vy-=1.88*approach*ny}b.vx+=nx*boost;b.vy+=ny*boost;return true}
function rail(b,a,z){const dx=z[0]-a[0],dy=z[1]-a[1],q=Math.max(0,Math.min(1,((b.x-a[0])*dx+(b.y-a[1])*dy)/(dx*dx+dy*dy))),px=a[0]+q*dx,py=a[1]+q*dy,nx=b.x-px,ny=b.y-py,d=Math.hypot(nx,ny);if(d>=b.r+3||d<.001)return;let ux=nx/d,uy=ny/d,dot=b.vx*ux+b.vy*uy;b.x=px+ux*(b.r+3.5);b.y=py+uy*(b.r+3.5);if(dot<0){b.vx-=1.7*dot*ux;b.vy-=1.7*dot*uy;if(b.hitCd<=0){tone(210,.035,'triangle',.008);b.hitCd=.07}}}
function flipperPoints(f){const active=f.left?key.left:key.right,angle=f.left?(active&&!tilted?-.57:.28):(active&&!tilted?Math.PI+.57:Math.PI-.28);return [f.x+Math.cos(angle)*f.l,f.y+Math.sin(angle)*f.l]}
function flipperCollision(b,f){const p=flipperPoints(f),dx=p[0]-f.x,dy=p[1]-f.y,q=Math.max(0,Math.min(1,((b.x-f.x)*dx+(b.y-f.y)*dy)/(dx*dx+dy*dy))),px=f.x+q*dx,py=f.y+q*dy,d=Math.hypot(b.x-px,b.y-py);if(d>=b.r+8||d<.001)return;const nx=(b.x-px)/d,ny=(b.y-py)/d;b.x=px+nx*(b.r+8.5);b.y=py+ny*(b.r+8.5);const active=(f.left?key.left:key.right)&&!tilted;if(active){b.vy=-Math.max(f.upper?520:680,Math.abs(b.vy)*.7+390);b.vx+=(f.left?1:-1)*(f.upper?180:120);if(b.hitCd<=0){tone(f.upper?410:320,.075,'square',.04);scoreHit(f.upper?75:25,b.x,b.y);b.hitCd=.12}}else if(b.vy>0){b.vy=-Math.max(130,b.vy*.5);b.vx+=(f.left?1:-1)*30}}
function enterRoute(b,entry,isOrbit=false){b.route={time:0,duration:isOrbit?.65:.85,from:[b.x,b.y],to:entry.to,via:isOrbit?[210,78]:[entry.x<200?75:335,130]};b.routeCd=1.7;scoreHit(isOrbit?500:850,b.x,b.y,entry.name);tone(isOrbit?900:720,.12,'sine',.05);tone(1100,.17,'triangle',.04,.13);flash=.2}
function dragonStrike(b){dragonHits++;scoreHit(1500,b.x,b.y,dragonHits%3===0?'DRAGE-MULTIBALL!':'DRAGEN TREFFET!');b.vy=Math.max(390,Math.abs(b.vy));b.vx=(Math.random()-.5)*390;tone(240,.2,'sawtooth',.055);tone(620,.23,'square',.04,.13);flash=.4;if(dragonHits%3===0&&!tilted){balls.push(makeBall(125,218,260,260),makeBall(290,229,-240,200));scoreHit(3000,210,178,'MULTIBALL');fanfare();level++}}
function updateBall(b,dt){b.life+=dt;b.routeCd=Math.max(0,b.routeCd-dt);b.hitCd=Math.max(0,b.hitCd-dt);
if(b.route){let p=b.route;p.time+=dt;const t=Math.min(1,p.time/p.duration),inv=1-t;b.x=inv*inv*p.from[0]+2*inv*t*p.via[0]+t*t*p.to[0];b.y=inv*inv*p.from[1]+2*inv*t*p.via[1]+t*t*p.to[1];if(t>=1){b.route=null;b.vx=p.to[0]>210?-190:190;b.vy=140}return}
if(b.inLane){if(b.vy!==0){b.vy+=600*dt;b.y+=b.vy*dt;if(b.y<=118){b.inLane=false;b.x=320;b.y=116;b.vx=-260;b.vy=155;b.routeCd=.65;scoreHit(100,319,116,'SKYTERAMPE');tone(840,.13,'triangle')}else if(b.y>660){b.y=644;b.vy=0}}return}
b.vy+=790*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.vx*=1-.12*dt;
if(b.x<36){b.x=36;b.vx=Math.abs(b.vx)*.86}if(b.x>332&&b.y>248){b.x=332;b.vx=-Math.abs(b.vx)*.85}if(b.x>383){b.x=383;b.vx=-Math.abs(b.vx)*.8}if(b.y<60){b.y=60;b.vy=Math.abs(b.vy)*.85}
for(const [a,z] of segments)rail(b,a,z);
for(const o of bumper)if(collideCircle(b,o,550)&&b.hitCd<=0){scoreHit(150+combo%10*20,o.x,o.y,'BUMPER!');tone(710+Math.random()*180,.11,'sine',.055);b.hitCd=.09;flash=.09}
for(const o of posts)if(collideCircle(b,o,120)&&b.hitCd<=0){tone(340,.04,'triangle',.018);b.hitCd=.08}
for(const f of flippers)flipperCollision(b,f);
if(b.routeCd<=0&&b.vy<100){for(const r of ramps)if(Math.hypot(b.x-r.x,b.y-r.y)<r.r){enterRoute(b,r);return}for(const r of orbits)if(Math.hypot(b.x-r.x,b.y-r.y)<r.r){enterRoute(b,r,true);return}}
if(b.routeCd<=0&&Math.hypot(b.x-208,b.y-157)<33){dragonStrike(b);b.routeCd=1.2}
for(let i=0;i<ringLights.length;i++){let x=108+i*50;if(b.y<145&&Math.abs(b.x-x)<12&&!ringLights[i]){ringLights[i]=true;scoreHit(250,x,125,'RUNEBONUS');tone(1000,.07,'triangle');if(ringLights.every(Boolean)){scoreHit(2000,210,135,'KONGEBONUS');ringLights.fill(false);fanfare()}}}
const speed=Math.hypot(b.vx,b.vy);if(speed>1400){b.vx*=1400/speed;b.vy*=1400/speed}}
function update(dt){frame+=dt;flash=Math.max(0,flash-dt);modeTime=Math.max(0,modeTime-dt);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.t-=dt}particles=particles.filter(p=>p.t>0);if(state!=='playing')return;
tiltDecay=Math.max(0,tiltDecay-dt);if(!tiltDecay&&!tilted&&tiltHeat>0)tiltHeat=Math.max(0,tiltHeat-dt*.8);if(keys.launch)charge=Math.min(25,charge+dt*15);
const steps=Math.max(1,Math.ceil(dt/.007));for(let i=0;i<steps;i++){for(const b of balls)updateBall(b,dt/steps);balls=balls.filter(b=>b.inLane||b.y<H+15);if(!balls.length){stock--;if(stock>0){readyBall();setMode('NY BALL',1.5);tone(210,.15)}else gameOver();break}}
canvas.dataset.ballCount=String(balls.length);canvas.dataset.ballZone=balls[0]?.inLane?'shooter':balls[0]?.route?'ramp':'field';canvas.dataset.ballX=String(Math.round(balls[0]?.x||0));canvas.dataset.ballY=String(Math.round(balls[0]?.y||0));canvas.dataset.mode=mode;}
function neonText(s,x,y,size,color){ctx.font=`900 ${size}px system-ui`;ctx.textAlign='center';ctx.shadowColor=color;ctx.shadowBlur=12;ctx.fillStyle=color;ctx.fillText(s,x,y);ctx.shadowBlur=0}
function draw(){ctx.fillStyle='#0e0a24';ctx.fillRect(0,0,W,H);
if(bg.complete&&bg.naturalWidth){ctx.globalAlpha=.84;ctx.drawImage(bg,0,0,W,H);ctx.globalAlpha=1}else{let g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#251640');g.addColorStop(1,'#080e2d');ctx.fillStyle=g;ctx.fillRect(27,44,365,640)}
ctx.fillStyle='#081027a6';ctx.fillRect(26,520,367,155);ctx.fillStyle='#070d21bf';ctx.fillRect(343,250,48,422);ctx.strokeStyle='#a994c3';ctx.lineWidth=5;ctx.strokeRect(27,45,365,630);
// Open steel shooter lane: no rail across its top, and a visible upper exit gate.
ctx.strokeStyle='#e0ceef';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(343,260);ctx.lineTo(343,655);ctx.moveTo(391,95);ctx.lineTo(391,659);ctx.stroke();ctx.strokeStyle='#6df8e6';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(343,252);ctx.quadraticCurveTo(342,166,318,128);ctx.stroke();
for(const [a,z] of segments){ctx.strokeStyle='#a6a3cb';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...z);ctx.stroke();ctx.strokeStyle='#5f477c';ctx.lineWidth=2;ctx.stroke()}
for(const r of ramps){let d=r.x<200?1:-1;ctx.strokeStyle='#090a28';ctx.lineWidth=23;ctx.beginPath();ctx.moveTo(r.x,r.y);ctx.bezierCurveTo(r.x+d*10,300,r.x+d*65,245,r.to[0],r.to[1]);ctx.stroke();ctx.strokeStyle=r.color;ctx.lineWidth=7;ctx.shadowColor=r.color;ctx.shadowBlur=13;ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle=r.color;ctx.beginPath();ctx.arc(r.x,r.y,13,0,Math.PI*2);ctx.fill()}
for(const o of orbits){ctx.strokeStyle='#efca78';ctx.lineWidth=8;ctx.beginPath();ctx.arc(o.x,o.y,o.r,Math.PI*.4,Math.PI*1.65);ctx.stroke()}
for(let i=0;i<ringLights.length;i++){let x=108+i*50;ctx.fillStyle=ringLights[i]?'#ffffff':'#ad79c7';ctx.shadowColor='#d6a6ff';ctx.shadowBlur=ringLights[i]?18:6;ctx.fillRect(x-10,119,19,10);ctx.shadowBlur=0}
if(dragon.complete&&dragon.naturalWidth){ctx.drawImage(dragon,164,112,89,85)}else{ctx.fillStyle='#a74e8e';ctx.beginPath();ctx.arc(208,157,27,0,Math.PI*2);ctx.fill()}
for(const o of bumper){ctx.shadowColor=o.c;ctx.shadowBlur=21;ctx.fillStyle='#231641';ctx.beginPath();ctx.arc(o.x,o.y,o.r+6,0,Math.PI*2);ctx.fill();ctx.fillStyle=o.c;ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff1b5';ctx.beginPath();ctx.arc(o.x,o.y,o.r*.52,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#40274a';ctx.font='900 14px serif';ctx.textAlign='center';ctx.fillText('✦',o.x,o.y+5)}
for(const o of posts){ctx.fillStyle='#fbd07a';ctx.shadowColor='#ff9f56';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
for(const f of flippers){const p=flipperPoints(f);ctx.strokeStyle=tilted?'#75718d':f.upper?'#89e9e1':'#ffc980';ctx.shadowColor=f.upper?'#39c7bd':'#ffa45d';ctx.shadowBlur=15;ctx.lineWidth=f.upper?13:18;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(...p);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#b45b87';ctx.lineWidth=3;ctx.stroke()}
ctx.fillStyle='#3c3152';ctx.fillRect(349,585,34,82);ctx.fillStyle='#e8d9f5';ctx.fillRect(364,579,5,77);ctx.fillStyle='#fbc87a';ctx.fillRect(352,659-charge,29,8);
for(const b of balls){if(b.route){ctx.shadowColor='#d4f8ff';ctx.shadowBlur=22}ctx.fillStyle='#ebf5ff';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(b.x-2.5,b.y-2.5,2,0,Math.PI*2);ctx.fill()}
for(const p of particles){ctx.globalAlpha=Math.min(1,p.t*2);ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,3,3)}ctx.globalAlpha=1;
ctx.fillStyle='#070b22bb';ctx.fillRect(65,12,289,42);neonText('CASTLE CHAOS',210,41,23,'#fff0b7');
ctx.textAlign='center';ctx.font='900 10px monospace';ctx.fillStyle='#ffeea9';ctx.fillText('RAMPER  •  ORBITS  •  DRAGE-MULTIBALL',210,684);
if(modeTime>0){ctx.fillStyle='#0c113bcc';ctx.fillRect(75,78,270,29);neonText(mode,210,98,13,'#fff2a1')}
if(tilted){ctx.fillStyle='#ff668b';ctx.font='900 40px monospace';ctx.fillText('TILT!',210,390)}if(flash>0){ctx.fillStyle=`rgba(255,230,175,${flash*.24})`;ctx.fillRect(28,55,363,612)}}
function loop(t){const dt=Math.min(.032,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
function bind(id,k){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.classList.add('active');el.setPointerCapture(e.pointerId);if(k==='tilt')nudge();else key[k]=true});for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>{el.classList.remove('active');if(k==='launch'){if(key.launch)launch();key.launch=false}else if(k!=='tilt')key[k]=false})}
for(const k of ['left','right','launch','tilt'])bind(k,k);
const map={ArrowLeft:'left',z:'left',Z:'left',ArrowRight:'right',x:'right',X:'right','/':'right'};
window.addEventListener('keydown',e=>{if(map[e.key]){key[map[e.key]]=true;e.preventDefault()}if(e.key===' '){key.launch=true;e.preventDefault()}if(['t','T','ArrowUp'].includes(e.key)){if(!e.repeat)nudge();e.preventDefault()}if(['p','P','Escape'].includes(e.key))pause()});
window.addEventListener('keyup',e=>{if(map[e.key])key[map[e.key]]=false;if(e.key===' '){if(key.launch)launch();key.launch=false}});
window.addEventListener('blur',()=>{key.left=key.right=key.launch=false;if(state==='playing')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause()});
$('start').addEventListener('click',()=>state==='paused'?pause():start());$('pause').addEventListener('click',pause);$('sound').addEventListener('click',()=>{muted=!muted;$('sound').textContent=muted?'AV':'PÅ ♪'});hud();})();
