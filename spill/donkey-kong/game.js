(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
const W=400,H=640;canvas.width=W*2;canvas.height=H*2;ctx.setTransform(2,0,0,2,0,0);
const floorY=[585,484,383,282,181],ladderX=[338,62,338,62],floorDir=[-1,1,-1,1,1];
let state='menu',player,barrels=[],sparks=[],score=0,best=0,lives=3,level=1,spawn=0,last=0,muted=false,audio,invulnerable=0,goalPulse=0;
const down={left:false,right:false,up:false,jump:false};
try{best=Number(localStorage.getItem('chatgenius-barrel-climb-best')||0)}catch{}
function sound(freq=440,dur=.07,type='square'){if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(35,freq*.55),audio.currentTime+dur);gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+dur);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+dur)}catch{}}
function hud(){$('score').textContent=String(score).padStart(5,'0');$('best').textContent=String(best).padStart(5,'0');$('level').textContent=String(level).padStart(2,'0');$('lives').textContent='♥'.repeat(lives)}
function modal(kicker,title,description,button){$('kicker').textContent=kicker;$('heading').innerHTML=title;$('message').textContent=description;$('start').textContent=button;$('overlay').classList.remove('hidden')}
function resetPlayer(){player={x:34,y:floorY[0]-21,floor:0,vy:0,jumping:false,climbing:null,w:18,h:21};invulnerable=1.6}
function start(){score=0;lives=3;level=1;barrels=[];sparks=[];spawn=1.6;resetPlayer();state='playing';$('overlay').classList.add('hidden');$('pause').disabled=false;hud();sound(650,.16)}
function win(){score+=500;level++;barrels=[];sparks=[];spawn=1.6;resetPlayer();hud();sound(950,.25)}
function gameOver(){state='over';$('pause').disabled=true;modal('GAME OVER','GAME<br>OVER',`Du fikk ${score} poeng og kom til nivå ${level}. Prøv igjen!`,'SPILL IGJEN ▶');sound(130,.4,'sawtooth')}
function lifeLost(){lives--;barrels=[];sparks=[];spawn=1.8;sound(110,.3,'sawtooth');if(lives<=0){hud();gameOver()}else{resetPlayer();hud()}}
function pause(){if(state==='playing'){state='paused';modal('PAUSE','PAUSE','Tønnene venter på deg.','FORTSETT ▶');$('pause').textContent='▶ FORTSETT'}else if(state==='paused'){state='playing';$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ PAUSE'}}
function sparkle(x,y,color){for(let i=0;i<9;i++){const t=Math.random()*Math.PI*2,s=40+Math.random()*95;sparks.push({x,y,vx:Math.cos(t)*s,vy:Math.sin(t)*s,life:.65,color})}}
function addScore(n){score+=n;if(score>best){best=score;try{localStorage.setItem('chatgenius-barrel-climb-best',String(best))}catch{}}hud()}
function update(dt){goalPulse+=dt;for(const p of sparks){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt}sparks=sparks.filter(p=>p.life>0);if(state!=='playing')return;
invulnerable=Math.max(0,invulnerable-dt);const speed=145;
if(player.climbing){const cl=player.climbing;player.x=cl.x;player.y-=120*dt;if(player.y<=floorY[cl.to]-player.h){player.y=floorY[cl.to]-player.h;player.floor=cl.to;player.climbing=null;addScore(50);sound(590,.06)}}
else if(player.jumping){player.x+=((down.right?1:0)-(down.left?1:0))*speed*dt;player.vy+=640*dt;player.y+=player.vy*dt;const ground=floorY[player.floor]-player.h;if(player.vy>=0&&player.y>=ground){player.y=ground;player.vy=0;player.jumping=false}}
else{player.x+=((down.right?1:0)-(down.left?1:0))*speed*dt;if(down.up&&player.floor<4&&Math.abs(player.x-ladderX[player.floor])<23){const x=ladderX[player.floor];player.climbing={x,to:player.floor+1};player.x=x;sound(450,.06)}else if(down.jump){player.jumping=true;player.vy=-300;sound(750,.13)}}
player.x=Math.max(18,Math.min(W-18,player.x));
spawn-=dt;if(spawn<=0){barrels.push({x:87,y:floorY[4]-11,floor:4,dir:1,r:10,angle:0,falling:false,vy:0});spawn=Math.max(.75,2.8-level*.2)*(0.85+Math.random()*.5);sound(180,.05,'triangle')}
for(const b of barrels){if(b.falling){b.vy+=620*dt;b.y+=b.vy*dt;if(b.floor>=0&&b.y>=floorY[b.floor]-b.r){b.y=floorY[b.floor]-b.r;b.falling=false;b.vy=0}}else{b.x+=b.dir*(76+level*11)*dt;b.angle+=b.dir*5*dt;if(b.x>W-18||b.x<18){if(b.floor===0){b.dead=true;continue}b.x=Math.max(18,Math.min(W-18,b.x));b.floor--;b.dir*=-1;b.falling=true;b.vy=30}}if(invulnerable<=0&&Math.abs(b.x-player.x)<b.r+10&&Math.abs(b.y-(player.y+10))<b.r+13){sparkle(player.x,player.y,'#ff9d6d');lifeLost();break}}
if(player.floor===4&&player.x>322&&!player.climbing){sparkle(player.x,player.y,'#83ffca');win()}
barrels=barrels.filter(b=>!b.dead);}
function text(t,x,y,size,color,align='left'){ctx.fillStyle=color;ctx.textAlign=align;ctx.font=`bold ${size}px monospace`;ctx.fillText(t,x,y)}
function draw(){ctx.fillStyle='#080d1f';ctx.fillRect(0,0,W,H);for(let i=0;i<50;i++){const x=(i*79+13)%W,y=(i*137+31)%H;ctx.fillStyle=i%3?'#24364d':'#41607a';ctx.fillRect(x,y,1.5,1.5)}
ctx.fillStyle='#233248';ctx.fillRect(0,0,W,35);text('CHATGENIUS ARCADE',13,23,14,'#8affd9');
for(let f=0;f<5;f++){const y=floorY[f];ctx.fillStyle='#db5b82';ctx.fillRect(12,y,W-24,10);ctx.fillStyle='#ff91ae';for(let x=14;x<W-14;x+=27)ctx.fillRect(x,y+2,16,2);ctx.fillStyle='#9d3a65';for(let x=25;x<W-14;x+=54)ctx.fillRect(x,y+7,16,3)}
for(let f=0;f<4;f++){const x=ladderX[f],top=floorY[f+1]+10,bottom=floorY[f];ctx.fillStyle='#5bd5e5';ctx.fillRect(x-13,top,5,bottom-top);ctx.fillRect(x+8,top,5,bottom-top);for(let y=top+8;y<bottom;y+=12)ctx.fillRect(x-13,y,26,4)}
// A friendly original ape mascot and the finish flag.
const t=goalPulse;ctx.fillStyle='#784d45';ctx.fillRect(46,112,65,49);ctx.fillStyle='#b67b5c';ctx.fillRect(60,120,37,33);ctx.fillRect(42,143,15,20);ctx.fillRect(101,143,15,20);ctx.fillStyle='#f3c399';ctx.fillRect(66,135,26,15);ctx.fillStyle='#1a2130';ctx.fillRect(68,126,6,6);ctx.fillRect(86,126,6,6);ctx.fillRect(78,139,5,5);ctx.fillStyle='#ffda73';ctx.fillRect(314,113,5,62);ctx.fillStyle='#f9799f';ctx.beginPath();ctx.moveTo(319,114);ctx.lineTo(361,125);ctx.lineTo(319,140);ctx.fill();ctx.fillStyle='#fff0b4';ctx.fillRect(333,123,9,9);if(Math.sin(t*5)>0)text('★',340,103,19,'#fff1a7');
for(const b of barrels){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.angle);ctx.fillStyle='#b96c3b';ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f7b26c';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='#633d35';ctx.beginPath();ctx.moveTo(-8,-4);ctx.lineTo(8,-4);ctx.moveTo(-8,4);ctx.lineTo(8,4);ctx.stroke();ctx.restore()}
if(invulnerable<=0||Math.floor(invulnerable*8)%2===0){const x=player.x,y=player.y;ctx.fillStyle='#58dff4';ctx.fillRect(x-8,y+5,16,16);ctx.fillStyle='#f0d5b4';ctx.fillRect(x-7,y-2,14,10);ctx.fillStyle='#ec688b';ctx.fillRect(x-10,y-6,20,6);ctx.fillStyle='#26375b';ctx.fillRect(x-8,y+20,6,4);ctx.fillRect(x+2,y+20,6,4)}for(const p of sparks){ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4)}ctx.globalAlpha=1;
text('NÅ FLAGGET!',W-16,84,11,'#ffdd8c','right');}
function loop(now){const dt=Math.min(.04,(now-last)/1000||0);last=now;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
function bind(id,key){const button=$(id);button.addEventListener('pointerdown',e=>{e.preventDefault();down[key]=true;button.classList.add('pressed');button.setPointerCapture(e.pointerId)});for(const evt of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(evt,()=>{down[key]=false;button.classList.remove('pressed')})}
for(const key of ['left','right','up','jump'])bind(key,key);
const map={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'up',w:'up',W:'up',' ':'jump',ArrowDown:'up'};
window.addEventListener('keydown',e=>{if(map[e.key]){e.preventDefault();down[map[e.key]]=true}if(e.key==='Escape'||e.key==='p'||e.key==='P')pause()});window.addEventListener('keyup',e=>{if(map[e.key])down[map[e.key]]=false});window.addEventListener('blur',()=>{for(const k in down)down[k]=false;if(state==='playing')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause()});
$('start').addEventListener('click',()=>{if(state==='paused'){pause()}else start()});$('pause').addEventListener('click',pause);$('sound').addEventListener('click',()=>{muted=!muted;$('sound').textContent=muted?'AV':'PÅ ♪'});hud();})();
