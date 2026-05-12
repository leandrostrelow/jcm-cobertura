const API_URL = "https://script.google.com/macros/s/AKfycbzF1MGAmojETsvqyoxybuBjDN3FRh4ivw785S1B9omphFuQ5Uuq8nrxla8SgHDedundxg/exec";
const storageKey = "jcm-simple-coverage-v2";
const localSchedule = window.JCM_SCHEDULE || [];
const STORY_BACKGROUND = "story-background.png";
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const TEAM_LOGOS = {
  "Multivix Vitória": "multivix-vitoria.png",
  "Multivix Cachoeiro": "multivix-cachoeiro.png",
  "UFES": "ufes.png",
  "EMESCAM": "emescam.png",
  "UVV": "uvv.png",
  "UNESC": "unesc.png"
};

let schedule = [...localSchedule];
let state = readState();
let selectedId = schedule[0]?.id;
let remoteReady = false;
const saveTimers = {};

const els = {
  dateFilter: document.querySelector("#dateFilter"),
  gamePicker: document.querySelector("#gamePicker"),
  nextPending: document.querySelector("#nextPending"),
  matchCard: document.querySelector("#matchCard"),
  toast: document.querySelector("#toast"),
  syncStatus: document.querySelector("#syncStatus"),
  storyModal: document.querySelector("#storyModal"),
  storyCanvas: document.querySelector("#storyCanvas"),
  storyTitle: document.querySelector("#storyTitle"),
  downloadStory: document.querySelector("#downloadStory"),
  shareStory: document.querySelector("#shareStory"),
  closeStory: document.querySelector("#closeStory")
};

let currentStory = {
  blob: null,
  fileName: "story-jcm.png",
  title: "Story JCM"
};

function readState() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function defaultRecord() {
  return {
    scoreA: "",
    scoreB: "",
    started: false,
    resultDone: false,
    startedAt: "",
    endedAt: "",
    coverageDuration: "",
    originalPhotosSent: false,
    startArtDone: false,
    resultArtDone: false,
    selectionDone: false,
    editingDone: false,
    reviewDone: false,
    editedPhotosDone: false,
    originalPhotosUrl: "",
    startArtUrl: "",
    resultArtUrl: "",
    editedPhotosUrl: "",
    liveUrl: "",
    photographers: [
      { name: "", sd: "", backup: false },
      { name: "", sd: "", backup: false }
    ]
  };
}

function record(id) {
  state[id] ||= defaultRecord();
  if (!Array.isArray(state[id].photographers) || state[id].photographers.length < 2) {
    state[id].photographers = defaultRecord().photographers;
  }
  return state[id];
}

function bool(value) {
  return value === true || value === "TRUE" || value === "true" || value === "Sim";
}

function normalizeText(value) {
  return value == null ? "" : String(value);
}

function localItem(id) {
  return localSchedule.find((item) => item.id === id) || {};
}

function rowToItem(row) {
  const fallback = localItem(row.ID);
  return {
    id: normalizeText(row.ID || fallback.id),
    weekend: normalizeText(row["Fim de semana"] || fallback.weekend),
    date: normalizeText(row.Data || fallback.date),
    weekday: normalizeText(row.Dia || fallback.weekday),
    time: normalizeText(row["Horário"] || fallback.time),
    venue: normalizeText(row.Local || fallback.venue),
    type: normalizeText(row.Tipo || fallback.type),
    modality: normalizeText(row.Modalidade || fallback.modality),
    phase: normalizeText(row.Fase || fallback.phase),
    teamA: normalizeText(row["Equipe A"] || fallback.teamA),
    teamB: normalizeText(row["Equipe B"] || fallback.teamB),
    participants: normalizeText(fallback.participants || row.Observações),
    notes: normalizeText(row.Observações || fallback.notes)
  };
}

