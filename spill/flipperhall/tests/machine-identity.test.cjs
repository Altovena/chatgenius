// Run: node --test spill/flipperhall/tests/machine-identity.test.cjs
// Protect meaningful visual/mechanical differences between the six original tables.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const gameDir=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(gameDir,'index.html'),'utf8');
function literal(expression,label){
  const found=html.match(expression);
  assert.ok(found,'Missing game source '+label);
  return new Function('return ('+found[1]+')')();
}
const modes=literal(/const modes=(\[[\s\S]*?\]);\s*const cards=/,'modes');
const layouts=literal(/const layouts=(\[[\s\S]*?\]);\s*function layout/,'layouts');
const cabinets=literal(/const machineArt=(\[[^;]*?\]);\s*let currentIntro=/,'cabinet art');
const playfields=literal(/const playfieldImages=(\[[^;]*?\])\.map\(src=>/,'playfield art');
const layoutSignature=l=>JSON.stringify({
  bumpers:l.bumpers,targets:l.targets,walls:l.walls,ramps:l.ramps,upper:l.upper,
  tunnel:l.tunnel,bridge:l.bridge,drops:l.drops
});
test('Every machine has its own named mechanics, mission and physical geometry',()=>{
  assert.ok(modes.length>=6,'Original six tables must remain available');
  assert.equal(modes.length,layouts.length,'Every selectable machine needs a physical layout');
  assert.equal(new Set(modes.map(m=>m.name)).size,modes.length,'Machine names must be unique');
  assert.equal(new Set(modes.map(m=>m.mission)).size,modes.length,'Machine goals must be distinct');
  assert.equal(new Set(layouts.map(layoutSignature)).size,layouts.length,
    'Two machines cannot accidentally share exactly the same physics layout');
  for(const [index,table] of layouts.entries()){
    assert.ok(table.bumpers.length>=2,'Machine '+index+' needs active bumpers');
    assert.ok(table.targets.length>=3,'Machine '+index+' needs several targets');
    assert.ok(table.ramps.length>=2,'Machine '+index+' needs playable ramp entries');
  }
});
function hashesForAssets(assets,label){
  assert.equal(assets.length,modes.length,label+' must have one asset for each machine');
  assert.equal(new Set(assets).size,assets.length,label+' paths must not be duplicated');
  const hashes=assets.map((asset,index)=>{
    assert.match(asset,/^assets\/[a-z0-9-]+\.webp$/,label+' path format '+index);
    const file=path.join(gameDir,asset);
    assert.ok(fs.existsSync(file),label+' missing for '+modes[index].name+': '+asset);
    const stat=fs.statSync(file);
    assert.ok(stat.size>1024,label+' unexpectedly small image for '+modes[index].name);
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  });
  assert.equal(new Set(hashes).size,hashes.length,
    label+' contains byte-identical images for different machines');
}
test('Cabinet images exist and are unique for each machine',()=>{
  hashesForAssets(cabinets,'Cabinet artwork');
});
test('Playfield images exist and are unique for each machine',()=>{
  hashesForAssets(playfields,'Playfield artwork');
});
