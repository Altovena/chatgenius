// Run: node --test spill/flipperhall/tests/mobile-controls.test.cjs
// Tests actual browser control handlers with a lightweight event-driven DOM stub.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'Flipperhall game script is required');
function element(control){
  const flags=new Set(),handlers={};
  const node={
    dataset:control?{control}:{},
    style:{setProperty(){}},
    classList:{
      add(k){flags.add(k)},remove(k){flags.delete(k)},contains(k){return flags.has(k)},
      toggle(k,on){if(on===undefined? !flags.has(k):on)flags.add(k);else flags.delete(k)}
    },
    addEventListener(k,fn){handlers[k]=fn},
    appendChild(){},replaceWith(){},setPointerCapture(){},
    querySelector(){return element()},querySelectorAll(){return []},
    textContent:'',innerHTML:'',offsetWidth:100
  };
  node.dispatch=(type)=>{assert.ok(handlers[type],'Missing '+type+' listener');handlers[type]({pointerId:9,preventDefault(){},code:'',repeat:false})};
  return node;
}
function harness(){
  const nodes=new Map();
  const controlButtons=['left','right','tilt','launch'].map(element);
  const node=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
  node('board').getContext=()=>({});
  const windowEvents={},documentEvents={};
  const document={
    hidden:false,
    getElementById:node,createElement:()=>element(),
    querySelectorAll(selector){return selector==='[data-control]'?controlButtons:[]},
    addEventListener(name,fn){documentEvents[name]=fn}
  };
  const win={
    location:{search:''},scrollTo(){},addEventListener(name,fn){windowEvents[name]=fn}
  };
  const sandbox={
    window:win,document,URLSearchParams,console,Math,performance:{now:()=>0},
    localStorage:{getItem:()=>null,setItem(){}},
    Image:class{constructor(){this.complete=false;this.naturalWidth=0}},
    requestAnimationFrame(){},setTimeout(){},clearTimeout(){}
  };
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{timeout:2500,filename:'flipperhall/index.html'});
  vm.runInContext('startMode(3);soundOn=false;',sandbox,{timeout:2500});
  const state=()=>vm.runInContext('({left:flips.left,right:flips.right,paused,playing})',sandbox);
  return {state,node,controlButtons,document,documentEvents,windowEvents,
    run:(code)=>vm.runInContext(code,sandbox,{timeout:2500}),
    button:(control)=>controlButtons.find(b=>b.dataset.control===control)};
}
test('Both flippers work simultaneously and an interrupted touch releases only its flipper',()=>{
  const h=harness(),left=h.button('left'),right=h.button('right');
  left.dispatch('pointerdown');right.dispatch('pointerdown');
  assert.equal(h.state().left,true);assert.equal(h.state().right,true);
  left.dispatch('pointercancel');
  assert.equal(h.state().left,false);assert.equal(h.state().right,true);
  right.dispatch('pointerup');
  assert.equal(h.state().right,false);
  assert.equal(left.classList.contains('pressed'),false);
  assert.equal(right.classList.contains('pressed'),false);
});
test('Switching away from Safari pauses game and releases every mobile control',()=>{
  const h=harness(),left=h.button('left'),right=h.button('right');
  left.dispatch('pointerdown');right.dispatch('pointerdown');
  h.document.hidden=true;
  h.documentEvents.visibilitychange();
  assert.equal(h.state().paused,true);
  assert.equal(h.state().left,false);assert.equal(h.state().right,false);
  assert.equal(left.classList.contains('pressed'),false);
  assert.equal(right.classList.contains('pressed'),false);
  left.dispatch('pointerdown');
  assert.equal(h.state().left,false,'Paused flipper must not be re-activated');
  assert.equal(left.classList.contains('pressed'),false,'Paused button must not look stuck');
  h.node('resume').onclick();
  assert.equal(h.state().paused,false);
  assert.equal(h.state().left,false);
  left.dispatch('pointerdown');
  assert.equal(h.state().left,true,'Fresh touch after resume should work');
});
test('Browser blur, manual pause and leaving the arcade clear stuck controls',()=>{
  const h=harness(),left=h.button('left'),right=h.button('right');
  left.dispatch('pointerdown');
  h.windowEvents.blur();
  assert.equal(h.state().paused,true);
  assert.equal(h.state().left,false);
  assert.equal(left.classList.contains('pressed'),false);
  h.node('resume').onclick();
  right.dispatch('pointerdown');
  h.node('pause').onclick();
  assert.equal(h.state().paused,true);
  assert.equal(h.state().right,false);
  assert.equal(right.classList.contains('pressed'),false);
  h.node('resume').onclick();
  left.dispatch('pointerdown');
  h.node('back').onclick();
  assert.equal(h.state().playing,false);
  assert.equal(h.state().left,false);
  assert.equal(left.classList.contains('pressed'),false);
});
test('Losing pointer capture always releases the flipper',()=>{
  const h=harness(),left=h.button('left');
  left.dispatch('pointerdown');
  assert.equal(h.state().left,true);
  left.dispatch('lostpointercapture');
  assert.equal(h.state().left,false);
  assert.equal(left.classList.contains('pressed'),false);
});

