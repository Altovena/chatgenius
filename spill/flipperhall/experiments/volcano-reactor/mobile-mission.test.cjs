// Run: node --test spill/flipperhall/experiments/volcano-reactor/mobile-mission.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const VR=require('./engine.js');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'Expected game UI script');
function harness(){
  const game=VR.newGame(),elements=new Map(),sounds=[];
  function node(id){
    if(!elements.has(id)){
      const classes=new Set();
      const el={
        textContent:'',style:{},
        classList:{
          toggle(c,on){if(on)classes.add(c);else classes.delete(c)},
          contains(c){return classes.has(c)}
        },
        querySelector(){if(!this.span)this.span={textContent:''};return this.span}
      };
      elements.set(id,el);
    }
    return elements.get(id);
  }
  const snippet=source.slice(source.indexOf('function update(){'),source.indexOf('function frame(t)'));
  assert.ok(snippet.startsWith('function update(){'),'Expected standalone update handler');
  const update=new Function('game','DOM','eventSound','setPreviousEvent',`
    let previousEvent='';
    ${snippet}
    return update;
  `)(game,node,msg=>sounds.push(msg));
  return {game,node,sounds,update};
}
test('Mobile mission shows valve progress, gate countdown and core objective',()=>{
  const h=harness();
  h.update();
  assert.match(h.node('mobileStage').textContent,/begge trykkventilene/);
  assert.equal(h.node('mobileGate').querySelector('span').textContent,'STENGT');
  VR.launch(h.game);
  VR.triggerValve(h.game,0);h.update();
  assert.equal(h.node('mobileValveA').querySelector('span').textContent,'✓');
  assert.equal(h.node('mobileValveB').querySelector('span').textContent,'0');
  assert.equal(h.node('mobileValveA').classList.contains('complete'),true);
  assert.match(h.node('mobileStage').textContent,/siste trykkventilen/);
  VR.triggerValve(h.game,1);h.update();
  assert.equal(h.node('mobileValveB').querySelector('span').textContent,'✓');
  assert.equal(h.node('mobileGate').classList.contains('open'),true);
  assert.equal(h.node('mobileGate').querySelector('span').textContent,'7.5 s');
  assert.match(h.node('mobileStage').textContent,/REAKTORKJERNEN/);
  h.game.gateTicks=600;h.update();
  assert.equal(h.node('mobileGate').querySelector('span').textContent,'5.0 s');
  VR.hitCore(h.game);h.update();
  assert.match(h.node('mobileStage').textContent,/Reaktor fullført/);
  assert.equal(h.node('mobileGate').querySelector('span').textContent,'STENGT');
  assert.equal(h.node('mobileValveA').classList.contains('complete'),false);
});
test('Mobile mission is not hidden behind the sidebar on small screens',()=>{
  assert.match(html,/class="mobile-mission" aria-label="Oppdragsstatus"/);
  assert.match(html,/@media\(max-width:700px\)\{\.mobile-mission\{display:block/);
  assert.match(html,/\.mobile-mission\{display:none\}/);
  assert.match(source,/game\.gateTicks\/120/);
});
test('HUD changes cannot advance physical time or award points',()=>{
  const h=harness();VR.launch(h.game);
  const before={score:h.game.score,tick:h.game.tick,gate:h.game.gateTicks};
  for(let i=0;i<50;i++)h.update();
  assert.deepEqual({score:h.game.score,tick:h.game.tick,gate:h.game.gateTicks},before);
});

test('Small portrait screens reserve space for header, HUD and fixed flipper controls',()=>{
  assert.match(html,/@media\(max-width:700px\)/);
  assert.match(html,/\.workspace\{display:block;margin-top:6px\}/);
  assert.match(html,/\.mobile-mission\{display:block/);
  assert.match(html,/\.warning\{display:none\}/);
  assert.match(html,/\.board\{margin:auto;width:min\(100%,calc\(\(100svh - 230px\)\*\.575\)\)/);
  assert.match(html,/max-height:620px/);
  assert.match(html,/\.controlbar\{position:fixed/);
  const estimates=[568,667,844].map(height=>{
    const reserved=height<=620?210:230;
    const boardWidth=(height-reserved)*.575;
    const boardHeight=boardWidth*800/460+10;
    return {height,boardWidth,boardHeight,remaining:height-boardHeight};
  });
  for(const e of estimates){
    assert.ok(e.boardWidth>160, 'Board must remain playable on '+e.height+'px screens');
    assert.ok(e.remaining>=195, 'Leave space for header, mission HUD and bottom controls: '+JSON.stringify(e));
  }
});
