const API_URL = "https://script.google.com/macros/s/AKfycbzF1MGAmojETsvqyoxybuBjDN3FRh4ivw785S1B9omphFuQ5Uuq8nrxla8SgHDedundxg/exec";
const localSchedule = window.JCM_SCHEDULE || [];
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
  { id: "volei-masculino", title: "Vôlei Masculino", qf1: "JCM-011", qf2: "JCM-010", sf1: "JCM-023", sf2: "JCM-022", final: "JCM-041" },
  { id: "volei-feminino", title: "Vôlei Feminino", qf1: "JCM-007", qf2: "JCM-008", sf1: "JCM-024", sf2: "JCM-025", final: "JCM-039" }
];
const GAME_DEPENDENCIES = BRACKET_DEFINITIONS.reduce((dependencies, bracket) => {
  if (bracket.qf1 && bracket.sf1) dependencies[bracket.sf1] = { ...dependencies[bracket.sf1], teamB: bracket.qf1 };
  if (bracket.qf2 && bracket.sf2) dependencies[bracket.sf2] = { ...dependencies[bracket.sf2], teamB: bracket.qf2 };
  if (bracket.sf1 && bracket.final) dependencies[bracket.final] = { ...dependencies[bracket.final], teamA: bracket.sf1 };
  if (bracket.sf2 && bracket.final) dependencies[bracket.final] = { ...dependencies[bracket.final], teamB: bracket.sf2 };
  return dependencies;
}, {});

let schedule = [...localSchedule];
let records = {};
let activeFilter = "all";

const els = {
  status: document.querySelector("#publicSyncStatus"),
  filters: document.querySelector("#publicBracketFilters"),
  board: document.querySelector("#publicBracketsBoard"),
  refresh: document.querySelector("#refreshBrackets")
};

function normalizeText(value) {
  return value == null ? "" : String(value);
}

function cleanDisplayText(value) {
  return normalizeText(value)
    .replace(/Atl\?ticas/g, "Atléticas")
    .replace(/Atl\?tica/g, "Atlética")
    .replace(/Cabo[-\s]+de[-\s]+Guerra/gi, "Cabo de Guerra");
}