function rowToRecord(row) {
  const finalizada = bool(row.Finalizada);
  const started = bool(row["Início feito"]) || finalizada || row.Status === "Em cobertura" || row.Status === "Finalizada";
  const startedAt = normalizeText(row["Início em"]);
  const endedAt = normalizeText(row["Fim de jogo em"]);
  const coverageDuration = normalizeText(row["Tempo cobertura"]);
  const resultDone = bool(row["Resultado feito"]) || !!endedAt || finalizada;
  const originalPhotosSent = bool(row["Originais enviadas"]) || finalizada;
  const startArtDone = bool(row["Arte início feita"]) || finalizada;
  const resultArtDone = bool(row["Arte resultado feita"]) || finalizada;
  const selectionDone = bool(row["Seleção feita"]) || finalizada;
  const editingDone = bool(row["Edição feita"]) || finalizada;
  const reviewDone = bool(row["Conferência feita"]) || finalizada;
  const editedPhotosDone = bool(row["Fotos editadas feitas"]) || finalizada;

  const photographers = [
    {
      name: normalizeText(row["Fotógrafo 1"]),
      sd: normalizeText(row["Nº SD 1"]),
      backup: bool(row["Backup 1"])
    },
    {
      name: normalizeText(row["Fotógrafo 2"]),
      sd: normalizeText(row["Nº SD 2"]),
      backup: bool(row["Backup 2"])
    }
  ];

  if (row["Fotógrafo extra"] || row["Nº SD extra"] || bool(row["Backup extra"])) {
    photographers.push({
      name: normalizeText(row["Fotógrafo extra"]),
      sd: normalizeText(row["Nº SD extra"]),
      backup: bool(row["Backup extra"])
    });
  }

  return {
    scoreA: normalizeText(row["Placar A"]),
    scoreB: normalizeText(row["Placar B"]),
    started,
    resultDone,
    startedAt,
    endedAt,
    coverageDuration,
    originalPhotosSent,
    startArtDone,
    resultArtDone,
    selectionDone,
    editingDone,
    reviewDone,
    editedPhotosDone,
    originalPhotosUrl: normalizeText(row["Link fotos originais"]),
    startArtUrl: normalizeText(row["Link arte post início"]),
    resultArtUrl: normalizeText(row["Link arte post resultado"]),
    editedPhotosUrl: normalizeText(row["Link fotos editadas"]),
    liveUrl: normalizeText(row["Link live ao vivo"]),
    photographers
  };
}

function recordToSheetData(id) {
  const data = record(id);
  const finalized = isRecordFinalized(data);
  const extras = data.photographers.slice(2);
  const extraNames = extras.map((person) => person.name).filter(Boolean).join(" | ");
  const extraSds = extras.map((person) => person.sd).filter(Boolean).join(" | ");

  return {
    "Placar A": data.scoreA,
    "Placar B": data.scoreB,
    "Status": statusForRecord(data),
    "Início feito": data.started,
    "Resultado feito": data.resultDone,
    "Início em": data.startedAt,
    "Fim de jogo em": data.endedAt,
    "Tempo cobertura": data.coverageDuration,
    "Fotógrafo 1": data.photographers[0]?.name || "",
    "Nº SD 1": data.photographers[0]?.sd || "",
    "Backup 1": !!data.photographers[0]?.backup,
    "Fotógrafo 2": data.photographers[1]?.name || "",
    "Nº SD 2": data.photographers[1]?.sd || "",
    "Backup 2": !!data.photographers[1]?.backup,
    "Fotógrafo extra": extraNames,
    "Nº SD extra": extraSds,
    "Backup extra": extras.length ? extras.every((person) => person.backup) : false,
    "Link fotos originais": data.originalPhotosUrl,
    "Originais enviadas": data.originalPhotosSent,
    "Link arte post início": data.startArtUrl,
    "Arte início feita": data.startArtDone,
    "Link arte post resultado": data.resultArtUrl,
    "Arte resultado feita": data.resultArtDone,
    "Seleção feita": data.selectionDone,
    "Edição feita": data.editingDone,
    "Conferência feita": data.reviewDone,
    "Link fotos editadas": data.editedPhotosUrl,
    "Fotos editadas feitas": data.editedPhotosDone,
    "Link live ao vivo": data.liveUrl,
    "Finalizada": finalized
  };
}

