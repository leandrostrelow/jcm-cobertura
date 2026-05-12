const API_URL = "https://script.google.com/macros/s/AKfycbzF1MGAmojETsvqyoxybuBjDN3FRh4ivw785S1B9omphFuQ5Uuq8nrxla8SgHDedundxg/exec";
const storageKey = "jcm-simple-coverage-v2";
const localSchedule = window.JCM_SCHEDULE || [];
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
  syncStatus: document.querySelector("#syncStatus")
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
            <span>Início: ${escapeHtml(formatTimestamp(data.startedAt))}</span>
            <span>Fim: ${escapeHtml(formatTimestamp(data.endedAt))}</span>
            <strong>Tempo: ${escapeHtml(data.coverageDuration || "-")}</strong>
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
          ${renderLinkField("startArtUrl", "Link post início", data.startArtUrl, "download")}
          ${renderLinkField("resultArtUrl", "Link post resultado", data.resultArtUrl, "download")}
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
  return `
    <div class="link-item">
      <header>
        <h3>${escapeHtml(title)}</h3>
      </header>
      <div class="link-actions">
        <input type="url" value="${safe}" placeholder="https://..." data-field="${field}">
        <a class="open-link ${disabled}" href="${safe || "#"}" target="_blank" rel="noreferrer" title="Abrir ou baixar">
          <i data-lucide="${icon}"></i>
        </a>
      </div>
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
