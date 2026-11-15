import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const home=read('index.html'),websites=read('nettsider/index.html'),lab=read('lab/index.html'),demosites=read('demosites/index.html');
const isFile=url=>{
 const pathname=url.split(/[?#]/)[0];
 if(pathname==='/')return fs.existsSync(path.join(root,'index.html'));
 const relative=pathname.replace(/^\//,'').replace(/\/$/,'/index.html');
 if(!relative)return false;
 return fs.existsSync(path.join(root,relative))&&fs.statSync(path.join(root,relative)).isFile();
};
test('studio, websites and lab each have one H1 and their own canonical',()=>{
 for(const [file,html,canonical] of [['home',home,'/'],['nettsider',websites,'/nettsider/'],['lab',lab,'/lab/']]){
   assert.match(html,/<html lang="no">/,file);
   assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,file);
   assert.match(html,/<meta name="description"/,file);
   assert.ok(html.includes('rel="canonical" href="https://www.chatgenius.pro'+canonical+'"'),file);
 }
});
test('public homepage is a brand overview, with four distinct product destinations',()=>{
 assert.match(home,/Vi gjør ideer til/);
 assert.match(home,/chatboter/i);
 for(const target of ['/nettsider/','/spill/','/apper/','/skreddersydde-ai-systemer/']){
   assert.ok(home.includes('href="'+target+'"'),target);
 }
 assert.match(home,/https:\/\/altovena\.com\//);
 assert.doesNotMatch(home,/name="company"/);
 assert.doesNotMatch(home,/4 900 kr/);
});
test('all on-site links resolve to existing pages',()=>{
 for(const [name,html] of [['home',home],['nettsider',websites],['lab',lab]]){
  const urls=[...html.matchAll(/href="(\/[^"]*)"/g)].map(m=>m[1]);
  for(const url of urls){
   if(url==='/privacy-policy')continue; // explicit Vercel rewrite
   assert.ok(isFile(url),name+' broken link: '+url);
  }
 }
});
test('all local static assets resolve',()=>{
 for(const [name,html] of [['home',home],['nettsider',websites],['lab',lab]]){
  const urls=[...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:svg|jpg|jpeg|png|webp|js|css))"/g)].map(m=>m[1]);
  for(const url of urls)assert.ok(isFile(url),name+' missing: '+url);
 }
});
test('websites landing passes company name to existing DemoSites form',()=>{
 assert.match(websites,/name="company"/);
 assert.match(websites,/action="\/demosites\/"/);
 assert.match(demosites,/URLSearchParams\(window.location.search\)\.get\('company'\)/);
 assert.match(demosites,/#order-form \[name="site_or_name"\]/);
});
test('website prices are consistent with DemoSites',()=>{
 for(const [name,start,monthly] of [['Basis','4 900','490'],['Standard','7 900','990'],['Premium','14 900','1 990']]){
   const rx=new RegExp(name+'[\\s\\S]{0,190}'+start+' kr[\\s\\S]{0,150}'+monthly+' kr\\/mnd');
   assert.match(websites,rx,name);
   assert.ok(demosites.includes(start+' kr + '+monthly+' kr/mnd'),name);
 }
});
test('lab still links to games, chess and apps',()=>{
 for(const url of ['/spill/','/spill/sjakk/','/apper/'])assert.ok(lab.includes('href="'+url+'"'),url);
});
test('studio homepage loads conversion tracking and real project visual, no VM2026 hero',()=>{
 assert.match(home,/assets\/search-discovery\.js/);
 assert.match(home,/assets\/apps\/realtyflow\.jpg/);
 assert.doesNotMatch(home,/vm2026\.jpg/);
});
