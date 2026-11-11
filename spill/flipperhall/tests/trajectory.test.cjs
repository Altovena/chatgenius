// Run: node --test spill/flipperhall/tests/trajectory.test.cjs
// Execute the real browser game loop with a lightweight, dependency-free DOM stub.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'Game script should exist');
function makeElement(){
  return {style:{},classList:{add(){},remove(){},toggle(){}},
    appendChild(){},replaceWith(){},addEventListener(){},setPointerCapture(){},
    querySelector(){return makeElement()},querySelectorAll(){return []},
    textContent:'',innerHTML:'',offsetWidth:100};
}
function runMachine(table){
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,makeElement());return elements.get(id)};
  const document={getElementById:element,createElement:()=>makeElement(),querySelectorAll:()=>[],
    addEventListener(){},hidden:false};
  element('board').getContext=()=>({});
  const storage=new Map();
  const window={location:{search:''},addEventListener(){},scrollTo(){}};
  const sandbox={document,window,URLSearchParams,console,Math,performance:{now:()=>0},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    Image:class{constructor(){this.complete=false;this.naturalWidth=0}},
    requestAnimationFrame(){},setTimeout(){},clearTimeout(){}};
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{timeout:2000,filename:'flipperhall/index.html'});
  vm.runInContext('startMode('+table+');soundOn=false;launch();',sandbox,{timeout:2000});
  const trace=[];
  for(let frame=0;frame<290;frame++){
    vm.runInContext('updateArms();simulate();',sandbox,{timeout:2000});
    const sample=vm.runInContext('({x:ball.x,y:ball.y,shooterLane,ballNumber,score})',sandbox);
    trace.push(sample);
    if(sample.ballNumber>1)break;
  }
  return trace;
}
for(const [index,name] of [[3,'Jungle Temple'],[4,'Abyssal Depths'],[5,'Clockwork Carnival']]){
  test(name+' enters the playable field before any loss',()=>{
    const trace=runMachine(index);
    const release=trace.findIndex(p=>!p.shooterLane);
    assert.ok(release>=0,name+': ball should exit shooter lane');
    assert.ok(trace.slice(release).some(p=>p.x>80&&p.x<370&&p.y>150&&p.y<600),
      name+': ball must actually cross into playable center before draining');
    assert.equal(trace[release].ballNumber,1,name+': launcher cannot directly lose the first ball');
  });
}
