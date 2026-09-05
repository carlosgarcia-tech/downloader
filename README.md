# Descargador

App web local para descargar audio y video desde YouTube / YouTube Music
(canciones sueltas, álbumes o playlists completas), usando `yt-dlp`.

## Requisitos (para desarrollo local)

1. **Python 3.9+** — [python.org](https://www.python.org/downloads/)
2. **ffmpeg** — necesario para extraer audio (mp3/flac), fusionar video+audio
   y embeber carátulas.
   - Windows: `winget install ffmpeg` (o descarga desde ffmpeg.org y agrégalo al PATH)
   - Mac: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg` (Debian/Ubuntu) o el equivalente de tu distro

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

- **Audio:** `downloads/Artista/Álbum/Pista.mp3`
- **Video:** `downloads/NombrePlaylist/Título.mp4`

Puedes cancelar una descarga en curso con el botón `×` de cada elemento, y
limpiar el historial de completadas/erróneas con "Limpiar terminadas".

## Configuración

Variables de entorno (`.env` o `docker-compose.yml`):

| Variable | Default | Descripción |
|----------|---------|-------------|
| `MAX_CONCURRENT_DOWNLOADS` | `2` | Descargas simultáneas máximas |
| `LOG_LEVEL` | `INFO` | Nivel de logging (DEBUG, INFO, WARNING, ERROR) |
| `CORS_ORIGINS` | `["*"]` | Orígenes permitidos para CORS |
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/jobs.db` | URL de base de datos |

## Notas

- El backend corre 2 descargas en paralelo como máximo (configurable via
  `MAX_CONCURRENT_DOWNLOADS`) para no saturar tu conexión ni disparar límites
  de YouTube.
- Si un video requiere iniciar sesión (privado, restringido por edad, etc.),
  yt-dlp soporta pasar cookies exportadas del navegador; se puede añadir
  fácilmente con la opción `cookiesfrombrowser` en `build_ydl_opts` si lo
  necesitas — dime y lo agrego.
- Usa esto solo para contenido que tengas derecho a descargar (tuyo, de
  dominio público, o donde el propio servicio lo permita); respeta los
  términos de uso de la plataforma y las leyes de derechos de autor de tu país.

## Estructura del proyecto

```
descargador/
├── backend/
│   ├── app/
│   │   ├── api/           # Rutas REST + WebSocket
│   │   ├── config.py      # Settings (pydantic-settings)
│   │   ├── core/          # Logging, security (rate limiting)
│   │   ├── models/        # Pydantic models
│   │   └── services/      # download, job_queue, ffmpeg
│   ├── main.py            # FastAPI factory
│   ├── pyproject.toml     # Package config
│   └── requirements.txt
├── frontend/              # Vanilla JS (por migrar a Vite+TS)
├── downloads/             # Archivos descargados (volumen Docker)
├── data/                  # SQLite DB (volumen Docker)
├── Dockerfile             # Multi-stage build
├── docker-compose.yml     # Orquestación
├── Makefile               # Comandos unificados
├── run.sh / run.bat       # Scripts legacy
└── README.md
```

## Ideas para ampliarlo

- Frontend moderno: Vite + TypeScript + React/Svelte
- Tests unitarios e integración (pytest)
- CI/CD con GitHub Actions
- Métricas Prometheus (`/metrics`)
- Cookies support para contenido privado
- SponsorBlock integration
- Drag & drop + clipboard API en frontend