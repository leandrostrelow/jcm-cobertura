const API_URL = "https://script.google.com/macros/s/AKfycbzF1MGAmojETsvqyoxybuBjDN3FRh4ivw785S1B9omphFuQ5Uuq8nrxla8SgHDedundxg/exec";
const storageKey = "jcm-simple-coverage-v2";
const notificationKey = "jcm-simple-notifications-v1";
const notificationSoundFile = "notification.mp3";
const remotePollIntervalMs = 12000;
const localSchedule = window.JCM_SCHEDULE || [];
const STORY_BACKGROUNDS = {
  start: "story-background-inicio.png",
  result: "story-background-resultado.png",
  photos: "story-background-fotos.png",
  fallback: "story-background.png"
};
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
const BRACKET_DEFINITIONS = [
  { id: "futsal-masculino", title: "Futsal Masculino", qf1: "JCM-013", qf2: "JCM-001", sf1: "JCM-018", sf2: "JCM-020", final: "JCM-053" },
  { id: "futsal-feminino", title: "Futsal Feminino", qf1: "JCM-002", qf2: "JCM-012", sf1: "JCM-021", sf2: "JCM-019", final: "JCM-051" },
  { id: "handebol-masculino", title: "Handebol Masculino", qf1: "JCM-006", qf2: "JCM-004", sf1: "JCM-029", sf2: "JCM-031", final: "JCM-049" },
  { id: "handebol-feminino", title: "Handebol Feminino", qf1: "JCM-009", qf2: "JCM-005", sf1: "JCM-032", sf2: "JCM-030", final: "JCM-047" },
  { id: "basquete-masculino", title: "Basquete Masculino", qf1: "JCM-017", qf2: "JCM-027", sf1: "JCM-034", sf2: "JCM-035", final: "JCM-045" },
  { id: "basquete-feminino", title: "Basquete Feminino", qf1: "JCM-016", qf2: "", sf1: "JCM-033", sf2: "JCM-026", final: "JCM-043" },
  { id: "futebol-masculino", title: "Futebol de Campo", qf1: "JCM-015", qf2: "JCM-014", sf1: "JCM-037", sf2: "JCM-036", final: "JCM-038" },
  { id: "volei-masculino", title: "Volei Masculino", qf1: "JCM-011", qf2: "JCM-010", sf1: "JCM-023", sf2: "JCM-022", final: "JCM-041" },
  { id: "volei-feminino", title: "Volei Feminino", qf1: "JCM-007", qf2: "JCM-008", sf1: "JCM-024", sf2: "JCM-025", final: "JCM-039" }
];
const GAME_DEPENDENCIES = BRACKET_DEFINITIONS.reduce((dependencies, bracket) => {
  if (bracket.qf1 && bracket.sf1) {
    dependencies[bracket.sf1] = { ...dependencies[bracket.sf1], teamB: bracket.qf1 };
  }
  if (bracket.qf2 && bracket.sf2) {
    dependencies[bracket.sf2] = { ...dependencies[bracket.sf2], teamB: bracket.qf2 };
  }
  if (bracket.sf1 && bracket.final) {
    dependencies[bracket.final] = { ...dependencies[bracket.final], teamA: bracket.sf1 };
  }
  if (bracket.sf2 && bracket.final) {
    dependencies[bracket.final] = { ...dependencies[bracket.final], teamB: bracket.sf2 };
  }
  return dependencies;
}, {});

let schedule = [...localSchedule];
let state = readState();
let notifications = readNotifications();
let selectedId = schedule[0]?.id;
let activeView = "coverage";
let remoteReady = false;
let remotePollTimer = null;
let savingRemote = false;
let notificationSoundReady = false;
let notificationAudio = null;
let notificationAudioContext = null;
const saveTimers = {};

