"""
UI smoke test con Playwright — lanza un navegador real contra el servidor
de humo (http://127.0.0.1:8031) y verifica el rediseño Premium:

1. Desktop 1440x900: página centrada, form, cola con thumbnail del job demo.
2. Sidebar sticky con hero de playlist (título + contador de pistas).
3. "Ver detalles" expande la lista completa con los 4 estados por canción.
4. Mobile 390x844: sidebar oculta, contenido a ancho casi total.

Uso: .venv/bin/python scripts/ui_smoke.py
Screenshots: /tmp/gzwave/smoke/*.png
"""

import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8031"
OUT = "/tmp/gzwave/smoke"

failures = []


def check(name: str, cond: bool, detail: str = ""):
    tag = "PASS" if cond else "FAIL"
    print(f"[{tag}] {name}{(' — ' + detail) if detail else ''}")
    if not cond:
        failures.append(name)


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---------------- Desktop 1440x900 ----------------
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(BASE, wait_until="networkidle")

    check("header 'GZWave' visible",
          page.get_by_role("heading", name="GZWave").is_visible())

    # El contenedor principal debe quedar centrado: márgenes izq ≈ der
    box = page.locator("main").first.bounding_box()
    if box:
        margin = 1440 - box["x"] - box["width"]
        check("contenedor centrado (márgenes simétricos)",
              abs(box["x"] - margin) <= 2,
              f"izq={box['x']:.0f}px der={margin:.0f}px ancho={box['width']:.0f}px")
    else:
        check("contenedor <main> existe", False)

    check("textarea de enlaces presente", page.locator("#urls").count() == 1)
    check("botón Pegar visible", page.get_by_text("Pegar").is_visible())

    # Job demo en la cola, con su miniatura de playlist como preview
    card = page.locator("li", has_text="Playlist Demo (Smoke)").first
    check("job demo en la cola", card.is_visible())
    check("thumbnail renderizado en la tarjeta",
          card.locator('img[src^="data:image/svg+xml"]').count() == 1)

    # Sidebar sticky con el hero de la playlist
    aside = page.locator("aside")
    check("sidebar preview visible (desktop)", aside.is_visible())
    check("hero con título de playlist",
          aside.get_by_text("Playlist Demo (Smoke)").is_visible())
    check("contador de pistas en hero", aside.get_by_text(r"4 pistas").is_visible())
    aside.screenshot(path=f"{OUT}/sidebar.png")

    # Botón Ver detalles → expande la página con las 4 canciones y estados
    detalles = page.get_by_role("button", name="Ver detalles")
    check("botón Ver detalles visible", detalles.is_visible())
    detalles.click()
    page.wait_for_selector("text=Cancion completada")

    body = card.inner_text()
    for titulo in ("Cancion completada", "Cancion descargandose",
                   "Cancion en espera", "Cancion con falla"):
        check(f"detalle: '{titulo}' en el desglose", titulo in body)
    low = body.lower()
    check("badge 'En espera' visible", "en espera" in low)
    check("estados Completado/Descargando/Error visibles",
          all(s in low for s in ("completado", "descargando", "error")))
    check("porcentajes de progreso visibles", "100%" in body and "43%" in body)

    card.screenshot(path=f"{OUT}/detalles.png")
    page.screenshot(path=f"{OUT}/desktop.png", full_page=True)

    # ---------------- Mobile 390x844 ----------------
    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.goto(BASE, wait_until="networkidle")
    aside_m = mobile.locator("aside")
    check("sidebar oculta en mobile",
          (not aside_m.is_visible()) if aside_m.count() else True)
    mbox = mobile.locator("main").first.bounding_box()
    if mbox:
        check("mobile: contenido a ancho casi total",
              mbox["width"] >= 390 - 33,  # px-4 → 16px por lado
              f"ancho={mbox['width']:.0f}px de 390px")
    else:
        check("mobile: <main> presente", False)
    mobile.screenshot(path=f"{OUT}/mobile.png", full_page=True)

    browser.close()

print()
if failures:
    print(f"✗ {len(failures)} checks fallaron: {failures}")
    sys.exit(1)
print("✓ Smoke UI completo — todo verde")
