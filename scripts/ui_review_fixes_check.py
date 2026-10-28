"""
UI check con Playwright — verificación de los fixes pendientes del review
de Web Interface Guidelines:

1. Validación de URLs inline en Form: error junto al campo, focus al campo,
   sin toast, aria-invalid y limpieza al editar.
2. color-scheme: dark aplicado al documento.
3. touch-action: manipulation en controles interactivos.
4. Virtualización barata: content-visibility: auto en filas de canción y
   overscroll-contain en los contenedores scrollables.

Uso: .venv/bin/python scripts/ui_review_fixes_check.py
"""

import http.server
import socketserver
import threading

from playwright.sync_api import sync_playwright

PORT = 8033
BASE = f"http://127.0.0.1:{PORT}"
DIST = "backend/frontend"

# Cola con un job de playlist para renderizar el tracklist (.cv-auto)
JOBS = [
    {
        "id": "job-1",
        "url": "https://music.youtube.com/playlist?list=PLsmoke",
        "mode": "audio",
        "status": "downloading",
        "progress": 50,
        "speed": 1048576,
        "eta": 60,
        "current_title": "Playlist Fix (Check)",
        "playlist_title": "Playlist Fix (Check)",
        "is_playlist": True,
        "item_index": 1,
        "item_count": 2,
        "error": None,
        "songs": [
            {"index": 1, "title": "Cancion completada", "status": "completed", "progress": 100, "speed": None, "eta": None, "filePath": ""},
            {"index": 2, "title": "Cancion descargandose", "status": "downloading", "progress": 50, "speed": 1048576, "eta": 60, "filePath": None},
        ],
    },
]

failures = []


def check(name: str, cond: bool, detail: str = ""):
    tag = "PASS" if cond else "FAIL"
    print(f"[{tag}] {name}{(' — ' + detail) if detail else ''}")
    if not cond:
        failures.append(name)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST, **kwargs)

    def log_message(self, *args):
        pass


with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1440, "height": 900})

            page.route("**/api/jobs", lambda route: (
                route.fulfill(json=JOBS, headers={"content-type": "application/json"})
                if route.request.method == "GET"
                else route.fulfill(json={}, headers={"content-type": "application/json"})
            ))
            page.goto(BASE, wait_until="networkidle")

            # ---------- 1) Validación inline ----------
            urls = page.locator("#urls")
            urls.fill("https://example.com/watch?v=nope")
            page.get_by_role("button", name="Descargar").click()
            page.wait_for_selector("#urls-error")

            err = page.locator("#urls-error")
            check("error inline visible junto al campo", err.is_visible())
            check("mensaje con fix/next step", "Solo se aceptan" in err.inner_text())
            check("focus en el campo tras submit fallido",
                  page.evaluate("document.activeElement?.id") == "urls")
            check("textarea con aria-invalid", urls.get_attribute("aria-invalid") == "true")
            check("sin toast de error (antiguo)", page.get_by_text("Alguno de los enlaces").count() == 0)
            check("sin contenedor de toasts activo",
                  page.locator('div[aria-label="Notificaciones"] > div').count() == 0)

            # editar limpia el error; submit de URL válida no lo regenera
            urls.fill("https://youtube.com/watch?v=ok")
            check("error se limpia al editar", page.locator("#urls-error").count() == 0)
            page.get_by_role("button", name="Descargar").click()
            page.wait_for_selector('button:has-text("Descargar")', state="visible")
            check("envío válido: sin error", page.locator("#urls-error").count() == 0)

            # ---------- 2) color-scheme: dark ----------
            scheme = page.evaluate("getComputedStyle(document.documentElement).colorScheme")
            check("color-scheme: dark en <html>", scheme == "dark", f"got: {scheme}")

            # ---------- 3) touch-action ----------
            for name, sel in (("submit", 'button:has-text("Descargar")'), ("input", "#urls")):
                ta = page.locator(sel if sel != "#urls" or urls.count() else sel).first \
                    if False else page.locator(sel).first
                val = ta.evaluate("el => getComputedStyle(el).touchAction")
                check(f"touch-action manipulation en {name}", val == "manipulation", f"got: {val}")

            # ---------- 4) virtualización / overscroll ----------
            row = page.locator("li.cv-auto").first
            check("fila de canción con content-visibility: auto",
                  row.evaluate("el => getComputedStyle(el).contentVisibility") == "auto")

            tracklist = page.locator("aside .overscroll-contain").first
            check("overscroll-contain en tracklist del aside",
                  tracklist.evaluate("el => getComputedStyle(el).overscrollBehavior") == "contain")

            row_num = page.locator("li.cv-auto").count()
            check("filas de canción con cv-auto", row_num >= 2, f"encontradas: {row_num}")

            browser.close()
    finally:
        httpd.shutdown()

print()
if failures:
    print(f"✗ {len(failures)} checks fallaron: {failures}")
    raise SystemExit(1)
print("✓ Fixes del review verificados en navegador — todo verde")
