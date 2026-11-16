#!/usr/bin/env python3
"""Public DemoSites browser audit. Does not create orders, submit forms or change data."""
import asyncio
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlencode

from playwright.async_api import async_playwright

BASE = os.environ.get("DEMOSITES_BASE_URL", "https://realtyflow.chatgenius.pro").rstrip("/")
CATALOG = os.environ.get("DEMOSITES_CATALOG_URL", "https://www.chatgenius.pro/demosites/")
OUT = Path(os.environ.get("DEMOSITES_QA_OUTPUT", "artifacts/demosites-browser"))
OUT.mkdir(parents=True, exist_ok=True)

DESIGNS = [
    ("cinematic", "showcase-cinematic-2026", {}),
    ("bento", "showcase-bento-2026", {}),
    ("atelier", "showcase-atelier-2026", {}),
    ("kinetic", "showcase-kinetic-2026", {}),
    ("panorama", "showcase-panorama-2026", {}),
    ("mosaic", "showcase-atelier-2026", {"layout": "mosaic", "style": "warm"}),
    ("signal", "showcase-kinetic-2026", {"layout": "signal", "style": "tech"}),
    ("split", "showcase-cinematic-2026", {"layout": "split", "style": "modern"}),
    ("fullbleed", "showcase-cinematic-2026", {"layout": "fullbleed", "style": "warm"}),
    ("editorial", "showcase-cinematic-2026", {"layout": "editorial", "style": "elegant"}),
]
VIEWPORTS = {
    "desktop": dict(viewport={"width": 1440, "height": 900}, device_scale_factor=1),
    "mobile": dict(viewport={"width": 390, "height": 844}, device_scale_factor=1, is_mobile=True, has_touch=True),
}

async def audit_design(browser, name, token, params, device, options):
    result = {"design": name, "device": device, "checks": {}, "errors": []}
    context = await browser.new_context(**options, reduced_motion="reduce")
    page = await context.new_page()
    query = urlencode({**params, "present": "1"})
    url = f"{BASE}/demosites/preview/{token}?{query}"
    result["url"] = url
    image_path = OUT / f"{name}-{device}.png"
    try:
        response = await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        result["http_status"] = response.status if response else None
        try:
            await page.locator("h1").first.wait_for(state="visible", timeout=16000)
        except Exception:
            pass
        await page.evaluate("document.fonts.ready")
        await page.wait_for_timeout(1000)
        title = await page.title()
        h1 = [value.strip() for value in await page.locator("h1").all_text_contents()]
        body = (await page.locator("body").inner_text())[:2000]
        root = await page.locator(".signature-site").count()
        result.update(title=title, h1=h1, signature_roots=root)
        result["checks"]["successful_http"] = result["http_status"] == 200
        result["checks"]["visible_heading"] = bool(h1 and h1[0])
        result["checks"]["substantive_content"] = len(body.strip()) > 180
        result["checks"]["not_auth_or_error_page"] = not any(
            term in (title+" "+body).lower()
            for term in ["vercel authentication", "authentication required", "404: this page", "application error"]
        )
        if name in {"cinematic", "bento", "atelier", "kinetic", "panorama", "mosaic", "signal"}:
            result["checks"]["signature_renderer"] = root > 0
        layout_metrics = await page.evaluate("""() => ({
          viewport: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          headingSize: document.querySelector('h1') ? parseFloat(getComputedStyle(document.querySelector('h1')).fontSize) : null,
          ctaBottom: document.querySelector('#top a[href="#kontakt"]')?.getBoundingClientRect().bottom ?? null,
        })""")
        result["layout_metrics"] = layout_metrics
        if device == "mobile":
            result["checks"]["no_horizontal_overflow"] = layout_metrics["documentWidth"] <= layout_metrics["viewport"] + 3
        if name == "cinematic" and device == "desktop":
            # Catches the oversized 7.5rem H1 that broke "tannbehandling" inside the word.
            result["checks"]["cinematic_heading_bounded"] = (
                layout_metrics["headingSize"] is not None and layout_metrics["headingSize"] <= 96
            )
            result["checks"]["primary_cta_above_fold"] = (
                layout_metrics["ctaBottom"] is not None and layout_metrics["ctaBottom"] <= 920
            )
        # Capture even failures: visual evidence is valuable for debugging.
        await page.screenshot(path=str(image_path), animations="disabled", full_page=False)
        result["screenshot"] = image_path.name
        result["screenshot_sha256"] = hashlib.sha256(image_path.read_bytes()).hexdigest()
    except Exception as exc:
        result["errors"].append(f"{type(exc).__name__}: {exc}")
        try:
            await page.screenshot(path=str(image_path), full_page=False, timeout=8000)
            result["screenshot"] = image_path.name
        except Exception:
            pass
    finally:
        await context.close()
    result["passed"] = not result["errors"] and all(result["checks"].values())
    return result

async def audit_catalog(browser):
    result = {"design": "catalog", "device": "desktop", "checks": {}, "errors": []}
    ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
    page = await ctx.new_page()
    try:
        response = await page.goto(CATALOG, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(1100)
        result["http_status"] = response.status if response else None
        expected = [name for name, _, _ in DESIGNS]
        available = await page.locator('input[name="design_layout"]').evaluate_all(
            "(els) => els.map(el => el.value)"
        )
        result["builder_choices"] = available
        result["checks"]["successful_http"] = result["http_status"] == 200
        result["checks"]["all_ten_selectable"] = all(x in available for x in expected)
        images = await page.locator('img[src*="/assets/demosites/"]').evaluate_all(
            """async (els) => Promise.all(els.map(async el => {
              el.loading = 'eager';
              try { await el.decode(); } catch (_) {}
              return {src: el.getAttribute('src'), ok: el.complete && el.naturalWidth > 0};
            }))"""
        )
        result["thumbnail_status"] = images
        result["checks"]["local_thumbnails_load"] = bool(images) and all(x["ok"] for x in images)
        await page.screenshot(path=str(OUT/"catalog-desktop.png"), animations="disabled", full_page=False)
    except Exception as exc:
        result["errors"].append(f"{type(exc).__name__}: {exc}")
    finally:
        await ctx.close()
    result["passed"] = not result["errors"] and all(result["checks"].values())
    return result

async def main():
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        try:
            results.append(await audit_catalog(browser))
            for name, token, params in DESIGNS:
                for device, opts in VIEWPORTS.items():
                    result = await audit_design(browser, name, token, params, device, opts)
                    results.append(result)
                    print(f"{'PASS' if result['passed'] else 'FAIL'} {name} {device}: {result.get('http_status')} {result.get('h1', [])}", flush=True)
        finally:
            await browser.close()
    hashes = {}
    for result in results:
        digest = result.get("screenshot_sha256")
        if digest:
            hashes.setdefault((result.get("device"), digest), []).append(result["design"])
    duplicates = [members for members in hashes.values() if len(members) > 1]
    report = {"success": all(row["passed"] for row in results) and not duplicates,
              "results": results, "identical_screenshot_groups": duplicates}
    (OUT/"report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"success": report["success"], "failing": [r["design"]+"-"+r["device"] for r in results if not r["passed"]], "duplicates": duplicates}, ensure_ascii=False))
    raise SystemExit(0 if report["success"] else 1)

if __name__ == "__main__":
    asyncio.run(main())
