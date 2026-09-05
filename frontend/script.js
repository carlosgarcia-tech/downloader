// ---------------------------------------------------------------------------
// Estado del modo (audio / video)
// ---------------------------------------------------------------------------
let currentMode = "audio";

const modeToggle = document.getElementById("mode-toggle");
const audioOpts = document.getElementById("audio-opts");
const videoOpts = document.getElementById("video-opts");

modeToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".mode-btn");
  if (!btn) return;
  currentMode = btn.dataset.mode;

  modeToggle.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  audioOpts.classList.toggle("hidden", currentMode !== "audio");
  videoOpts.classList.toggle("hidden", currentMode !== "video");
});

// ---------------------------------------------------------------------------
// Envío del formulario
// ---------------------------------------------------------------------------
const form = document.getElementById("job-form");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    urls: document.getElementById("urls").value,
    mode: currentMode,
    audio_format: document.getElementById("audio_format").value,
    audio_quality: document.getElementById("audio_quality").value,
    video_quality: document.getElementById("video_quality").value,
    folder: document.getElementById("folder").value,
  };

  if (!body.urls.trim()) return;

  const submitBtn = form.querySelector(".submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Encolando...";

  try {
    await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    document.getElementById("urls").value = "";
  } catch (err) {
    alert("No se pudo conectar con el servidor. ¿Sigue corriendo el backend?");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Descargar";
  }
});

// ---------------------------------------------------------------------------
// Botón "limpiar terminadas"
// ---------------------------------------------------------------------------
document.getElementById("clear-btn").addEventListener("click", () => {
  fetch("/api/jobs/clear", { method: "POST" });
});

// ---------------------------------------------------------------------------
// Cancelar un trabajo puntual (delegación de eventos)
// ---------------------------------------------------------------------------
document.getElementById("queue-list").addEventListener("click", (e) => {
  const btn = e.target.closest(".job-cancel");
  if (!btn) return;
  fetch(`/api/jobs/${btn.dataset.id}`, { method: "DELETE" });
});

// ---------------------------------------------------------------------------
// Helpers de formato
// ---------------------------------------------------------------------------
function formatSpeed(bytesPerSec) {
  if (!bytesPerSec) return "";
  const kb = bytesPerSec / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB/s`;
  return `${(kb / 1024).toFixed(1)} MB/s`;
}

function formatEta(seconds) {
  if (seconds === null || seconds === undefined) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `ETA ${m}:${s.toString().padStart(2, "0")}`;
}

const STATUS_LABEL = {
  queued: "en cola",
  starting: "iniciando",
  downloading: "descargando",
  processing: "procesando",
  completed: "listo",
  error: "error",
  cancelled: "cancelado",
};

// ---------------------------------------------------------------------------
// Renderizado de la cola
// ---------------------------------------------------------------------------
const queueList = document.getElementById("queue-list");

function renderJobs(jobs) {
  if (!jobs || jobs.length === 0) {
    queueList.innerHTML = `<li class="empty-hint">Todavía no hay descargas. Pega un enlace arriba para empezar.</li>`;
    return;
  }

  queueList.innerHTML = jobs.map(renderJob).join("");
}

function renderJob(job) {
  const title = job.current_title || job.url;
  const progress = Math.max(0, Math.min(100, job.progress || 0));
  const statusLabel = STATUS_LABEL[job.status] || job.status;

  const itemCounter =
    job.item_index && job.item_count
      ? `pista ${job.item_index}/${job.item_count} · `
      : "";

  const canCancel = ["queued", "starting", "downloading", "processing"].includes(job.status);

  const footline = job.status === "downloading"
    ? `<div class="job-footline"><span>${itemCounter}${formatSpeed(job.speed)}</span><span>${formatEta(job.eta)}</span></div>`
    : itemCounter
      ? `<div class="job-footline"><span>${itemCounter}</span><span></span></div>`
      : "";

  const errorLine = job.status === "error" && job.error
    ? `<div class="job-error-text">${escapeHtml(job.error)}</div>`
    : "";

  return `
    <li class="job ${job.mode}">
      <div class="job-top">
        <div>
          <div class="job-title">${escapeHtml(title)}</div>
          <div class="job-url">${escapeHtml(job.url)}</div>
        </div>
        <div class="job-meta">
          <span class="job-status status-${job.status}">${statusLabel}</span>
          ${canCancel ? `<button class="job-cancel" data-id="${job.id}" title="Cancelar">×</button>` : ""}
        </div>
      </div>
      <div class="job-bar-track">
        <div class="job-bar-fill" style="width:${progress}%"></div>
      </div>
      ${footline}
      ${errorLine}
    </li>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// WebSocket con reconexión automática
// ---------------------------------------------------------------------------
function connectWebSocket() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws`);

  ws.onmessage = (event) => {
    const jobs = JSON.parse(event.data);
    renderJobs(jobs);
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 1500);
  };

  ws.onerror = () => ws.close();
}

connectWebSocket();

// Carga inicial por si el WebSocket tarda en conectar
fetch("/api/jobs")
  .then((r) => r.json())
  .then(renderJobs)
  .catch(() => {});