const els = {
  viewTabs: document.querySelector(".view-tabs"),
  coveragePanels: document.querySelectorAll(".picker, #notificationCenter, #matchCard"),
  bracketsView: document.querySelector("#bracketsView"),
  bracketsBoard: document.querySelector("#bracketsBoard"),
  bracketFilter: document.querySelector("#bracketFilter"),
  dateFilter: document.querySelector("#dateFilter"),
  gamePicker: document.querySelector("#gamePicker"),
  prevGame: document.querySelector("#prevGame"),
  nextGame: document.querySelector("#nextGame"),
  matchCard: document.querySelector("#matchCard"),
  notificationCenter: document.querySelector("#notificationCenter"),
  notificationList: document.querySelector("#notificationList"),
  enableSound: document.querySelector("#enableSound"),
  clearNotifications: document.querySelector("#clearNotifications"),
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

function readNotifications() {
  try {
    const value = JSON.parse(localStorage.getItem(notificationKey)) || [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveNotifications() {
  localStorage.setItem(notificationKey, JSON.stringify(notifications.slice(0, 30)));
}

function defaultPhotographer() {
  return {
    name: "",
    sd: "",
    backup: false,
    photoStart: "",
    photoEnd: "",
    photoTotal: ""
  };
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
      defaultPhotographer(),
      defaultPhotographer()
    ]
  };
}

function record(id) {
  state[id] ||= defaultRecord();
  if (!Array.isArray(state[id].photographers)) {
    state[id].photographers = [];
  }
  state[id].photographers = state[id].photographers.map(normalizePhotographer);
  while (state[id].photographers.length < 2) {
    state[id].photographers.push(defaultPhotographer());
  }
  return state[id];
}

function normalizePhotographer(person = {}) {
  const normalized = {
    ...defaultPhotographer(),
    ...person,
    name: normalizeText(person.name),
    sd: normalizeText(person.sd),
    photoStart: normalizeText(person.photoStart),
    photoEnd: normalizeText(person.photoEnd),
    photoTotal: normalizeText(person.photoTotal)
  };
  normalized.backup = bool(person.backup);
  normalized.photoTotal = normalized.photoTotal || calculatePhotoTotal(normalized);
  return normalized;
}

function bool(value) {
  return value === true || value === "TRUE" || value === "true" || value === "Sim";
}

function normalizeText(value) {
  return value == null ? "" : String(value);
}

function splitJoinedValues(value) {
  return normalizeText(value)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function photoNumber(value) {
  const clean = normalizeText(value).replace(/\D/g, "");
  return clean ? Number(clean) : NaN;
}

function calculatePhotoTotal(person) {
  const start = photoNumber(person?.photoStart);
  const end = photoNumber(person?.photoEnd);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "";
  return String(end - start + 1);
}

function photographerPhotoTotal(person) {
  if (!person) return "";
  return normalizeText(person.photoTotal) || calculatePhotoTotal(person);
}

function joinExtraPhotographerField(extras, field) {
  return extras.map((person) => {
    if (field === "photoTotal") return photographerPhotoTotal(person);
    return normalizeText(person[field]);
  }).filter(Boolean).join(" | ");
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
    photographerFromRow(row, 1),
    photographerFromRow(row, 2),
    ...extraPhotographersFromRow(row)
  ];

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

function photographerFromRow(row, index) {
  return normalizePhotographer({
    name: normalizeText(row[`Fotógrafo ${index}`]),
    sd: normalizeText(row[`Nº SD ${index}`]),
    backup: bool(row[`Backup ${index}`]),
    photoStart: normalizeText(row[`Nº foto inicial ${index}`]),
    photoEnd: normalizeText(row[`Nº foto final ${index}`]),
    photoTotal: normalizeText(row[`Total de fotos ${index}`])
  });
}

function extraPhotographersFromRow(row) {
  const names = splitJoinedValues(row["Fotógrafo extra"]);
  const sds = splitJoinedValues(row["Nº SD extra"]);
  const starts = splitJoinedValues(row["Nº foto inicial extra"]);
  const ends = splitJoinedValues(row["Nº foto final extra"]);
  const totals = splitJoinedValues(row["Total de fotos extra"]);
  const count = Math.max(names.length, sds.length, starts.length, ends.length, totals.length, bool(row["Backup extra"]) ? 1 : 0);
  return Array.from({ length: count }, (_, index) => normalizePhotographer({
    name: names[index] || "",
    sd: sds[index] || "",
    backup: bool(row["Backup extra"]),
    photoStart: starts[index] || "",
    photoEnd: ends[index] || "",
    photoTotal: totals[index] || ""
  }));
}

function recordToSheetData(id) {
  const data = record(id);
  const finalized = isRecordFinalized(data);
  const extras = data.photographers.slice(2);
  const extraNames = extras.map((person) => person.name).filter(Boolean).join(" | ");
  const extraSds = extras.map((person) => person.sd).filter(Boolean).join(" | ");
  const photoA = data.photographers[0] || defaultPhotographer();
  const photoB = data.photographers[1] || defaultPhotographer();

  return {
    "Placar A": data.scoreA,
    "Placar B": data.scoreB,
    "Status": statusForRecord(data),
    "Início feito": data.started,
    "Resultado feito": data.resultDone,
    "Início em": data.startedAt,
    "Fim de jogo em": data.endedAt,
    "Tempo cobertura": data.coverageDuration,
    "Fotógrafo 1": photoA.name || "",
    "Nº SD 1": photoA.sd || "",
    "Backup 1": !!photoA.backup,
    "Nº foto inicial 1": photoA.photoStart || "",
    "Nº foto final 1": photoA.photoEnd || "",
    "Total de fotos 1": photographerPhotoTotal(photoA),
    "Fotógrafo 2": photoB.name || "",
    "Nº SD 2": photoB.sd || "",
    "Backup 2": !!photoB.backup,
    "Nº foto inicial 2": photoB.photoStart || "",
    "Nº foto final 2": photoB.photoEnd || "",
    "Total de fotos 2": photographerPhotoTotal(photoB),
    "Fotógrafo extra": extraNames,
    "Nº SD extra": extraSds,
    "Backup extra": extras.length ? extras.every((person) => person.backup) : false,
    "Nº foto inicial extra": joinExtraPhotographerField(extras, "photoStart"),
    "Nº foto final extra": joinExtraPhotographerField(extras, "photoEnd"),
    "Total de fotos extra": joinExtraPhotographerField(extras, "photoTotal"),
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

function getItemById(id) {
  return schedule.find((item) => item.id === id) || localSchedule.find((item) => item.id === id);
}

function getCurrentItem() {
  return resolveItemTeams(getItemById(selectedId) || schedule[0]);
}

function scoreNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : NaN;
}

function winnerForMatch(id) {
  const item = resolveItemTeams(getItemById(id));
  if (!item) return "";
  const data = record(id);
  const scoreA = scoreNumber(data.scoreA);
  const scoreB = scoreNumber(data.scoreB);
  if (Number.isNaN(scoreA) || Number.isNaN(scoreB) || scoreA === scoreB) return "";
  return scoreA > scoreB ? item.teamA : item.teamB;
}

function resolveItemTeams(item) {
  if (!item) return item;
  const dependency = GAME_DEPENDENCIES[item.id];
  if (!dependency) return item;
  return {
    ...item,
    teamA: dependency.teamA ? (winnerForMatch(dependency.teamA) || item.teamA) : item.teamA,
    teamB: dependency.teamB ? (winnerForMatch(dependency.teamB) || item.teamB) : item.teamB
  };
}

function hasCompleteScore(data) {
  return normalizeText(data.scoreA).trim() !== "" && normalizeText(data.scoreB).trim() !== "";
}

function statusForRecord(data) {
  if (isRecordFinalized(data)) return "Finalizada";
  if (data.resultDone || data.endedAt) return "Fim de jogo";
  if (data.started) return "Em cobertura";
  return "Pendente";
}

function statusClassForStatus(status) {
  if (status === "Finalizada") return "finalized";
  if (status === "Fim de jogo") return "ended";
  return "";
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
    return `<option value="${escapeHtml(item.id)}">${done}${escapeHtml(optionLabel(resolveItemTeams(item)))}</option>`;
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
  const statusClass = statusClassForStatus(status);
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

  renderBrackets();
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
  const logo = teamLogoCandidates(name);
  const img = logo
    ? `<img ${imageAttributes("team-logo", logo)}>`
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

function teamLogoCandidates(name) {
  const normalized = normalizeText(name);
  return TEAM_LOGOS[normalized] || "";
}

function imageAttributes(className, src) {
  return `class="${escapeHtml(className)}" src="${escapeHtml(src)}" alt="" onerror="this.remove()"`;
}

function renderPhotographer(person, index) {
  const n = index + 1;
  const total = photographerPhotoTotal(person);
  const removeButton = index >= 2
    ? `<button class="remove-photo" type="button" data-remove-photographer="${index}" title="Remover fotógrafo">
        <i data-lucide="x"></i>
      </button>`
    : "";
  return `
    <div class="photographer-card" data-photographer="${index}">
      ${removeButton}
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
      <div class="photo-range">
        <label>
          <span>Nº foto inicial</span>
          <input value="${escapeHtml(person.photoStart)}" placeholder="Inicial" inputmode="numeric" data-photo-index="${index}" data-photo-field="photoStart">
        </label>
        <label>
          <span>Nº foto final</span>
          <input value="${escapeHtml(person.photoEnd)}" placeholder="Final" inputmode="numeric" data-photo-index="${index}" data-photo-field="photoEnd">
        </label>
        <label>
          <span>Total de fotos</span>
          <input class="photo-total" value="${escapeHtml(total)}" placeholder="0" inputmode="numeric" data-photo-index="${index}" data-photo-field="photoTotal" aria-label="Total de fotos fotógrafo ${n}">
        </label>
      </div>
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

function updatePhotographerField(data, index, field, target) {
  data.photographers[index] = normalizePhotographer(data.photographers[index]);
  data.photographers[index][field] = target.type === "checkbox" ? target.checked : target.value;
  if (field === "photoStart" || field === "photoEnd") {
    data.photographers[index].photoTotal = calculatePhotoTotal(data.photographers[index]);
    const totalInput = target.closest(".photographer-card")?.querySelector(".photo-total");
    if (totalInput) totalInput.value = photographerPhotoTotal(data.photographers[index]);
  }
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

function renderNotifications() {
  if (!els.notificationList) return;
  els.notificationCenter.classList.toggle("has-alerts", notifications.length > 0);
  els.notificationList.innerHTML = notifications.length
    ? notifications.map(renderNotification).join("")
    : `<div class="notification-empty">
        <i data-lucide="bell"></i>
        <span>Aguardando avisos da equipe em campo.</span>
      </div>`;
  if (window.lucide) lucide.createIcons();
}

function switchView(view) {
  activeView = view === "brackets" ? "brackets" : "coverage";
  els.coveragePanels.forEach((panel) => {
    panel.hidden = activeView !== "coverage";
  });
  if (els.bracketsView) els.bracketsView.hidden = activeView !== "brackets";
  document.querySelectorAll(".view-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === activeView);
  });
  if (activeView === "brackets") renderBrackets();
  if (window.lucide) lucide.createIcons();
}

function initBracketFilter() {
  if (!els.bracketFilter) return;
  const current = els.bracketFilter.value || "all";
  els.bracketFilter.innerHTML = [
    `<option value="all">Todos os chaveamentos</option>`,
    ...BRACKET_DEFINITIONS.map((bracket) => `<option value="${escapeHtml(bracket.id)}">${escapeHtml(bracket.title)}</option>`)
  ].join("");
  els.bracketFilter.value = current === "all" || BRACKET_DEFINITIONS.some((bracket) => bracket.id === current)
    ? current
    : "all";
}

function renderBrackets() {
  if (!els.bracketsBoard) return;
  initBracketFilter();
  const filter = els.bracketFilter?.value || "all";
  const brackets = filter === "all"
    ? BRACKET_DEFINITIONS
    : BRACKET_DEFINITIONS.filter((bracket) => bracket.id === filter);
  els.bracketsBoard.innerHTML = brackets.map(renderBracketCard).join("");
  if (window.lucide) lucide.createIcons();
}

function renderBracketCard(bracket) {
  const qfIds = [bracket.qf1, bracket.qf2].filter(Boolean);
  const semiIds = [bracket.sf1, bracket.sf2].filter(Boolean);
  return `
    <article class="bracket-card">
      <header class="bracket-card-head">
        <div>
          <p>Chaveamento</p>
          <h2>${escapeHtml(bracket.title)}</h2>
        </div>
        <span>${escapeHtml(bracketSummary(bracket))}</span>
      </header>
      <div class="bracket-columns">
        <div class="bracket-column">
          <h3>Quartas</h3>
          ${qfIds.length ? qfIds.map(renderBracketMatch).join("") : renderBracketEmpty("Sem quartas cadastradas")}
        </div>
        <div class="bracket-column">
          <h3>Semifinais</h3>
          ${semiIds.map(renderBracketMatch).join("")}
        </div>
        <div class="bracket-column">
          <h3>Final</h3>
          ${renderBracketMatch(bracket.final)}
        </div>
      </div>
    </article>
  `;
}

function bracketSummary(bracket) {
  const ids = [bracket.qf1, bracket.qf2, bracket.sf1, bracket.sf2, bracket.final].filter(Boolean);
  const done = ids.filter((id) => winnerForMatch(id)).length;
  return `${done} de ${ids.length} definidos`;
}

function renderBracketEmpty(text) {
  return `<div class="bracket-empty">${escapeHtml(text)}</div>`;
}

function renderBracketMatch(id) {
  const item = resolveItemTeams(getItemById(id));
  if (!item) return renderBracketEmpty("Jogo nao encontrado");
  const data = record(item.id);
  const winner = winnerForMatch(item.id);
  const scoreReady = hasCompleteScore(data);
  return `
    <article class="bracket-match ${winner ? "has-winner" : ""}">
      <header>
        <span>${escapeHtml(`${shortDate(item.date)} ${item.time}`)}</span>
        <strong>${escapeHtml(item.phase)}</strong>
      </header>
      <div class="bracket-teams">
        ${renderBracketTeam(item.teamA, data.scoreA, scoreReady && winner === item.teamA)}
        ${renderBracketTeam(item.teamB, data.scoreB, scoreReady && winner === item.teamB)}
      </div>
      <footer>
        <span>${winner ? `Vencedor: ${escapeHtml(formatWinnerName(winner))}` : escapeHtml(statusForRecord(data))}</span>
        <button class="secondary-button slim" type="button" data-open-bracket-game="${escapeHtml(item.id)}">
          <i data-lucide="external-link"></i>
          <span>Abrir</span>
        </button>
      </footer>
    </article>
  `;
}

function renderBracketTeam(name, score, isWinner) {
  const normalized = normalizeText(name);
  const logo = teamLogoCandidates(normalized);
  const waiting = /^Vencedor/i.test(normalized);
  const classes = ["bracket-team", isWinner ? "winner" : "", waiting ? "waiting" : ""].filter(Boolean).join(" ");
  const safeScore = normalizeText(score);
  return `
    <div class="${classes}">
      ${logo ? `<img ${imageAttributes("bracket-team-logo", logo)}>` : `<span class="bracket-team-logo fallback">${escapeHtml(teamInitials(normalized))}</span>`}
      <strong>${formatTeamName(normalized)}</strong>
      <span class="bracket-score">${escapeHtml(safeScore || "-")}</span>
    </div>
  `;
}

function teamInitials(name) {
  const normalized = normalizeText(name).trim();
  if (!normalized) return "-";
  if (/^Vencedor/i.test(normalized)) return "?";
  return normalized.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatWinnerName(name) {
  return normalizeText(name).replace(/\s+/g, " ");
}

function openBracketGame(id) {
  if (!getItemById(id)) return;
  selectedId = id;
  switchView("coverage");
  render();
  els.matchCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderNotification(notification) {
  return `
    <article class="notification-item">
      <div class="notification-icon">
        <i data-lucide="hard-drive-download"></i>
      </div>
      <div>
        <h3>${escapeHtml(notification.title)}</h3>
        <p>${escapeHtml(notification.body)}</p>
        <span>${escapeHtml(notification.time)}</span>
      </div>
      <button class="secondary-button slim" type="button" data-open-notification="${escapeHtml(notification.itemId)}">
        Abrir
      </button>
    </article>
  `;
}

function addNotification(notification) {
  notifications = [notification, ...notifications].slice(0, 20);
  saveNotifications();
  renderNotifications();
  playNotificationSound();
  showToast(notification.title);
}

function detectRemoteNotifications(nextSchedule, nextState) {
  if (!remoteReady) return;
  Object.entries(nextState).forEach(([id, nextData]) => {
    const previousData = state[id];
    if (!previousData || previousData.originalPhotosSent || !nextData.originalPhotosSent) return;
    const item = nextSchedule.find((game) => game.id === id) || schedule.find((game) => game.id === id);
    if (!item) return;
    addNotification({
      id: `backup-${id}-${Date.now()}`,
      type: "backup-originals",
      itemId: id,
      title: "Backup originais finalizado",
      body: `${item.time} - ${item.modality} - ${matchTitle(item)}. Fotos prontas para seleção/edição.`,
      time: formatTimestamp(nowIso())
    });
  });
}

function matchTitle(item) {
  if (item.teamA && item.teamB) return `${item.teamA} x ${item.teamB}`;
  return item.participants || item.phase || item.modality;
}

function openNotificationItem(id) {
  if (!schedule.some((item) => item.id === id)) return;
  selectedId = id;
  render();
  els.matchCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearNotifications() {
  notifications = [];
  saveNotifications();
  renderNotifications();
}

function getNotificationAudio() {
  if (!notificationAudio) {
    notificationAudio = new Audio(notificationSoundFile);
    notificationAudio.preload = "auto";
    notificationAudio.volume = 0.95;
  }
  return notificationAudio;
}

async function enableNotificationSound() {
  notificationSoundReady = true;
  try {
    const audio = getNotificationAudio();
    audio.currentTime = 0;
    await audio.play();
    showToast("Som das notificações ativado.");
  } catch {
    playFallbackNotificationSound();
    showToast("Som ativado. Se o MP3 ainda não carregar, uso um bip reserva.");
  }
}

function playNotificationSound() {
  if (!notificationSoundReady) return;
  const audio = getNotificationAudio().cloneNode(true);
  audio.volume = 0.95;
  audio.play().catch(() => playFallbackNotificationSound());
}

function createNotificationAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  notificationAudioContext ||= new AudioContext();
  return notificationAudioContext;
}

function playFallbackNotificationSound() {
  const context = createNotificationAudioContext();
  if (!context) return;
  if (context.state === "suspended") context.resume().catch(() => {});
  const now = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  gain.connect(context.destination);

  [740, 980].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const start = now + index * 0.18;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + 0.16);
  });
}

function storyLabel(type) {
  if (type === "photos") return "FOTOS DISPONÍVEIS";
  return type === "result" ? "PLACAR DO JOGO" : "INÍCIO DO JOGO";
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
  if (Array.isArray(src)) {
    return src.reduce(
      (promise, candidate) => promise.catch(() => loadImage(candidate)),
      Promise.reject(new Error("Tentando imagens alternativas."))
    );
  }
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

function modalityParts(item) {
  const text = normalizeText(item.modality).trim();
  const match = text.match(/^(.+?)\s+(Masculino|Feminino)$/i);
  if (!match) return [text.toUpperCase()];
  return [match[1].toUpperCase(), match[2].toUpperCase()];
}

function drawStoryModality(ctx, item, y, size, lineGap = 66) {
  const lines = modalityParts(item);
  if (lines.length === 1) {
    drawStoryText(ctx, lines[0], y, size, 900);
    return;
  }
  drawStoryText(ctx, lines[0], y, size, 860);
  drawStoryText(ctx, lines[1], y + lineGap, size, 860);
}

function drawStoryModalityCompact(ctx, item, y, size = 52) {
  drawStoryText(ctx, modalityParts(item).join(" "), y, size, 850);
}

function drawStoryModalitySmall(ctx, item, y) {
  const text = modalityParts(item).join(" ");
  drawStoryText(ctx, `(${text})`, y, 42, 820);
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

function drawScoreNumber(ctx, value, centerX, centerY, opacity = 1) {
  ctx.save();
  ctx.globalAlpha = opacity;
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
  if (side === "A" && scoreA < scoreB) return 0.38;
  if (side === "B" && scoreB < scoreA) return 0.38;
  return 1;
}

async function openStoryArt(type) {
  const item = getCurrentItem();
  const data = record(item.id);

  if (!item.teamA || !item.teamB) {
    showToast("Essa arte precisa de duas equipes na partida.");
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
    linkToCopy: ""
  };

  await drawStory(type, item, data);
  if (window.lucide) lucide.createIcons();
}

async function drawStory(type, item, data) {
  const canvas = els.storyCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  try {
    drawCover(ctx, await loadImage(STORY_BACKGROUNDS[type] || STORY_BACKGROUNDS.fallback));
  } catch {
    try {
      drawCover(ctx, await loadImage(STORY_BACKGROUNDS.fallback));
    } catch {
      drawFallbackBackground(ctx);
    }
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  const isResult = type === "result";
  const isPhotos = type === "photos";
  const titleY = isPhotos ? 555 : isResult ? 460 : 520;
  drawStoryText(ctx, storyLabel(type), titleY, isResult ? 70 : 74, 930);
  if (isResult || isPhotos) {
    drawStoryModalityCompact(ctx, item, isPhotos ? 650 : 555, 48);
  }

  const logoSize = isResult ? 345 : isPhotos ? 360 : 370;
  const logoY = isResult ? 820 : isPhotos ? 930 : 805;
  const logoAX = 315;
  const logoBX = 765;
  const logoA = teamLogoCandidates(item.teamA);
  const logoB = teamLogoCandidates(item.teamB);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.38)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  const logoAOpacity = isResult ? loserOpacity(data, "A") : 1;
  const logoBOpacity = isResult ? loserOpacity(data, "B") : 1;

  try {
    ctx.globalAlpha = logoAOpacity;
    drawContainedImage(ctx, await loadImage(logoA), logoAX, logoY, logoSize, logoSize);
  } catch {
    ctx.globalAlpha = logoAOpacity;
    drawLogoFallback(ctx, item.teamA, logoAX, logoY, logoSize);
  }

  try {
    ctx.globalAlpha = logoBOpacity;
    drawContainedImage(ctx, await loadImage(logoB), logoBX, logoY, logoSize, logoSize);
  } catch {
    ctx.globalAlpha = logoBOpacity;
    drawLogoFallback(ctx, item.teamB, logoBX, logoY, logoSize);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawVersusStory(ctx, logoY);

  if (isResult) {
    drawScoreNumber(ctx, data.scoreA, logoAX, 1135, loserOpacity(data, "A"));
    drawScoreNumber(ctx, data.scoreB, logoBX, 1135, loserOpacity(data, "B"));
  } else if (isPhotos) {
    // Photos art keeps only the title, sport and team crests.
  } else {
    drawStoryModality(ctx, item, 1125, 72, 74);
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

function findGameByOffset(offset) {
  const visible = getVisibleGames();
  if (!visible.length) return null;
  const currentIndex = Math.max(0, visible.findIndex((item) => item.id === selectedId));
  const nextIndex = (currentIndex + offset + visible.length) % visible.length;
  return visible[nextIndex];
}

function selectGameOffset(offset, message) {
  const item = findGameByOffset(offset);
  if (!item || item.id === selectedId) return;
  selectedId = item.id;
  render();
  showToast(message);
}

function shouldPauseRemoteRefresh() {
  const active = document.activeElement;
  const editingField = active && els.matchCard.contains(active) && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName);
  return savingRemote || editingField;
}

function startRemotePolling() {
  window.clearInterval(remotePollTimer);
  remotePollTimer = window.setInterval(() => {
    if (shouldPauseRemoteRefresh()) return;
    loadRemoteData({ silent: true });
  }, remotePollIntervalMs);
}

async function loadRemoteData(options = {}) {
  const silent = !!options.silent;
  if (!silent) setSyncStatus("Conectando...", "saving");
  try {
    const response = await fetch(`${API_URL}?action=list&t=${Date.now()}`);
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "Erro ao carregar planilha");

    const nextSchedule = payload.rows.map(rowToItem).filter((item) => item.id);
    if (!nextSchedule.length) throw new Error("Planilha sem jogos");
    const nextState = payload.rows.reduce((acc, row) => {
      if (row.ID) acc[row.ID] = rowToRecord(row);
      return acc;
    }, {});
    detectRemoteNotifications(nextSchedule, nextState);
    schedule = nextSchedule;
    state = nextState;
    remoteReady = true;
    saveState();
    if (!schedule.some((item) => item.id === selectedId)) selectedId = schedule[0]?.id;
    setSyncStatus("Online", "online");
    render();
  } catch (error) {
    remoteReady = false;
    setSyncStatus("Modo local", "offline");
    if (!silent) showToast("Não consegui carregar a planilha. O app ficou em modo local.");
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
  savingRemote = true;
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
  } finally {
    savingRemote = false;
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
  els.viewTabs?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-view]");
    if (!tab) return;
    switchView(tab.dataset.view);
  });

  els.bracketFilter?.addEventListener("change", renderBrackets);

  els.bracketsBoard?.addEventListener("click", (event) => {
    const open = event.target.closest("[data-open-bracket-game]");
    if (!open) return;
    openBracketGame(open.dataset.openBracketGame);
  });

  els.dateFilter.addEventListener("change", () => {
    render();
  });

  els.gamePicker.addEventListener("change", () => {
    selectedId = els.gamePicker.value;
    render();
  });

  els.prevGame.addEventListener("click", () => selectGameOffset(-1, "Partida anterior selecionada."));
  els.nextGame.addEventListener("click", () => selectGameOffset(1, "Próxima partida selecionada."));

  els.enableSound.addEventListener("click", () => {
    enableNotificationSound().catch(() => showToast("Não consegui ativar o som agora."));
  });

  els.clearNotifications.addEventListener("click", clearNotifications);

  els.notificationList.addEventListener("click", (event) => {
    const open = event.target.closest("[data-open-notification]");
    if (!open) return;
    openNotificationItem(open.dataset.openNotification);
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
      updatePhotographerField(data, index, field, event.target);
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
      updatePhotographerField(data, index, field, event.target);
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
    const remove = event.target.closest("[data-remove-photographer]");
    const toggle = event.target.closest("[data-toggle]");
    const art = event.target.closest("[data-art-type]");
    if (art) {
      openStoryArt(art.dataset.artType).catch(() => showToast("Não consegui gerar a arte."));
      return;
    }
    if (add) {
      data.photographers.push(defaultPhotographer());
      saveState();
      queueSave(item.id, true);
      render();
      return;
    }
    if (remove) {
      const index = Number(remove.dataset.removePhotographer);
      if (index >= 2) {
        data.photographers.splice(index, 1);
        saveState();
        queueSave(item.id, true);
        render();
      }
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
initBracketFilter();
switchView(activeView);
renderNotifications();
render();
loadRemoteData();
startRemotePolling();
