#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "Creando entorno virtual..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

mkdir -p data

echo ""
echo "Abre http://localhost:8000 en tu navegador"
echo ""
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000