// Run: node --test spill/flipperhall/tests/session-balance.test.cjs
// Deterministic gameplay sessions using the actual game physics, without a browser.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'Game script required');

function el(){
  return {style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},
    appendChild(){},replaceWith(){},addEventListener(){},setPointerCapture(){},
    querySelector(){return el()},querySelectorAll(){return []},
    textContent:'',innerHTML:'',offsetWidth:120};
}
function environment(){
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,el());return nodes.get(id)};
  node('board').getContext=()=>({});
  const document={getElementById:node,createElement:el,querySelectorAll:()=>[],
    addEventListener(){},hidden:false};
  const sandbox={document,window:{location:{search:''},addEventListener(){},scrollTo(){}},
    URLSearchParams,console,Math,performance:{now:()=>0},
    localStorage:{getItem:()=>null,setItem(){}},
    Image:class{constructor(){this.complete=false;this.naturalWidth=0}},
    requestAnimationFrame(){},setTimeout(){},clearTimeout(){}};
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{timeout:2500,filename:'flipperhall/index.html'});
  return sandbox;
}

function runSession(machine,control){
  const sandbox=environment();
  const command=`
    startMode(${machine});soundOn=false;
    const summary={mode:${machine},pattern:${JSON.stringify(control)},releases:0,centerEntries:0,
      drains:0,firstCenterFrame:null,firstDrainFrame:null,firstReleaseFrame:null,
      score:0,frames:0,ended:false,unsafe:false,balls:[]};
    let activeBall=0,centerReached=false;
    for(let frame=0;frame<2200;frame++){
      if(!playing||ended){summary.ended=ended;break}
      if(!launched){launch();activeBall=ballNumber;centerReached=false}
      if(${JSON.stringify(control)}==='alternating'){
        flips.left=frame%44<11;
        flips.right=(frame+22)%44<11;
      }else if(${JSON.stringify(control)}==='reactive'){
        flips.left=ball.y>520&&ball.x<275&&frame%16<8;
        flips.right=ball.y>520&&ball.x>=185&&frame%16<8;
      }else{flips.left=false;flips.right=false}
      updateArms();simulate();
      if(!shooterLane&&summary.firstReleaseFrame===null)summary.firstReleaseFrame=frame;
      if(!shooterLane&&ball.x>80&&ball.x<370&&ball.y>150&&ball.y<600){
        if(!centerReached){summary.centerEntries++;centerReached=true;
          if(summary.firstCenterFrame===null)summary.firstCenterFrame=frame}
      }
      if(!Number.isFinite(ball.x)||!Number.isFinite(ball.y)||!Number.isFinite(ball.vx)||!Number.isFinite(ball.vy)){
        summary.unsafe=true;break;
      }
      if(ballNumber>activeBall||ended){
        summary.drains++;summary.balls.push({ball:activeBall,centerReached,frame});
        if(!centerReached)summary.unsafe=true;
        if(summary.firstDrainFrame===null)summary.firstDrainFrame=frame;
      }
      summary.frames=frame+1;
    }
    summary.score=score;summary.ended=ended;summary;
  `;
  return vm.runInContext(command,sandbox,{timeout:12000});
}
for(const [machine,name] of [[3,'Jungle Temple'],[4,'Abyssal Depths'],[5,'Clockwork Carnival']]){
  for(const pattern of ['idle','alternating','reactive']){
    test(name+' / '+pattern+' completes safe playfield entry',()=>{
      const result=runSession(machine,pattern);
      assert.ok(result.firstReleaseFrame!==null,name+': launch exit required');
      assert.ok(result.firstCenterFrame!==null,name+': ball must enter center field');
      assert.equal(result.unsafe,false,name+': invalid motion or immediate drain '+JSON.stringify(result.balls));
      assert.ok(result.frames>=90,name+': simulation must exercise gameplay, not just launcher');
      assert.ok(result.score>=0,name+': score must remain valid');
      console.log('SESSION '+JSON.stringify(result));
    });
  }
}

test('Jungle Temple first descent remains playable without guaranteed side drain',()=>{
  const noInput=runSession(3,'idle');
  const controlled=runSession(3,'reactive');
  assert.ok(noInput.firstDrainFrame===null||noInput.firstDrainFrame>=400,
    'Jungle must not consistently lose the first ball immediately at the left edge');
  assert.ok(controlled.score!==noInput.score||controlled.firstDrainFrame!==noInput.firstDrainFrame,
    'Flipper input should influence the Jungle Temple ball path');
});

test('Abyssal Depths no longer falls through center on the first descent',()=>{
  const idle=runSession(4,'idle');
  const reactive=runSession(4,'reactive');
  assert.ok(idle.firstDrainFrame===null||idle.firstDrainFrame>=340,
    'First Abyssal ball should reach lower playfield with a fair chance to respond');
  assert.ok(reactive.firstDrainFrame===null||reactive.firstDrainFrame>=340,
    'Reactive flipper play should not cause an unavoidable initial drain');
  assert.ok(idle.score!==reactive.score||idle.firstDrainFrame!==reactive.firstDrainFrame,
    'Flipper input must influence Abyssal game outcome');
});