function shortDate(date) {
  return normalizeText(date).slice(0, 5);
}

function getDates() {
  return [...new Set(schedule.map((item) => item.date).filter(Boolean))];
}

function getVisibleGames() {
  const date = els.dateFilter.value;
  return schedule.filter((item) => date === "all" || item.date === date);
}

function getCurrentItem() {
  return schedule.find((item) => item.id === selectedId) || schedule[0];
}

function hasCompleteScore(data) {
  return data.scoreA.trim() !== "" && data.scoreB.trim() !== "";
}

function statusForRecord(data) {
  if (isRecordFinalized(data)) return "Finalizada";
  if (data.resultDone || data.endedAt) return "Fim de jogo";
  if (data.started) return "Em cobertura";
  return "Pendente";
}

function isRecordFinalized(data) {
  return data.started &&
    data.startArtDone &&
    data.resultArtDone &&
    data.originalPhotosSent &&
    data.selectionDone &&
    data.editingDone &&
    data.reviewDone &&
    data.editedPhotosDone;
}

function isFinalized(item) {
  return isRecordFinalized(record(item.id));
}

function progress(item) {
  const data = record(item.id);
  const checks = [
    data.started,
    data.startArtDone,
    data.resultArtDone,
    data.originalPhotosSent,
    data.selectionDone,
    data.editingDone,
    data.reviewDone,
    data.editedPhotosDone
  ];
  const done = checks.filter(Boolean).length;
  return { done, total: checks.length, percent: Math.round((done / checks.length) * 100) };
}

function optionLabel(item) {
  const opponent = item.teamA && item.teamB ? `${item.teamA} x ${item.teamB}` : item.participants || item.phase;
  return `${item.time} - ${item.modality} - ${item.phase} - ${opponent}`;
}

function nowIso() {
  return new Date().toISOString();
}

