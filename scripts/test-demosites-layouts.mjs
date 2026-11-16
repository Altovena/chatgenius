import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const builder=fs.readFileSync("demosites/index.html","utf8");
const sales=fs.readFileSync("nettsider/index.html","utf8");
const apps=fs.readFileSync("apper/index.html","utf8");
const signatures=["cinematic","bento","atelier","kinetic","panorama"];
const modern=["mosaic","signal"];
const classics=["split","fullbleed","editorial"];
test("every existing layout is selectable in Nettsider builder",()=>{
  for(const id of [...signatures,...modern,...classics]){
    assert.ok(builder.includes('name="design_layout" value="'+id+'"'),"missing layout "+id);
  }
  assert.match(builder,/name="design_layout" value="auto"/);
  assert.match(builder,/layout_variant: String\(data\.get\("design_layout"\)/);
});
test("seven Signature layouts and three classics accurately labeled",()=>{
  for(const id of signatures) assert.ok(builder.includes("showcase-"+id+"-2026"),id);
  assert.ok(builder.includes("layout=mosaic"));
  assert.ok(builder.includes("showcase-signal-studio-2026?present=1"));
  for(const id of classics)assert.ok(builder.includes("layout="+id),id);
  assert.ok(builder.includes("Ti layoutvalg"));
  assert.ok(sales.includes("Ti layoutvalg"));
  assert.match(builder,/ikke nye kundecaser/i);
});
test("Nettsider is the product menu name everywhere touched",()=>{
  assert.match(builder,/href="\/nettsider\/">Nettsider<\/a>/);
  assert.match(apps,/href="\/nettsider\/">Nettsider<\/a>/);
  assert.doesNotMatch(apps,/href="\/demosites\/" data-i18n="nav_trial">Prøveside/);
});
