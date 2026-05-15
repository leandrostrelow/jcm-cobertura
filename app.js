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
  bracket: "story-background-chaveamento.png",
  upcoming: "story-background-proximos.png",
  youtube: "youtube-cover-background.png",
  fallback: "story-background.png"
};
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const YOUTUBE_WIDTH = 1920;
const YOUTUBE_HEIGHT = 1080;
const logoSources = (fileName) => [fileName, `assets/logos/${fileName}`];
const TEAM_LOGOS = {
  "Multivix Vitória": logoSources("multivix-vitoria.png"),
  "Multivix Vitoria": logoSources("multivix-vitoria.png"),
  "Multivix Cachoeiro": logoSources("multivix-cachoeiro.png"),
  "UFES": logoSources("ufes.png"),
  "EMESCAM": logoSources("emescam.png"),
  "UVV": logoSources("uvv.png"),
  "UNESC": logoSources("unesc.png")
};
const BRACKET_DEFINITIONS = [
  { id: "futsal-masculino", title: "Futsal Masculino", qf1: "JCM-013", qf2: "JCM-001", sf1: "JCM-018", sf2: "JCM-020", final: "JCM-053" },
  { id: "futsal-feminino", title: "Futsal Feminino", qf1: "JCM-002", qf2: "JCM-012", sf1: "JCM-021", sf2: "JCM-019", final: "JCM-051" },
  { id: "handebol-masculino", title: "Handebol Masculino", qf1: "JCM-006", qf2: "JCM-004", sf1: "JCM-029", sf2: "JCM-031", final: "JCM-049" },
  { id: "handebol-feminino", title: "Handebol Feminino", qf1: "JCM-009", qf2: "JCM-005", sf1: "JCM-032", sf2: "JCM-030", final: "JCM-047" },
  { id: "basquete-masculino", title: "Basquete Masculino", qf1: "JCM-017", qf2: "JCM-027", sf1: "JCM-034", sf2: "JCM-035", final: "JCM-045" },
  { id: "basquete-feminino", title: "Basquete Feminino", qf1: "JCM-016", qf2: "", sf1: "JCM-033", sf2: "JCM-026", final: "JCM-043" },
  { id: "cabo-de-guerra-masculino", title: "Cabo de Guerra Masculino", qf1: "JCM-056", qf2: "JCM-057", sf1: "JCM-058", sf2: "JCM-059", final: "JCM-060" },
  { id: "cabo-de-guerra-feminino", title: "Cabo de Guerra Feminino", qf1: "JCM-061", qf2: "JCM-062", sf1: "JCM-063", sf2: "JCM-064", final: "JCM-065" },
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
let youtubeDateFilter = "all";
let youtubeSelectedIds = readYoutubeSelection();
const saveTimers = {};
const pendingRemoteSaveIds = new Set();
let lastLocalEditAt = 0;

const els = {
  viewTabs: document.querySelector(".view-tabs"),
  coveragePanels: document.querySelectorAll(".picker, #notificationCenter, #matchCard"),
  bracketsView: document.querySelector("#bracketsView"),
  bracketsBoard: document.querySelector("#bracketsBoard"),
  bracketFilter: document.querySelector("#bracketFilter"),
  progressView: document.querySelector("#progressView"),
  progressBoard: document.querySelector("#progressBoard"),
  progressFilter: document.querySelector("#progressFilter"),
  upcomingView: document.querySelector("#upcomingView"),
  upcomingPanel: document.querySelector("#upcomingPanel"),
  youtubeView: document.querySelector("#youtubeView"),
  youtubePanel: document.querySelector("#youtubePanel"),
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
  storyKicker: document.querySelector("#storyKicker"),
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

function readYoutubeSelection() {
  try {
    const value = JSON.parse(localStorage.getItem("jcm-youtube-selection-v1")) || [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveYoutubeSelection() {
  localStorage.setItem("jcm-youtube-selection-v1", JSON.stringify(youtubeSelectedIds));
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
    upcomingPostDone: false,
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
  state[id] = { ...defaultRecord(), ...state[id] };
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

function cleanDisplayText(value) {
  return normalizeText(value)
    .replace(/Atl\?ticas/g, "Atléticas")
    .replace(/Atl\?tica/g, "Atlética")
    .replace(/atl\?ticas/g, "atléticas")
    .replace(/atl\?tica/g, "atlética")
    .replace(/Cabo[-\s]+de[-\s]+Guerra/gi, "Cabo de Guerra")
    .replace(/edit\?veis/g, "editáveis")
    .replace(/\?nico/g, "único");
}

function titleCaseWords(value) {
  const minorWords = new Set(["de", "da", "do", "das", "dos", "e"]);
  let wordIndex = 0;
  return cleanDisplayText(value).replace(/\p{L}[\p{L}\p{M}]*/gu, (word) => {
    const lower = word.toLocaleLowerCase("pt-BR");
    const isMinor = wordIndex > 0 && minorWords.has(lower);
    wordIndex += 1;
    if (isMinor) return lower;
    if (word.length <= 2 && word === word.toUpperCase()) return word;
    return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1).toLocaleLowerCase("pt-BR");
  });
}

function scheduleSortValue(item) {
  return [
    item.dateISO || formatSheetDate(item.date),
    formatSheetTime(item.time),
    item.venue || "",
    item.modality || "",
    item.phase || ""
  ].join("|");
}

function sortScheduleItems(items) {
  return [...items].sort((a, b) => scheduleSortValue(a).localeCompare(scheduleSortValue(b), "pt-BR", { numeric: true }));
}

function formatSheetDate(value, fallback = "") {
  const text = normalizeText(value || fallback).trim();
  if (!text) return "";
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  return text;
}

function formatSheetTime(value, fallback = "") {
  const text = normalizeText(value || fallback).trim();
  if (!text) return "";
  const plainTime = text.match(/^(\d{1,2}):(\d{2})/);
  if (plainTime) return `${plainTime[1].padStart(2, "0")}:${plainTime[2]}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
    }
  }
  return text;
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
    date: formatSheetDate(row.Data, fallback.date),
    weekday: cleanDisplayText(row.Dia || fallback.weekday),
    time: formatSheetTime(row["Horário"], fallback.time),
    venue: cleanDisplayText(row.Local || fallback.venue),
    type: cleanDisplayText(row.Tipo || fallback.type),
    modality: cleanDisplayText(row.Modalidade || fallback.modality),
    phase: cleanDisplayText(row.Fase || fallback.phase),
    teamA: cleanDisplayText(row["Equipe A"] || fallback.teamA),
    teamB: cleanDisplayText(row["Equipe B"] || fallback.teamB),
    participants: cleanDisplayText(fallback.participants || row.Observações),
    notes: cleanDisplayText(row.Observações || fallback.notes)
  };
}

function mergeRemoteSchedule(remoteItems) {
  const remoteById = new Map(remoteItems.map((item) => [item.id, item]));
  const used = new Set();
  const merged = localSchedule.map((item) => {
    const remoteItem = remoteById.get(item.id);
    if (!remoteItem) return item;
    used.add(item.id);
    const mergedItem = { ...item, ...remoteItem };
    if (item.type === "Chaveamento") mergedItem.type = item.type;
    return mergedItem;
  });
  remoteItems.forEach((item) => {
    if (!used.has(item.id) && !localSchedule.some((local) => local.id === item.id)) merged.push(item);
  });
  return merged;
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
  const upcomingPostDone = bool(row["Post agenda feito"]);

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
    upcomingPostDone,
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
  const item = getItemById(id) || {};
  const data = record(id);
  const finalized = isRecordFinalized(data);
  const extras = data.photographers.slice(2);
  const extraNames = extras.map((person) => person.name).filter(Boolean).join(" | ");
  const extraSds = extras.map((person) => person.sd).filter(Boolean).join(" | ");
  const photoA = data.photographers[0] || defaultPhotographer();
  const photoB = data.photographers[1] || defaultPhotographer();

  return {
    "ID": id,
    "Fim de semana": item.weekend || "",
    "Data": item.date || "",
    "Dia": item.weekday || "",
    "Horário": item.time || "",
    "Local": item.venue || "",
    "Tipo": item.type || "",
    "Modalidade": item.modality || "",
    "Fase": item.phase || "",
    "Equipe A": item.teamA || "",
    "Placar A": data.scoreA,
    "Equipe B": item.teamB || "",
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
    "Post agenda feito": data.upcomingPostDone,
    "Link live ao vivo": data.liveUrl,
    "Finalizada": finalized,
    "Observações": item.notes || ""
  };
}

function shortDate(date) {
  return formatSheetDate(date).slice(0, 5);
}

function getDates() {
  return [...new Set(sortScheduleItems(schedule).map((item) => item.date).filter(Boolean))];
}

function getVisibleGames() {
  const date = els.dateFilter.value;
  return sortScheduleItems(schedule.filter((item) => item.type !== "Chaveamento" && (date === "all" || item.date === date)));
}

function gameItems() {
  return schedule.filter((item) => item.type === "Jogo" && item.teamA && item.teamB);
}

function isAgendaEvent(item) {
  return item.type === "Evento" && /cabo/i.test(slugify(item.modality || item.sport || ""));
}

function agendaItems() {
  return sortScheduleItems([...gameItems(), ...schedule.filter(isAgendaEvent)]);
}

function agendaGroupKey(item) {
  return slugify(item.sport || item.modality || "");
}

function smartAgendaChunks(items, maxItems = 4) {
  const chunks = [];
  for (let index = 0; index < items.length; index += maxItems) {
    chunks.push(items.slice(index, index + maxItems));
  }
  return chunks;
}

function upcomingGames(count = 4, fromId = selectedId) {
  const games = gameItems();
  const currentIndex = games.findIndex((item) => item.id === fromId);
  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  return games.slice(startIndex).filter((item) => !isFinalized(item)).slice(0, count).map(resolveItemTeams);
}

function agendaPostBatches() {
  const dateGroups = new Map();
  agendaItems().map(resolveItemTeams).forEach((item) => {
    const key = item.date || "Sem data";
    if (!dateGroups.has(key)) dateGroups.set(key, []);
    dateGroups.get(key).push(item);
  });

  const batches = [];
  dateGroups.forEach((items, date) => {
    const chunks = smartAgendaChunks(items, 4);
    const totalChunks = chunks.length;
    for (let index = 0; index < totalChunks; index += 1) {
      const games = chunks[index];
      const first = games[0] || {};
      batches.push({
        id: `agenda-${slugify(date)}-${index + 1}`,
        date,
        label: `${weekdayShort(first.weekday)} - ${shortDate(date)}`,
        chunkLabel: totalChunks > 1 ? `${index + 1}/${totalChunks}` : "",
        games
      });
    }
  });
  return batches;
}

function agendaBatchesByDate() {
  return agendaPostBatches().reduce((groups, batch) => {
    if (!groups.length || groups[groups.length - 1].date !== batch.date) {
      groups.push({ date: batch.date, label: batch.label, batches: [] });
    }
    groups[groups.length - 1].batches.push(batch);
    return groups;
  }, []);
}

function agendaBatchById(id) {
  return agendaPostBatches().find((batch) => batch.id === id);
}

function agendaBatchPosted(batch) {
  return batch.games.length > 0 && batch.games.every((item) => record(item.id).upcomingPostDone);
}

function agendaBatchTitle(batch) {
  const sports = [...new Set(batch.games.map((item) => cleanDisplayText(item.sport || item.modality || "")).filter(Boolean))];
  if (sports.length === 1) return titleCaseWords(sports[0]);
  return `${batch.games.length} ${batch.games.length === 1 ? "jogo" : "jogos"}`;
}

function weekdayShort(weekday) {
  return normalizeText(weekday).replace(/-feira/i, "");
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
  return `${item.time} - ${item.modality} - ${titleCaseWords(item.phase)} - ${opponent}`;
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
  const finalized = isRecordFinalized(data);
  els.gamePicker?.classList.toggle("finalized-picker", finalized);

  els.matchCard.innerHTML = `
    <div class="match-top ${finalized ? "finalized-top" : ""}">
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
          <span class="pill phase">${escapeHtml(titleCaseWords(item.phase))}</span>
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
          ${renderLinkField("originalPhotosUrl", "Link Fotos Originais", data.originalPhotosUrl, "hard-drive-download")}
          ${renderArtCard("start", "Post Início")}
          ${renderArtCard("result", "Post Resultado")}
          ${renderLinkField("editedPhotosUrl", "Link Fotos Editadas", data.editedPhotosUrl, "download")}
          ${renderLinkField("liveUrl", "Link Da Live Ao Vivo", data.liveUrl, "radio")}
        </div>
      </section>

      <section class="field-group">
        <p class="field-title">Checklist</p>
        <div class="done-grid">
          ${doneButton("started", "Início", data.started, "play")}
          ${doneButton("startArtDone", "Arte Início", data.startArtDone, "badge-check")}
          ${doneButton("resultArtDone", "Arte Resultado", data.resultArtDone, "badge-check")}
          ${doneButton("originalPhotosSent", "Backup Originais", data.originalPhotosSent, "upload-cloud")}
          ${doneButton("selectionDone", "Seleção", data.selectionDone, "list-checks")}
          ${doneButton("editingDone", "Edição", data.editingDone, "pen-line")}
          ${doneButton("reviewDone", "Conferência", data.reviewDone, "badge-check")}
          ${doneButton("editedPhotosDone", "Fotos Editadas", data.editedPhotosDone, "images")}
        </div>
      </section>
    </div>
  `;

  renderBrackets();
  renderProgressBoard();
  renderUpcomingPanel();
  renderYoutubePanel();
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
  const sources = Array.isArray(src) ? src.filter(Boolean) : [src].filter(Boolean);
  const fallback = sources[1] || "";
  const onerror = fallback
    ? `if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=''}else{this.remove()}`
    : "this.remove()";
  return `class="${escapeHtml(className)}" src="${escapeHtml(sources[0] || "")}" ${fallback ? `data-fallback="${escapeHtml(fallback)}"` : ""} alt="" onerror="${escapeHtml(onerror)}"`;
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
          <span>Nº Foto Inicial</span>
          <input value="${escapeHtml(person.photoStart)}" placeholder="Inicial" inputmode="numeric" data-photo-index="${index}" data-photo-field="photoStart">
        </label>
        <label>
          <span>Nº Foto Final</span>
          <input value="${escapeHtml(person.photoEnd)}" placeholder="Final" inputmode="numeric" data-photo-index="${index}" data-photo-field="photoEnd">
        </label>
        <label>
          <span>Total de Fotos</span>
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
        <span>Gerar Arte</span>
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

function updateBracketScore(id, field, value) {
  const item = getItemById(id);
  if (!item || !["scoreA", "scoreB"].includes(field)) return;
  const data = record(id);
  data[field] = value;
  syncScoreCompletion(data);
  saveState();
  queueSave(id, true);
  renderBrackets();
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
  activeView = ["brackets", "progress", "upcoming", "youtube"].includes(view) ? view : "coverage";
  els.coveragePanels.forEach((panel) => {
    panel.hidden = activeView !== "coverage";
  });
  if (els.bracketsView) els.bracketsView.hidden = activeView !== "brackets";
  if (els.progressView) els.progressView.hidden = activeView !== "progress";
  if (els.upcomingView) els.upcomingView.hidden = activeView !== "upcoming";
  if (els.youtubeView) els.youtubeView.hidden = activeView !== "youtube";
  document.querySelectorAll(".view-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === activeView);
  });
  if (activeView === "brackets") renderBrackets();
  if (activeView === "progress") renderProgressBoard();
  if (activeView === "upcoming") renderUpcomingPanel();
  if (activeView === "youtube") renderYoutubePanel();
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
        <div class="bracket-card-actions">
          <span>${escapeHtml(bracketSummary(bracket))}</span>
          <button class="generate-art" type="button" data-bracket-art="${escapeHtml(bracket.id)}" title="Gerar arte do chaveamento">
            <i data-lucide="wand-sparkles"></i>
            <span>Gerar arte</span>
          </button>
        </div>
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
  const inlineScore = item.type === "Chaveamento";
  const matchClasses = ["bracket-match", winner ? "has-winner" : "", inlineScore ? "inline-score" : ""].filter(Boolean).join(" ");
  return `
    <article class="${matchClasses}">
      <header>
        <span>${escapeHtml(`${shortDate(item.date)} ${item.time}`)}</span>
        <strong>${escapeHtml(titleCaseWords(item.phase))}</strong>
      </header>
      <div class="bracket-teams">
        ${renderBracketTeam(item.teamA, data.scoreA, scoreReady && winner === item.teamA, {
          editable: inlineScore,
          itemId: item.id,
          field: "scoreA"
        })}
        ${renderBracketTeam(item.teamB, data.scoreB, scoreReady && winner === item.teamB, {
          editable: inlineScore,
          itemId: item.id,
          field: "scoreB"
        })}
      </div>
      <footer>
        <span>${winner ? `Vencedor: ${escapeHtml(formatWinnerName(winner))}` : escapeHtml(statusForRecord(data))}</span>
        ${inlineScore
          ? `<span class="bracket-inline-note">Placar no chaveamento</span>`
          : `<button class="secondary-button slim" type="button" data-open-bracket-game="${escapeHtml(item.id)}">
              <i data-lucide="external-link"></i>
              <span>Abrir</span>
            </button>`}
      </footer>
    </article>
  `;
}

function renderBracketTeam(name, score, isWinner, options = {}) {
  const normalized = normalizeText(name);
  const logo = teamLogoCandidates(normalized);
  const waiting = /^Vencedor/i.test(normalized);
  const classes = ["bracket-team", isWinner ? "winner" : "", waiting ? "waiting" : ""].filter(Boolean).join(" ");
  const safeScore = normalizeText(score);
  const scoreControl = options.editable && !waiting
    ? `<input class="bracket-score-input" inputmode="numeric" maxlength="3" value="${escapeHtml(safeScore)}" data-bracket-score="${escapeHtml(options.itemId)}" data-field="${escapeHtml(options.field)}" aria-label="Placar ${escapeHtml(normalized)}">`
    : `<span class="bracket-score">${escapeHtml(safeScore || "-")}</span>`;
  return `
    <div class="${classes}">
      ${logo ? `<img ${imageAttributes("bracket-team-logo", logo)}>` : `<span class="bracket-team-logo fallback">${escapeHtml(teamInitials(normalized))}</span>`}
      <strong>${formatTeamName(normalized)}</strong>
      ${scoreControl}
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

function renderProgressBoard() {
  if (!els.progressBoard) return;
  const filter = els.progressFilter?.value || "all";
  const games = gameItems().map(resolveItemTeams).filter((item) => {
    const status = statusForRecord(record(item.id));
    if (filter === "finalized") return status === "Finalizada";
    if (filter === "ended") return status === "Fim de jogo";
    if (filter === "active") return status === "Em cobertura";
    if (filter === "pending") return status === "Pendente";
    return true;
  });
  const totals = progressTotals();
  els.progressBoard.innerHTML = `
    <div class="progress-summary">
      <div><strong>${totals.finalized}</strong><span>Finalizadas</span></div>
      <div><strong>${totals.ended}</strong><span>Fim de jogo</span></div>
      <div><strong>${totals.active}</strong><span>Em cobertura</span></div>
      <div><strong>${totals.pending}</strong><span>Pendentes</span></div>
    </div>
    <div class="progress-list">
      ${games.length ? games.map(renderProgressCard).join("") : `<div class="progress-empty">Nenhum jogo nesse filtro.</div>`}
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function progressTotals() {
  return gameItems().reduce((acc, item) => {
    const status = statusForRecord(record(item.id));
    if (status === "Finalizada") acc.finalized += 1;
    else if (status === "Fim de jogo") acc.ended += 1;
    else if (status === "Em cobertura") acc.active += 1;
    else acc.pending += 1;
    return acc;
  }, { finalized: 0, ended: 0, active: 0, pending: 0 });
}

function renderProgressCard(item) {
  const data = record(item.id);
  const status = statusForRecord(data);
  const statusClass = statusClassForStatus(status);
  const itemProgress = progress(item);
  return `
    <article class="progress-card ${statusClass}">
      <div class="progress-main">
        <div>
          <span>${escapeHtml(`${shortDate(item.date)} ${item.time}`)}</span>
          <h3>${escapeHtml(item.modality)} - ${escapeHtml(titleCaseWords(item.phase))}</h3>
          <p>${escapeHtml(matchTitle(item))}</p>
        </div>
        <strong class="status ${statusClass}">${escapeHtml(status)}</strong>
      </div>
      <div class="progress-meter" aria-label="${itemProgress.done} de ${itemProgress.total} ações feitas">
        <span style="width: ${itemProgress.percent}%"></span>
      </div>
      <footer>
        <span>${itemProgress.done} de ${itemProgress.total} ações feitas</span>
        <button class="secondary-button slim" type="button" data-open-progress-game="${escapeHtml(item.id)}">
          <i data-lucide="external-link"></i>
          <span>Abrir</span>
        </button>
      </footer>
    </article>
  `;
}

function renderUpcomingPanel() {
  if (!els.upcomingPanel) return;
  const batches = agendaPostBatches();
  const dayGroups = agendaBatchesByDate();
  els.upcomingPanel.innerHTML = `
    <div class="upcoming-head">
      <div>
        <p>Agenda rápida</p>
        <h2>Postagens de próximos jogos</h2>
      </div>
      <span class="upcoming-total">${batches.length} artes planejadas</span>
    </div>
    <div class="upcoming-days">
      ${dayGroups.length ? dayGroups.map(renderUpcomingDay).join("") : `<div class="upcoming-empty">Não há jogos para montar agenda.</div>`}
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function renderUpcomingDay(group) {
  const posted = group.batches.filter(agendaBatchPosted).length;
  return `
    <section class="upcoming-day">
      <header class="upcoming-day-head">
        <div>
          <p>${escapeHtml(group.label)}</p>
          <h3>${group.batches.length} ${group.batches.length === 1 ? "arte planejada" : "artes planejadas"}</h3>
        </div>
        <span>${posted} de ${group.batches.length} postadas</span>
      </header>
      <div class="upcoming-list">
        ${group.batches.map(renderUpcomingBatch).join("")}
      </div>
    </section>
  `;
}

function renderUpcomingBatch(batch) {
  const done = agendaBatchPosted(batch);
  return `
    <article class="upcoming-batch ${done ? "done" : ""}">
      <header>
        <div>
          <span>${batch.chunkLabel ? `Arte ${escapeHtml(batch.chunkLabel)}` : "Arte única"} • ${batch.games.length} ${batch.games.length === 1 ? "jogo" : "jogos"}</span>
          <h3>${escapeHtml(agendaBatchTitle(batch))}</h3>
        </div>
        <button class="icon-action ${done ? "done" : ""}" type="button" data-toggle-upcoming-posted="${escapeHtml(batch.id)}">
          <i data-lucide="check-circle-2"></i>
          <span>${done ? "Postado" : "Marcar postado"}</span>
        </button>
      </header>
      <div class="upcoming-batch-games">
        ${batch.games.map(renderUpcomingGameRow).join("")}
      </div>
      <footer>
        <button class="generate-art" type="button" data-upcoming-art="${escapeHtml(batch.id)}">
          <i data-lucide="wand-sparkles"></i>
          <span>Gerar arte</span>
        </button>
      </footer>
    </article>
  `;
}

function renderUpcomingGameRow(item) {
  return `
    <button class="upcoming-game-row" type="button" data-open-upcoming-game="${escapeHtml(item.id)}">
      <span>${escapeHtml(item.time)}</span>
      <strong>${escapeHtml(titleCaseWords(item.modality))}</strong>
      <small>${escapeHtml(item.venue)}</small>
    </button>
  `;
}

function youtubeItems() {
  return agendaItems().map(resolveItemTeams);
}

function youtubeItemsByDate() {
  return youtubeItems().reduce((groups, item) => {
    if (youtubeDateFilter !== "all" && item.date !== youtubeDateFilter) return groups;
    const last = groups[groups.length - 1];
    if (!last || last.date !== item.date) {
      groups.push({ date: item.date, label: `${weekdayShort(item.weekday)} - ${shortDate(item.date)}`, items: [] });
    }
    groups[groups.length - 1].items.push(item);
    return groups;
  }, []);
}

function selectedYoutubeItems() {
  const items = youtubeItems();
  return youtubeSelectedIds
    .map((id) => items.find((item) => item.id === id))
    .filter(Boolean)
    .map(resolveItemTeams);
}

function renderYoutubePanel() {
  if (!els.youtubePanel) return;
  const dates = getDates();
  const selectedCount = selectedYoutubeItems().length;
  const groups = youtubeItemsByDate();
  els.youtubePanel.innerHTML = `
    <div class="youtube-head">
      <div>
        <p>Capas YouTube</p>
        <h2>Selecione os jogos da capa</h2>
      </div>
      <div class="youtube-actions">
        <button class="secondary-button slim" type="button" data-youtube-clear>
          <i data-lucide="x"></i>
          <span>Limpar</span>
        </button>
        <button class="generate-art" type="button" data-youtube-generate ${selectedCount ? "" : "disabled"}>
          <i data-lucide="wand-sparkles"></i>
          <span>Gerar capa</span>
        </button>
      </div>
    </div>
    <div class="youtube-tools">
      <label>
        <span>Data</span>
        <select data-youtube-date-filter>
          <option value="all">Todas as datas</option>
          ${dates.map((date) => `<option value="${escapeHtml(date)}" ${youtubeDateFilter === date ? "selected" : ""}>${escapeHtml(shortDate(date))}</option>`).join("")}
        </select>
      </label>
      <button class="secondary-button" type="button" data-youtube-select-visible>
        <i data-lucide="check-square"></i>
        <span>Selecionar dia visível</span>
      </button>
      <div class="youtube-count">
        <strong>${selectedCount}</strong>
        <span>selecionados para a capa</span>
      </div>
    </div>
    <div class="youtube-hint">Ideal para capa: 2 a 5 jogos. O fundo pode ficar na raiz com o nome <strong>youtube-cover-background.png</strong>.</div>
    <div class="youtube-days">
      ${groups.length ? groups.map(renderYoutubeDay).join("") : `<div class="upcoming-empty">Não há jogos para selecionar.</div>`}
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function renderYoutubeDay(group) {
  const selected = group.items.filter((item) => youtubeSelectedIds.includes(item.id)).length;
  return `
    <section class="youtube-day">
      <header class="youtube-day-head">
        <div>
          <p>${escapeHtml(group.label)}</p>
          <h3>${group.items.length} ${group.items.length === 1 ? "item" : "itens"}</h3>
        </div>
        <span>${selected} selecionados</span>
      </header>
      <div class="youtube-game-grid">
        ${group.items.map(renderYoutubeGameCard).join("")}
      </div>
    </section>
  `;
}

function renderYoutubeGameCard(item) {
  const selected = youtubeSelectedIds.includes(item.id);
  const leftLogo = item.teamA ? teamLogoCandidates(item.teamA) : "";
  const rightLogo = item.teamB ? teamLogoCandidates(item.teamB) : "";
  const eventLabel = !item.teamA || !item.teamB ? cleanDisplayText(item.participants || item.phase || item.modality) : "";
  const logosHtml = item.teamA && item.teamB
    ? `${leftLogo ? `<img ${imageAttributes("youtube-game-logo", leftLogo)}>` : `<strong>${escapeHtml(teamInitials(item.teamA))}</strong>`}
        <em>x</em>
        ${rightLogo ? `<img ${imageAttributes("youtube-game-logo", rightLogo)}>` : `<strong>${escapeHtml(teamInitials(item.teamB))}</strong>`}`
    : `<strong class="youtube-event-chip">${escapeHtml(eventLabel || "Evento")}</strong>`;
  return `
    <label class="youtube-game-card ${selected ? "selected" : ""}">
      <input type="checkbox" ${selected ? "checked" : ""} data-youtube-game="${escapeHtml(item.id)}">
      <span class="youtube-game-logos">
        ${logosHtml}
      </span>
      <span class="youtube-game-info">
        <strong>${escapeHtml(item.time)} - ${escapeHtml(titleCaseWords(item.modality))}</strong>
        <small>${escapeHtml(item.venue)}</small>
        <small>${escapeHtml(matchTitle(item))}</small>
      </span>
    </label>
  `;
}

function toggleYoutubeGame(id, checked) {
  if (checked && youtubeSelectedIds.length >= 5 && !youtubeSelectedIds.includes(id)) {
    showToast("Para manter a capa limpa, use no máximo 5 jogos.");
    renderYoutubePanel();
    return;
  }
  youtubeSelectedIds = checked
    ? [...new Set([...youtubeSelectedIds, id])]
    : youtubeSelectedIds.filter((itemId) => itemId !== id);
  saveYoutubeSelection();
  renderYoutubePanel();
}

function selectVisibleYoutubeDay() {
  const visibleIds = youtubeItemsByDate().flatMap((group) => group.items.map((item) => item.id));
  youtubeSelectedIds = visibleIds.slice(0, 5);
  saveYoutubeSelection();
  renderYoutubePanel();
  showToast("Selecionei os primeiros 5 itens visíveis para a capa.");
}

function toggleAgendaBatchPosted(batchId) {
  const batch = agendaBatchById(batchId);
  if (!batch) return;
  const nextValue = !agendaBatchPosted(batch);
  batch.games.forEach((item) => {
    record(item.id).upcomingPostDone = nextValue;
    queueSave(item.id, true);
  });
  saveState();
  renderUpcomingPanel();
  showToast(nextValue ? "Postagem marcada como feita." : "Postagem marcada como pendente.");
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

function setArtCanvasSize(width, height) {
  els.storyCanvas.width = width;
  els.storyCanvas.height = height;
  els.storyModal.classList.toggle("wide-art", width > height);
}

function bracketStoryFileName(bracket) {
  return `${slugify(`chaveamento-atualizado-${bracket.title}`)}.png`;
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
  const widthTarget = ctx.canvas.width;
  const heightTarget = ctx.canvas.height;
  const scale = Math.max(widthTarget / image.width, heightTarget / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, (widthTarget - width) / 2, (heightTarget - height) / 2, width, height);
}

function drawFallbackBackground(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0);
  gradient.addColorStop(0, "#3c1763");
  gradient.addColorStop(1, "#080311");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawContainedImage(ctx, image, centerX, centerY, maxWidth, maxHeight) {
  const bounds = visibleImageBounds(image);
  const scale = Math.min(maxWidth / bounds.width, maxHeight / bounds.height);
  const width = bounds.width * scale;
  const height = bounds.height * scale;
  ctx.drawImage(
    image,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    centerX - width / 2,
    centerY - height / 2,
    width,
    height
  );
}

function visibleImageBounds(image) {
  const cache = visibleImageBounds.cache || (visibleImageBounds.cache = new WeakMap());
  if (cache.has(image)) return cache.get(image);

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const fallback = { x: 0, y: 0, width, height };

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] <= 12) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (minX > maxX || minY > maxY) {
      cache.set(image, fallback);
      return fallback;
    }

    const padding = 4;
    const sourceX = Math.max(0, minX - padding);
    const sourceY = Math.max(0, minY - padding);
    const bounds = {
      x: sourceX,
      y: sourceY,
      width: Math.min(width - sourceX, maxX - minX + 1 + padding * 2),
      height: Math.min(height - sourceY, maxY - minY + 1 + padding * 2)
    };
    cache.set(image, bounds);
    return bounds;
  } catch {
    cache.set(image, fallback);
    return fallback;
  }
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

function drawPhotosAvailableTitle(ctx) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.52)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;

  let titleSize = 166;
  do {
    ctx.font = `900 ${titleSize}px Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif`;
    if (ctx.measureText("FOTOS").width <= 760) break;
    titleSize -= 4;
  } while (titleSize > 110);

  ctx.save();
  ctx.translate(STORY_WIDTH / 2, 510);
  ctx.transform(1, -0.03, -0.16, 1, 0, 0);
  ctx.lineJoin = "round";
  ctx.lineWidth = 14;
  ctx.strokeStyle = "rgba(12, 6, 24, 0.72)";
  ctx.strokeText("FOTOS", 0, 0);
  const whiteGradient = ctx.createLinearGradient(0, -85, 0, 80);
  whiteGradient.addColorStop(0, "#ffffff");
  whiteGradient.addColorStop(0.55, "#f7f7f7");
  whiteGradient.addColorStop(1, "#cfcfd6");
  ctx.fillStyle = whiteGradient;
  ctx.fillText("FOTOS", 0, 0);
  ctx.restore();

  let subtitleSize = 104;
  do {
    ctx.font = `900 italic ${subtitleSize}px "Trebuchet MS", "Arial Black", Impact, sans-serif`;
    if (ctx.measureText("DISPONÍVEIS").width <= 900) break;
    subtitleSize -= 4;
  } while (subtitleSize > 72);

  ctx.save();
  ctx.translate(STORY_WIDTH / 2, 610);
  ctx.rotate(-0.045);
  ctx.lineJoin = "round";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(14, 2, 30, 0.9)";
  ctx.strokeText("DISPONÍVEIS", 0, 0);
  ctx.fillStyle = "#8b3dff";
  ctx.fillText("DISPONÍVEIS", 0, 0);
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "#c48cff";
  ctx.fillText("DISPONÍVEIS", -3, -4);
  ctx.restore();
  ctx.restore();
}

function drawPositionedText(ctx, text, x, y, size, maxWidth, options = {}) {
  let fontSize = size;
  ctx.save();
  ctx.textAlign = options.align || "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = options.color || "#ffffff";
  ctx.shadowColor = options.shadow === false ? "transparent" : "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = options.shadow === false ? 0 : 16;
  ctx.shadowOffsetY = options.shadow === false ? 0 : 6;
  do {
    ctx.font = `${options.weight || 900} ${fontSize}px Inter, Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    fontSize -= 3;
  } while (fontSize > 28);
  ctx.fillText(text, x, y);
  ctx.restore();
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
  if (els.storyKicker) els.storyKicker.textContent = "Arte para Instagram";
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

async function openBracketArt(bracketId) {
  const bracket = BRACKET_DEFINITIONS.find((item) => item.id === bracketId);
  if (!bracket) return;

  els.storyModal.hidden = false;
  if (els.storyKicker) els.storyKicker.textContent = "Arte para Instagram";
  els.storyTitle.textContent = "Arte de chaveamento";
  els.downloadStory.disabled = true;
  els.shareStory.disabled = true;
  currentStory = {
    blob: null,
    fileName: bracketStoryFileName(bracket),
    title: `Chaveamento atualizado - ${bracket.title}`,
    linkToCopy: ""
  };

  await drawBracketStory(bracket);
  if (window.lucide) lucide.createIcons();
}

async function openUpcomingArt(batchId) {
  const batch = agendaBatchById(batchId);
  if (!batch || !batch.games.length) {
    showToast("Não encontrei jogos para essa arte.");
    return;
  }

  els.storyModal.hidden = false;
  if (els.storyKicker) els.storyKicker.textContent = "Arte para Instagram";
  els.storyTitle.textContent = "Arte de próximos jogos";
  els.downloadStory.disabled = true;
  els.shareStory.disabled = true;
  currentStory = {
    blob: null,
    fileName: `${slugify(`proximos-jogos-${batch.label}-${batch.chunkLabel || "1"}`)}.png`,
    title: `Próximos jogos - ${batch.label}`,
    linkToCopy: ""
  };

  await drawUpcomingStory(batch);
  if (window.lucide) lucide.createIcons();
}

async function openYoutubeCoverArt() {
  const items = selectedYoutubeItems();
  if (!items.length) {
    showToast("Selecione pelo menos um jogo para montar a capa.");
    return;
  }
  if (items.length > 5) {
    showToast("Para a capa ficar limpa, selecione no máximo 5 jogos.");
    return;
  }

  const label = youtubeCoverLabel(items);
  els.storyModal.hidden = false;
  if (els.storyKicker) els.storyKicker.textContent = "Capa para YouTube";
  els.storyTitle.textContent = "Capa YouTube";
  els.downloadStory.disabled = true;
  els.shareStory.disabled = true;
  currentStory = {
    blob: null,
    fileName: `${slugify(`capa-youtube-${label}`)}.png`,
    title: `Capa YouTube - ${label}`,
    linkToCopy: ""
  };

  await drawYoutubeCover(items);
  if (window.lucide) lucide.createIcons();
}

function youtubeCoverLabel(items) {
  const dates = [...new Set(items.map((item) => item.date).filter(Boolean))];
  if (dates.length === 1) {
    const first = items[0];
    return `${weekdayShort(first.weekday)} - ${shortDate(first.date)}`;
  }
  return "Jogos selecionados";
}

async function drawStory(type, item, data) {
  setArtCanvasSize(STORY_WIDTH, STORY_HEIGHT);
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
  if (isPhotos) {
    drawPhotosAvailableTitle(ctx);
  } else {
    drawStoryText(ctx, storyLabel(type), titleY, isResult ? 70 : 74, 930);
  }
  if (isResult || isPhotos) {
    drawStoryModalityCompact(ctx, item, isPhotos ? 725 : 555, isPhotos ? 50 : 48);
  }

  const logoSize = isResult ? 345 : isPhotos ? 360 : 370;
  const logoY = isResult ? 820 : isPhotos ? 980 : 805;
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

async function drawBracketStory(bracket) {
  setArtCanvasSize(STORY_WIDTH, STORY_HEIGHT);
  const canvas = els.storyCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  await drawStoryBackground(ctx, [STORY_BACKGROUNDS.bracket, STORY_BACKGROUNDS.photos, STORY_BACKGROUNDS.fallback]);
  ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  drawPositionedText(ctx, "CHAVEAMENTO ATUALIZADO", STORY_WIDTH / 2, 395, 30, 720, {
    color: "rgba(255,255,255,0.58)",
    weight: 850
  });
  drawPositionedText(ctx, bracket.title.toUpperCase(), STORY_WIDTH / 2, 450, 46, 920);

  await drawBracketBranch(ctx, bracket.qf1, bracket.sf1, 285);
  await drawBracketBranch(ctx, bracket.qf2, bracket.sf2, 795);
  await drawBracketFinal(ctx, bracket.final);

  currentStory.blob = await canvasToBlob(canvas);
  els.downloadStory.disabled = false;
  els.shareStory.disabled = false;
}

async function drawUpcomingStory(batch) {
  const games = batch.games;
  setArtCanvasSize(STORY_WIDTH, STORY_HEIGHT);
  const canvas = els.storyCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  await drawStoryBackground(ctx, [STORY_BACKGROUNDS.upcoming, STORY_BACKGROUNDS.photos, STORY_BACKGROUNDS.fallback]);
  ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  drawPositionedText(ctx, "PRÓXIMOS JOGOS", STORY_WIDTH / 2, 440, 72, 900);
  drawPositionedText(ctx, batch.label.toUpperCase(), STORY_WIDTH / 2, 535, 42, 520, { color: "#ffffff" });

  const gap = games.length <= 2 ? 260 : 235;
  const startY = games.length <= 2 ? 800 : games.length === 3 ? 735 : 685;
  for (let index = 0; index < games.length; index += 1) {
    await drawUpcomingStoryGame(ctx, games[index], startY + index * gap);
  }

  currentStory.blob = await canvasToBlob(canvas);
  els.downloadStory.disabled = false;
  els.shareStory.disabled = false;
}

async function drawUpcomingStoryGame(ctx, item, y) {
  const x = STORY_WIDTH / 2;
  drawPositionedText(ctx, item.time, x, y - 55, 30, 260, {
    color: "rgba(255,255,255,0.72)",
    weight: 850
  });
  drawPositionedText(ctx, item.modality.toUpperCase(), x, y - 18, 34, 430);
  drawPositionedText(ctx, item.venue.toUpperCase(), x, y + 19, 22, 420, {
    color: "rgba(255,255,255,0.58)",
    weight: 850
  });

  if (!item.teamA || !item.teamB) {
    drawPositionedText(ctx, normalizeText(item.participants || item.phase || "EVENTO").toUpperCase(), x, y + 68, 28, 620, {
      color: "rgba(255,255,255,0.82)",
      weight: 850
    });
    return;
  }

  const logoY = y + 20;
  await drawSmallStoryLogo(ctx, item.teamA, x - 360, logoY);
  drawPositionedText(ctx, "X", x, y + 68, 38, 80);
  await drawSmallStoryLogo(ctx, item.teamB, x + 360, logoY);
}

async function drawYoutubeCover(items) {
  setArtCanvasSize(YOUTUBE_WIDTH, YOUTUBE_HEIGHT);
  const canvas = els.storyCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, YOUTUBE_WIDTH, YOUTUBE_HEIGHT);

  await drawStoryBackground(ctx, [STORY_BACKGROUNDS.youtube, STORY_BACKGROUNDS.upcoming, STORY_BACKGROUNDS.fallback]);
  const layout = youtubeCoverLayout(items.length);

  drawPositionedText(ctx, youtubeCoverLabel(items).toUpperCase(), layout.textX, layout.titleY, 44, 760, {
    color: "#ffffff",
    weight: 950
  });

  for (let index = 0; index < items.length; index += 1) {
    await drawYoutubeCoverGame(ctx, items[index], layout.startY + index * layout.rowGap, layout);
  }

  currentStory.blob = await canvasToBlob(canvas);
  els.downloadStory.disabled = false;
  els.shareStory.disabled = false;
}

function youtubeCoverLayout(count) {
  const base = {
    textX: 1325,
    leftX: 1010,
    rightX: 1640,
    timeSize: 28,
    modalitySize: 34,
    venueSize: 22,
    xSize: 38
  };
  if (count <= 1) {
    return { ...base, titleY: 330, startY: 555, rowGap: 0, logoSize: 230 };
  }
  if (count === 2) {
    return { ...base, titleY: 270, startY: 460, rowGap: 260, logoSize: 205 };
  }
  if (count === 3) {
    return { ...base, titleY: 210, startY: 390, rowGap: 215, logoSize: 178 };
  }
  if (count === 4) {
    return { ...base, titleY: 150, startY: 315, rowGap: 172, logoSize: 158 };
  }
  return {
    ...base,
    titleY: 105,
    startY: 245,
    rowGap: 152,
    logoSize: 132,
    timeSize: 24,
    modalitySize: 30,
    venueSize: 19,
    xSize: 32
  };
}

async function drawYoutubeBrand(ctx) {
  try {
    const jcmLogo = await loadImage(["jcm-logo.png", "LOGO JCM + LOTUS/jcm-logo.png"]);
    drawContainedImage(ctx, jcmLogo, 365, 345, 540, 390);
  } catch {
    drawPositionedText(ctx, "JCM", 365, 345, 160, 520);
  }

  try {
    const lotusLogo = await loadImage(["lotus-logo.png", "LOGO JCM + LOTUS/lotus-logo.png"]);
    drawContainedImage(ctx, lotusLogo, 365, 740, 430, 175);
  } catch {
    drawPositionedText(ctx, "LOTUS", 365, 740, 86, 430);
  }
}

async function drawYoutubeCoverGame(ctx, item, y, layout) {
  if (item.teamA && item.teamB) {
    await drawYoutubeTeamLogo(ctx, item.teamA, layout.leftX, y + 10, layout.logoSize);
    await drawYoutubeTeamLogo(ctx, item.teamB, layout.rightX, y + 10, layout.logoSize);
    drawPositionedText(ctx, "X", layout.textX, y + 72, layout.xSize, 80);
  } else {
    drawPositionedText(ctx, cleanDisplayText(item.participants || item.phase || "EVENTO").toUpperCase(), layout.textX, y + 72, layout.modalitySize, 620, {
      color: "rgba(255,255,255,0.82)",
      weight: 900
    });
  }

  drawPositionedText(ctx, item.time, layout.textX, y - 36, layout.timeSize, 180, {
    color: "rgba(255,255,255,0.74)",
    weight: 900
  });
  drawPositionedText(ctx, titleCaseWords(item.modality).toUpperCase(), layout.textX, y, layout.modalitySize, 530, {
    color: "#ffffff",
    weight: 950
  });
  drawPositionedText(ctx, cleanDisplayText(item.venue).toUpperCase(), layout.textX, y + 36, layout.venueSize, 520, {
    color: "rgba(255,255,255,0.62)",
    weight: 900
  });
}

async function drawYoutubeTeamLogo(ctx, teamName, x, y, size) {
  const logo = teamLogoCandidates(teamName);
  if (logo) {
    try {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.42)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      drawContainedImage(ctx, await loadImage(logo), x, y, size, size);
      ctx.restore();
      return;
    } catch {
      // Fall back to text below.
    }
  }
  drawPositionedText(ctx, teamInitials(teamName), x, y, 56, 140);
}

async function drawSmallStoryLogo(ctx, teamName, x, y) {
  const logo = teamLogoCandidates(teamName);
  if (logo) {
    try {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.36)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      drawContainedImage(ctx, await loadImage(logo), x, y, 320, 190);
      ctx.restore();
      return;
    } catch {
      // Fall back to text below.
    }
  }
  drawPositionedText(ctx, teamInitials(teamName), x, y, 44, 120);
}

async function drawStoryBackground(ctx, candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    try {
      drawCover(ctx, await loadImage(candidate));
      return;
    } catch {
      // Try the next configured background.
    }
  }
  drawFallbackBackground(ctx);
}

async function drawBracketBranch(ctx, quarterId, semiId, centerX) {
  const topMatchId = quarterId || semiId;
  const semiY = quarterId ? 1120 : 900;
  if (quarterId) {
    drawPositionedText(ctx, "QUARTAS", centerX, 620, 30, 340);
    await drawBracketStoryMatch(ctx, topMatchId, centerX, 770, 200);
    drawBracketArrow(ctx, centerX, 905, 990);
  }

  drawPositionedText(ctx, "SEMIFINAIS", centerX, semiY - 76, 30, 360);
  await drawBracketStoryMatch(ctx, semiId, centerX, semiY + 55, 200, { highlightKnownOnly: true });
}

async function drawBracketFinal(ctx, finalId) {
  drawPositionedText(ctx, "FINAL", STORY_WIDTH / 2, 1395, 31, 320);
  await drawBracketStoryMatch(ctx, finalId, STORY_WIDTH / 2, 1510, 190, { compact: true, highlightKnownOnly: true });
}

async function drawBracketStoryMatch(ctx, id, centerX, centerY, logoSize, options = {}) {
  const item = resolveItemTeams(getItemById(id));
  if (!item) return;
  const offset = options.compact ? 118 : 125;
  const xA = centerX - offset;
  const xB = centerX + offset;
  const drewA = await drawBracketStoryLogo(ctx, item.teamA, xA, centerY, logoSize, options);
  const drewB = await drawBracketStoryLogo(ctx, item.teamB, xB, centerY, logoSize, options);
  if (drewA || drewB) {
    drawPositionedText(ctx, "X", centerX, centerY, options.compact ? 38 : 42, 70);
  }
}

async function drawBracketStoryLogo(ctx, teamName, x, y, size, options = {}) {
  const logo = teamLogoCandidates(teamName);
  const waiting = /^Vencedor/i.test(normalizeText(teamName));
  if (waiting) return false;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.shadowColor = "rgba(0,0,0,0.42)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  if (logo) {
    try {
      drawContainedImage(ctx, await loadImage(logo), x, y, size, size);
      ctx.restore();
      return true;
    } catch {
      // Fall back to a text badge below.
    }
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  roundRect(ctx, x - size / 2, y - size / 2, size, size, 22);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  drawPositionedText(ctx, normalizeText(teamName).toUpperCase(), x, y, 30, size - 20, {
    color: "#151515"
  });
  return true;
}

function drawBracketArrow(ctx, x, y1, y2) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 24, y2 - 30);
  ctx.lineTo(x, y2);
  ctx.lineTo(x + 24, y2 - 30);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
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
  const recentEdit = Date.now() - lastLocalEditAt < 1800;
  return savingRemote || editingField || pendingRemoteSaveIds.size > 0 || recentEdit;
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
    const protectedIds = new Set(pendingRemoteSaveIds);
    const active = document.activeElement;
    if (active && els.matchCard.contains(active) && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName) && selectedId) {
      protectedIds.add(selectedId);
    }
    protectedIds.forEach((id) => {
      if (state[id]) nextState[id] = state[id];
    });
    detectRemoteNotifications(nextSchedule, nextState);
    schedule = mergeRemoteSchedule(nextSchedule);
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
  lastLocalEditAt = Date.now();
  pendingRemoteSaveIds.add(id);
  saveState();
  if (!remoteReady) {
    pendingRemoteSaveIds.delete(id);
    return;
  }
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
    pendingRemoteSaveIds.delete(id);
    delete saveTimers[id];
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
  els.progressFilter?.addEventListener("change", renderProgressBoard);

  els.bracketsBoard?.addEventListener("click", (event) => {
    const open = event.target.closest("[data-open-bracket-game]");
    const art = event.target.closest("[data-bracket-art]");
    if (art) {
      openBracketArt(art.dataset.bracketArt).catch(() => showToast("Não consegui gerar a arte do chaveamento."));
      return;
    }
    if (!open) return;
    openBracketGame(open.dataset.openBracketGame);
  });

  els.bracketsBoard?.addEventListener("change", (event) => {
    const input = event.target.closest("[data-bracket-score]");
    if (!input) return;
    updateBracketScore(input.dataset.bracketScore, input.dataset.field, input.value);
  });

  els.progressBoard?.addEventListener("click", (event) => {
    const open = event.target.closest("[data-open-progress-game]");
    if (!open) return;
    openBracketGame(open.dataset.openProgressGame);
  });

  els.upcomingPanel?.addEventListener("click", (event) => {
    const art = event.target.closest("[data-upcoming-art]");
    const toggle = event.target.closest("[data-toggle-upcoming-posted]");
    const open = event.target.closest("[data-open-upcoming-game]");
    if (art) {
      openUpcomingArt(art.dataset.upcomingArt).catch(() => showToast("Não consegui gerar o post dos próximos jogos."));
      return;
    }
    if (toggle) {
      toggleAgendaBatchPosted(toggle.dataset.toggleUpcomingPosted);
      return;
    }
    if (!open) return;
    openBracketGame(open.dataset.openUpcomingGame);
  });

  els.youtubePanel?.addEventListener("change", (event) => {
    const dateFilter = event.target.closest("[data-youtube-date-filter]");
    const game = event.target.closest("[data-youtube-game]");
    if (dateFilter) {
      youtubeDateFilter = dateFilter.value;
      renderYoutubePanel();
      return;
    }
    if (!game) return;
    toggleYoutubeGame(game.dataset.youtubeGame, game.checked);
  });

  els.youtubePanel?.addEventListener("click", (event) => {
    const clear = event.target.closest("[data-youtube-clear]");
    const selectVisible = event.target.closest("[data-youtube-select-visible]");
    const generate = event.target.closest("[data-youtube-generate]");
    if (clear) {
      youtubeSelectedIds = [];
      saveYoutubeSelection();
      renderYoutubePanel();
      return;
    }
    if (selectVisible) {
      selectVisibleYoutubeDay();
      return;
    }
    if (generate) {
      openYoutubeCoverArt().catch(() => showToast("Não consegui gerar a capa do YouTube."));
    }
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
      const field = event.target.dataset.field;
      data[field] = event.target.value;
      if (field === "scoreA" || field === "scoreB") {
        syncScoreCompletion(data);
      }
      saveState();
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
