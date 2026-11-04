/* Consent preferences: analytics and marketing are off until explicitly enabled. */
(function () {
  "use strict";
  var key = "chatgenius:cookie-consent:v1";
  function choice() { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; } }
  window.chatgeniusAnalyticsAllowed = function () { return choice()?.analytics === true; };
  function init() {
    var trigger = document.createElement("button");
    trigger.textContent = "Kapselvalg";
    trigger.setAttribute("aria-label", "Endre informasjonskapsler");
    trigger.style.cssText = "position:fixed;bottom:12px;left:12px;z-index:99990;background:#fff;color:#244a3a;border:1px solid #aaa;border-radius:30px;padding:8px 12px;cursor:pointer;font:12px sans-serif";
    document.body.appendChild(trigger);
    var shade = document.createElement("div");
    shade.style.cssText = "position:fixed;inset:0;z-index:99999;background:#0009;display:none;align-items:flex-end;justify-content:center;padding:16px;box-sizing:border-box";
    var panel = document.createElement("section");
    panel.setAttribute("role", "dialog");panel.setAttribute("aria-modal", "true");panel.setAttribute("aria-label", "Valg av informasjonskapsler");
    panel.style.cssText = "max-width:720px;width:100%;background:#fff;color:#172c26;padding:24px;border-radius:16px;box-sizing:border-box;box-shadow:0 10px 40px #0004;font:15px/1.5 system-ui,sans-serif";
    panel.innerHTML = '<h2 style="margin:0 0 12px;font:700 23px/1.3 system-ui,sans-serif;color:#172c26">Vi respekterer personvernet ditt</h2><p>Vi bruker nødvendige informasjonskapsler for grunnleggende funksjoner. Analyse og markedsføring er valgfrie og aktiveres bare etter samtykke.</p><div data-options hidden style="margin:16px 0"><label style="display:block;margin:8px 0"><input type="checkbox" checked disabled> Nødvendige (alltid aktive)</label><label style="display:block;margin:8px 0"><input data-analytics type="checkbox"> Analyse og besøksstatistikk</label><label style="display:block;margin:8px 0"><input data-marketing type="checkbox"> Markedsføring (ingen annonsetagger er aktivert nå)</label></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button data-reject type="button">Avvis</button><button data-settings type="button">Innstillinger</button><button data-accept type="button">Godta alle</button></div>';
    panel.querySelectorAll("button").forEach(function (button) { button.style.cssText = "padding:10px 15px;border:1px solid #82918b;border-radius:8px;background:#f5f8f6;color:#172c26;cursor:pointer;font:600 14px system-ui,sans-serif"; });
    panel.querySelector("[data-accept]").style.cssText += ";background:#286e52;color:white;border-color:#286e52";
    shade.appendChild(panel); document.body.appendChild(shade);
    var opts = panel.querySelector("[data-options]");
    var a = panel.querySelector("[data-analytics]");
    var m = panel.querySelector("[data-marketing]");
    var settings = panel.querySelector("[data-settings]");
    function show(edit) { var saved = choice(); a.checked = saved?.analytics === true; m.checked = saved?.marketing === true; opts.hidden = !edit; settings.textContent = edit ? "Lagre valg" : "Innstillinger"; shade.style.display = "flex"; trigger.hidden = true; }
    function save(analytics, marketing) {
      try { localStorage.setItem(key, JSON.stringify({ analytics: analytics, marketing: marketing, savedAt: new Date().toISOString() })); } catch (_) {}
      shade.style.display = "none"; trigger.hidden = false;
      window.dispatchEvent(new Event("chatgenius:cookie-consent-changed"));
      if (!analytics && document.querySelector('script[src*="googletagmanager.com/gtag"]')) location.reload();
    }
    trigger.addEventListener("click", function () { show(true); });
    panel.querySelector("[data-reject]").addEventListener("click", function () { save(false, false); });
    panel.querySelector("[data-accept]").addEventListener("click", function () { save(true, true); });
    settings.addEventListener("click", function () { if (opts.hidden) { opts.hidden = false; settings.textContent = "Lagre valg"; } else save(a.checked, m.checked); });
    if (!choice()) show(false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* Measure public ChatGenius source arrivals without tracking individuals.
 * The actual referrer URL, searches, conversations and URL queries stay in
 * the browser. An arrival is captured only after RealtyFlow confirms storage.
 */
(function () {
  "use strict";
  if (!window.chatgeniusAnalyticsAllowed?.()) return;
  var current = window.location;
  if (current.protocol !== "https:" ||
      !/^(?:www\.)?chatgenius\.pro$/i.test(current.hostname)) return;

  var path = current.pathname || "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 220 ||
      /[\x00-\x1f@?#]/.test(path) ||
      /%(?:00|0[0-9a-f]|1[0-9a-f]|2f|3f|23|40)/i.test(path) ||
      /^\/(?:api|app|admin|auth|account|konto|crm|min-side|nedlasting|avtale|checkout|private)(?:\/|\.|$)/i.test(path) ||
      /(?:^|\/)(?:nedlasting|avtale)(?:\.html)?$/i.test(path)) return;

  var raw = document.referrer || "";
  if (!raw || raw.length > 4096) return;
  var source;
  var host;
  try {
    var origin = new URL(raw);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.port) return;
    host = origin.hostname.toLowerCase();
    var known = [
      [/^gemini\.google\.com$/i, "google_gemini"],
      [/(^|\.)google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/i, "google_search"],
      [/(^|\.)bing\.com$/i, "bing_search"],
      [/(^|\.)chatgpt\.com$/i, "chatgpt"],
      [/^copilot\.microsoft\.com$/i, "microsoft_copilot"],
      [/(^|\.)perplexity\.ai$/i, "perplexity"],
      [/^search\.brave\.com$/i, "brave_search"],
      [/(^|\.)duckduckgo\.com$/i, "duckduckgo"]
    ];
    for (var i = 0; i < known.length; i++) {
      if (known[i][0].test(host)) { source = known[i][1]; break; }
    }
    if (!source) return;
  } catch (_) { return; }

  var storageKey = "chatgenius:search-discovery:" + path + ":" + source;
  try {
    if (window.sessionStorage.getItem(storageKey)) return;
  } catch (_) {
    // Unavailable session storage is not evidence that a visit was measured.
  }

  void fetch("https://realtyflow.chatgenius.pro/api/public/search-discovery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: path, referrer: "https://" + host + "/" }),
    keepalive: true
  }).then(function (response) {
    if (response.status !== 204) return;
    try {
      window.sessionStorage.setItem(storageKey, "1");
      window.sessionStorage.setItem("chatgenius:discovery-source", source);
      window.sessionStorage.setItem("chatgenius:discovery-landing", path);
    } catch (_) {}
  }).catch(function () {});
})();


/* Website conversion tracking.
 * Records only coarse CTA categories and optional known search/AI attribution
 * already captured by the arrival tracker. No user IDs, IPs, email addresses,
 * query strings or raw external URLs are sent.
 */
(function () {
  "use strict";
  var current = window.location;
  if (current.protocol !== "https:" ||
      !/^(?:www\.)?chatgenius\.pro$/i.test(current.hostname)) return;
  if (!document || typeof document.addEventListener !== "function") return;

  function cleanPath(value) {
    if (!value || typeof value !== "string") return "";
    try {
      var u = new URL(value, current.origin);
      if (u.origin !== current.origin) return u.pathname || "";
      return u.pathname || "/";
    } catch (_) {
      return "";
    }
  }

  function classifyLink(anchor) {
    var href = anchor.getAttribute("href") || "";
    if (!href) return null;

    if (/^mailto:post@chatgenius\.pro(?:\?|$)/i.test(href)) {
      return { eventType: "email", target: "email_contact" };
    }
    if (/^https:\/\/appointment\.chatgenius\.pro\/booking\.html(?:\?|$)/i.test(href)) {
      return { eventType: "booking", target: "booking" };
    }
    if (/^https:\/\/realtyflow\.chatgenius\.pro\/demo\/?(?:\?|$)/i.test(href)) {
      return { eventType: "demo", target: "realtyflow_demo" };
    }
    if (/^https:\/\/family\.chatgenius\.pro\/demo\/?(?:\?|$)/i.test(href)) {
      return { eventType: "demo", target: "family_demo" };
    }
    if (/^https:\/\/remaster\.freddybremseth\.com\/demo\/?(?:\?|$)/i.test(href)) {
      return { eventType: "demo", target: "remaster_demo" };
    }

    var path = cleanPath(href);
    if (path === "/kom-i-gang/" || path === "/kom-i-gang") return { eventType: "next_step", target: "getting_started" };
    if (path === "/demo/" || path === "/demo") return { eventType: "demo", target: "demo_hub" };
    if (path === "/demosites/demo/" || path === "/demosites/demo") return { eventType: "demo", target: "demosites_demo" };
    if (path === "/demosites/" || path === "/demosites") return { eventType: "trial", target: "demosites_trial" };
    if (href === "#contact" || href === "/#contact") return { eventType: "contact", target: "contact_section" };
    return null;
  }

  document.addEventListener("click", function (event) {
    if (!window.chatgeniusAnalyticsAllowed?.()) return;
    var node = event.target;
    if (!node || typeof node.closest !== "function") return;
    var anchor = node.closest("a[href]");
    if (!anchor) return;
    var classified = classifyLink(anchor);
    if (!classified) return;

    var pagePath = current.pathname || "/";
    var dedupeKey = "chatgenius:conversion:" + pagePath + ":" + classified.target;
    try {
      if (window.sessionStorage.getItem(dedupeKey)) return;
    } catch (_) {}

    var discoverySource = null;
    var landingPath = null;
    try {
      discoverySource = window.sessionStorage.getItem("chatgenius:discovery-source") || null;
      landingPath = window.sessionStorage.getItem("chatgenius:discovery-landing") || null;
    } catch (_) {}

    void fetch("https://realtyflow.chatgenius.pro/api/public/conversion-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: classified.eventType,
        target: classified.target,
        path: pagePath,
        discoverySource: discoverySource,
        landingPath: landingPath
      }),
      keepalive: true
    }).then(function (response) {
      if (response.status !== 204) return;
      try { window.sessionStorage.setItem(dedupeKey, "1"); } catch (_) {}
    }).catch(function () {});
  }, { passive: true });
})();
