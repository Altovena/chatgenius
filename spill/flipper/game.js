(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d'),W=420,H=720;
canvas.width=W*2;canvas.height=H*2;ctx.setTransform(2,0,0,2,0,0);
let state='menu',ball=null,score=0,best=0,balls=3,last=0,tilt=0,tilted=false,tiltCooldown=0,combo=0,lights=0,charge=0,plunger=false,muted=false,audio,frames=0,particles=[];
const keys={left:false,right:false,launch:false};
try{best=Number(localStorage.getItem('chatgenius-castle-pinball-best')||0)}catch{}
const rails=[[[31,92],[31,541]],[[31,541],[137,644]],[[389,92],[389,541]],[[389,541],[283,644]],[[33,92],[93,49]],[[327,49],[387,92]],[[31,93],[30,115]],[[389,93],[390,115]],[[42,550],[130,619]],[[378,550],[290,619]]];
const bumpers=[{x:147,y:213,r:27,c:'#ef6fb0'},{x:268,y:211,r:27,c:'#6fe3f3'},{x:207,y:292,r:29,c:'#ffd779'}];
const posts=[{x:112,y:570,r:9},{x:308,y:570,r:9},{x:205,y:420,r:9},{x:95,y:360,r:9},{x:325,y:365,r:9}];
const targets=[{x:111,y:112,w:22,h:10},{x:163,y:107,w:22,h:10},{x:215,y:104,w:22,h:10},{x:267,y:107,w:22,h:10},{x:319,y:112,w:22,h:10}];
function sound(freq=500,dur=.09,type='square',vol=.03){if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(35,freq*.48),audio.currentTime+dur);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+dur);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur)}catch{}}
function jingle(){sound(740,.09);setTimeout(()=>sound(980,.09),90);setTimeout(()=>sound(1300,.16),180)}
function hud(){$('score').textContent=String(score).padStart(7,'0');$('best').textContent=String(best).padStart(7,'0');$('balls').textContent=String(balls);$('tilt').textContent=tilted?'TILT!':tilt>1.3?'ADVARSEL':'KLAR';$('tilt').style.color=tilted?'#ff7586':'#8ef5d9'}
function points(n,x,y){score+=n;combo++;if(score>best){best=score;try{localStorage.setItem('chatgenius-castle-pinball-best',String(best))}catch{}}for(let i=0;i<9;i++){const a=Math.random()*Math.PI*2,s=50+Math.random()*110;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:.6})}hud()}
function modal(kicker,title,description,button){$('kicker').textContent=kicker;$('heading').innerHTML=title;$('message').textContent=description;$('start').textContent=button;$('overlay').classList.remove('hidden')}
function newBall(){ball={x:364,y:632,vx:0,vy:0,r:8,active:false};tilted=false;tilt=0;tiltCooldown=0;plunger=false;charge=0;hud()}
function start(){score=0;balls=3;combo=0;newBall();state='playing';$('overlay').classList.add('hidden');$('pause').disabled=false;hud();sound(680,.15)}
function over(){state='over';$('pause').disabled=true;modal('GAME OVER','CASTLE<br>CHAOS',`Du fikk ${score.toLocaleString('no-NO')} poeng! Klar for et nytt spill?`,'SPILL IGJEN ▶');sound(140,.36,'sawtooth')}
function pause(){if(state==='playing'){state='paused';modal('PAUSE','PAUSE','Slottet venter på deg.','FORTSETT ▶');$('pause').textContent='▶ FORTSETT'}else if(state==='paused'){state='playing';$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ PAUSE'}}
function launch(){if(state!=='playing'||!ball||ball.active)return;ball.active=true;ball.vx=-140-Math.random()*60;ball.vy=-880-charge*3;sound(150,.17,'sawtooth',.055);charge=0}
function nudge(){if(state!=='playing'||!ball?.active)return;tilt+=1;tiltCooldown=2.5;ball.vx+=(Math.random()-.5)*220;ball.vy-=110;sound(110,.1,'triangle');if(tilt>=3){tilted=true;sound(100,.5,'sawtooth');hud()}else hud()}
function collideCircle(obj,boost=1){if(!ball?.active)return;const dx=ball.x-obj.x,dy=ball.y-obj.y,d=Math.hypot(dx,dy),min=ball.r+obj.r;if(d>=min||d<.001)return;const nx=dx/d,ny=dy/d,dot=ball.vx*nx+ball.vy*ny;ball.x=obj.x+nx*(min+1);ball.y=obj.y+ny*(min+1);if(dot<0){ball.vx-=2*dot*nx;ball.vy-=2*dot*ny}ball.vx+=nx*boost;ball.vy+=ny*boost;return true}
function collideRail(a,b){const dx=b[0]-a[0],dy=b[1]-a[1],q=Math.max(0,Math.min(1,((ball.x-a[0])*dx+(ball.y-a[1])*dy)/(dx*dx+dy*dy))),px=a[0]+q*dx,py=a[1]+q*dy,nx=ball.x-px,ny=ball.y-py,d=Math.hypot(nx,ny);if(d>=ball.r+3||d<.01)return;const ux=nx/d,uy=ny/d,dot=ball.vx*ux+ball.vy*uy;ball.x=px+ux*(ball.r+3.5);ball.y=py+uy*(ball.r+3.5);if(dot<0){ball.vx-=1.75*dot*ux;ball.vy-=1.75*dot*uy;sound(190,.035,'triangle',.008)}}
function segmentContact(ax,ay,bx,by,active,side){const dx=bx-ax,dy=by-ay,q=Math.max(0,Math.min(1,((ball.x-ax)*dx+(ball.y-ay)*dy)/(dx*dx+dy*dy))),px=ax+q*dx,py=ay+q*dy,dist=Math.hypot(ball.x-px,ball.y-py);if(dist>=ball.r+8)return;const nx=(ball.x-px)/(dist||1),ny=(ball.y-py)/(dist||1);ball.x=px+nx*(ball.r+8.5);ball.y=py+ny*(ball.r+8.5);if(active&&!tilted){ball.vy=-Math.max(490,Math.abs(ball.vy)*.8+360);ball.vx+=side*(95+Math.random()*70);sound(330,.09,'square',.045);points(25,ball.x,ball.y)}else if(ball.vy>0){ball.vy=-Math.max(180,ball.vy*.63);ball.vx+=side*25}}
function update(dt){frames+=dt;lights=Math.max(0,lights-dt);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.t-=dt}particles=particles.filter(p=>p.t>0);if(state!=='playing')return;tiltCooldown=Math.max(0,tiltCooldown-dt);if(!tiltCooldown&&tilt>0&&!tilted)tilt=Math.max(0,tilt-dt*.75);if(!ball?.active){if(keys.launch)charge=Math.min(32,charge+dt*22);return}
const steps=Math.max(1,Math.ceil(dt/.008)),h=dt/steps;for(let step=0;step<steps;step++){
 ball.vy+=780*h;ball.vx*=1-.13*h;ball.x+=ball.vx*h;ball.y+=ball.vy*h;
 if(ball.x<ball.r+35){ball.x=ball.r+35;ball.vx=Math.abs(ball.vx)*.82}if(ball.x>W-ball.r-35){ball.x=W-ball.r-35;ball.vx=-Math.abs(ball.vx)*.82}if(ball.y<ball.r+52){ball.y=ball.r+52;ball.vy=Math.abs(ball.vy)*.7}
 for(const [a,b] of rails)collideRail(a,b);
 for(const ob of bumpers)if(collideCircle(ob,540)){points(100+Math.min(combo,10)*10,ob.x,ob.y);lights=.18;sound(720+Math.random()*200,.1,'sine',.055)}
 for(const ob of posts)if(collideCircle(ob,110)){sound(280,.04,'triangle',.015)}
 for(const t of targets)if(ball.x>t.x-ball.r&&ball.x<t.x+t.w+ball.r&&Math.abs(ball.y-t.y)<14){ball.vy=Math.abs(ball.vy)+150;points(250,t.x,t.y);lights=.35;sound(1100,.12,'square')}
 const leftA=[144,626],leftB=[144+71*Math.cos(keys.left&&!tilted?-.53:.3),626+71*Math.sin(keys.left&&!tilted?-.53:.3)];
 const rightA=[276,626],rightB=[276+71*Math.cos(keys.right&&!tilted?Math.PI+.53:Math.PI-.3),626+71*Math.sin(keys.right&&!tilted?Math.PI+.53:Math.PI-.3)];
 segmentContact(...leftA,...leftB,keys.left,-1);segmentContact(...rightA,...rightB,keys.right,1);
 if(ball.y>H+20){balls--;combo=0;points(0,ball.x,H-30);if(balls<=0)over();else newBall();break}
 const speed=Math.hypot(ball.vx,ball.vy);if(speed>1350){ball.vx*=1350/speed;ball.vy*=1350/speed}
 }
}
function draw(){ctx.fillStyle='#0d0c2e';ctx.fillRect(0,0,W,H);const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#21133d');grad.addColorStop(.55,'#181333');grad.addColorStop(1,'#0b0a20');ctx.fillStyle=grad;ctx.fillRect(28,42,364,650);
for(let i=0;i<64;i++){ctx.fillStyle=i%3?'#473459':'#6a4571';ctx.fillRect(36+(i*61)%350,70+(i*139)%570,1.5,1.5)}
// Original castle fantasy artwork, inspired by classic 1990s tables.
ctx.fillStyle='#4e3c6d';ctx.fillRect(133,74,154,90);for(let i=0;i<6;i++)ctx.fillRect(133+i*29,58,16,25);ctx.fillStyle='#a17aac';ctx.fillRect(146,89,128,64);ctx.fillStyle='#3d204b';ctx.beginPath();ctx.arc(210,155,39,Math.PI,0);ctx.lineTo(249,163);ctx.lineTo(171,163);ctx.fill();ctx.fillStyle='#f1bf74';ctx.fillRect(203,60,14,45);ctx.fillStyle='#f16e9c';ctx.beginPath();ctx.moveTo(217,61);ctx.lineTo(243,71);ctx.lineTo(217,83);ctx.fill();
ctx.textAlign='center';ctx.font='900 27px Georgia';ctx.fillStyle='#ffe6a1';ctx.fillText('CASTLE CHAOS',210,43);ctx.font='bold 10px monospace';ctx.fillStyle='#dfbcea';ctx.fillText('MAGIC • MAYHEM • MULTIBALL',210,180);
for(const [a,b] of rails){ctx.strokeStyle='#b7a5c9';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.strokeStyle='#615078';ctx.lineWidth=3;ctx.stroke()}
for(const t of targets){ctx.fillStyle=lights>0?'#fff6ab':'#e779b3';ctx.fillRect(t.x,t.y,t.w,t.h);ctx.strokeStyle='#fff0b5';ctx.lineWidth=2;ctx.strokeRect(t.x,t.y,t.w,t.h)}
for(const b of bumpers){ctx.shadowColor=b.c;ctx.shadowBlur=lights>0?28:16;ctx.fillStyle='#241f4e';ctx.beginPath();ctx.arc(b.x,b.y,b.r+5,0,Math.PI*2);ctx.fill();ctx.fillStyle=b.c;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff2c3';ctx.beginPath();ctx.arc(b.x,b.y,b.r*.53,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#3e2752';ctx.font='bold 14px monospace';ctx.fillText('★',b.x,b.y+5)}
for(const p of posts){ctx.fillStyle='#f7c86a';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}
ctx.fillStyle='#fb83a7';for(const tri of [[[52,507],[128,568],[113,554]],[[368,507],[292,568],[307,554]]]){ctx.beginPath();ctx.moveTo(...tri[0]);ctx.lineTo(...tri[1]);ctx.lineTo(...tri[2]);ctx.closePath();ctx.fill()}
const flippers=[{x:144,y:626,angle:keys.left&&!tilted?-.53:.3,side:1},{x:276,y:626,angle:keys.right&&!tilted?Math.PI+.53:Math.PI-.3,side:-1}];for(const f of flippers){ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.angle);ctx.strokeStyle=tilted?'#77718b':'#ffca77';ctx.lineWidth=18;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(71,0);ctx.stroke();ctx.strokeStyle='#a95e7b';ctx.lineWidth=4;ctx.stroke();ctx.restore()}
ctx.fillStyle='#42334d';ctx.fillRect(345,568,34,93);ctx.fillStyle='#e8d8eb';ctx.fillRect(363,569,5,75);ctx.fillStyle='#fdc96c';ctx.fillRect(353,650-charge,23,8);
if(ball){ctx.shadowColor='#d9f7ff';ctx.shadowBlur=15;ctx.fillStyle='#dfeaff';ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ball.x-2.5,ball.y-2.5,2.5,0,Math.PI*2);ctx.fill()}
for(const p of particles){ctx.globalAlpha=Math.min(1,p.t*2);ctx.fillStyle='#ffe99b';ctx.fillRect(p.x,p.y,4,4)}ctx.globalAlpha=1;if(tilted){ctx.fillStyle='#ff567e';ctx.font='900 37px monospace';ctx.fillText('TILT!',210,380)}
ctx.textAlign='left';ctx.fillStyle='#9b8bae';ctx.font='bold 10px monospace';ctx.fillText('CHATGENIUS.PRO',44,697)}
function loop(t){const dt=Math.min(.032,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
function bind(id,key){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.classList.add('active');el.setPointerCapture(e.pointerId);if(key==='tilt')nudge();else if(key==='launch')keys.launch=true;else keys[key]=true});for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,()=>{el.classList.remove('active');if(key==='launch'){if(keys.launch)launch();keys.launch=false}else if(key!=='tilt')keys[key]=false})}
for(const key of ['left','right','launch','tilt'])bind(key,key);
const mapping={ArrowLeft:'left',z:'left',Z:'left',ArrowRight:'right','/':'right',x:'right',X:'right'};
window.addEventListener('keydown',e=>{if(mapping[e.key]){keys[mapping[e.key]]=true;e.preventDefault()}if(e.key===' '){keys.launch=true;e.preventDefault()}if(e.key==='t'||e.key==='T'||e.key==='ArrowUp'){if(!e.repeat)nudge();e.preventDefault()}if(e.key==='p'||e.key==='P'||e.key==='Escape')pause()});
window.addEventListener('keyup',e=>{if(mapping[e.key])keys[mapping[e.key]]=false;if(e.key===' '){if(keys.launch)launch();keys.launch=false}});
window.addEventListener('blur',()=>{keys.left=false;keys.right=false;keys.launch=false;if(state==='playing')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause()});
$('start').addEventListener('click',()=>state==='paused'?pause():start());$('pause').addEventListener('click',pause);$('sound').addEventListener('click',()=>{muted=!muted;$('sound').textContent=muted?'AV':'PÅ ♪'});hud();})();
