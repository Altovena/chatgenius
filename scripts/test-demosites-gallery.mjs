import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page=fs.readFileSync("demosites/index.html","utf8");
const signatures=["cinematic","bento","atelier","kinetic","panorama"];
test("all five original signature cards have distinct fallback artwork",()=>{
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

test("Atelier thumbnail is served locally in gallery and builder",()=>{
 const local="/assets/demosites/atelier-design-preview.svg";
 const usage=(page.match(/src="\/assets\/demosites\/atelier-design-preview\.svg"/g)||[]).length;
 assert.equal(usage,2,"the gallery and the builder must both use the same local image");
 assert.ok(fs.existsSync("assets/demosites/atelier-design-preview.svg"));
 const art=fs.readFileSync("assets/demosites/atelier-design-preview.svg","utf8");
 assert.match(art,/<svg[^>]*viewBox="0 0 1400 850"/);
 assert.match(art,/<title[^>]*>Atelier/);
 assert.match(page,/Designillustrasjon – åpne demoen/);
 assert.ok(page.includes("showcase-atelier-2026?present=1"),"real demo link must remain");
});

test("all seven Signature designs have stable local illustrations in both gallery and builder",()=>{
 const signatures=["cinematic","bento","atelier","kinetic","panorama","mosaic","signal"];
 for(const id of signatures){
   const local="/assets/demosites/"+id+"-design-preview.svg";
   const usage=page.split('src="'+local+'"').length-1;
   assert.equal(usage,2,id+" local image required in gallery and builder");
   const svgPath="assets/demosites/"+id+"-design-preview.svg";
   assert.ok(fs.existsSync(svgPath),svgPath+" missing");
   const svg=fs.readFileSync(svgPath,"utf8");
   assert.match(svg,/<svg\b[^>]*viewBox="0 0 1400 850"/,id+" canvas");
   assert.match(svg,/designillustrasjon/i,id+" must be labeled");
 }
});
test("Nettsider and DemoSites do not depend on third-party screenshot service",()=>{
 const websites=fs.readFileSync("nettsider/index.html","utf8");
 assert.doesNotMatch(page,/image\.thum\.io/i);
 assert.doesNotMatch(websites,/image\.thum\.io/i);
 assert.match(websites,/assets\/demosites\/cinematic-design-preview\.svg/);
 for(const layout of ["cinematic","bento","atelier","kinetic","panorama"]){
   assert.ok(page.includes("showcase-"+layout+"-2026?present=1"),layout+" demo URL must be preserved");
 }
 for(const layout of ["mosaic","signal"])
   assert.ok(page.includes("layout="+layout),layout+" variation URL must be preserved");
});
