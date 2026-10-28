# GZWave

App web local para descargar audio y video desde YouTube / YouTube Music
(canciones sueltas, álbumes o playlists completas) usando `yt-dlp`, con una
cola de descargas y progreso en vivo vía WebSocket.

## Características

- **Audio** en mp3/m4a/flac con calidad configurable y carátula embebida.
- **Video** hasta la resolución que elijas (hasta 4K según el fuente).
- Cola con **progreso en tiempo real**: velocidad, ETA y pista actual de la playlist.
- Descargas simultáneas limitadas (semáforo global) para no saturar la conexión.
- Exportación de archivos descargados (`/download` individual y `/download-zip`).
- Rate limiting (100 req/min) y historial persistido en SQLite.

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | FastAPI + uvicorn, yt-dlp, SQLAlchemy 2 (async) + SQLite, pydantic-settings |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS 4 + framer-motion |
| Comunicación | REST + WebSocket (`/ws`) para eventos de cola |
| Tests | pytest + httpx (+ ruff / mypy como linters) |

## Requisitos (para desarrollo local)

1. **Python 3.9+** — [python.org](https://www.python.org/downloads/)
2. **ffmpeg** — necesario para extraer audio (mp3/flac), fusionar video+audio
   y embeber carátulas.
   - Windows: `winget install ffmpeg` (o descarga desde ffmpeg.org y agrégalo al PATH)
   - Mac: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg` (Debian/Ubuntu) o el equivalente de tu distro
3. **Node 18+** — solo si quieres modificar el frontend (ver [Frontend](#frontend)).

## Despliegue con Docker (Recomendado)

### Producción
```bash
# Construir y levantar
make prod
# o manualmente:
docker compose up -d --build
```

### Desarrollo (hot reload)
```bash
make dev
# o manualmente:
docker compose --profile dev up -d --build
```

### Comandos útiles
```bash
make logs      # Ver logs en tiempo real
make shell     # Entrar al contenedor
make down      # Parar contenedores
make down-v    # Parar y eliminar volúmenes
make test      # Ejecutar tests
make lint      # Linters (ruff, mypy)
make format    # Formatear código
make clean     # Limpiar todo (contenedores, imágenes, volúmenes)
```

La app estará en **http://localhost:8000**

## Instalación y arranque local (sin Docker)

**Linux / Mac**
```bash
chmod +x run.sh
./run.sh
```

**Windows**
```bat
run.bat
```

El script crea un entorno virtual, instala las dependencias y levanta el
servidor. Abre **http://localhost:8000** en tu navegador.

(La primera vez tarda un poco más porque instala todo; las siguientes veces
arranca casi al instante.)

También puedes hacerlo a mano:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
mkdir -p data
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

## Frontend

El código fuente vive en `frontend/` (React + TS + Vite). El build se genera
en `backend/frontend/` — el backend lo sirve automáticamente como sitio
estático en `/`.

```bash
cd frontend
npm install
npm run dev      # servidor de desarrollo de Vite (proxy al backend)
npm run build    # build de producción -> backend/frontend/
```

## Uso

1. Pega uno o varios enlaces en el cuadro de texto (uno por línea): puede ser
   un video suelto, una canción de YouTube Music, un álbum o una playlist
   completa — yt-dlp descarga automáticamente todos los elementos.
2. Elige **Audio** (mp3/m4a/flac, con calidad configurable) o **Video**
   (hasta la resolución que elijas).
3. Opcionalmente, escribe una subcarpeta para organizar esa descarga.
4. Pulsa **Descargar**. La cola de abajo muestra progreso en vivo, velocidad,
   ETA y en qué pista de la playlist va.

Los archivos se guardan en la carpeta `downloads/`, organizados así:

- **Audio:** `downloads/Artista/Álbum|Playlist/Pista.mp3`
- **Video:** `downloads/NombrePlaylist/Título.mp4`

Puedes cancelar una descarga en curso con el botón `×` de cada elemento, y
limpiar el historial de completadas/erróneas con "Limpiar terminadas".

## Configuración

Variables de entorno (`.env` o `docker-compose.yml`):

| Variable | Default | Descripción |
|----------|---------|-------------|
| `MAX_CONCURRENT_DOWNLOADS` | `4` | Descargas simultáneas máximas |
| `LOG_LEVEL` | `INFO` | Nivel de logging (DEBUG, INFO, WARNING, ERROR) |
| `CORS_ORIGINS` | `["*"]` | Orígenes permitidos para CORS |
| `HOST` / `PORT` | `0.0.0.0:8000` | Dirección y puerto del servidor |
| `DOWNLOADS_DIR` | `./downloads` | Carpeta de descargas |
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/jobs.db` | URL de base de datos |

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/jobs` | Crear trabajo(s) de descarga (varios enlaces por request) |
| `GET` | `/api/jobs` | Listar trabajos |
| `DELETE` | `/api/jobs/{id}` | Cancelar/borrar un trabajo |
| `POST` | `/api/jobs/clear` | Limpiar trabajos terminados |
| `GET` | `/api/jobs/{id}/download` | Descargar un archivo |
| `GET` | `/api/jobs/{id}/download-zip` | Descargar un trabajo como ZIP |
| `GET` | `/api/health` | Health check |
| `WS` | `/ws` | Eventos de la cola en tiempo real |

## Estructura del proyecto

```
gzwave/
├── backend/
│   ├── app/
│   │   ├── api/           # Rutas REST + WebSocket
│   │   ├── config.py      # Settings (pydantic-settings)
│   │   ├── core/          # Logging, security (rate limiting)
│   │   ├── models/        # Pydantic models (Job, Download)
│   │   └── services/      # download (yt-dlp), job_queue, ffmpeg
│   ├── frontend/          # Build del frontend (generado, no editar a mano)
│   ├── tests/             # pytest
│   ├── main.py            # App FastAPI + lifespan
│   └── pyproject.toml     # Config de paquete, ruff y mypy
├── frontend/              # Código fuente React + TS + Vite
├── downloads/             # Archivos descargados (volumen Docker)
├── data/                  # SQLite DB (volumen Docker)
├── Dockerfile             # Multi-stage build
├── docker-compose.yml     # Producción + perfil dev con hot reload
├── Makefile               # Comandos unificados
├── run.sh / run.bat       # Arranque local con venv automático
└── README.md
```

## Notas

- Se puede subir la concurrencia de descargas con `MAX_CONCURRENT_DOWNLOADS`,
  aunque demasiadas en paralelo puede disparar límites de YouTube.
- Si un video requiere iniciar sesión (privado, restringido por edad, etc.),
  yt-dlp soporta pasar cookies exportadas del navegador; se puede añadir
  fácilmente con la opción `cookiesfrombrowser` en `build_ydl_opts` si lo
  necesitas — dime y lo agrego.
- Usa esto solo para contenido que tengas derecho a descargar (tuyo, de
  dominio público, o donde el propio servicio lo permita); respeta los
  términos de uso de la plataforma y las leyes de derechos de autor de tu país.
