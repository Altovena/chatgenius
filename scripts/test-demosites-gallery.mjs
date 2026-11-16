import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page=fs.readFileSync("demosites/index.html","utf8");
const signatures=["cinematic","bento","atelier","kinetic","panorama"];
test("all five signature screenshots have distinct labelled fallback artwork",()=>{
 for(const name of signatures){
   assert.match(page,new RegExp('data-signature="'+name+'"'));
   assert.match(page,new RegExp('cg-signature-'+name));
   assert.ok(page.includes('showcase-'+name+'-2026'),name+" should retain real preview link");
 }
 assert.equal((page.match(/class="cg-signature-visual cg-signature-/g)||[]).length,5);
 assert.equal((page.match(/class="showcase-shot"/g)||[]).length,5);
});
test("screenshots can fail without leaving an empty gallery",()=>{
 assert.match(page,/addEventListener\('error', fallback/);
 assert.match(page,/image\.complete && image\.naturalWidth === 0/);
 assert.match(page,/preview-unavailable/);
 assert.match(page,/DESIGNSKISSE/g);
});
test("gallery contains ten layout choices with proper context",()=>{
 for(const name of [...signatures,"mosaic","signal","split","fullbleed","editorial"])
   assert.ok(page.includes('name="design_layout" value="'+name+'"'),name+" missing");
 assert.match(page,/Ti layoutvalg/);
});