test('Last ball releases held flippers before showing the game-over overlay',()=>{
  const h=harness(),left=h.button('left'),right=h.button('right');
  left.dispatch('pointerdown');right.dispatch('pointerdown');
  h.run('ballNumber=3;score=325;finishBall();');
  const state=h.run('({ended,playing,paused,ballNumber,score})');
  assert.equal(state.ended,true);
  assert.equal(state.playing,false);
  assert.equal(state.paused,true);
  assert.equal(h.state().left,false);
  assert.equal(h.state().right,false);
  assert.equal(left.classList.contains('pressed'),false);
  assert.equal(right.classList.contains('pressed'),false);
  assert.match(h.node('overlayText').textContent,/325/);
});
test('Spill igjen starts a clean new game without stale controls or effects',()=>{
  const h=harness(),left=h.button('left');
  left.dispatch('pointerdown');
  h.run("ballNumber=3;score=5000;toast='GAMMEL MELDING';toastTime=90;hitFlash=24;bumperGlow[0]=12;physicsAccumulator=28;finishBall();");
  h.node('resume').onclick();
  const state=h.run('({ended,playing,paused,ballNumber,score,launched,toast,toastTime,hitFlash,physicsAccumulator,bumperGlow})');
  assert.equal(state.ended,false);
  assert.equal(state.playing,true);
  assert.equal(state.paused,false);
  assert.equal(state.ballNumber,1);
  assert.equal(state.score,0);
  assert.equal(state.launched,false);
  assert.equal(state.toast,'');
  assert.equal(state.toastTime,0);
  assert.equal(state.hitFlash,0);
  assert.equal(state.physicsAccumulator,0);
  assert.ok(state.bumperGlow.every(n=>n===0));
  assert.equal(left.classList.contains('pressed'),false);
  assert.equal(h.state().left,false);
  assert.equal(h.node('scoreEvent').textContent,'');
  left.dispatch('pointerdown');
  assert.equal(h.state().left,true,'Controls should work normally in new game');
});
test('Switching machines clears pressed controls and old visual notifications',()=>{
  const h=harness(),right=h.button('right');
  right.dispatch('pointerdown');
  h.run("toast='FORRIGE MASKIN';toastTime=35;hitFlash=9;score=410;startMode(5);");
  const state=h.run('({mode,score,ballNumber,toastTime,hitFlash,playing,paused})');
  assert.equal(state.mode,5);
  assert.equal(state.score,0);
  assert.equal(state.ballNumber,1);
  assert.equal(state.toastTime,0);
  assert.equal(state.hitFlash,0);
  assert.equal(state.playing,true);
  assert.equal(state.paused,false);
  assert.equal(h.state().right,false);
  assert.equal(right.classList.contains('pressed'),false);
});