function formatTimestamp(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTimeOnly(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return "";
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "";
  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}min`;
  if (hours) return `${hours}h`;
  return `${minutes}min`;
}

function setSyncStatus(text, className) {
  if (!els.syncStatus) return;
  els.syncStatus.textContent = text;
  els.syncStatus.className = `sync-status ${className || ""}`.trim();
}

function initFilters() {
  const currentDate = els.dateFilter.value || "all";
  els.dateFilter.innerHTML = [
    `<option value="all">Todas as datas</option>`,
    ...getDates().map((date) => `<option value="${escapeHtml(date)}">${escapeHtml(shortDate(date))}</option>`)
  ].join("");
  els.dateFilter.value = getDates().includes(currentDate) ? currentDate : "all";
  populateGamePicker();
}

function populateGamePicker() {
  const visible = getVisibleGames();
  if (!visible.some((item) => item.id === selectedId)) selectedId = visible[0]?.id || schedule[0]?.id;
  els.gamePicker.innerHTML = visible.map((item) => {
    const done = isFinalized(item) ? "OK - " : "";
    return `<option value="${escapeHtml(item.id)}">${done}${escapeHtml(optionLabel(item))}</option>`;
  }).join("");
  els.gamePicker.value = selectedId;
}

function render() {
  initFilters();
  const item = getCurrentItem();
  if (!item) {
    els.matchCard.innerHTML = "";
    return;
  }
  const data = record(item.id);
  const status = statusForRecord(data);
  const statusClass = status === "Finalizada" ? "finalized" : status === "Fim de jogo" ? "ended" : "";
  const coverageEnded = status === "Fim de jogo" || status === "Finalizada";

  els.matchCard.innerHTML = `
    <div class="match-top">
      <div class="match-meta">
        <div class="meta-row">
          <div class="time-card">
            <div class="match-date-line">${escapeHtml(`${item.weekday} ${shortDate(item.date)}`)}</div>
            <span class="time">${escapeHtml(item.time)}</span>
            <span class="pill venue">${escapeHtml(item.venue)}</span>
          </div>

          <div class="coverage-summary">
            <div class="coverage-row">
              <span>Início</span>
              <strong>${escapeHtml(formatTimeOnly(data.startedAt))}</strong>
            </div>
            <div class="coverage-row">
              <span>Fim</span>
              <strong>${escapeHtml(formatTimeOnly(data.endedAt))}</strong>
            </div>
            <div class="coverage-row">
              <span>Tempo</span>
              <strong>${escapeHtml(data.coverageDuration || "-")}</strong>
            </div>
          </div>
        </div>

        <div class="play-line">
          <button class="play-button ${data.started && !coverageEnded ? "active" : ""} ${coverageEnded ? "ended" : ""}" type="button" data-toggle="started">
            <i data-lucide="${coverageEnded ? "square" : data.started ? "radio" : "play"}"></i>
            <span>${coverageEnded ? "Fim" : "Início"}</span>
          </button>
          <span class="status ${statusClass}">${status}</span>
        </div>
      </div>

      <div class="scoreboard">
        <div class="match-tags">
          <span class="pill modality">${escapeHtml(item.modality)}</span>
          <span class="pill phase">${escapeHtml(item.phase)}</span>
        </div>
        ${renderScore(item, data)}
      </div>
    </div>

    <div class="management">
      <section class="field-group">
        <div class="field-head">
          <h2>Fotógrafos</h2>
          <button class="add-button" type="button" data-add-photographer>
            <i data-lucide="plus"></i>
            <span>Adicionar</span>
          </button>
        </div>
        <div class="photographers">
          ${data.photographers.map((person, index) => renderPhotographer(person, index)).join("")}
        </div>
      </section>

      <section class="field-group">
        <p class="field-title">Links da operação</p>
        <div class="link-grid">
          ${renderLinkField("originalPhotosUrl", "Link fotos originais", data.originalPhotosUrl, "hard-drive-download")}
          ${renderArtCard("start", "Post início")}
          ${renderArtCard("result", "Post resultado")}
          ${renderLinkField("editedPhotosUrl", "Link fotos editadas", data.editedPhotosUrl, "download")}
          ${renderLinkField("liveUrl", "Link da live ao vivo", data.liveUrl, "radio")}
        </div>
      </section>

      <section class="field-group">
        <p class="field-title">Checklist</p>
        <div class="done-grid">
          ${doneButton("started", "Início", data.started, "play")}
          ${doneButton("startArtDone", "Arte início", data.startArtDone, "badge-check")}
          ${doneButton("resultArtDone", "Arte resultado", data.resultArtDone, "badge-check")}
          ${doneButton("originalPhotosSent", "Backup originais", data.originalPhotosSent, "upload-cloud")}
          ${doneButton("selectionDone", "Seleção", data.selectionDone, "list-checks")}
          ${doneButton("editingDone", "Edição", data.editingDone, "pen-line")}
          ${doneButton("reviewDone", "Conferência", data.reviewDone, "badge-check")}
          ${doneButton("editedPhotosDone", "Fotos editadas", data.editedPhotosDone, "images")}
        </div>
      </section>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function renderScore(item, data) {
  if (!item.teamA || !item.teamB) {
    return `<div class="event-title">${escapeHtml(item.participants || item.modality)}</div>`;
  }
  return `
    <div class="score-line">
      ${renderTeam(item.teamA, "left")}
      <input class="score-input" inputmode="numeric" maxlength="3" value="${escapeHtml(data.scoreA)}" data-field="scoreA" aria-label="Placar ${escapeHtml(item.teamA)}">
      <div class="versus">x</div>
      <input class="score-input" inputmode="numeric" maxlength="3" value="${escapeHtml(data.scoreB)}" data-field="scoreB" aria-label="Placar ${escapeHtml(item.teamB)}">
      ${renderTeam(item.teamB, "right")}
    </div>
  `;
}

function renderTeam(name, side) {
  const logo = TEAM_LOGOS[name];
  const img = logo
    ? `<img class="team-logo" src="${escapeHtml(logo)}" alt="" onerror="this.remove()">`
    : "";
  const label = `<span>${formatTeamName(name)}</span>`;
  const content = side === "left" ? `${label}${img}` : `${img}${label}`;
  return `<div class="team ${side}">${content}</div>`;
}

function formatTeamName(name) {
  const normalized = normalizeText(name);
  const parts = normalized.match(/^Multivix\s+(.+)$/i);
  if (parts) {
    return `Multivix<br>${escapeHtml(parts[1])}`;
  }
  return escapeHtml(normalized);
}

function renderPhotographer(person, index) {
  const n = index + 1;
  return `
    <div class="photographer-card" data-photographer="${index}">
      <label>
        <span>Fotógrafo ${n}</span>
        <input value="${escapeHtml(person.name)}" placeholder="Nome" data-photo-index="${index}" data-photo-field="name">
      </label>
      <label>
        <span>Nº SD</span>
        <input value="${escapeHtml(person.sd)}" placeholder="SD" data-photo-index="${index}" data-photo-field="sd">
      </label>
      <label class="check-field">
        <input type="checkbox" ${person.backup ? "checked" : ""} data-photo-index="${index}" data-photo-field="backup">
        <span>Backup</span>
      </label>
    </div>
  `;
}

function renderLinkField(field, title, value, icon) {
  const disabled = value ? "" : "disabled";
  const safe = escapeHtml(value);
  const artType = field === "editedPhotosUrl" ? "photos" : "";
  const generateButton = artType
    ? `<button class="generate-art" type="button" data-art-type="${artType}" title="Gerar arte para story">
        <i data-lucide="wand-sparkles"></i>
        <span>Gerar</span>
      </button>`
    : "";
  return `
    <div class="link-item">
      <header>
        <h3>${escapeHtml(title)}</h3>
      </header>
      <div class="link-actions ${artType ? "has-generator" : ""}">
        <input type="url" value="${safe}" placeholder="https://..." data-field="${field}">
        ${generateButton}
        <a class="open-link ${disabled}" href="${safe || "#"}" target="_blank" rel="noreferrer" title="Abrir ou baixar">
          <i data-lucide="${icon}"></i>
        </a>
      </div>
    </div>
  `;
}

function renderArtCard(type, title) {
  return `
    <div class="link-item art-card">
      <header>
        <h3>${escapeHtml(title)}</h3>
      </header>
      <button class="generate-art full" type="button" data-art-type="${type}" title="Gerar arte para story">
        <i data-lucide="wand-sparkles"></i>
        <span>Gerar arte</span>
      </button>
    </div>
  `;
}

function doneButton(field, label, done, icon) {
  return `
    <button class="icon-action ${done ? "done" : ""}" type="button" data-toggle="${field}">
      <i data-lucide="${icon}"></i>
      <span>${escapeHtml(label)}</span>
    </button>
  `;
}

function updateField(field, value) {
  const item = getCurrentItem();
  const data = record(item.id);
  data[field] = value;
  if (field === "scoreA" || field === "scoreB") {
    syncScoreCompletion(data);
  }
  saveState();
  queueSave(item.id);
}

function syncStartState(data) {
  if (data.started && !data.startedAt) {
    data.startedAt = nowIso();
  }
  if (!data.started) {
    data.startedAt = "";
    data.endedAt = "";
    data.coverageDuration = "";
    data.resultDone = false;
  }
}

function syncScoreCompletion(data) {
  if (hasCompleteScore(data)) {
    data.resultDone = true;
    if (!data.endedAt) data.endedAt = nowIso();
    data.coverageDuration = formatDuration(data.startedAt, data.endedAt);
  } else {
    data.resultDone = false;
    data.endedAt = "";
    data.coverageDuration = "";
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2300);
}

function storyLabel(type) {
  if (type === "photos") return "FOTOS DISPONÍVEIS";
  return type === "result" ? "RESULTADO FINAL" : "INÍCIO DO JOGO";
}

function storyFileName(item, type) {
  const prefix = type === "photos" ? "fotos-disponiveis" : type === "result" ? "resultado" : "inicio";
  const base = `${prefix}-${item.modality}-${item.teamA || "evento"}-${item.teamB || ""}`;
  return `${slugify(base)}.png`;
}

function slugify(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error("Imagem não informada."));
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(ctx, image) {
  const scale = Math.max(STORY_WIDTH / image.width, STORY_HEIGHT / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, (STORY_WIDTH - width) / 2, (STORY_HEIGHT - height) / 2, width, height);
}

function drawFallbackBackground(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, STORY_WIDTH, 0);
  gradient.addColorStop(0, "#3c1763");
  gradient.addColorStop(1, "#080311");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
}

