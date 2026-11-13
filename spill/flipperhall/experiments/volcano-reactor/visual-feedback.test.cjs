// Run: node --test spill/flipperhall/experiments/volcano-reactor/visual-feedback.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const VR=require('./engine.js');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'Playable preview must include an inline display script');
function visualHarness(reduced=false){
  // Execute only the UI effect layer with the real engine state; no DOM or canvas.
  const start=source.indexOf('const reduceMotion=');
  const end=source.indexOf('function soundReady()',start);
  assert.ok(start>=0&&end>start,'Expected standalone visual feedback functions');
  const visualSource=source.slice(start,end);
  const game=VR.newGame(),sounds=[];
  const effects=new Function('window','E','game','tone',
    visualSource+'\nreturn {resetEffects,observeEffects,advanceEffects,effects};'
  )({matchMedia:()=>({matches:reduced})},VR,game,(...args)=>sounds.push(args));
  return {game,sounds,...effects};
}
test('Valve hit creates feedback once per activation without changing score or physics',()=>{
  const {game,effects,observeEffects,advanceEffects}=visualHarness();
  VR.launch(game);
  VR.triggerValve(game,0);
  const score=game.score,at={...game.ball},tick=game.tick;
  observeEffects();
  assert.equal(effects.valves[0],46);
  assert.equal(effects.valves[1],0);
  assert.ok(effects.sparks.length>=12);
  observeEffects();
  assert.equal(effects.sparks.length,16,'The same valve must not burst each frame');
  advanceEffects();
  assert.equal(effects.valves[0],45);
  assert.equal(game.score,score);
  assert.deepEqual(game.ball,at);
  assert.equal(game.tick,tick);
});
test('Opening the gate animates once, and the real game gate remains authoritative',()=>{
  const {game,effects,observeEffects}=visualHarness();
  VR.launch(game);VR.triggerValve(game,0);observeEffects();
  VR.triggerValve(game,1);observeEffects();
  assert.equal(game.gateOpen,true);
  assert.equal(effects.gate,65);
  assert.equal(effects.valves[1],46);
  const sparks=effects.sparks.length;
  observeEffects();
  assert.equal(effects.sparks.length,sparks,'Do not re-trigger opening every frame');
});
test('A real core hit triggers a celebration, then replay clears old feedback',()=>{
  const {game,effects,observeEffects,resetEffects}=visualHarness();
  VR.launch(game);VR.triggerValve(game,0);VR.triggerValve(game,1);
  observeEffects();
  game.ball={x:230,y:322,vx:0,vy:-10,r:7};game.shooter=false;
  for(let i=0;i<120&&!game.coreHits;i++)VR.step(game);
  assert.equal(game.coreHits,1);
  observeEffects();
  assert.equal(effects.core,120);
  assert.ok(effects.sparks.length>=45);
  resetEffects();
  assert.equal(effects.core,0);
  assert.equal(effects.gate,0);
  assert.deepEqual(effects.valves,[0,0]);
  assert.equal(effects.sparks.length,0);
});
test('Pause freezes particle animation; reduced motion produces no particle bursts',()=>{
  const h=visualHarness();VR.launch(h.game);VR.triggerValve(h.game,0);
  h.observeEffects();const before=h.effects.valves[0];
  VR.pause(h.game);h.advanceEffects();
  assert.equal(h.effects.valves[0],before);
  const still=visualHarness(true);VR.launch(still.game);VR.triggerValve(still.game,0);
  still.observeEffects();
  assert.equal(still.effects.sparks.length,0);
});
test('Visual rendering uses authoritative gate and includes clear mission feedback',()=>{
  assert.match(source,/const open=game\.gateOpen/);
  assert.match(source,/effects\.valves\[i\]/);
  assert.match(source,/effects\.core>0/);
  assert.match(source,/ctx\.fillText\('REAKTOREN AKTIVERT!'/);
  assert.match(source,/prefers-reduced-motion: reduce/);
  assert.match(source,/observeEffects\(\);advanceEffects\(\);board\(\)/);
  assert.match(html,/id="remaining"/);
});
