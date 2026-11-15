import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(import.meta.dirname,"..");
const pages=["nettsider/index.html","spill/index.html","apper/index.html","skreddersydde-ai-systemer/index.html"];
const routes=["/nettsider/","/spill/","/apper/","/skreddersydde-ai-systemer/"];
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const exists=url=>{
 const p=url.split(/[?#]/)[0];
 if(p==="/")return fs.existsSync(path.join(root,"index.html"));
 const rel=p.replace(/^\//,"").replace(/\/$/,"/index.html");
 return !!rel&&fs.existsSync(path.join(root,rel))&&fs.statSync(path.join(root,rel)).isFile();
};
test("all product pages retain one H1, canonical and new navigation",()=>{
 pages.forEach((file,i)=>{
  const html=read(file);
  assert.equal((html.match(/<h1\b/g)||[]).length,1,file+" H1");
  assert.match(html,/rel="canonical"/,file);
  assert.match(html,/assets\/product-hubs\.css/,file);
  assert.match(html,/cg-product-hub/,file);
  for(const route of routes) assert.ok(html.includes('href="'+route+'"')||html.includes('href="'+route+'" aria-current="page"'),file+" must include "+route);
 });
});
test("navigation, shared asset and crosslinks are valid",()=>{
 for(const file of pages){
  const html=read(file);
  for(const [,url] of html.matchAll(/href="(\/[^"]+)"/g)){
   if(url==="/privacy-policy")continue;
   assert.ok(exists(url),file+" broken link: "+url);
  }
  assert.match(html,/cg-hub-crosslinks/,file);
 }
 assert.ok(fs.statSync(path.join(root,"assets/product-hubs.css")).size<12000);
});
test("new presentation does not modify core games and app runtime declarations",()=>{
 const games=read("spill/index.html");
 const apps=read("apper/index.html");
 const custom=read("skreddersydde-ai-systemer/index.html");
 const websites=read("nettsider/index.html");
 for(const route of ["/spill/arcade-hall/","/spill/flipperhall/","/spill/sjakk/"])assert.ok(games.includes(route));
 assert.match(apps,/function mergeCatalog\(apiApps\)/);
 assert.match(apps,/lastApps = mergeCatalog\(\[\]\);\s*render\(lastApps\);/);
 assert.match(apps,/fetch\(API_BASE \+ "\/api\/saas\/subscribe"\)/);
 assert.match(websites,/action="\/demosites\/"/);
 assert.match(websites,/name="company"/);
 assert.match(custom,/human-in-the-loop|Human-in-the-loop/i);
});