function drawContainedImage(ctx, image, centerX, centerY, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
}

function drawStoryText(ctx, text, y, size, maxWidth) {
  let fontSize = size;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  do {
    ctx.font = `900 ${fontSize}px Inter, Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    fontSize -= 4;
  } while (fontSize > 42);
  ctx.fillText(text, STORY_WIDTH / 2, y);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function drawLogoFallback(ctx, label, centerX, centerY, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(124,58,237,0.65)";
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = "#151515";
  ctx.font = `900 ${Math.round(size * 0.18)}px Inter, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(normalizeText(label).slice(0, 12).toUpperCase(), centerX, centerY);
  ctx.restore();
}

function drawStoryScore(ctx, data) {
  if (!hasCompleteScore(data)) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.font = "900 112px Inter, Arial, sans-serif";
  ctx.fillText(`${data.scoreA} x ${data.scoreB}`, STORY_WIDTH / 2, 1002);
  ctx.restore();
}

async function copyText(text, successMessage) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch {
    showToast("Arte gerada. Não consegui copiar o link automaticamente.");
  }
}

function drawScoreNumber(ctx, value, centerX, centerY) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.font = "900 118px Inter, Arial, sans-serif";
  ctx.fillText(normalizeText(value), centerX, centerY);
  ctx.restore();
}

