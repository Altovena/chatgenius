import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const home = read('index.html'), lab=read('lab/index.html'), demosites=read('demosites/index.html');
const resolveFile = (url) => {
  const clean = url.split(/[?#]/)[0].replace(/^\//,'');
  if (!clean) return fs.existsSync(path.join(root,'index.html'));
  if (clean.startsWith('#')) return null;
  const relative = clean.replace(/\/$/, '/index.html');
  return fs.existsSync(path.join(root,relative)) && fs.statSync(path.join(root,relative)).isFile();
};
test('home and lab have unique headings and proper page language',()=>{
  for(const page of [home,lab]){
    assert.match(page,/<html lang="no">/);
    assert.equal((page.match(/<h1(?:\s|>)/g)||[]).length,1);
    assert.match(page,/<meta name="description"/);
    assert.match(page,/<link rel="canonical"/);
  }
});
test('home and Lab internal anchor paths resolve to repository files',()=>{
  for (const [name, page] of [['home',home],['lab',lab]]){
    const found = [...page.matchAll(/href="(\/[^"]*)"/g)].map(m=>m[1]).filter(x=>!x.startsWith('//'));
    for(const url of found) {
      if(url==='/privacy-policy') continue; // handled by Vercel rewrite
      assert.ok(resolveFile(url),name+': unresolved link '+url);
    }
  }
});
test('local images, scripts and CSS resolve',()=>{
  for (const [name,page] of [['home',home],['lab',lab]]){
    const refs=[...page.matchAll(/(?:src|href)="(\/[^"]+\.(?:svg|jpg|jpeg|png|js|css))"/g)].map(m=>m[1]);
    for(const url of refs) assert.ok(resolveFile(url),name+': missing asset '+url);
  }
});
test('DemoSites receives only nonempty company query in existing form',()=>{
  assert.match(home, /name="company"/);
  assert.match(home, /action="\/demosites\/"/);
  assert.match(demosites, /URLSearchParams\(window.location.search\)\.get\('company'\)/);
  assert.match(demosites, /#order-form \[name="site_or_name"\]/);
});
test('Lab preserves original games and apps routes',()=>{
  assert.match(lab,/href="\/spill\/"/);
  assert.match(lab,/href="\/apper\/"/);
  assert.match(lab,/href="\/spill\/sjakk\/"/);
});