function bool(value) {
  if (typeof value === "boolean") return value;
  return ["true", "sim", "ok", "feito", "1", "x"].includes(normalizeText(value).trim().toLowerCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function shortDate(value) {
  const parts = normalizeText(value).split("/");
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : normalizeText(value);
}

function formatSheetDate(value, fallback = "") {
  const text = normalizeText(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return text || fallback;
}

function formatSheetTime(value, fallback = "") {
  const text = normalizeText(value);
  const iso = text.match(/T(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const time = text.match(/^(\d{1,2}):(\d{2})/);
  if (time) return `${time[1].padStart(2, "0")}:${time[2]}`;
  return text || fallback;
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

function localItem(id) {
  return localSchedule.find((item) => item.id === id) || {};
}

function rowToItem(row) {
  const fallback = localItem(row.ID);
  return {
    id: normalizeText(row.ID || fallback.id),
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

function rowToRecord(row) {
  const finalizada = bool(row.Finalizada);
  const started = bool(row["Início feito"]) || finalizada || row.Status === "Em cobertura" || row.Status === "Finalizada";
  const endedAt = normalizeText(row["Fim de jogo em"]);
  const resultDone = bool(row["Resultado feito"]) || !!endedAt || finalizada;
  return {
    scoreA: normalizeText(row["Placar A"]),
    scoreB: normalizeText(row["Placar B"]),
    started,
    resultDone,
    finalized: finalizada
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

function record(id) {
  return records[id] || { scoreA: "", scoreB: "", started: false, resultDone: false, finalized: false };
}

function getItemById(id) {
  return schedule.find((item) => item.id === id) || localSchedule.find((item) => item.id === id);
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
  if (data.finalized) return "Finalizada";
  if (data.resultDone) return "Fim de jogo";
  if (data.started) return "Em cobertura";
  return "Pendente";
}

function teamLogoCandidates(name) {
  return TEAM_LOGOS[normalizeText(name)] || "";
}

function imageAttributes(className, src) {
  const sources = Array.isArray(src) ? src.filter(Boolean) : [src].filter(Boolean);
  const fallback = sources[1] || "";
  const onerror = fallback
    ? `if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=''}else{this.remove()}`
    : "this.remove()";
  return `class="${escapeHtml(className)}" src="${escapeHtml(sources[0] || "")}" ${fallback ? `data-fallback="${escapeHtml(fallback)}"` : ""} alt="" onerror="${escapeHtml(onerror)}"`;
}

function teamInitials(name) {
  const normalized = normalizeText(name).trim();
  if (!normalized) return "-";
  if (/^Vencedor/i.test(normalized)) return "?";
  return normalized.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatTeamName(name) {
  const normalized = normalizeText(name);
  const parts = normalized.match(/^Multivix\s+(.+)$/i);
  if (parts) return `Multivix<br>${escapeHtml(parts[1])}`;
  return escapeHtml(normalized);
}

function bracketSummary(bracket) {
  const ids = [bracket.qf1, bracket.qf2, bracket.sf1, bracket.sf2, bracket.final].filter(Boolean);
  const done = ids.filter((id) => winnerForMatch(id)).length;
  return `${done} de ${ids.length} definidos`;
}

function renderFilters() {
  els.filters.innerHTML = [
    `<button class="${activeFilter === "all" ? "active" : ""}" type="button" data-filter="all">Todos</button>`,
    ...BRACKET_DEFINITIONS.map((bracket) => (
      `<button class="${activeFilter === bracket.id ? "active" : ""}" type="button" data-filter="${escapeHtml(bracket.id)}">${escapeHtml(bracket.title)}</button>`
    ))
  ].join("");
}

function renderBrackets() {
  renderFilters();
  const brackets = activeFilter === "all"
    ? BRACKET_DEFINITIONS
    : BRACKET_DEFINITIONS.filter((bracket) => bracket.id === activeFilter);
  els.board.innerHTML = brackets.map(renderBracketCard).join("");
  if (window.lucide) lucide.createIcons();
}

function renderBracketCard(bracket) {
  const qfIds = [bracket.qf1, bracket.qf2].filter(Boolean);
  const semiIds = [bracket.sf1, bracket.sf2].filter(Boolean);
  return `
    <article class="bracket-card public-bracket-card">
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
          ${qfIds.length ? qfIds.map(renderBracketMatch).join("") : renderBracketEmpty("Sem quartas")}
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

function renderBracketEmpty(text) {
  return `<div class="bracket-empty">${escapeHtml(text)}</div>`;
}

function renderBracketMatch(id) {
  const item = resolveItemTeams(getItemById(id));
  if (!item) return renderBracketEmpty("Jogo não encontrado");
  const data = record(item.id);
  const winner = winnerForMatch(item.id);
  const scoreReady = hasCompleteScore(data);
  return `
    <article class="bracket-match ${winner ? "has-winner" : ""}">
      <header>
        <span>${escapeHtml(`${shortDate(item.date)} ${item.time}`)}</span>
        <strong>${escapeHtml(titleCaseWords(item.phase))}</strong>
      </header>
      <div class="bracket-teams">
        ${renderBracketTeam(item.teamA, data.scoreA, scoreReady && winner === item.teamA)}
        ${renderBracketTeam(item.teamB, data.scoreB, scoreReady && winner === item.teamB)}
      </div>
      <footer>
        <span>${winner ? `Vencedor: ${escapeHtml(winner)}` : escapeHtml(statusForRecord(data))}</span>
      </footer>
    </article>
  `;
}

function renderBracketTeam(name, score, isWinner) {
  const normalized = normalizeText(name);
  const logo = teamLogoCandidates(normalized);
  const waiting = /^Vencedor/i.test(normalized);
  const classes = ["bracket-team", isWinner ? "winner" : "", waiting ? "waiting" : ""].filter(Boolean).join(" ");
  return `
    <div class="${classes}">
      ${logo ? `<img ${imageAttributes("bracket-team-logo", logo)}>` : `<span class="bracket-team-logo fallback">${escapeHtml(teamInitials(normalized))}</span>`}
      <strong>${formatTeamName(normalized)}</strong>
      <span class="bracket-score">${escapeHtml(normalizeText(score) || "-")}</span>
    </div>
  `;
}

function setStatus(text, className = "") {
  els.status.textContent = text;
  els.status.className = `sync-status ${className}`.trim();
}

async function loadRemoteData() {
  setStatus("Atualizando...", "saving");
  try {
    const response = await fetch(`${API_URL}?action=list&t=${Date.now()}`);
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "Erro ao carregar");
    const nextSchedule = payload.rows.map(rowToItem).filter((item) => item.id);
    schedule = mergeRemoteSchedule(nextSchedule);
    records = payload.rows.reduce((acc, row) => {
      if (row.ID) acc[row.ID] = rowToRecord(row);
      return acc;
    }, {});
    setStatus("Online", "online");
    renderBrackets();
  } catch {
    setStatus("Modo local", "offline");
    renderBrackets();
  }
}

els.filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  renderBrackets();
});

els.refresh.addEventListener("click", loadRemoteData);

renderBrackets();
loadRemoteData();
window.setInterval(loadRemoteData, 15000);
