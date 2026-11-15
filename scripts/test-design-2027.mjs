import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("assets/design-2027.css", "utf8");
const js = fs.readFileSync("assets/design-2027.js", "utf8");

test("homepage pilot loads the scoped 2027 design system", () => {
  assert.match(html, /<body class="home-2027 home-conversion">/);
  assert.match(html, /href="assets\/design-2027\.css"/);
  assert.match(html, /src="assets\/design-2027\.js"/);
  assert.match(css, /body\.home-2027/);
});

test("design pilot preserves core SEO identity and conversion paths", () => {
  assert.equal((html.match(/<h1\b/gi) || []).length, 1);
  assert.match(html, /rel="canonical" href="https:\/\/www\.chatgenius\.pro\/"/);
  assert.match(html, /href="\/demo\/"/);
  assert.match(html, /href="\/case\/"/);
  assert.match(html, /href="\/kom-i-gang\/"/);
  assert.match(html, /application\/ld\+json/i);
});

test("motion layer is progressive and respects reduced motion", () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(js, /prefers-reduced-motion:\s*reduce/);
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /requestAnimationFrame/);
});

test("2027 palette avoids legacy neon glow as the primary visual language", () => {
  assert.match(css, /--glow:\s*none/);
  assert.match(css, /--ds27-sand:/);
  assert.match(css, /--ds27-sage:/);
  assert.match(css, /--ds27-cobalt:/);
  assert.doesNotMatch(css, /text-shadow:\s*0\s+0\s+[2-9][0-9]px/i);
});


const contentPages = [
  "demo/index.html",
  "demo/realtyflow/index.html",
  "demo/familyhub/index.html",
  "demo/olivia/index.html",
  "demo/remaster/index.html",
  "demo/corporate-intelligence/index.html",
  "demosites/demo/index.html",
  "guider/index.html",
  "guider/slik-kommer-bedriften-i-gang-med-ai/index.html",
  "guider/hva-er-en-ai-agent/index.html",
  "guider/ai-automatisering-eksempler/index.html",
  "guider/chatgpt-claude-gemini-perplexity-bedrift/index.html",
  "case/index.html",
  "case/realtyflow/index.html",
  "case/olivia/index.html",
  "case/corporate-intelligence/index.html",
  "case/demosites/index.html",
  "case/familyhub/index.html",
  "case/remaster-reels/index.html",
  "integrasjoner/index.html",
  "om-chatgenius/index.html",
  "slik-jobber-vi/index.html",
  "kom-i-gang/index.html",
  "ai-opplaering/index.html",
  "ai-resepsjonist/index.html",
  "nettsider-med-ai/index.html",
  "ai-automatisering/index.html",
  "skreddersydde-ai-systemer/index.html",
  "bruksomrader/index.html",
  "ai-for-sma-bedrifter/index.html",
  "ai-for-kundeservice/index.html",
  "ai-for-markedsforing/index.html",
  "ai-for-salg/index.html",
  "ai-for-eiendomsmeglere/index.html"
];

test("strategic content pages use the shared 2027 design layer", () => {
  for (const file of contentPages) {
    const page = fs.readFileSync(file, "utf8");
    assert.match(page, /<body class="[^"]*design-2027[^"]*"/, file + " should opt into design-2027");
    assert.match(page, /href="\/assets\/design-2027\.css"/, file + " should load shared 2027 CSS");
    assert.match(page, /src="\/assets\/design-2027\.js"/, file + " should load progressive motion layer");
  }
});

test("dynamic article surfaces use the shared 2027 design layer", () => {
  for (const file of ["api/article.js", "api/articles.js"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /design-2027 content-2027/, file + " should emit 2027 body classes");
    assert.match(source, /\/assets\/design-2027\.css/, file + " should emit 2027 CSS");
    assert.match(source, /\/assets\/design-2027\.js/, file + " should emit 2027 motion layer");
  }
});


const localizedHomePages = ["fr/index.html", "es/index.html", "de/index.html", "ru/index.html"];
test("localized homepages share the 2027 visual system without changing language content", () => {
  for (const file of localizedHomePages) {
    const page = fs.readFileSync(file, "utf8");
    assert.match(page, /<body class="design-2027 home-2027">/);
    assert.match(page, /href="\/assets\/design-2027\.css"/);
    assert.match(page, /src="\/assets\/design-2027\.js"/);
    assert.match(page, /<html lang="(?:fr|es|de|ru)">/);
  }
});

const commercialPages = [
  "apper/index.html", "fr/apper/index.html", "es/apper/index.html", "de/apper/index.html", "ru/apper/index.html",
  "demosites/index.html", "fr/demosites/index.html", "es/demosites/index.html", "de/demosites/index.html", "ru/demosites/index.html"
];
test("commercial app and DemoSites pages use the shared 2027 visual system", () => {
  for (const file of commercialPages) {
    const page = fs.readFileSync(file, "utf8");
    assert.match(page, /<body class="[^"]*design-2027[^"]*commercial-2027[^"]*"/, file + " should opt into commercial 2027 design");
    assert.match(page, /href="\/assets\/design-2027\.css"/, file + " should load 2027 CSS");
    assert.match(page, /src="\/assets\/design-2027\.js"/, file + " should load 2027 JS");
  }
});


test("design layer stays within a small performance budget", () => {
  const cssBytes = fs.statSync("assets/design-2027.css").size;
  const jsBytes = fs.statSync("assets/design-2027.js").size;
  assert.ok(cssBytes <= 48000, "2027 CSS should stay <= 48 KB, got " + cssBytes);
  assert.ok(jsBytes <= 12000, "2027 JS should stay <= 12 KB, got " + jsBytes);
});

test("cross-page transitions remain progressive and reduced-motion safe", () => {
  assert.match(css, /@view-transition\s*\{[\s\S]*navigation:\s*auto/);
  assert.match(css, /view-transition-name:\s*cg-brand/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*::view-transition-old/);
});


test("rich demo layer is lightweight and reduced-motion safe", () => {
  const demoCss = fs.readFileSync("assets/product-demo.css", "utf8");
  const demoJs = fs.readFileSync("assets/product-demo.js", "utf8");
  assert.match(demoCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(demoJs, /prefers-reduced-motion:\s*reduce/);
  assert.ok(fs.statSync("assets/product-demo.css").size <= 16000, "product demo CSS should stay <= 16 KB");
  assert.ok(fs.statSync("assets/product-demo.js").size <= 6000, "product demo JS should stay <= 6 KB");
});


test("demo feature tabs and cards define explicit readable contrast", () => {
  const css = fs.readFileSync("assets/product-demo.css", "utf8");
  assert.match(css, /\.feature-tab\{[^}]*background:#122235[^}]*color:#f5f9fc/);
  assert.match(css, /\.feature-tab\.active\{[^}]*background:#0f6fff[^}]*color:#fff/);
  assert.match(css, /\.feature-tab:focus-visible\{[^}]*outline:3px solid #8bd3ff/);
  assert.match(css, /\.feature-item strong\{[^}]*color:#19344d/);
  assert.match(css, /\.feature-item span\{[^}]*color:#4c667c/);
});