function drawVersusStory(ctx, y) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.42)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  ctx.font = "900 96px Inter, Arial, sans-serif";
  ctx.fillText("X", STORY_WIDTH / 2, y);
  ctx.restore();
}

function loserOpacity(data, side) {
  if (!hasCompleteScore(data)) return 1;
  const scoreA = Number(data.scoreA);
  const scoreB = Number(data.scoreB);
  if (Number.isNaN(scoreA) || Number.isNaN(scoreB) || scoreA === scoreB) return 1;
  if (side === "A" && scoreA < scoreB) return 0.42;
  if (side === "B" && scoreB < scoreA) return 0.42;
  return 1;
}

async function openStoryArt(type) {
  const item = getCurrentItem();
  const data = record(item.id);

  if (!item.teamA || !item.teamB) {
    showToast("Essa arte precisa de duas equipes na partida.");
    return;
  }
  if (type === "photos" && !data.editedPhotosUrl.trim()) {
    showToast("Preencha o link das fotos editadas antes de gerar a arte.");
    return;
  }
  if (type === "result" && !hasCompleteScore(data)) {
    showToast("Coloque o placar dos dois times antes de gerar o resultado.");
    return;
  }

  els.storyModal.hidden = false;
  els.storyTitle.textContent = type === "photos" ? "Arte de fotos" : type === "result" ? "Arte de resultado" : "Arte de início";
  els.downloadStory.disabled = true;
  els.shareStory.disabled = true;
  currentStory = {
    blob: null,
    fileName: storyFileName(item, type),
    title: `${storyLabel(type)} - ${item.modality}`,
    linkToCopy: type === "photos" ? data.editedPhotosUrl.trim() : ""
  };

  await drawStory(type, item, data);
  if (type === "photos") await copyText(data.editedPhotosUrl, "Link das fotos copiado.");
  if (window.lucide) lucide.createIcons();
}

