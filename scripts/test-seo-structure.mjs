import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pages = [
  ["index.html", "https://www.chatgenius.pro/"],
  ["apper/index.html", "https://www.chatgenius.pro/apper/"],
  ["demo/index.html", "https://www.chatgenius.pro/demo/"],
  ["demo/realtyflow/index.html", "https://www.chatgenius.pro/demo/realtyflow/"],
  ["demo/familyhub/index.html", "https://www.chatgenius.pro/demo/familyhub/"],
  ["demo/olivia/index.html", "https://www.chatgenius.pro/demo/olivia/"],
  ["demo/remaster/index.html", "https://www.chatgenius.pro/demo/remaster/"],
  ["demo/corporate-intelligence/index.html", "https://www.chatgenius.pro/demo/corporate-intelligence/"],
  ["demosites/index.html", "https://www.chatgenius.pro/demosites/"],
  ["demosites/demo/index.html", "https://www.chatgenius.pro/demosites/demo/"],
  ["guider/index.html", "https://www.chatgenius.pro/guider/"],
  ["guider/slik-kommer-bedriften-i-gang-med-ai/index.html", "https://www.chatgenius.pro/guider/slik-kommer-bedriften-i-gang-med-ai/"],
  ["guider/hva-er-en-ai-agent/index.html", "https://www.chatgenius.pro/guider/hva-er-en-ai-agent/"],
  ["guider/ai-automatisering-eksempler/index.html", "https://www.chatgenius.pro/guider/ai-automatisering-eksempler/"],
  ["guider/chatgpt-claude-gemini-perplexity-bedrift/index.html", "https://www.chatgenius.pro/guider/chatgpt-claude-gemini-perplexity-bedrift/"],
  ["case/index.html", "https://www.chatgenius.pro/case/"],
  ["case/realtyflow/index.html", "https://www.chatgenius.pro/case/realtyflow/"],
  ["case/olivia/index.html", "https://www.chatgenius.pro/case/olivia/"],
  ["case/corporate-intelligence/index.html", "https://www.chatgenius.pro/case/corporate-intelligence/"],
  ["case/demosites/index.html", "https://www.chatgenius.pro/case/demosites/"],
  ["case/familyhub/index.html", "https://www.chatgenius.pro/case/familyhub/"],
  ["case/remaster-reels/index.html", "https://www.chatgenius.pro/case/remaster-reels/"],
  ["integrasjoner/index.html", "https://www.chatgenius.pro/integrasjoner/"],
  ["om-chatgenius/index.html", "https://www.chatgenius.pro/om-chatgenius/"],
  ["slik-jobber-vi/index.html", "https://www.chatgenius.pro/slik-jobber-vi/"],
  ["kom-i-gang/index.html", "https://www.chatgenius.pro/kom-i-gang/"],
  ["ai-opplaering/index.html", "https://www.chatgenius.pro/ai-opplaering/"],
  ["ai-resepsjonist/index.html", "https://www.chatgenius.pro/ai-resepsjonist/"],
  ["nettsider-med-ai/index.html", "https://www.chatgenius.pro/nettsider-med-ai/"],
  ["ai-automatisering/index.html", "https://www.chatgenius.pro/ai-automatisering/"],
  ["skreddersydde-ai-systemer/index.html", "https://www.chatgenius.pro/skreddersydde-ai-systemer/"],
  ["bruksomrader/index.html", "https://www.chatgenius.pro/bruksomrader/"],
  ["ai-for-sma-bedrifter/index.html", "https://www.chatgenius.pro/ai-for-sma-bedrifter/"],
  ["ai-for-kundeservice/index.html", "https://www.chatgenius.pro/ai-for-kundeservice/"],
  ["ai-for-markedsforing/index.html", "https://www.chatgenius.pro/ai-for-markedsforing/"],
  ["ai-for-salg/index.html", "https://www.chatgenius.pro/ai-for-salg/"],
  ["ai-for-eiendomsmeglere/index.html", "https://www.chatgenius.pro/ai-for-eiendomsmeglere/"]
];

