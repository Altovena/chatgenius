// Tests actual target illumination lifetime in the shipped game script.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const source=html.match(/function drawPremiumTarget\(x,y,i,m\)\{[\s\S]*?const live=([^,;\n]+),flash=live\?1:0;/);
assert.ok(source,'Expected target hit feedback expression');
const highlighted=new Function('targetHitTicks','ticks','i','return ('+source[1]+')');
test('Unhit targets do not glow',()=>{
  assert.equal(highlighted([],200,0),false);
});
test('Target light pulses for limited ticks and then fades',()=>{
  const hits=[100];
  assert.equal(highlighted(hits,100,0),true);
  assert.equal(highlighted(hits,117,0),true);
  assert.equal(highlighted(hits,118,0),false);
  assert.equal(highlighted(hits,1000,0),false);
});
test('Target feedback is specific to the hit target',()=>{
  assert.equal(highlighted([100,undefined,180],190,1),false);
  assert.equal(highlighted([100,undefined,180],190,2),true);
});