async function drawStory(type, item, data) {
  const canvas = els.storyCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  try {
    drawCover(ctx, await loadImage(STORY_BACKGROUND));
  } catch {
    drawFallbackBackground(ctx);
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  const isResult = type === "result";
  const isPhotos = type === "photos";
  drawStoryText(ctx, storyLabel(type), isResult ? 520 : isPhotos ? 535 : 555, 72, 900);

  const logoSize = isResult ? 292 : isPhotos ? 285 : 330;
  const logoY = isResult ? 785 : isPhotos ? 810 : 850;
  const logoAX = 320;
  const logoBX = 760;
  const logoA = TEAM_LOGOS[item.teamA];
  const logoB = TEAM_LOGOS[item.teamB];

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.38)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;

  try {
    ctx.globalAlpha = loserOpacity(data, "A");
    drawContainedImage(ctx, await loadImage(logoA), logoAX, logoY, logoSize, logoSize);
  } catch {
    ctx.globalAlpha = loserOpacity(data, "A");
    drawLogoFallback(ctx, item.teamA, logoAX, logoY, logoSize);
  }

  try {
    ctx.globalAlpha = loserOpacity(data, "B");
    drawContainedImage(ctx, await loadImage(logoB), logoBX, logoY, logoSize, logoSize);
  } catch {
    ctx.globalAlpha = loserOpacity(data, "B");
    drawLogoFallback(ctx, item.teamB, logoBX, logoY, logoSize);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawVersusStory(ctx, logoY);

  if (isResult) {
    drawScoreNumber(ctx, data.scoreA, logoAX, 1110);
    drawScoreNumber(ctx, data.scoreB, logoBX, 1110);
  } else if (isPhotos) {
    drawStoryText(ctx, "LINK COPIADO", 1115, 48, 820);
    drawStoryText(ctx, item.modality.toUpperCase(), 1270, 62, 900);
  } else {
    drawStoryText(ctx, item.modality.toUpperCase(), 1265, 72, 940);
  }

  currentStory.blob = await canvasToBlob(canvas);
  els.downloadStory.disabled = false;
  els.shareStory.disabled = false;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível gerar a imagem."));
    }, "image/png", 1);
  });
}

