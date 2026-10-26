"""Descargador backend package.

Makes the `app` package (backend/app) importable so the server can be started
from the repository root with:

    python -m uvicorn backend.main:app

Without this, `from app.api import ...` fails because the repo root is on
sys.path but backend/ is not.
"""

import sys
from pathlib import Path

_BACKEND_DIR = str(Path(__file__).resolve().parent)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)
