// Run with: node --test spill/flipperhall/tests/launch.test.cjs
// No external dependencies. Executes the actual plunger transition from index.html.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/if\(shooterLane\)\{ball\.x=414;ball\.y-=8\.5;.*?continue\}/s);
assert.ok(source, 'Expected to find the physical shooter-lane logic');
// Wrapping the statement in a loop preserves the real continue statement.
const advance = new Function('mode', 'state', `
  let ball=state.ball, shooterLane=state.shooterLane;
  for(let n=0;n<1;n++) { ${source[0]} }
  state.shooterLane=shooterLane;
`);
function shoot(mode) {
  const state={ball:{x:414,y:690,vx:0,vy:-17,r:7},shooterLane:true};
  for(let n=0;n<100 && state.shooterLane;n++)advance(mode,state);
  assert.equal(state.shooterLane,false, 'Shot must exit the launch lane');
  return state.ball;
}
for(const mode of [3,4,5]) {
  test('Machine '+mode+' feeds upper playfield instead of draining from plunger',()=>{
    const ball=shoot(mode);
    assert.ok(ball.x < 390 && ball.y < 120, 'Ball starts safely in upper playfield');
    assert.ok(ball.vx < 0 && ball.vy < 0, 'Ball enters up and left');
  });
}
for(const mode of [0,1,2]) {
  test('Machine '+mode+' retains established shot geometry',()=>{
    const ball=shoot(mode);
    assert.deepEqual([ball.x,ball.y,ball.vx,ball.vy],[381,132,-6.1,2.5]);
  });
}
test('Later machines have individual inward launch angles',()=>{
  assert.deepEqual([shoot(3).vx,shoot(4).vx,shoot(5).vx],[-4.5,-3.9,-4.8]);
  assert.ok(shoot(5).vy < shoot(4).vy);
});
test('Last three machines keep a playable flipper gap',()=>{
  const flipper=html.match(/function flipperGeo\(side\)\{[^\n]*\}/g)?.at(-1);
  assert.ok(flipper, 'Expected final shared flipper geometry');
  assert.match(flipper,/length=lower\?89:83/);
  assert.match(html,/if\(mode<3&&ball\.vy>0&&ball\.y>616/);
});