for (const [file, canonical] of pages) {
  test(file + " has one clear SEO identity", () => {
    const html = fs.readFileSync(file, "utf8");
    assert.equal((html.match(/<h1\b/gi) || []).length, 1, "expected exactly one H1");
    assert.equal((html.match(/<title\b/gi) || []).length, 1, "expected exactly one title");
    assert.equal((html.match(/<meta\s+name=["']description["']/gi) || []).length, 1, "expected exactly one meta description");
    assert.equal((html.match(/rel=["']canonical["']/gi) || []).length, 1, "expected exactly one canonical");
    assert.ok(
      html.includes('href="' + canonical + '"') || html.includes("href='" + canonical + "'"),
      "expected canonical href " + canonical
    );
    assert.ok(!/noindex/i.test(html), "pillar/use-case pages should be indexable");
    assert.ok(/application\/ld\+json/i.test(html), "expected structured data");
  });
}

test("use-case pages link back to the use-case hub", () => {
  for (const [file] of pages.filter(([file]) => file.startsWith("ai-for-"))) {
    const html = fs.readFileSync(file, "utf8");
    assert.match(html, /href=["']\/bruksomrader\/["']/);
  }
});

test("homepage links to solution and use-case hubs", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /href=["']\/bruksomrader\/["']/);
  assert.match(html, /href=["']\/ai-opplaering\/["']/);
  assert.match(html, /href=["']\/ai-automatisering\/["']/);
  assert.match(html, /href=["']\/nettsider-med-ai\/["']/);
});


test("sitemap source includes all strategic cluster paths", () => {
  const source = fs.readFileSync("api/sitemap.js", "utf8");
  for (const path of [
    "/ai-opplaering/",
    "/ai-resepsjonist/",
    "/nettsider-med-ai/",
    "/ai-automatisering/",
    "/skreddersydde-ai-systemer/",
    "/bruksomrader/",
    "/ai-for-sma-bedrifter/",
    "/ai-for-kundeservice/",
    "/ai-for-markedsforing/",
    "/ai-for-salg/",
    "/ai-for-eiendomsmeglere/",
    "/demo/",
    "/demo/realtyflow/",
    "/demo/familyhub/",
    "/demo/olivia/",
    "/demo/remaster/",
    "/demo/corporate-intelligence/",
    "/demosites/demo/",
    "/guider/",
    "/guider/slik-kommer-bedriften-i-gang-med-ai/",
    "/guider/hva-er-en-ai-agent/",
    "/guider/ai-automatisering-eksempler/",
    "/guider/chatgpt-claude-gemini-perplexity-bedrift/",
    "/case/olivia/",
    "/case/corporate-intelligence/",
    "/om-chatgenius/",
    "/slik-jobber-vi/",
    "/kom-i-gang/"
  ]) assert.ok(source.includes('"' + path + '"'), "missing sitemap path " + path);
});


test("demo pages do not advertise nonexistent localized alternates", () => {
  const source = fs.readFileSync("api/sitemap.js", "utf8");
  const localizedMatch = source.match(/const localizedRoutes = \[([^\]]+)\]/);
  assert.ok(localizedMatch, "localizedRoutes declaration missing");
  assert.ok(!localizedMatch[1].includes('"/demo/"'), "demo hub has no translated routes yet");
  assert.ok(!localizedMatch[1].includes('"/demosites/demo/"'), "DemoSites walkthrough has no translated routes yet");
});


test("strategic journey pages expose a next-step path", () => {
  const files = [
    "ai-for-sma-bedrifter/index.html",
    "ai-for-kundeservice/index.html",
    "ai-for-markedsforing/index.html",
    "ai-for-salg/index.html",
    "ai-for-eiendomsmeglere/index.html",
    "ai-opplaering/index.html",
    "ai-resepsjonist/index.html",
    "nettsider-med-ai/index.html",
    "ai-automatisering/index.html",
    "skreddersydde-ai-systemer/index.html",
    "guider/slik-kommer-bedriften-i-gang-med-ai/index.html",
    "guider/hva-er-en-ai-agent/index.html",
    "guider/ai-automatisering-eksempler/index.html",
    "guider/chatgpt-claude-gemini-perplexity-bedrift/index.html",
    "case/realtyflow/index.html",
    "case/olivia/index.html",
    "case/corporate-intelligence/index.html",
    "case/demosites/index.html",
    "case/familyhub/index.html",
    "case/remaster-reels/index.html",
    "demo/index.html"
  ];
  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    assert.match(html, /href=["']\/kom-i-gang\/["']/, file + " should link to /kom-i-gang/");
  }
});


test("dynamic article surfaces expose conversion journey", () => {
  for (const file of ["api/article.js", "api/articles.js"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /\/kom-i-gang\//, file + " should link to /kom-i-gang/");
    assert.match(source, /\/demo\//, file + " should link to /demo/");
    assert.match(source, /search-discovery\.js/, file + " should load privacy-safe discovery/conversion tracker");
  }
});


test("all static strategic JSON-LD blocks parse as valid JSON", () => {
  for (const [file] of pages) {
    const html = fs.readFileSync(file, "utf8");
    const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    assert.ok(blocks.length > 0, file + " should include JSON-LD");
    for (const block of blocks) {
      assert.doesNotThrow(
        () => JSON.parse(block[1]),
        file + " contains invalid JSON-LD"
      );
    }
  }
});


test("ChatGenius about page exposes a restrained Freddy Bremseth project network", () => {
  const html = fs.readFileSync("om-chatgenius/index.html", "utf8");
  assert.match(html, /https:\/\/www\.freddybremseth\.com\/#person/);
  for (const url of [
    "https://www.freddybremseth.com/",
    "https://www.zenecohomes.com/",
    "https://www.pinosoecolife.com/",
    "https://www.donaanna.com/",
    "https://remaster.freddybremseth.com/",
    "https://books.freddybremseth.com/",
    "https://art.freddybremseth.com/"
  ]) assert.ok(html.includes(url), "missing contextual project link " + url);
  assert.match(html, /"@type":"ItemList"/);
  assert.match(html, /id="project-network"/);
});


test("homepage branded Freddy link points to the authority hub", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /href=["']https:\/\/www\.freddybremseth\.com\/["'][^>]*>Freddy Bremseth<\/a>/);
});


test("apps page keeps the complete public catalog visible", () => {
  const html = fs.readFileSync("apper/index.html", "utf8");
  for (const slug of ["astro", "family", "spanish", "vm2026", "demosites"]) {
    assert.ok(html.includes('slug: "' + slug + '"'), "missing public app " + slug);
  }
  assert.match(html, /function mergeCatalog\(apiApps\)/);
  assert.match(html, /lastApps = mergeCatalog\(\[\]\);\s*render\(lastApps\);/);
  assert.match(html, /https:\/\/family\.chatgenius\.pro\//);
  assert.match(html, /https:\/\/spanish\.chatgenius\.pro\//);
  assert.match(html, /https:\/\/vm2026\.chatgenius\.pro\//);
});


test("vertical product strategy stays explicit and evidence-led", () => {
  const homepage = fs.readFileSync("index.html", "utf8");
  const about = fs.readFileSync("om-chatgenius/index.html", "utf8");
  const cases = fs.readFileSync("case/index.html", "utf8");
  assert.match(homepage, /RealtyFlow \+ Nexus/);
  assert.match(homepage, /Olivia/);
  assert.match(homepage, /Corporate Intelligence/);
  assert.match(about, /produktiser/i);
  assert.match(cases, /produktretning|under utvikling/i);
});

test("apps availability is separate from checkout availability", () => {
  const html = fs.readFileSync("apper/index.html", "utf8");
  assert.match(html, /var isLive = app\.catalog_status === "live"/);
  assert.match(html, /a_available/);
  assert.match(html, /a_demo_price/);
  assert.match(html, /app\.subscribable/);
});


test("strategic content pages do not repeat H2 headings", () => {
  const files = [
    "guider/slik-kommer-bedriften-i-gang-med-ai/index.html",
    "guider/hva-er-en-ai-agent/index.html",
    "guider/ai-automatisering-eksempler/index.html",
    "guider/chatgpt-claude-gemini-perplexity-bedrift/index.html",
    "integrasjoner/index.html",
    "ai-for-sma-bedrifter/index.html",
    "ai-for-kundeservice/index.html",
    "ai-for-markedsforing/index.html",
    "ai-for-salg/index.html",
    "ai-for-eiendomsmeglere/index.html",
    "ai-opplaering/index.html",
    "ai-resepsjonist/index.html",
    "nettsider-med-ai/index.html",
    "ai-automatisering/index.html",
    "skreddersydde-ai-systemer/index.html"
  ];
  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
      .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase());
    const duplicates = headings.filter((heading, index) => headings.indexOf(heading) !== index);
    assert.deepEqual([...new Set(duplicates)], [], file + " has duplicate H2 headings");
  }
});

test("manual-standard content pages expose enough structure to answer and route", () => {
  for (const file of [
    "integrasjoner/index.html",
    "ai-for-sma-bedrifter/index.html",
    "ai-for-kundeservice/index.html",
    "ai-for-markedsforing/index.html",
    "ai-for-salg/index.html",
    "ai-for-eiendomsmeglere/index.html"
  ]) {
    const html = fs.readFileSync(file, "utf8");
    const h2Count = (html.match(/<h2\b/gi) || []).length;
    assert.ok(h2Count >= 8, file + " should have at least 8 useful H2 sections");
    assert.match(html, /Vanlige spørsmål/i, file + " should answer common questions");
    assert.match(html, /Neste steg|Relevante løsninger|Se .*i praksis/i, file + " should route the reader onward");
  }
});


test("localized homepages reflect ChatGenius studio positioning and Altovena link", () => {
  const expected = {
    "fr/index.html": [/Nous transformons les idées/, /produits numériques/, /ALTOVENA/],
    "es/index.html": [/Convertimos ideas/, /productos digitales/, /ALTOVENA/],
    "de/index.html": [/Wir machen Ideen/, /digitalen Produkten/, /ALTOVENA/],
    "ru/index.html": [/Превращаем идеи/, /цифровые продукты/, /ALTOVENA/],
  };
  for (const [file, patterns] of Object.entries(expected)) {
    const html = fs.readFileSync(file, "utf8");
    for (const pattern of patterns) assert.match(html, pattern, file + " missing studio positioning");
    assert.match(html, /href="\/nettsider\/"/, file + " must link to website offering");
    assert.match(html, /href="\/spill\/"/, file + " must link to games");
    assert.match(html, /href="\/apper\/"/, file + " must link to apps");
    assert.match(html, /href="\/skreddersydde-ai-systemer\/"/, file + " must link to custom software");
    assert.match(html, /href="https:\/\/altovena.com\/"/, file + " must link to professional brand");
  }
});

test("i18n build preserves manually curated localized homepages", () => {
  const build = fs.readFileSync("scripts/build-i18n.mjs", "utf8");
  assert.match(build, /manualLocales:\s*true/);
  assert.match(build, /if \(page\.manualLocales\)/);
});


test("demo hub points to public internal product tours", () => {
  const html = fs.readFileSync("demo/index.html", "utf8");
  for (const href of [
    "/demo/realtyflow/",
    "/demosites/demo/",
    "/demo/familyhub/",
    "/demo/olivia/",
    "/demo/remaster/",
    "/demo/corporate-intelligence/"
  ]) assert.ok(
    html.includes('href="' + href + '"') || html.includes("href='" + href + "'"),
    "demo hub missing " + href
  );
  assert.doesNotMatch(html, /realtyflow\.chatgenius\.pro\/demo/i);
  assert.doesNotMatch(html, /family\.chatgenius\.pro\/demo/i);
  assert.doesNotMatch(html, /remaster\.freddybremseth\.com\/demo/i);
});

test("rich product demos show five-step tours and deeper feature exploration", () => {
  for (const file of [
    "demo/realtyflow/index.html",
    "demo/familyhub/index.html",
    "demo/olivia/index.html",
    "demo/remaster/index.html",
    "demo/corporate-intelligence/index.html",
    "demosites/demo/index.html"
  ]) {
    const html = fs.readFileSync(file, "utf8");
    assert.ok((html.match(/class="tour-scene/g) || []).length >= 5, file + " should show at least five tour scenes");
    assert.match(html, /data-duration="15000"/, file + " should keep the 15-second auto tour");
    assert.match(html, /Utforsk/i, file + " should offer deeper exploration after the tour");
    assert.match(html, /product-demo\.css/, file + " should load shared demo CSS");
    assert.match(html, /product-demo\.js/, file + " should load shared demo JS");
  }
  const corporate = fs.readFileSync("demo/corporate-intelligence/index.html", "utf8");
  assert.match(corporate, /konseptdemo/i);
  assert.match(corporate, /under utvikling/i);
});
