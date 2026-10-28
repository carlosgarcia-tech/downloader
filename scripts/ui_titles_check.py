"""
UI check con Playwright — verifica que los títulos se renderizan literalmente
(sin doble escape HTML) tras eliminar escapeHtml() de JobItem.tsx.

Arranca un servidor estático sobre el build (backend/frontend) y mockea
GET /api/jobs devolviendo un job cuyo título, playlist, URL y error contienen
los caracteres que antes se escapaban: &, <, >, comillas simples y dobles.

Uso: .venv/bin/python scripts/ui_titles_check.py
"""

import http.server
import socketserver
import threading

from playwright.sync_api import sync_playwright

PORT = 8032
BASE = f"http://127.0.0.1:{PORT}"
DIST = "backend/frontend"

# Todos los valores contienen los caracteres que escapeHtml() convertía en
# entidades: si quedara doble escape, en pantalla se vería "&amp;" / "&lt;".
TRICKY = 'Rock & Roll <Clásico> "Vol. 2"'
FLAG = TRICKY

JOBS = [
    {
        "id": "job-1",
        "url": "https://music.youtube.com/watch?v=abc&list=oly<mpics>",
        "mode": "audio",
        "status": "downloading",
        "progress": 43,
        "speed": 1048576,
        "eta": 95,
        "current_title": FLAG,
        "playlist_title": "Éxitos & <Rarezas> \"80s\"",
        "is_playlist": True,
        "item_index": 2,
        "item_count": 4,
        "error": None,
        "songs": [
            {"index": 1, "title": "Cumbia & Lamento <remaster>", "status": "completed", "progress": 100, "speed": None, "eta": None, "filePath": ""},
            {"index": 2, "title": FLAG, "status": "downloading", "progress": 43, "speed": 1048576, "eta": 95, "filePath": None},
        ],
    },
    {
        "id": "job-2",
        "url": "https://youtube.com/watch?v=err&ctx='fault'>",
        "mode": "video",
        "status": "error",
        "progress": 0,
        "current_title": "Video con <error> & \"falla\"",
        "error": "http 403 & contextual <bloqueado> por geo'zona\"",
        "is_playlist": False,
        "songs": None,
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
            page.route("**/api/jobs", lambda route: route.fulfill(
                json=JOBS, headers={"content-type": "application/json"}))
            page.goto(BASE, wait_until="networkidle")

            body = page.locator("body").inner_text()

            check("título del job se muestra literal",
                  FLAG in body, f"esperado: {FLAG}")
            entities = ("&amp;", "&lt;", "&gt;", "&quot;", "&#039;",
                        "amp;", "lt;", "gt;", "quot;", "039;")
            visibles = [e for e in entities if e in body]
            check("sin entidades HTML visibles", not visibles,
                  f"entidades en pantalla: {visibles}" if visibles else "")

            card = page.locator("li", has_text=FLAG).first
            check("tarjeta del job presente", card.is_visible())
            check("URL excluida de la comparación de título",
                  card.get_by_text(FLAG).count() >= 1)

            # Expandir detalles: título de canción tricky y título de playlist
            card.get_by_role("button", name="Ver detalles").click()
            page.wait_for_selector("text=Cumbia & Lamento <remaster>")
            body_x = page.locator("body").inner_text()
            check("título de canción con & < literal",
                  "Cumbia & Lamento <remaster>" in body_x)
            check("título de playlist con & < \" literal",
                  "Éxitos & <Rarezas> \"80s\"" in body_x)

            # Job con error: mensaje mostrado literal
            err_card = page.locator("li", has_text="Video con <error>").first
            check("tarjeta de error presente", err_card.is_visible())
            check("mensaje de error literal",
                  "http 403 & contextual <bloqueado>" in body_x)

            browser.close()
    finally:
        httpd.shutdown()

print()
if failures:
    print(f"✗ {len(failures)} checks fallaron: {failures}")
    raise SystemExit(1)
print("✓ Títulos renderizados sin doble escape — todo verde")
