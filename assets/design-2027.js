(() => {
  "use strict";

  const root = document.body;
  if (!root.classList.contains("design-2027") && !root.classList.contains("home-2027")) return;

  const localeMatch = location.pathname.match(/^\/(de|es|fr|ru)(?:\/|$)/);
  const locale = localeMatch ? localeMatch[1] : "no";
  const prefix = locale === "no" ? "" : "/" + locale;
  const labels = {
    no: { solutions:"Løsninger", apps:"Apper", trial:"Prøveside", games:"Spill", menu:"Meny", start:"Kom i gang", usecases:"Bruksområder", guides:"Guider", cases:"Case", demos:"Demoer", integrations:"Integrasjoner", training:"AI-opplæring", seo:"SEO, AEO og GEO", about:"Om ChatGenius", contact:"Kontakt" },
    de: { solutions:"Lösungen", apps:"Apps", trial:"Testseite", games:"Spiele", menu:"Menü", start:"Loslegen", usecases:"Anwendungsfälle", guides:"Ratgeber", cases:"Cases", demos:"Demos", integrations:"Integrationen", training:"AI-Schulung", seo:"SEO, AEO & GEO", about:"Über ChatGenius", contact:"Kontakt" },
    es: { solutions:"Soluciones", apps:"Apps", trial:"Sitio de prueba", games:"Juegos", menu:"Menú", start:"Empezar", usecases:"Casos de uso", guides:"Guías", cases:"Casos", demos:"Demos", integrations:"Integraciones", training:"Formación en IA", seo:"SEO, AEO y GEO", about:"Sobre ChatGenius", contact:"Contacto" },
    fr: { solutions:"Solutions", apps:"Apps", trial:"Site d’essai", games:"Jeux", menu:"Menu", start:"Commencer", usecases:"Cas d’usage", guides:"Guides", cases:"Cas", demos:"Démos", integrations:"Intégrations", training:"Formation IA", seo:"SEO, AEO & GEO", about:"À propos", contact:"Contact" },
    ru: { solutions:"Решения", apps:"Приложения", trial:"Пробный сайт", games:"Игры", menu:"Меню", start:"Начать", usecases:"Сценарии", guides:"Гайды", cases:"Кейсы", demos:"Демо", integrations:"Интеграции", training:"AI-обучение", seo:"SEO, AEO и GEO", about:"О ChatGenius", contact:"Контакты" }
  }[locale];

  const path = (noPath, localizedPath = noPath) => locale === "no" ? noPath : prefix + localizedPath;
  const ensureUnifiedHeader = () => {
    let siteHeader = document.querySelector(".site-header");
    if (!siteHeader) {
      siteHeader = document.createElement("header");
      siteHeader.className = "site-header";
      siteHeader.innerHTML = '<a class="brand" href="' + prefix + '/" aria-label="ChatGenius.pro"><img src="/logo.jpeg" alt="" width="40" height="40"><span>ChatGenius.pro</span></a><nav class="site-nav" aria-label="Hovedmeny"></nav><div class="header-right"></div>';
      document.body.insertBefore(siteHeader, document.body.firstChild);
    }

    let brand = siteHeader.querySelector(".brand");
    if (!brand) {
      brand = document.createElement("a");
      brand.className = "brand";
      siteHeader.insertBefore(brand, siteHeader.firstChild);
    }
    brand.setAttribute("href", prefix + "/");
    brand.setAttribute("aria-label", "ChatGenius.pro");
    brand.innerHTML = '<img src="/logo.jpeg" alt="" width="40" height="40"><span>ChatGenius.pro</span>';

    let nav = siteHeader.querySelector(".site-nav");
    if (!nav) {
      nav = document.createElement("nav");
      nav.className = "site-nav";
      siteHeader.appendChild(nav);
    }
    nav.setAttribute("aria-label", labels.menu);
    nav.innerHTML =
      '<a href="/bruksomrader/">' + labels.solutions + '</a>' +
      '<a href="' + path("/apper/", "/apper/") + '">' + labels.apps + '</a>' +
      '<a href="' + path("/demosites/", "/demosites/") + '">' + labels.trial + '</a>' +
      '<a href="/spill/">' + labels.games + '</a>' +
      '<div class="cg-nav-dropdown">' +
        '<button class="cg-nav-trigger" type="button" aria-expanded="false">' + labels.menu + ' <span aria-hidden="true">⌄</span></button>' +
        '<div class="cg-nav-panel">' +
          '<a href="/bruksomrader/">' + labels.usecases + '</a>' +
          '<a href="/guider/">' + labels.guides + '</a>' +
          '<a href="/case/">' + labels.cases + '</a>' +
          '<a href="/demo/">' + labels.demos + '</a>' +
          '<a href="/integrasjoner/">' + labels.integrations + '</a>' +
          '<a href="/ai-opplaering/">' + labels.training + '</a>' +
          '<a href="/seo-aeo-geo/">' + labels.seo + '</a>' +
          '<a href="/om-chatgenius/">' + labels.about + '</a>' +
          '<a href="/#contact">' + labels.contact + '</a>' +
        '</div>' +
      '</div>';

    let right = siteHeader.querySelector(".header-right");
    if (!right) {
      right = document.createElement("div");
      right.className = "header-right";
      siteHeader.appendChild(right);
    }
    const lang = right.querySelector(".lang-switch");
    right.innerHTML = "";
    if (lang) right.appendChild(lang);
    const games = document.createElement("a");
    games.className = "cg-mobile-games";
    games.href = "/spill/";
    games.textContent = "🎮 " + labels.games;
    games.setAttribute("aria-label", labels.games + " – arkadespill for mobil og PC");
    right.appendChild(games);
    const cta = document.createElement("a");
    cta.className = "header-action";
    cta.href = "/kom-i-gang/";
    cta.textContent = labels.start;
    right.appendChild(cta);

    const dropdown = nav.querySelector(".cg-nav-dropdown");
    const trigger = dropdown && dropdown.querySelector(".cg-nav-trigger");
    const close = () => {
      if (!dropdown || !trigger) return;
      dropdown.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    };
    if (trigger) {
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = dropdown.classList.toggle("open");
        trigger.setAttribute("aria-expanded", String(open));
      });
    }
    document.addEventListener("click", (event) => {
      if (dropdown && !dropdown.contains(event.target)) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  };

  ensureUnifiedHeader();
  document.documentElement.classList.add("cg-nav-ready");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector(".site-header");
  const hero = document.querySelector(".hero");

  const footer = document.querySelector(".site-footer");
  if (footer && !footer.querySelector(".freddy-network")) {
    const network = document.createElement("nav");
    network.className = "freddy-network";
    network.setAttribute("aria-label", "Freddy Bremseth prosjektnettverk");
    network.innerHTML = '<strong>Freddy Bremseth network</strong>' +
      '<a href="https://www.freddybremseth.com/">FreddyBremseth.com</a>' +
      '<a href="https://www.zenecohomes.com/">Zen Eco Homes</a>' +
      '<a href="https://www.pinosoecolife.com/">Pinoso Eco Life</a>' +
      '<a href="https://www.donaanna.com/">Doña Anna</a>' +
      '<a href="https://books.freddybremseth.com/">Books</a>' +
      '<a href="https://art.freddybremseth.com/">Art</a>' +
      '<a href="https://remaster.freddybremseth.com/">Re-Master Freddy</a>';
    footer.appendChild(network);
  }

  const updateHeader = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 18);
  };
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  if (reducedMotion) return;

  const revealSelector = root.classList.contains("home-2027")
    ? ".solution-hub, .usecase-band, .demosites-promo, .sales-section, .training-section, .portfolio-section, .contact-section"
    : ".content-hero, .content-main > section, .content-aside, .solution-hub";
  const revealTargets = document.querySelectorAll(revealSelector);
  revealTargets.forEach((node) => node.classList.add("motion-reveal"));

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
    revealTargets.forEach((node) => observer.observe(node));
  } else {
    revealTargets.forEach((node) => node.classList.add("is-visible"));
  }

  let raf = 0;
  const onPointerMove = (event) => {
    if (!hero) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const rect = hero.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      const mx = (x - 0.5) * 2;
      const my = (y - 0.5) * 2;
      hero.style.setProperty("--hero-a-x", (mx * 8).toFixed(2) + "px");
      hero.style.setProperty("--hero-a-y", (my * 8).toFixed(2) + "px");
      hero.style.setProperty("--hero-b-x", (mx * -11).toFixed(2) + "px");
      hero.style.setProperty("--hero-b-y", (my * -7).toFixed(2) + "px");
      hero.style.setProperty("--hero-c-x", (mx * 12).toFixed(2) + "px");
      hero.style.setProperty("--hero-c-y", (my * -10).toFixed(2) + "px");
      hero.style.setProperty("--hero-d-x", (mx * -7).toFixed(2) + "px");
      hero.style.setProperty("--hero-d-y", (my * 11).toFixed(2) + "px");
      hero.style.setProperty("--spot-x", String((x * 100).toFixed(1)) + "%");
      hero.style.setProperty("--spot-y", String((y * 100).toFixed(1)) + "%");
    });
  };
  if (hero && root.classList.contains("home-2027")) {
    hero.addEventListener("pointermove", onPointerMove, { passive: true });
  }

  const tiltCards = document.querySelectorAll(".solution-card");
  tiltCards.forEach((card) => {
    card.classList.add("motion-card");
    card.addEventListener("pointermove", (event) => {
      if (window.innerWidth < 900) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      card.style.setProperty("--tilt-y", String(((x - 0.5) * 3.4).toFixed(2)) + "deg");
      card.style.setProperty("--tilt-x", String(((0.5 - y) * 3.0).toFixed(2)) + "deg");
    }, { passive: true });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
    });
  });
})();