function downloadCurrentStory() {
  if (!currentStory.blob) return;
  const url = URL.createObjectURL(currentStory.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = currentStory.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function shareCurrentStory() {
  if (!currentStory.blob) return;
  const file = new File([currentStory.blob], currentStory.fileName, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    if (currentStory.linkToCopy) {
      await copyText(currentStory.linkToCopy, "Link copiado para enviar junto.");
    }
    await navigator.share({
      files: [file],
      title: currentStory.title
    });
    return;
  }
  if (currentStory.linkToCopy) {
    await copyText(currentStory.linkToCopy, "Link copiado para enviar junto.");
  }
  downloadCurrentStory();
  showToast("Compartilhamento não disponível aqui. Baixei a arte para você postar pelo celular.");
}

function closeStoryModal() {
  els.storyModal.hidden = true;
}

function findNextPending() {
  const visible = getVisibleGames();
  const currentIndex = visible.findIndex((item) => item.id === selectedId);
  const ordered = [...visible.slice(currentIndex + 1), ...visible.slice(0, currentIndex + 1)];
  return ordered.find((item) => !isFinalized(item)) || visible[0];
}

async function loadRemoteData() {
  setSyncStatus("Conectando...", "saving");
  try {
    const response = await fetch(`${API_URL}?action=list&t=${Date.now()}`);
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "Erro ao carregar planilha");

    schedule = payload.rows.map(rowToItem).filter((item) => item.id);
    state = payload.rows.reduce((acc, row) => {
      if (row.ID) acc[row.ID] = rowToRecord(row);
      return acc;
    }, {});
    remoteReady = true;
    saveState();
    if (!schedule.some((item) => item.id === selectedId)) selectedId = schedule[0]?.id;
    setSyncStatus("Online", "online");
    render();
  } catch (error) {
    remoteReady = false;
    setSyncStatus("Modo local", "offline");
    showToast("Não consegui carregar a planilha. O app ficou em modo local.");
    render();
  }
}

function queueSave(id, immediate = false) {
  saveState();
  if (!remoteReady) return;
  window.clearTimeout(saveTimers[id]);
  saveTimers[id] = window.setTimeout(() => saveRemoteRecord(id), immediate ? 0 : 650);
}

async function saveRemoteRecord(id) {
  if (!remoteReady) return;
  setSyncStatus("Salvando...", "saving");
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "update",
        id,
        data: recordToSheetData(id)
      })
    });
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "Erro ao salvar");
    setSyncStatus("Salvo", "online");
    window.setTimeout(() => setSyncStatus("Online", "online"), 900);
  } catch (error) {
    setSyncStatus("Erro ao salvar", "offline");
    showToast("Não consegui salvar na planilha. Confira a conexão ou a implantação do Apps Script.");
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindEvents() {
  els.dateFilter.addEventListener("change", () => {
    render();
  });

  els.gamePicker.addEventListener("change", () => {
    selectedId = els.gamePicker.value;
    render();
  });

  els.nextPending.addEventListener("click", () => {
    const next = findNextPending();
    if (next) {
      selectedId = next.id;
      render();
      showToast("Próxima partida pendente selecionada.");
    }
  });

  els.closeStory.addEventListener("click", closeStoryModal);
  els.downloadStory.addEventListener("click", downloadCurrentStory);
  els.shareStory.addEventListener("click", () => {
    shareCurrentStory().catch(() => showToast("Não consegui compartilhar. Tente baixar o PNG."));
  });
  els.storyModal.addEventListener("click", (event) => {
    if (event.target === els.storyModal) closeStoryModal();
  });

  els.matchCard.addEventListener("input", (event) => {
    const item = getCurrentItem();
    const data = record(item.id);
    if (event.target.dataset.field) {
      updateField(event.target.dataset.field, event.target.value);
      return;
    }
    if (event.target.dataset.photoIndex) {
      const index = Number(event.target.dataset.photoIndex);
      const field = event.target.dataset.photoField;
      data.photographers[index][field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      saveState();
      queueSave(item.id);
    }
  });

  els.matchCard.addEventListener("change", (event) => {
    const item = getCurrentItem();
    const data = record(item.id);
    if (event.target.dataset.photoIndex) {
      const index = Number(event.target.dataset.photoIndex);
      const field = event.target.dataset.photoField;
      data.photographers[index][field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      saveState();
      queueSave(item.id, true);
      render();
    }
    if (event.target.dataset.field) {
      queueSave(item.id, true);
      render();
    }
  });

  els.matchCard.addEventListener("click", (event) => {
    const item = getCurrentItem();
    const data = record(item.id);
    const add = event.target.closest("[data-add-photographer]");
    const toggle = event.target.closest("[data-toggle]");
    const art = event.target.closest("[data-art-type]");
    if (art) {
      openStoryArt(art.dataset.artType).catch(() => showToast("Não consegui gerar a arte."));
      return;
    }
    if (add) {
      data.photographers.push({ name: "", sd: "", backup: false });
      saveState();
      queueSave(item.id, true);
      render();
      return;
    }
    if (toggle) {
      const field = toggle.dataset.toggle;
      data[field] = !data[field];
      if (field === "started") {
        syncStartState(data);
        if (data.started) syncScoreCompletion(data);
      }
      saveState();
      queueSave(item.id, true);
      render();
      if (isFinalized(item)) showToast("Partida finalizada.");
    }
  });
}

bindEvents();
initFilters();
render();
loadRemoteData();
