// Run: node --test spill/flipperhall/experiments/volcano-reactor/engine.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const VR=require('./engine.js');
test('Reactor prototype remains isolated and defines a different asymmetric layout',()=>{
  const g=VR.newGame();
  assert.equal(g.mode,'volcano');
  assert.equal(VR.WIDTH,460);assert.equal(VR.HEIGHT,800);
  assert.ok(VR.RAILS.length>=10,'Unique volcano orbit/chute geometry required');
  assert.equal(VR.VALVES.length,2);
  assert.equal(g.ballNo,1);
});
test('Valves are unique goals, not repeatable free points',()=>{
  const g=VR.newGame();assert.equal(VR.launch(g),true);
  assert.equal(VR.triggerValve(g,0),true);
  const score=g.score;
  assert.equal(VR.triggerValve(g,0),false);
  assert.equal(g.score,score);
  assert.equal(g.gateOpen,false);
  assert.equal(VR.triggerValve(g,1),true);
  assert.equal(g.gateOpen,true);
  assert.equal(g.gateTicks,900);
  assert.equal(g.score,score+350+900);
});
test('Only an open reactor gate permits core bonus and mission completion',()=>{
  const g=VR.newGame();VR.launch(g);
  assert.equal(VR.hitCore(g),false);
  assert.equal(g.score,0);
  VR.triggerValve(g,0);VR.triggerValve(g,1);
  assert.equal(VR.hitCore(g),true);
  assert.equal(g.coreHits,1);
  assert.equal(g.missionComplete,true);
  assert.equal(g.gateOpen,false);
  assert.equal(g.gateTicks,0);
  assert.equal(g.score,6600);
  assert.equal(VR.hitCore(g),false,'Cannot farm consecutive core hits with a closed gate');
});
test('Gate blocks motion when closed and vanishes from collision physics when open',()=>{
  const closed=VR.newGame();const open=VR.newGame();
  VR.launch(closed);VR.launch(open);
  for(const g of [closed,open]){
    g.shooter=false;g.ball={x:230,y:290,vx:0,vy:-5,r:7};
  }
  open.gateOpen=true;open.gateTicks=400;
  for(let n=0;n<9;n++){VR.step(closed);VR.step(open)}
  assert.ok(closed.ball.y>open.ball.y+10,
    'Closed gate should physically deflect the upward-moving ball; open gate should allow passage');
});
test('Timed gate closes cleanly and requires new valves after countdown',()=>{
  const g=VR.newGame();VR.launch(g);VR.triggerValve(g,0);VR.triggerValve(g,1);
  g.shooter=false;g.ball={x:400,y:500,vx:0,vy:0,r:7};
  g.gateTicks=2;
  VR.step(g);
  assert.equal(g.gateOpen,false);assert.deepEqual(g.valves,[false,false]);
  assert.equal(g.score,1600,'Expired gate must not award points');
});
test('Pause cannot advance ball or gate timer; flipper keys release',()=>{
  const g=VR.newGame();VR.launch(g);g.shooter=false;
  VR.triggerValve(g,0);VR.triggerValve(g,1);
  VR.setFlippers(g,true,true);VR.pause(g);
  const snapshot={y:g.ball.y,tick:g.tick,timer:g.gateTicks};
  for(let n=0;n<20;n++)VR.step(g);
  assert.equal(g.ball.y,snapshot.y);
  assert.equal(g.tick,snapshot.tick);
  assert.equal(g.gateTicks,snapshot.timer);
  assert.equal(g.left,false);assert.equal(g.right,false);
  VR.resume(g);VR.step(g);assert.ok(g.tick>snapshot.tick);
});
for(const pattern of ['idle','alternating','reactive']){
  test('Full physical trajectory: '+pattern,()=>{
    const g=VR.newGame();let lowerVisits=0,launched=0,invalid=false;
    for(let frame=0;frame<4000&&g.playing;frame++){
      if(!g.launched){VR.launch(g);launched++}
      if(pattern==='idle')VR.setFlippers(g,false,false);
      else if(pattern==='alternating')VR.setFlippers(g,frame%41<10,(frame+20)%41<10);
      else VR.setFlippers(g,g.ball.y>545&&g.ball.x<260&&frame%18<9,
        g.ball.y>545&&g.ball.x>=180&&frame%18<9);
      VR.step(g);
      if(!g.shooter&&g.ball.y>470&&g.ball.y<720)lowerVisits++;
      if(!Number.isFinite(g.ball.x)||!Number.isFinite(g.ball.y)||!Number.isFinite(g.score)){invalid=true;break}
    }
    assert.equal(invalid,false);
    assert.ok(launched>=1);
    assert.ok(lowerVisits>0,'Ball must actually visit lower playfield');
    assert.ok(g.ballNo>=1&&g.ballNo<=3);
    assert.ok(g.score>=0);
    console.log('VOLCANO',JSON.stringify({pattern,launched,lowerVisits,ball:g.ballNo,score:g.score,ended:g.ended}));
  });
}

test('Core can be hit by an actual moving ball through the open reactor gate',()=>{
  const g=VR.newGame();VR.launch(g);g.shooter=false;
  VR.triggerValve(g,0);VR.triggerValve(g,1);
  g.ball={x:230,y:322,vx:0,vy:-10,r:7};
  for(let n=0;n<120&&g.coreHits===0;n++)VR.step(g);
  assert.equal(g.coreHits,1,'Real moving ball must be able to reach the reactor core');
  assert.equal(g.missionComplete,true);
  assert.equal(g.gateOpen,false,'Scoring should close the gate');
});
test('An open gate gives the player a 7.5-second physics-time window',()=>{
  const g=VR.newGame();VR.launch(g);VR.triggerValve(g,0);VR.triggerValve(g,1);
  assert.equal(g.gateTicks,900,'900 substeps at 120 Hz equals 7.5 seconds');
  g.shooter=false;g.ball={x:400,y:500,vx:0,vy:0,r:7};
  for(let n=0;n<50;n++)VR.step(g);
  assert.equal(g.gateTicks,800);
  assert.equal(g.gateOpen,true);
});
