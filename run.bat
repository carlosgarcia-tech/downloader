@echo off
cd /d "%~dp0"

if not exist ".venv" (
  echo Creando entorno virtual...
  python -m venv .venv
)

call .venv\Scripts\activate.bat
pip install -q -r requirements.txt

if not exist "data" mkdir data

echo.
echo Abre http://localhost:8000 en tu navegador
echo.
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000