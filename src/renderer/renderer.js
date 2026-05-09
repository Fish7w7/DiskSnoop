const api = window.diskScope;
const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
const LAST_SCAN_KEY = "disksnoop:lastScan";
const APP_VERSION_LABEL = "0.1.0-beta.1";

const state = {
  screen: "welcome",
  tab: "overview",
  drives: [],
  selectedDrive: null,
  settings: null,
  scanProgress: null,
  scanResult: null,
  selectedItem: null,
  selectedIds: new Set(),
  selectedQuarantineId: "",
  quarantine: [],
  history: [],
  installedApps: [],
  contentPreview: null,
  modal: null,
  search: "",
  fileSearch: "",
  fileSizeFilter: 500 * MB,
  fileSort: "size",
  candidateSearch: "",
  sizeFilter: 1,
  sort: "size",
  candidateScope: "Todos",
  candidateSafety: "Seguro revisar",
  candidateAge: "Prioridade",
  candidateMinSize: 10 * MB,
  candidateLimit: 80,
  duplicateSearch: "",
  duplicateMinWaste: 0,
  selectedDuplicateId: "",
  leftoversSearch: "",
  leftoversStatus: "Possível sobra",
  leftoversLocation: "Todos",
  leftoversLimit: 80,
  paused: false,
  toast: ""
};

let lastRenderedTab = null;

const tabs = [
  ["overview", "Visão Geral", "home"],
  ["folders", "Pastas Grandes", "folder"],
  ["files", "Arquivos Grandes", "file"],
  ["candidates", "Candidatos", "clipboard"],
  ["duplicates", "Duplicados", "copy"],
  ["leftovers", "Sobras de Apps", "cube"],
  ["quarantine", "Quarentena", "shield"],
  ["history", "Histórico", "clock"],
  ["updates", "Atualização", "download"],
  ["settings", "Configurações", "settings"]
];

const themeLabels = {
  light: "Claro",
  dark: "Escuro",
  hacker: "Hacker",
  neon: "Neon",
  system: "Sistema"
};

const availableThemes = ["Claro", "Escuro"];

function normalizeTheme(settings) {
  const normalized = { ...(settings || {}) };
  if (normalized.theme === "black") normalized.theme = "dark";
  if (!themeLabels[normalized.theme]) normalized.theme = "light";
  normalized.ignoredPaths = Array.isArray(normalized.ignoredPaths) ? normalized.ignoredPaths : [];
  normalized.includedPaths = Array.isArray(normalized.includedPaths) ? normalized.includedPaths : [];
  return normalized;
}

const iconPaths = {
  logo: '<path d="M12 2C8 6.2 5 9.5 5 13.4A7 7 0 0 0 19 13.4C19 9.5 16 6.2 12 2Z"/><path d="M12 10a3 3 0 0 0-3 3 3 3 0 0 0 6 0" class="icon-cut"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
  clipboard: '<path d="M8 4h8l1 3H7z"/><path d="M6 6H5v15h14V6h-1"/><path d="M9 11h6M9 15h6"/>',
  shield: '<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-5"/>',
  settings: '<path d="M12.2 2h-.4l-1 3.1a7.5 7.5 0 0 0-1.7.7L6.2 4.3l-1.9 1.9 1.5 2.9c-.3.5-.5 1.1-.7 1.7L2 11.8v.4l3.1 1c.2.6.4 1.2.7 1.7l-1.5 2.9 1.9 1.9 2.9-1.5c.5.3 1.1.5 1.7.7l1 3.1h.4l1-3.1c.6-.2 1.2-.4 1.7-.7l2.9 1.5 1.9-1.9-1.5-2.9c.3-.5.5-1.1.7-1.7l3.1-1v-.4l-3.1-1a7.5 7.5 0 0 0-.7-1.7l1.5-2.9-1.9-1.9-2.9 1.5a7.5 7.5 0 0 0-1.7-.7z"/><circle cx="12" cy="12" r="3"/>',
  disk: '<path d="M5 6c0-2 14-2 14 0v12c0 2-14 2-14 0z"/><path d="M5 6c0 2 14 2 14 0"/><circle cx="12" cy="14" r="2"/>',
  file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
  cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12 4 7.5M12 12l8-4.5M12 12v9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  database: '<path d="M5 6c0-2 14-2 14 0s-14 2-14 0v12c0 2 14 2 14 0V6"/><path d="M5 12c0 2 14 2 14 0"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h1M3 12h1M3 18h1"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
  refresh: '<path d="M20 12a8 8 0 0 1-14 5"/><path d="M4 17h5v-5"/><path d="M4 12a8 8 0 0 1 14-5"/><path d="M20 7h-5v5"/>',
  reset: '<path d="M9 7H4V2"/><path d="M4.6 7A8 8 0 1 1 4 12"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/>',
  external: '<path d="M14 3h7v7"/><path d="M21 3 10 14"/><path d="M19 14v7H3V5h7"/>',
  check: '<path d="m5 12 4 4 10-10"/>'
};

function icon(name, className = "") {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || ""}</svg>`;
}

function appLogo(className = "") {
  return `<span class="logo ${className}"><img src="../assets/app-icon.png" alt=""></span>`;
}

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index < 2 ? 0 : 1)} ${units[index]}`;
}

function compactBytes(bytes = 0) {
  if (bytes >= GB) return `${Math.round(bytes / GB)} GB`;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  return formatBytes(bytes);
}

function relativeDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const days = Math.max(0, Math.round(diff / 86400000));
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 60) return `${days} dias`;
  if (days < 730) return days >= 365 ? "1 ano" : `${Math.round(days / 30)} meses`;
  return `${Math.round(days / 365)} anos`;
}

function fullDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function durationLabel(ms) {
  const total = Math.max(0, Math.round(Number(ms || 0) / 1000));
  if (!total) return "-";
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}min`;
  }
  return minutes ? `${minutes}min ${seconds}s` : `${seconds}s`;
}

function usedPercent(drive) {
  return drive?.total ? Math.round((drive.used / drive.total) * 100) : 0;
}

function driveStatus(drive) {
  const percent = usedPercent(drive);
  if (percent >= 95) return { label: "Crítico", className: "high" };
  if (percent >= 85) return { label: "Cheio", className: "medium" };
  if (percent >= 70) return { label: "Atenção", className: "medium" };
  return { label: "Saudável", className: "low" };
}

function urgencyScore(drive) {
  const freeGb = drive.free / GB;
  const smallSsdBoost = String(drive.type || "").toLowerCase().includes("ssd") && drive.total < 180 * GB ? 18 : 0;
  const lowFreeBoost = freeGb < 12 ? 28 : freeGb < 25 ? 12 : 0;
  return usedPercent(drive) + smallSsdBoost + lowFreeBoost;
}

function mostUrgentDrive() {
  return [...state.drives].sort((a, b) => urgencyScore(b) - urgencyScore(a))[0];
}

function normalizeMediaType(type) {
  const lower = String(type || "").toLowerCase();
  if (lower.includes("ssd")) return "SSD";
  if (lower.includes("hdd") || lower.includes("hard disk")) return "HD";
  return "SSD/HD";
}

function applyTheme() {
  const theme = state.settings?.theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("disksnoop-theme", theme); } catch {}
}

function setToast(message) {
  state.toast = message;
  render();
  if (message) {
    setTimeout(() => {
      if (state.toast === message) {
        state.toast = "";
        render();
      }
    }, 3500);
  }
}

function cleanIpcError(error) {
  let message = String(error?.message || error || "Erro inesperado.");
  message = message.replace(/^Error invoking remote method '[^']+':\s*/i, "");
  message = message.replace(/^Error:\s*/i, "");
  return message.trim();
}

function friendlyMoveError(error, item) {
  const message = cleanIpcError(error);
  if (message.includes("O Windows bloqueou o acesso")) {
    return {
      title: "Item protegido pelo Windows",
      message: `${item?.name || "Este item"} não pôde ser movido para a quarentena. Ele fica em uma área protegida ou está em uso. Abra no Explorer e revise manualmente.`,
      confirmText: "Entendi",
      icon: "shield"
    };
  }
  return {
    title: "Não foi possível mover",
    message: `${item?.name || "Este item"} não pôde ser movido. ${message}`,
    confirmText: "Entendi",
    icon: "shield"
  };
}

function confirmModal(options) {
  return new Promise((resolve) => {
    state.modal = { ...options, resolve };
    render();
  });
}

function progressBar(percent) {
  return `<div class="progress"><span style="width:${Math.max(0, Math.min(100, percent))}%"></span></div>`;
}

function badge(label, kind = "low") {
  return `<span class="badge ${kind}">${escapeHtml(label)}</span>`;
}

function safetyBadge(value) {
  if (value === "Seguro revisar") return badge("Seguro", "low");
  if (value === "Provavel removivel" || value === "Provável removível") return badge("Prov.", "warn");
  if (value === "Sensivel" || value === "Sensível") return badge("Alto", "high");
  return badge("Médio", "medium");
}

function shellTopRight() {
  if (state.screen === "welcome" || state.screen === "disks") return "";
  if (state.screen === "scanning") return `<button class="primary" data-action="cancel-scan">Cancelar</button>`;
  if (state.tab === "candidates") return `<button class="primary" data-action="quarantine-selected" ${state.selectedIds.size ? "" : "disabled"}>Mover selecionados</button>`;
  if (state.tab === "quarantine") return `<div class="top-stat">Espaço recuperado: <strong>${compactBytes(totalQuarantined())}</strong></div>`;
  if (state.tab === "settings") return "";
  return `
    <div class="select-shell">
      <select data-action="drive-select">${state.drives.map((drive) => `<option value="${escapeHtml(drive.letter)}" ${state.selectedDrive?.letter === drive.letter ? "selected" : ""}>[${escapeHtml(drive.letter.replace(":", ""))}]</option>`).join("")}</select>
      ${icon("chevron")}
    </div>
    <button class="primary" data-action="new-scan">${state.scanResult ? "Novo scan" : "Escanear agora"}</button>
  `;
}

function appHeader() {
  const themeText = state.tab === "settings" ? `Tema: ${themeLabels[state.settings?.theme] || "Claro"}` : "";
  return `
    <header class="app-header">
      <div class="app-brand">
        ${appLogo()}
        <strong>DiskSnoop</strong>
      </div>
      <div class="header-right">
        <div class="header-lower">
          <div class="header-actions">${shellTopRight()}</div>
          ${themeText ? `<div class="theme-label">${escapeHtml(themeText)}</div>` : ""}
        </div>
        <div class="window-controls">
          <button title="Minimizar" data-action="window-minimize">
            <svg width="10" height="1" viewBox="0 0 10 1" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="1" rx="0.5" fill="currentColor"/></svg>
          </button>
          <button title="Maximizar" data-action="window-maximize">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="9" height="9" rx="1.5" stroke="currentColor"/></svg>
          </button>
          <button class="btn-close" title="Fechar" data-action="window-close">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </header>
  `;
}

function sidebar() {
  return `
    <aside class="sidebar">
      <nav class="side-nav">
        ${tabs.map(([id, label, iconName]) => `
          <button class="nav-item ${state.tab === id ? "active" : ""}" data-action="tab" data-tab="${id}">
            ${icon(iconName)}
            <span>${label}</span>
          </button>
        `).join("")}
      </nav>
      <section class="sidebar-info">
        <div class="sidebar-info-copy">
          <strong>DiskSnoop</strong>
          <span>Versão v0.1.0</span>
          <p>Feito para ajudar você a recuperar espaço.</p>
        </div>
        <span class="sidebar-info-icon" aria-hidden="true">${icon("database")}</span>
      </section>
    </aside>
  `;
}

function welcomeScreen() {
  return `
    <div class="window">
      ${appHeader()}
      <main class="welcome-clean">
        <div class="welcome-bg-grid"></div>
        <div class="welcome-glow"></div>
        <div class="welcome-inner">
          <div class="welcome-hero">
            <div class="welcome-logo-wrap">
              ${appLogo("big")}
              <div class="welcome-logo-ring"></div>
            </div>
            <h1 class="welcome-title">Descubra onde seu<br>espaço foi parar</h1>
            <p class="welcome-sub">O DiskSnoop analisa seus discos, encontra pastas pesadas, caches,<br>arquivos esquecidos e sobras de aplicativos.</p>
            <div class="welcome-actions">
              <button class="primary large" data-action="show-disks">
                ${icon("search")} Começar análise
              </button>
              <div class="welcome-safe-badge">
                ${icon("shield")}
                Nada é apagado automaticamente — você revisa tudo antes
              </div>
            </div>
          </div>

          <div class="welcome-features">
            <div class="welcome-feature-card">
              <div class="wf-icon">
                ${icon("folder")}
              </div>
              <h3>Pastas pesadas</h3>
              <p>Ranking das pastas que mais consomem espaço, com detalhamento por subpasta.</p>
            </div>
            <div class="welcome-feature-card">
              <div class="wf-icon">
                ${icon("clipboard")}
              </div>
              <h3>Candidatos a limpeza</h3>
              <p>node_modules, caches de build, instaladores antigos, downloads esquecidos e logs.</p>
            </div>
            <div class="welcome-feature-card">
              <div class="wf-icon">
                ${icon("shield")}
              </div>
              <h3>Quarentena segura</h3>
              <p>Mova itens para quarentena antes de excluir. Restauração com um clique quando precisar.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;
}

function driveBarClass(pct) {
  if (pct >= 92) return "critical";
  if (pct >= 75) return "warning";
  return "";
}

function disksScreen() {
  const urgent = mostUrgentDrive();
  const hasCachedScan = Boolean(localStorage.getItem(LAST_SCAN_KEY));
  return `
    <div class="window">
      ${appHeader()}
      <main class="disk-page">
        <div class="disk-heading">
          <div class="page-heading">
            <h1>Escolha um disco</h1>
            <p>${urgent ? `Sugestão: analisar ${escapeHtml(urgent.letter)} primeiro. ${compactBytes(urgent.free)} livres de ${compactBytes(urgent.total)}.` : "Nenhum disco encontrado."}</p>
          </div>
          <div class="button-row">
            ${hasCachedScan ? `<button class="secondary" data-action="load-cached-scan">Último scan</button>` : ""}
            <button class="secondary" data-action="load-test-scan">Bypass teste</button>
          </div>
        </div>
        <section class="drive-grid">
          ${state.drives.map((drive) => {
            const status = driveStatus(drive);
            const pct = usedPercent(drive);
            const barClass = driveBarClass(pct);
            const isPriority = urgent?.letter === drive.letter;
            return `
              <article class="drive-card ${isPriority ? "priority" : ""}">
                <div class="drive-top">
                  <span class="drive-top-icon">${icon("disk")}</span>
                  <div class="drive-top-info">
                    <h2>${escapeHtml(normalizeMediaType(drive.type))} ${escapeHtml(drive.letter)}</h2>
                    <p>${escapeHtml(drive.name || "Disco local")}</p>
                    ${isPriority ? `<p class="priority-copy">Prioridade alta</p>` : ""}
                  </div>
                  ${badge(status.label, status.className)}
                </div>
                <div class="drive-divider"></div>
                <div class="drive-space">
                  <span>${compactBytes(drive.used)} usados de ${compactBytes(drive.total)}</span>
                  <span class="drive-space-pct">${pct}%</span>
                </div>
                <div class="drive-bar-wrap">
                  <div class="drive-bar-fill ${barClass}" style="width:${pct}%"></div>
                </div>
                <div class="drive-numbers">
                  <span>Total<b>${formatBytes(drive.total)}</b></span>
                  <span>Usado<b>${formatBytes(drive.used)}</b></span>
                  <span>Livre<b>${formatBytes(drive.free)}</b></span>
                </div>
                <button class="primary wide" data-action="start-scan" data-drive="${escapeHtml(drive.letter)}">Analisar ${escapeHtml(drive.letter)}</button>
              </article>
            `;
          }).join("")}
        </section>
      </main>
    </div>
  `;
}

function scanningScreen() {
  const progress = state.scanProgress || { progress: 0, currentPath: "", files: 0, skipped: 0, mappedBytes: 0, candidates: 0 };
  return `
    <div class="window">
      ${appHeader()}
      <main class="scan-page">
        <section class="scan-card">
          <h1>Escaneando ${escapeHtml(state.selectedDrive?.letter || "")}</h1>
          <p>${escapeHtml(progress.currentPath || "Preparando análise...")}</p>
          ${progressBar(progress.progress || 0)}
          <div class="scan-grid">
            <div><span>Arquivos</span><strong>${Number(progress.files || 0).toLocaleString("pt-BR")}</strong></div>
            <div><span>Mapeado</span><strong>${formatBytes(progress.mappedBytes || 0)}</strong></div>
            <div><span>Candidatos</span><strong>${Number(progress.candidates || 0).toLocaleString("pt-BR")}</strong></div>
            <div><span>Sem acesso</span><strong>${Number(progress.skipped || 0).toLocaleString("pt-BR")}</strong></div>
          </div>
          <div class="button-row">
            <button class="secondary" data-action="${state.paused ? "resume-scan" : "pause-scan"}">${state.paused ? "Retomar" : "Pausar"}</button>
            <button class="danger" data-action="cancel-scan">Cancelar</button>
          </div>
        </section>
      </main>
    </div>
  `;
}

function appShell() {
  return `
    <div class="window">
      ${appHeader()}
      <div class="workspace">
        ${sidebar()}
        <main class="content">${renderTab()}</main>
      </div>
      ${contentPreviewOverlay()}
      ${modalOverlay()}
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </div>
  `;
}

function modalOverlay() {
  const modal = state.modal;
  if (!modal) return "";
  return `
    <div class="overlay modal-overlay">
      <section class="app-modal">
        <header>
          <span class="modal-icon ${modal.variant === "danger" ? "danger" : ""}">${icon(modal.icon || "shield")}</span>
          <div>
            <h2>${escapeHtml(modal.title)}</h2>
            <p>${escapeHtml(modal.message)}</p>
          </div>
        </header>
        ${modal.requireText ? `
          <label class="modal-input">
            <span>Digite ${escapeHtml(modal.requireText)} para confirmar</span>
            <input data-modal-input value="${escapeHtml(modal.value || "")}" autocomplete="off">
          </label>
        ` : ""}
        ${modal.error ? `<p class="modal-error">${escapeHtml(modal.error)}</p>` : ""}
        <footer>
          <button class="secondary" data-action="modal-cancel">${escapeHtml(modal.cancelText || "Cancelar")}</button>
          <button class="${modal.variant === "danger" ? "outline-danger" : "primary"}" data-action="modal-confirm">${escapeHtml(modal.confirmText || "Confirmar")}</button>
        </footer>
      </section>
    </div>
  `;
}

function contentPreviewOverlay() {
  if (!state.contentPreview) return "";
  const preview = state.contentPreview;
  return `
    <div class="overlay content-preview-overlay">
      <section class="content-preview">
        <header>
          <div>
            <h2>Conteúdo</h2>
            <p>${escapeHtml(preview.path)}</p>
          </div>
          <button class="secondary" data-action="close-content-preview">Fechar</button>
        </header>
        <div class="preview-table">
          <table>
            <thead><tr><th>Nome</th><th>Tipo</th><th>Tamanho</th><th>Modificado</th></tr></thead>
            <tbody>
              ${preview.items.map((item) => `
                <tr>
                  <td class="name-cell"><span class="folder-icon">${icon(item.type === "Pasta" ? "folder" : "file")}</span><span>${escapeHtml(item.name)}</span></td>
                  <td>${escapeHtml(item.type)}</td>
                  <td>${item.type === "Pasta" ? "-" : compactBytes(item.size)}</td>
                  <td>${relativeDate(item.modifiedAt)}</td>
                </tr>
              `).join("") || `<tr><td colspan="4" class="empty-soft">Pasta vazia ou inacessível.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderTab() {
  if (state.tab === "overview") return overviewTab();
  if (state.tab === "folders") return foldersTab();
  if (state.tab === "files") return largeFilesTab();
  if (state.tab === "candidates") return candidatesTab();
  if (state.tab === "duplicates") return duplicatesTab();
  if (state.tab === "leftovers") return leftoversTab();
  if (state.tab === "quarantine") return quarantineTab();
  if (state.tab === "history") return historyTab();
  if (state.tab === "updates") return updatesTab();
  if (state.tab === "settings") return settingsTab();
  return "";
}

function groupedCandidates() {
  const groups = new Map();
  for (const item of state.scanResult?.candidates || []) {
    groups.set(item.type, (groups.get(item.type) || 0) + item.size);
  }
  return [...groups.entries()].sort((a, b) => b[1] - a[1]);
}

function totalReviewable() {
  return (state.scanResult?.candidates || []).reduce((sum, item) => sum + item.size, 0);
}

function currentHistoryEntry() {
  return (state.history || []).find((item) => item.id === state.scanResult?.id);
}

function duplicateReviewableTotal() {
  return (state.scanResult?.duplicateGroups || []).reduce((sum, group) => sum + (group.reviewableBytes || 0), 0);
}

function possibleLeftoversCount() {
  return (state.scanResult?.largeFolders || []).filter((item) => {
    const lower = item.path.toLowerCase();
    return lower.includes("\\appdata\\local\\") || lower.includes("\\appdata\\roaming\\") || lower.includes("\\programdata\\");
  }).length;
}

function overviewTab() {
  const result = state.scanResult;
  const drive = result.drive;
  const historyEntry = currentHistoryEntry();
  const categories = groupedCandidates();
  const reviewable = totalReviewable();
  const duplicateReviewable = duplicateReviewableTotal();
  const top = categories.slice(0, 4);
  const largest = top[0]?.[1] || 1;
  const durationMs = historyEntry?.durationMs || (new Date(result.finishedAt).getTime() - new Date(result.startedAt).getTime());
  const scannedRoots = result.scanRoots?.length || 1;

  return `
    <section class="overview">
      <div class="page-heading split-heading">
        <div>
          <h1>${escapeHtml(normalizeMediaType(drive.type))} ${escapeHtml(drive.letter)}</h1>
          <p>${compactBytes(drive.used)} usados de ${compactBytes(drive.total)}</p>
        </div>
        <span>Último scan: hoje</span>
      </div>

      <section class="metric-cards">
        <article class="metric-card">
          <span class="metric-icon">${icon("disk")}</span>
          <div><strong>${compactBytes(reviewable)}</strong><span>Revisáveis</span></div>
        </article>
        <article class="metric-card">
          <span class="metric-icon">${icon("file")}</span>
          <div><strong>${result.candidates.length}</strong><span>Encontrados</span></div>
        </article>
        <article class="metric-card">
          <span class="metric-icon">${icon("cube")}</span>
          <div><strong>${possibleLeftoversCount()} apps?</strong><span>Sobras</span></div>
        </article>
      </section>

      <h2>Relatório do scan</h2>
      <section class="panel scan-report">
        <div class="report-grid">
          <div><span>Finalizado</span><strong>${fullDate(result.finishedAt)}</strong></div>
          <div><span>Duração</span><strong>${durationLabel(durationMs)}</strong></div>
          <div><span>Arquivos</span><strong>${Number(result.files || 0).toLocaleString("pt-BR")}</strong></div>
          <div><span>Pastas</span><strong>${Number(result.directories || 0).toLocaleString("pt-BR")}</strong></div>
          <div><span>Sem acesso</span><strong>${Number(result.skipped || 0).toLocaleString("pt-BR")}</strong></div>
          <div><span>Raízes analisadas</span><strong>${scannedRoots}</strong></div>
        </div>
        <div class="report-note">
          ${icon("shield")}
          <span>Nada foi apagado automaticamente. ${duplicateReviewable ? `${compactBytes(duplicateReviewable)} aparecem como possíveis duplicados e precisam de confirmação manual.` : "Revise candidatos e quarentena antes de qualquer exclusão permanente."}</span>
        </div>
      </section>

      <h2>Uso por categoria</h2>
      <section class="panel category-panel">
        ${(top.length ? top : [["Sem candidatos", 0]]).map(([name, size]) => `
          <div class="category-row">
            <span>${escapeHtml(cleanCategory(name))}</span>
            <div class="category-bar">${progressBar(largest ? (size / largest) * 80 : 0)}</div>
            <strong>${compactBytes(size)}</strong>
          </div>
        `).join("")}
      </section>

      <h2>Achados importantes</h2>
      <section class="panel finding-list">
        ${(state.scanResult?.candidates || []).slice(0, 4).map((item) => `
          <button class="finding-row" data-action="select-overview-candidate" data-id="${escapeHtml(item.id)}">
            <span class="mini-icon">${icon(iconForCandidate(item))}</span>
            <span>${escapeHtml(summaryName(item))}</span>
            <strong>${compactBytes(item.size)}</strong>
          </button>
        `).join("") || `<div class="empty-soft">Nenhum achado importante por enquanto.</div>`}
      </section>

      <h2>Ações rápidas</h2>
      <section class="quick-actions">
        <button class="quick-action" data-action="tab" data-tab="folders">${icon("folder")}Ver maiores pastas</button>
        <button class="quick-action" data-action="tab" data-tab="files">${icon("file")}Ver arquivos grandes</button>
        <button class="quick-action" data-action="tab" data-tab="candidates">${icon("clipboard")}Revisar candidatos</button>
        <button class="quick-action" data-action="tab" data-tab="duplicates">${icon("copy")}Ver duplicados</button>
        <button class="quick-action" data-action="tab" data-tab="leftovers">${icon("cube")}Checar sobras de apps</button>
        <button class="quick-action" data-action="tab" data-tab="settings">${icon("settings")}Ajustar regras</button>
      </section>
    </section>
  `;
}

function cleanCategory(name) {
  return String(name || "").replace("Projetos dev", "Projetos dev").replace("Downloads antigos", "Downloads").replace("Instaladores antigos", "Instaladores");
}

function summaryName(item) {
  if (item.type === "Projetos dev" && item.name === "node_modules") return "node_modules em projetos antigos";
  if (item.type === "Instaladores antigos") return "Instaladores antigos em Downloads";
  if (item.type === "Caches") return "Caches grandes de apps";
  if (item.type === "Arquivos grandes") return "Arquivos grandes sem uso recente";
  return item.name;
}

function iconForCandidate(item) {
  if (item.type === "Instaladores antigos") return "download";
  if (item.type === "Caches") return "database";
  if (item.type === "Arquivos grandes") return "clock";
  return "folder";
}

function filteredFolders() {
  const query = state.search.toLowerCase();
  return [...(state.scanResult?.largeFolders || [])]
    .filter((item) => !query || item.path.toLowerCase().includes(query) || item.name.toLowerCase().includes(query))
    .filter((item) => item.size >= state.sizeFilter * GB)
    .sort((a, b) => {
      if (state.sort === "date") return new Date(b.modifiedAt || 0) - new Date(a.modifiedAt || 0);
      if (state.sort === "risk") return riskWeight(b.risk) - riskWeight(a.risk);
      return b.size - a.size;
    });
}

function riskWeight(value) {
  if (value === "Sensivel" || value === "Sensível") return 3;
  if (value === "Verificar antes") return 2;
  return 1;
}

function folderRisk(item) {
  if (item.risk === "Sensivel" || item.risk === "Sensível") return ["Alto", "high"];
  if (item.name.toLowerCase().includes("appdata") || item.path.toLowerCase().includes("\\appdata\\")) return ["Alto", "high"];
  if (item.path.toLowerCase().includes("\\downloads\\") || item.name.toLowerCase().includes("videos")) return ["Médio", "medium"];
  return ["Baixo", "low"];
}

function foldersTab() {
  const items = filteredFolders();
  const selected = state.selectedItem || items[0];
  if (!state.selectedItem && selected) state.selectedItem = selected;
  return `
    <section>
      <div class="page-heading">
        <h1>Pastas Grandes</h1>
      </div>
      <div class="filters-row folders-filters">
        <label class="search-box">${icon("search")}<input data-field="search" value="${escapeHtml(state.search)}" placeholder="Buscar caminho..."></label>
        <div class="select-shell wide-select"><select data-field="sizeFilter"><option value="1" ${state.sizeFilter === 1 ? "selected" : ""}>Min: 1 GB</option><option value="5" ${state.sizeFilter === 5 ? "selected" : ""}>Min: 5 GB</option><option value="10" ${state.sizeFilter === 10 ? "selected" : ""}>Min: 10 GB</option></select>${icon("chevron")}</div>
        <div class="select-shell wide-select"><select data-field="sort"><option value="size" ${state.sort === "size" ? "selected" : ""}>Ordenar: tam.</option><option value="date" ${state.sort === "date" ? "selected" : ""}>Ordenar: data</option><option value="risk" ${state.sort === "risk" ? "selected" : ""}>Ordenar: risco</option></select>${icon("chevron")}</div>
      </div>
      <section class="panel table-panel">
        <table class="folders-table">
          <thead><tr><th>Nome</th><th>Tamanho</th><th>Modificado</th><th>Risco</th></tr></thead>
          <tbody>
            ${items.slice(0, 60).map((item) => {
              const [label, kind] = folderRisk(item);
              return `
                <tr class="${state.selectedItem?.id === item.id ? "selected" : ""}" data-action="select-folder" data-id="${escapeHtml(item.id)}">
                  <td class="name-cell"><span class="folder-icon">${icon("folder")}</span><span>${escapeHtml(item.name)}</span></td>
                  <td>${compactBytes(item.size)}</td>
                  <td>${relativeDate(item.modifiedAt)}</td>
                  <td>${badge(label, kind)}</td>
                </tr>
              `;
            }).join("") || `<tr><td colspan="4" class="empty-soft">Nenhuma pasta com os filtros atuais.</td></tr>`}
          </tbody>
        </table>
      </section>
      <h2>Detalhes</h2>
      ${folderDetails(state.selectedItem)}
    </section>
  `;
}

function folderDetails(item) {
  if (!item) return `<section class="panel detail-strip"><p class="muted">Selecione uma pasta para ver detalhes.</p></section>`;
  return `
    <section class="panel detail-strip">
      <span class="detail-icon">${icon("folder")}</span>
      <div class="detail-copy">
        <h3>${escapeHtml(item.path)}</h3>
        <p>${escapeHtml(item.reason || "Pasta grande detectada no scan.")}</p>
        ${childrenSummary(item)}
        <div class="detail-actions">
          <button class="secondary" data-action="open-selected">${icon("folder")}Abrir pasta</button>
          <button class="secondary" data-action="show-selected">${icon("list")}Ver conteúdo</button>
          <button class="secondary" data-action="ignore-selected">${icon("ban")}Ignorar</button>
        </div>
      </div>
    </section>
  `;
}

function childrenSummary(item) {
  const children = (item?.children || []).slice(0, 5);
  if (!children.length) return "";
  return `
    <div class="content-summary">
      <h4>Conteúdo principal</h4>
      ${children.map((child) => `
        <div class="content-summary-row">
          <span>${icon(child.type === "Pasta" ? "folder" : "file")}${escapeHtml(child.name)}</span>
          <strong>${compactBytes(child.size)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function filteredLargeFiles() {
  const query = state.fileSearch.toLowerCase().trim();
  return [...(state.scanResult?.candidates || [])]
    .filter((item) => item.type === "Arquivos grandes")
    .filter((item) => !query || `${item.name} ${item.path}`.toLowerCase().includes(query))
    .filter((item) => item.size >= state.fileSizeFilter)
    .sort((a, b) => {
      if (state.fileSort === "date") return new Date(b.modifiedAt || 0) - new Date(a.modifiedAt || 0);
      if (state.fileSort === "safety") return safetyWeight(b.security) - safetyWeight(a.security);
      return b.size - a.size;
    });
}

function safetyWeight(value) {
  if (value === "Sensivel" || value === "Sensível") return 4;
  if (value === "Verificar antes") return 3;
  if (value === "Provavel removivel" || value === "Provável removível") return 2;
  return 1;
}

function largeFilesTab() {
  const items = filteredLargeFiles();
  const selected = items.find((item) => item.id === state.selectedItem?.id) || items[0];
  if (state.selectedItem?.id !== selected?.id) state.selectedItem = selected || null;
  const total = items.reduce((sum, item) => sum + item.size, 0);

  return `
    <section>
      <div class="page-heading">
        <h1>Arquivos Grandes</h1>
        <p>${items.length} arquivos encontrados acima de ${formatBytes(state.fileSizeFilter)}. Total visível: ${compactBytes(total)}.</p>
      </div>
      <div class="filters-row files-filters">
        <label class="search-box">${icon("search")}<input data-field="fileSearch" value="${escapeHtml(state.fileSearch)}" placeholder="Buscar arquivo ou caminho..."></label>
        <div class="select-shell wide-select">
          <select data-field="fileSizeFilter">
            <option value="${250 * MB}" ${state.fileSizeFilter === 250 * MB ? "selected" : ""}>Min: 250 MB</option>
            <option value="${500 * MB}" ${state.fileSizeFilter === 500 * MB ? "selected" : ""}>Min: 500 MB</option>
            <option value="${GB}" ${state.fileSizeFilter === GB ? "selected" : ""}>Min: 1 GB</option>
            <option value="${5 * GB}" ${state.fileSizeFilter === 5 * GB ? "selected" : ""}>Min: 5 GB</option>
            <option value="${10 * GB}" ${state.fileSizeFilter === 10 * GB ? "selected" : ""}>Min: 10 GB</option>
          </select>
          ${icon("chevron")}
        </div>
        <div class="select-shell wide-select">
          <select data-field="fileSort">
            <option value="size" ${state.fileSort === "size" ? "selected" : ""}>Ordenar: tam.</option>
            <option value="date" ${state.fileSort === "date" ? "selected" : ""}>Ordenar: data</option>
            <option value="safety" ${state.fileSort === "safety" ? "selected" : ""}>Ordenar: selo</option>
          </select>
          ${icon("chevron")}
        </div>
      </div>
      <section class="panel table-panel">
        <table class="large-files-table">
          <thead><tr><th>Arquivo</th><th>Caminho</th><th>Tamanho</th><th>Modificado</th><th>Selo</th></tr></thead>
          <tbody>
            ${items.slice(0, 120).map((item) => `
              <tr class="${state.selectedItem?.id === item.id ? "selected" : ""}" data-action="select-file" data-id="${escapeHtml(item.id)}">
                <td class="name-cell"><span class="folder-icon">${icon("file")}</span><span>${escapeHtml(item.name)}</span></td>
                <td class="path-cell">${escapeHtml(item.path)}</td>
                <td>${compactBytes(item.size)}</td>
                <td>${relativeDate(item.modifiedAt)}</td>
                <td>${safetyBadge(item.security)}</td>
              </tr>
            `).join("") || `<tr><td colspan="5" class="empty-soft">Nenhum arquivo grande com os filtros atuais.</td></tr>`}
          </tbody>
        </table>
      </section>
      <h2>Detalhes</h2>
      ${fileDetails(state.selectedItem)}
    </section>
  `;
}

function fileDetails(item) {
  if (!item) return `<section class="panel explanation"><p class="muted">Selecione um arquivo para ver detalhes.</p></section>`;
  return `
    <section class="panel explanation candidate-detail-panel">
      <div class="candidate-detail-grid">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <small>${escapeHtml(item.path)}</small>
        </div>
        <div class="candidate-detail-meta">
          <span>Tamanho <strong>${compactBytes(item.size)}</strong></span>
          <span>Modificado <strong>${relativeDate(item.modifiedAt)}</strong></span>
          <span>Selo ${safetyBadge(item.security)}</span>
        </div>
      </div>
      <p>${escapeHtml(item.reason || "Arquivo grande detectado no scan. Revise antes de mover, especialmente se for documento, vídeo ou arquivo pessoal.")}</p>
      <div class="detail-actions">
        <button class="secondary" data-action="open-selected">${icon("folder")}Abrir local</button>
        <button class="secondary" data-action="ignore-selected">${icon("ban")}Ignorar</button>
        <button class="secondary" data-action="quarantine-selected-item">${icon("shield")}Mover para quarentena</button>
      </div>
    </section>
  `;
}

function filteredCandidates() {
  const query = state.candidateSearch.toLowerCase().trim();
  return [...(state.scanResult?.candidates || [])]
    .filter((item) => {
      if (query && !`${item.name} ${item.path} ${item.type}`.toLowerCase().includes(query)) return false;
      if (!query && Number(state.candidateMinSize || 0) > 0 && item.size < Number(state.candidateMinSize)) return false;
      if (state.candidateScope !== "Todos" && cleanCandidateType(item.type) !== state.candidateScope) return false;
      if (state.candidateSafety === "Seguro revisar" && item.security !== "Seguro revisar") return false;
      if (state.candidateSafety === "Verificar antes" && item.security !== "Verificar antes") return false;
      if ((state.candidateSafety === "Provavel removivel" || state.candidateSafety === "Provável removível") && item.security !== "Provavel removivel" && item.security !== "Provável removível") return false;
      return true;
    })
    .sort((a, b) => {
      if (state.candidateAge === "Prioridade") return candidatePriorityScore(b) - candidatePriorityScore(a);
      if (state.candidateAge === "Mais antigos") return new Date(a.modifiedAt || 0) - new Date(b.modifiedAt || 0);
      return b.size - a.size;
    });
}

function candidatePriorityScore(item) {
  const type = cleanCandidateType(item.type);
  const typeScore = {
    Dev: 85,
    Cache: 78,
    Download: 68,
    Instalador: 58,
    Compactado: 50,
    Logs: 48,
    Temporario: 44,
    "Arquivo grande": 30
  }[type] || 20;
  const safetyScore = item.security === "Seguro revisar" ? 28
    : item.security === "Provavel removivel" || item.security === "Provável removível" ? 22
      : item.security === "Verificar antes" ? 8
        : -40;
  const sizeMb = Math.max(1, (item.size || 0) / MB);
  const sizeScore = Math.min(38, Math.log2(sizeMb) * 5);
  const days = Math.max(0, (Date.now() - new Date(item.modifiedAt || 0).getTime()) / 86400000);
  const ageScore = Math.min(18, days / 18);
  return typeScore + safetyScore + sizeScore + ageScore;
}

function cleanCandidateType(type) {
  if (type === "Projetos dev") return "Dev";
  if (type === "Instaladores antigos") return "Instalador";
  if (type === "Caches") return "Cache";
  if (type === "Logs grandes") return "Logs";
  if (type === "Arquivos grandes") return "Arquivo grande";
  if (type === "Downloads antigos") return "Download";
  if (type === "Compactados antigos") return "Compactado";
  if (type === "Temporarios" || type === "Temporários") return "Temporario";
  return type;
}

function candidatesTab() {
  const items = filteredCandidates();
  const selected = items.find((item) => item.id === state.selectedItem?.id) || items[0];
  if (state.selectedItem?.id !== selected?.id) state.selectedItem = selected || null;
  const totalCandidates = state.scanResult?.candidates?.length || 0;
  const safe = items.filter((item) => item.security === "Seguro revisar").length;
  const review = items.filter((item) => item.security === "Verificar antes").length;
  const selectedItems = (state.scanResult?.candidates || []).filter((item) => state.selectedIds.has(item.id));
  const selectedSize = selectedItems.reduce((sum, item) => sum + item.size, 0);
  const visibleItems = items.slice(0, state.candidateLimit);
  return `
    <section>
      <div class="page-heading">
        <h1>Candidatos à Limpeza</h1>
        <p>${items.length} itens visíveis de ${totalCandidates}. ${safe} seguros para revisar, ${review} pedem verificação manual.</p>
      </div>
      <div class="filters-row candidates-filters">
        <label class="search-box">${icon("search")}<input data-field="candidateSearch" value="${escapeHtml(state.candidateSearch)}" placeholder="Buscar item ou caminho..."></label>
        ${selectControl("candidateScope", ["Todos", "Dev", "Instalador", "Cache", "Logs", "Arquivo grande", "Download", "Compactado", "Temporario"], state.candidateScope)}
        ${selectControl("candidateSafety", ["Seguro revisar", "Provável removível", "Verificar antes", "Todos"], state.candidateSafety)}
        ${selectControl("candidateMinSize", [["Relevantes: 10 MB+", 10 * MB], ["Qualquer tamanho", 0], ["100 MB+", 100 * MB], ["1 GB+", GB]], state.candidateMinSize)}
        ${selectControl("candidateAge", ["Prioridade", "Maiores", "Mais antigos"], state.candidateAge)}
      </div>
      <div class="selection-summary">
        <span>Mostrando ${visibleItems.length} de ${items.length}</span>
        <span>${state.selectedIds.size} selecionado(s)</span>
        <strong>${compactBytes(selectedSize)}</strong>
      </div>
      <section class="panel table-panel candidates-panel">
        <table class="candidates-table">
          <thead><tr><th class="check-col"><input type="checkbox" data-action="toggle-all-candidates" ${visibleItems.length && visibleItems.every((item) => state.selectedIds.has(item.id)) ? "checked" : ""}></th><th>Item</th><th>Tipo</th><th>Tamanho</th><th>Selo</th></tr></thead>
          <tbody>
            ${visibleItems.map((item) => `
              <tr class="${state.selectedItem?.id === item.id ? "selected" : ""}" data-action="select-candidate" data-id="${escapeHtml(item.id)}">
                <td><input type="checkbox" data-action="toggle-select" data-id="${escapeHtml(item.id)}" ${state.selectedIds.has(item.id) ? "checked" : ""}></td>
                <td class="candidate-item-cell">
                  <div class="candidate-main">
                    <span class="candidate-icon">${icon(item.type === "Instaladores antigos" ? "download" : item.type === "Arquivos grandes" ? "file" : "folder")}</span>
                    <span class="candidate-copy">
                      <strong>${escapeHtml(item.name)}</strong>
                      <small>${escapeHtml(item.path)}</small>
                    </span>
                  </div>
                </td>
                <td>${escapeHtml(cleanCandidateType(item.type))}</td>
                <td>${compactBytes(item.size)}</td>
                <td>${safetyBadge(item.security)}</td>
              </tr>
            `).join("") || `<tr><td colspan="5" class="empty-soft">Nenhum candidato com os filtros atuais.</td></tr>`}
          </tbody>
        </table>
      </section>
      ${items.length > visibleItems.length ? `<button class="secondary load-more" data-action="show-more-candidates">${icon("list")}Mostrar mais ${Math.min(80, items.length - visibleItems.length)}</button>` : ""}
      <h2>Por que apareceu aqui?</h2>
      ${candidateDetails(state.selectedItem)}
    </section>
  `;
}

function selectControl(field, options, current) {
  return `<div class="select-shell wide-select"><select data-field="${field}">${options.map((item) => {
    const label = Array.isArray(item) ? item[0] : item;
    const value = Array.isArray(item) ? item[1] : item;
    return `<option value="${escapeHtml(value)}" ${String(current) === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("")}</select>${icon("chevron")}</div>`;
}

function candidateDetails(item) {
  if (!item) return `<section class="panel explanation"><p class="muted">Selecione um candidato para ver a explicação.</p></section>`;
  return `
    <section class="panel explanation candidate-detail-panel">
      <div class="candidate-detail-grid">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <small>${escapeHtml(item.path)}</small>
        </div>
        <div class="candidate-detail-meta">
          <span>Tipo <strong>${escapeHtml(cleanCandidateType(item.type))}</strong></span>
          <span>Tamanho <strong>${compactBytes(item.size)}</strong></span>
          <span>Modificado <strong>${relativeDate(item.modifiedAt)}</strong></span>
          <span>Selo ${safetyBadge(item.security)}</span>
        </div>
      </div>
      <p>${escapeHtml(item.reason || "Este item parece ocupar espaço relevante e merece revisão.")}</p>
      ${childrenSummary(item)}
      <div class="detail-actions">
        <button class="secondary" data-action="open-selected">${icon("folder")}Abrir</button>
        <button class="secondary" data-action="show-selected">${icon("list")}Ver conteúdo</button>
        <button class="secondary" data-action="ignore-selected">${icon("ban")}Ignorar</button>
        <button class="secondary" data-action="quarantine-selected-item">${icon("shield")}Mover para quarentena</button>
      </div>
    </section>
  `;
}

function duplicateGroups() {
  const query = state.duplicateSearch.toLowerCase().trim();
  return [...(state.scanResult?.duplicateGroups || [])]
    .filter((group) => !query || `${group.name} ${group.items?.map((item) => item.path).join(" ")}`.toLowerCase().includes(query))
    .filter((group) => (group.reviewableBytes || 0) >= Number(state.duplicateMinWaste || 0))
    .sort((a, b) => (b.reviewableBytes || 0) - (a.reviewableBytes || 0));
}

function selectedDuplicate(groups = duplicateGroups()) {
  return groups.find((group) => group.id === state.selectedDuplicateId) || groups[0] || null;
}

function duplicatesTab() {
  const groups = duplicateGroups();
  const selected = selectedDuplicate(groups);
  if (selected && state.selectedDuplicateId !== selected.id) state.selectedDuplicateId = selected.id;
  const reviewable = groups.reduce((sum, group) => sum + (group.reviewableBytes || 0), 0);
  return `
    <section>
      <div class="page-heading">
        <h1>Possíveis Duplicados</h1>
        <p>${groups.length} grupos encontrados. Espaço revisável estimado: ${compactBytes(reviewable)}.</p>
      </div>
      <div class="safety-note">${icon("shield")}Suspeita baseada em nome e tamanho. O DiskSnoop ainda não usa hash de conteúdo, então revise cada cópia antes de mover qualquer coisa.</div>
      <div class="filters-row duplicates-filters">
        <label class="search-box">${icon("search")}<input data-field="duplicateSearch" value="${escapeHtml(state.duplicateSearch)}" placeholder="Buscar arquivo ou caminho..."></label>
        <div class="select-shell wide-select">
          <select data-field="duplicateMinWaste">
            <option value="0" ${Number(state.duplicateMinWaste) === 0 ? "selected" : ""}>Qualquer tamanho</option>
            <option value="${100 * MB}" ${Number(state.duplicateMinWaste) === 100 * MB ? "selected" : ""}>Revisável: 100 MB+</option>
            <option value="${500 * MB}" ${Number(state.duplicateMinWaste) === 500 * MB ? "selected" : ""}>Revisável: 500 MB+</option>
            <option value="${GB}" ${Number(state.duplicateMinWaste) === GB ? "selected" : ""}>Revisável: 1 GB+</option>
          </select>
          ${icon("chevron")}
        </div>
      </div>
      <section class="panel table-panel">
        <table class="duplicates-table">
          <thead><tr><th>Arquivo</th><th>Cópias</th><th>Tamanho</th><th>Revisável</th><th>Confiança</th></tr></thead>
          <tbody>
            ${groups.map((group) => `
              <tr class="${selected?.id === group.id ? "selected" : ""}" data-action="select-duplicate" data-id="${escapeHtml(group.id)}">
                <td class="name-cell"><span class="folder-icon">${icon("copy")}</span><span>${escapeHtml(group.name)}</span></td>
                <td>${Number(group.copies || group.items?.length || 0).toLocaleString("pt-BR")}</td>
                <td>${compactBytes(group.size)}</td>
                <td>${compactBytes(group.reviewableBytes)}</td>
                <td>${badge(group.confidence || "Possível", "medium")}</td>
              </tr>
            `).join("") || `<tr><td colspan="5" class="empty-soft">Nenhum possível duplicado neste scan.</td></tr>`}
          </tbody>
        </table>
      </section>
      <h2>Revisão do grupo</h2>
      ${duplicateDetails(selected)}
    </section>
  `;
}

function duplicateDetails(group) {
  if (!group) {
    return `<section class="panel explanation"><p class="muted">Nenhum grupo selecionado.</p></section>`;
  }
  const items = group.items || [];
  return `
    <section class="panel explanation candidate-detail-panel">
      <div class="candidate-detail-grid">
        <div>
          <h3>${escapeHtml(group.name)}</h3>
          <small>${escapeHtml(group.reason || "Possíveis duplicados por nome e tamanho.")}</small>
        </div>
        <div class="candidate-detail-meta">
          <span>Cópias <strong>${Number(items.length).toLocaleString("pt-BR")}</strong></span>
          <span>Tamanho cada <strong>${compactBytes(group.size)}</strong></span>
          <span>Estimativa <strong>${compactBytes(group.reviewableBytes)}</strong></span>
        </div>
      </div>
      <div class="duplicate-copy-list">
        ${items.map((item, index) => `
          <div class="duplicate-copy-row">
            <span>${icon("file")}<strong>${index === 0 ? "Mais recente" : `Cópia ${index + 1}`}</strong></span>
            <code title="${escapeHtml(item.path)}">${escapeHtml(item.path)}</code>
            <small>${relativeDate(item.modifiedAt)}</small>
            <button class="table-action" data-action="open-path" data-path="${escapeHtml(item.path)}">Abrir</button>
          </div>
        `).join("")}
      </div>
      <p class="muted">O DiskSnoop ainda não compara hash do conteúdo. Use esta tela como pista visual antes de mover qualquer arquivo.</p>
    </section>
  `;
}

function totalQuarantined() {
  return (state.quarantine || []).filter((item) => item.status === "Em quarentena").reduce((sum, item) => sum + item.size, 0);
}

function selectedQuarantine() {
  return state.quarantine.find((item) => item.id === state.selectedQuarantineId) || state.quarantine[0];
}

function quarantineStatusBadge(status = "Em quarentena") {
  if (status === "Em quarentena") return badge(status, "low");
  if (status === "Arquivo ausente") return badge(status, "high");
  return badge(status, "medium");
}

function possibleLeftovers() {
  return (state.scanResult?.largeFolders || [])
    .filter((item) => {
      const lower = item.path.toLowerCase();
      if (isNoisyLeftoverPath(lower)) return false;
      return lower.includes("\\appdata\\local\\")
        || lower.includes("\\appdata\\roaming\\")
        || lower.includes("\\programdata\\")
        || lower.includes("\\program files\\")
        || lower.includes("\\program files (x86)\\");
    });
}

function isNoisyLeftoverPath(lowerPath) {
  return lowerPath.includes("\\programdata\\package cache\\")
    || lowerPath.includes("\\programdata\\microsoft\\windows\\")
    || lowerPath.includes("\\program files\\windowsapps\\")
    || lowerPath.includes("\\program files\\common files\\")
    || lowerPath.includes("\\program files (x86)\\common files\\");
}

function leftoverLocation(item) {
  const lower = item.path.toLowerCase();
  if (lower.includes("\\appdata\\local\\")) return "AppData Local";
  if (lower.includes("\\appdata\\roaming\\")) return "AppData Roaming";
  if (lower.includes("\\programdata\\")) return "ProgramData";
  if (lower.includes("\\program files (x86)\\")) return "Program Files (x86)";
  if (lower.includes("\\program files\\")) return "Program Files";
  return "Outro";
}

function filteredLeftovers() {
  const query = state.leftoversSearch.toLowerCase().trim();
  return possibleLeftovers()
    .filter((item) => {
      const [status] = leftoverStatus(item);
      if (query && !`${item.name} ${item.path}`.toLowerCase().includes(query)) return false;
      if (state.leftoversStatus !== "Todos" && status !== state.leftoversStatus) return false;
      if (state.leftoversLocation !== "Todos" && leftoverLocation(item) !== state.leftoversLocation) return false;
      return true;
    })
    .sort((a, b) => b.size - a.size);
}

function leftoverStatus(item) {
  const match = matchingInstalledApp(item);
  if (match) return ["App instalado", "low"];
  const lower = item.path.toLowerCase();
  if (lower.includes("\\program files\\")) return ["Verificar manualmente", "medium"];
  if (isGenericAppDataFolder(item.name)) return ["Verificar manualmente", "medium"];
  if (lower.includes("\\appdata\\")) return ["Possível sobra", "medium"];
  if (lower.includes("\\programdata\\")) return ["App não encontrado?", "medium"];
  return ["Nome parecido", "low"];
}

function matchingInstalledApp(item) {
  const folderName = normalizeName(item.name);
  if (!folderName || folderName.length < 4 || isGenericAppDataFolder(item.name)) return null;
  return state.installedApps.find((appInfo) => {
    const appName = normalizeName(appInfo.name);
    return appName && (appName.includes(folderName) || folderName.includes(appName));
  });
}

function isGenericAppDataFolder(value) {
  return new Set(["cache", "caches", "data", "packages", "temp", "tmp", "logs", "log", "local", "roaming"]).has(normalizeName(value));
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function leftoversTab() {
  const allItems = possibleLeftovers();
  const items = filteredLeftovers();
  const visibleItems = items.slice(0, state.leftoversLimit);
  const selected = items.find((item) => item.id === state.selectedItem?.id) || items[0];
  if (state.selectedItem?.id !== selected?.id) state.selectedItem = selected || null;
  const possible = allItems.filter((item) => leftoverStatus(item)[0] === "Possível sobra").length;
  const installed = allItems.filter((item) => leftoverStatus(item)[0] === "App instalado").length;
  const manual = allItems.length - possible - installed;
  return `
    <section>
      <div class="page-heading">
        <h1>Sobras de Apps</h1>
        <p>Possíveis pastas órfãs encontradas em AppData, ProgramData e Program Files. Esta tela é conservadora.</p>
      </div>
      <div class="safety-note">${icon("shield")}Esses achados são pistas, não confirmação de sobra. Pastas ligadas a apps instalados ou com nome genérico ficam fora do foco principal.</div>
      <div class="leftover-summary">
        <span><strong>${allItems.length}</strong> analisadas</span>
        <span><strong>${possible}</strong> possíveis sobras</span>
        <span><strong>${installed}</strong> ligadas a apps instalados</span>
        <span><strong>${manual}</strong> verificar</span>
      </div>
      <div class="filters-row leftovers-filters">
        <label class="search-box">${icon("search")}<input data-field="leftoversSearch" value="${escapeHtml(state.leftoversSearch)}" placeholder="Buscar app ou caminho..."></label>
        ${selectControl("leftoversStatus", ["Todos", "Possível sobra", "App não encontrado?", "Verificar manualmente", "App instalado"], state.leftoversStatus)}
        ${selectControl("leftoversLocation", ["Todos", "AppData Local", "AppData Roaming", "ProgramData", "Program Files", "Program Files (x86)"], state.leftoversLocation)}
      </div>
      <section class="panel table-panel">
        <table class="leftovers-table">
          <thead><tr><th>Pasta</th><th>Local</th><th>Tamanho</th><th>Status</th></tr></thead>
          <tbody>
            ${visibleItems.map((item) => {
              const [label, kind] = leftoverStatus(item);
              return `
                <tr class="${state.selectedItem?.id === item.id ? "selected" : ""}" data-action="select-leftover" data-id="${escapeHtml(item.id)}">
                  <td class="name-cell"><span class="folder-icon">${icon("folder")}</span><span>${escapeHtml(item.name)}</span></td>
                  <td title="${escapeHtml(item.path)}">${escapeHtml(shortPath(item.path))}</td>
                  <td>${compactBytes(item.size)}</td>
                  <td>${badge(label, kind)}</td>
                </tr>
              `;
            }).join("") || `<tr><td colspan="4" class="empty-soft">Nenhuma possível sobra de app encontrada neste scan.</td></tr>`}
          </tbody>
        </table>
      </section>
      <h2>Revisão segura</h2>
      ${items.length > visibleItems.length ? `<button class="secondary load-more" data-action="show-more-leftovers">${icon("list")}Mostrar mais ${Math.min(80, items.length - visibleItems.length)}</button>` : ""}
      ${leftoverDetails(state.selectedItem)}
    </section>
  `;
}

function shortPath(value) {
  if (!value) return "-";
  const parts = value.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 4) return value;
  return `${parts[0]}\\...\\${parts.slice(-3).join("\\")}`;
}

function leftoverDetails(item) {
  if (!item) return `<section class="panel explanation"><p class="muted">Selecione uma pasta para revisar.</p></section>`;
  const match = matchingInstalledApp(item);
  const [status, kind] = leftoverStatus(item);
  return `
    <section class="panel explanation candidate-detail-panel">
      <div class="candidate-detail-grid">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <small>${escapeHtml(item.path)}</small>
        </div>
        <div class="candidate-detail-meta">
          <span>Status ${badge(status, kind)}</span>
          <span>Local <strong>${escapeHtml(leftoverLocation(item))}</strong></span>
          <span>Tamanho <strong>${compactBytes(item.size)}</strong></span>
          <span>Modificado <strong>${relativeDate(item.modifiedAt)}</strong></span>
        </div>
      </div>
      <p>${match ? `Nome parecido com app instalado: ${escapeHtml(match.name)}. ` : ""}O DiskSnoop encontrou esta pasta em uma área comum de dados de aplicativos. Isso não significa que ela pode ser removida automaticamente; abra a pasta e confirme se o app ainda existe ou se os dados são importantes.</p>
      ${childrenSummary(item)}
      <div class="detail-actions">
        <button class="secondary" data-action="open-selected">${icon("folder")}Abrir pasta</button>
        <button class="secondary" data-action="show-selected">${icon("list")}Ver conteúdo</button>
        <button class="secondary" data-action="ignore-selected">${icon("ban")}Ignorar</button>
        <button class="secondary" data-action="quarantine-leftover">${icon("shield")}Mover para quarentena</button>
      </div>
    </section>
  `;
}

function quarantineTab() {
  const selected = selectedQuarantine();
  if (!state.selectedQuarantineId && selected) state.selectedQuarantineId = selected.id;
  const activeItems = state.quarantine.filter((item) => item.status === "Em quarentena");
  return `
    <section>
      <div class="page-heading">
        <h1>Quarentena</h1>
        <p>${activeItems.length} itens ativos. Itens movidos daqui ainda podem ser restaurados.</p>
      </div>
      <section class="panel table-panel">
        <table>
          <thead><tr><th class="check-col"></th><th>Item</th><th>Origem</th><th>Tamanho</th><th>Data</th><th>Status</th></tr></thead>
          <tbody>
            ${state.quarantine.map((item) => `
              <tr class="${selected?.id === item.id ? "selected" : ""}" data-action="select-quarantine" data-id="${escapeHtml(item.id)}">
                <td><input type="checkbox" ${selected?.id === item.id ? "checked" : ""}></td>
                <td class="name-cell"><span class="folder-icon">${icon(item.type === "Arquivos grandes" ? "file" : "folder")}</span><span>${escapeHtml(item.name)}</span></td>
                <td>${escapeHtml(shortOrigin(item.originalPath))}</td>
                <td>${compactBytes(item.size)}</td>
                <td>${relativeDate(item.movedAt)}</td>
                <td>${quarantineStatusBadge(item.status)}</td>
              </tr>
            `).join("") || `<tr><td colspan="6" class="empty-soft">Nada em quarentena.</td></tr>`}
          </tbody>
        </table>
      </section>
      <h2>Ações</h2>
      <section class="panel action-panel">
        ${selected ? `
          <p>Item selecionado: <strong>${escapeHtml(selected.name)}</strong></p>
          <p>Origem: ${escapeHtml(selected.originalPath)}</p>
          <p>Quarentena: ${escapeHtml(selected.quarantinePath || "-")}</p>
          <p>Status: ${escapeHtml(selected.status || "Em quarentena")}</p>
          <div class="detail-actions">
            <button class="secondary" data-action="open-quarantine-item" data-path="${escapeHtml(selected.quarantinePath || "")}" ${selected.status !== "Em quarentena" ? "disabled" : ""}>${icon("folder")}Abrir na quarentena</button>
            <button class="outline-primary" data-action="restore-quarantine" data-id="${escapeHtml(selected.id)}" ${selected.status !== "Em quarentena" ? "disabled" : ""}>${icon("reset")}Restaurar</button>
            <button class="outline-danger" data-action="delete-quarantine" data-id="${escapeHtml(selected.id)}" ${selected.status !== "Em quarentena" ? "disabled" : ""}>${icon("trash")}Excluir permanentemente</button>
            <button class="secondary" data-action="forget-missing-quarantine" data-id="${escapeHtml(selected.id)}" ${selected.status === "Arquivo ausente" ? "" : "disabled"}>${icon("ban")}Remover registro ausente</button>
          </div>
        ` : `<p class="muted">Selecione um item em quarentena.</p>`}
      </section>
      <h2>Histórico</h2>
      <section class="panel history-panel">
        ${(state.history || []).slice(0, 3).map((item) => `<p>${icon("clock")} ${fullDate(item.date)}: ${item.candidates} candidatos encontrados em ${escapeHtml(item.drive)}</p>`).join("") || `<p>${icon("clock")} Nenhuma ação registrada ainda.</p>`}
      </section>
    </section>
  `;
}

function historyTab() {
  const scans = state.history || [];
  const totalMoved = scans.reduce((sum, item) => sum + (item.movedToQuarantine || 0), 0);
  const totalDeleted = scans.reduce((sum, item) => sum + (item.permanentlyDeleted || 0), 0);
  const last = scans[0];
  const freeDelta = last ? (last.freeAfter || 0) - (last.freeBefore || 0) : 0;
  return `
    <section>
      <div class="page-heading">
        <h1>Histórico</h1>
        <p>Scans anteriores e ações registradas pelo DiskSnoop.</p>
      </div>
      <section class="history-summary-cards">
        <article class="history-summary-card"><span>Scans</span><strong>${scans.length}</strong></article>
        <article class="history-summary-card"><span>Movido para quarentena</span><strong>${compactBytes(totalMoved)}</strong></article>
        <article class="history-summary-card"><span>Excluído permanente</span><strong>${compactBytes(totalDeleted)}</strong></article>
        <article class="history-summary-card"><span>Última variação livre</span><strong>${freeDelta >= 0 ? "+" : ""}${compactBytes(freeDelta)}</strong></article>
      </section>
      <section class="panel table-panel">
        <table class="history-table">
          <thead><tr><th>Data</th><th>Disco</th><th>Duração</th><th>Candidatos</th><th>Duplicados</th><th>Sem acesso</th><th>Revisável</th><th>Quarentena</th><th>Excluído</th><th>Livre antes</th><th>Livre depois</th><th>Ação</th></tr></thead>
          <tbody>
            ${(state.history || []).map((item) => `
              <tr>
                <td>${fullDate(item.date)}</td>
                <td>${escapeHtml(item.drive)}</td>
                <td>${durationLabel(item.durationMs)}</td>
                <td>${Number(item.candidates || 0).toLocaleString("pt-BR")}</td>
                <td>${Number(item.duplicates || 0).toLocaleString("pt-BR")}</td>
                <td>${Number(item.skipped || 0).toLocaleString("pt-BR")}</td>
                <td>${compactBytes(item.reviewable || 0)}</td>
                <td>${compactBytes(item.movedToQuarantine || 0)}</td>
                <td>${compactBytes(item.permanentlyDeleted || 0)}</td>
                <td>${compactBytes(item.freeBefore || 0)}</td>
                <td>${compactBytes(item.freeAfter || 0)}</td>
                <td><button class="table-action" data-action="load-history-scan" data-id="${escapeHtml(item.id)}">Carregar</button></td>
              </tr>
            `).join("") || `<tr><td colspan="12" class="empty-soft">Nenhum scan registrado ainda.</td></tr>`}
          </tbody>
        </table>
      </section>
      <h2>Resumo atual</h2>
      <section class="panel history-panel">
        <p>${icon("clock")} Último scan carregado: ${state.scanResult ? fullDate(state.scanResult.finishedAt) : "nenhum"}</p>
        <p>${icon("shield")} Em quarentena agora: ${compactBytes(totalQuarantined())}</p>
      </section>
    </section>
  `;
}

function shortOrigin(value) {
  if (!value) return "-";
  const parts = value.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return value;
  return `${parts[0]}\\${parts[1]}`;
}

function updatesTab() {
  return `
    <section>
      <div class="page-heading">
        <h1>Atualização</h1>
        <p>Espaço reservado para o sistema de updates do DiskSnoop.</p>
      </div>

      <section class="panel update-placeholder">
        <div class="update-hero-icon">${icon("download")}</div>
        <div class="update-copy">
          <span class="beta-pill">Em preparação</span>
          <h2>Sistema de atualização em preparação</h2>
          <p>Essa área será usada futuramente para verificar novas versões, changelog e instalação de updates.</p>
        </div>
        <div class="update-status-grid">
          <div><span>Versão atual</span><strong>${escapeHtml(APP_VERSION_LABEL)}</strong></div>
          <div><span>Última versão disponível</span><strong>Em breve</strong></div>
          <div><span>Canal</span><strong>Beta</strong></div>
          <div><span>Status</span><strong>Update ainda não implementado</strong></div>
        </div>
        <div class="release-roadmap">
          <article>
            <span>Próxima</span>
            <strong>0.2.0-beta</strong>
            <p>Polimento de UX, segurança das ações e candidatos mais confiáveis.</p>
          </article>
          <article>
            <span>Depois</span>
            <strong>0.3.0-beta</strong>
            <p>Revisão final de empacotamento, estabilidade e preparação do fluxo de update.</p>
          </article>
          <article>
            <span>Meta</span>
            <strong>1.x</strong>
            <p>Primeira linha estável, com o comportamento principal maduro.</p>
          </article>
        </div>
        <div class="update-future-list">
          <h3>Preparado para receber depois</h3>
          <ul>
            <li>Verificar nova versão manualmente.</li>
            <li>Mostrar changelog antes de atualizar.</li>
            <li>Baixar atualização com confirmação do usuário.</li>
            <li>Reiniciar para aplicar update quando isso existir.</li>
          </ul>
        </div>
        <div class="detail-actions">
          <button class="primary" disabled>${icon("download")}Verificar agora</button>
          <button class="secondary" disabled>${icon("list")}Changelog em breve</button>
        </div>
      </section>
    </section>
  `;
}

function settingsTab() {
  const ignoredCount = state.settings.ignoredPaths?.length || 0;
  const includedCount = state.settings.includedPaths?.length || 0;
  const activeQuarantine = state.quarantine.filter((item) => item.status === "Em quarentena");
  return `
    <section>
      <div class="page-heading">
        <h1>Configurações</h1>
        <p>Ajuste como o DiskSnoop analisa e protege arquivos</p>
      </div>

      <h2>Aparência</h2>
      <section class="panel settings-card">
        <div>
          <p>Tema atual</p>
          <span>Temas disponíveis agora: Claro e Escuro. A estrutura de tokens já está pronta para novos temas.</span>
        </div>
        ${selectControl("theme", availableThemes, themeLabels[state.settings.theme] || "Claro")}
      </section>

      <h2>Limites do scan</h2>
      <section class="panel settings-card vertical">
        ${settingSelect("Arquivo grande a partir de:", "largeFileSize", [["250 MB", 250 * MB], ["500 MB", 500 * MB], ["1 GB", GB], ["5 GB", 5 * GB], ["10 GB", 10 * GB]], state.settings.largeFileSize)}
        ${settingSelect("Pasta grande a partir de:", "largeFolderSize", [["500 MB", 500 * MB], ["1 GB", GB], ["2 GB", 2 * GB], ["5 GB", 5 * GB], ["10 GB", 10 * GB]], state.settings.largeFolderSize)}
        ${settingSelect("Possível duplicado a partir de:", "duplicateFileSize", [["10 MB", 10 * MB], ["50 MB", 50 * MB], ["100 MB", 100 * MB], ["500 MB", 500 * MB], ["1 GB", GB]], state.settings.duplicateFileSize || 50 * MB)}
        ${settingSelect("Considerar arquivo antigo após:", "oldFileDays", [["30 dias", 30], ["90 dias", 90], ["180 dias", 180], ["365 dias", 365]], state.settings.oldFileDays)}
      </section>

      <h2>Detectores</h2>
      <section class="panel settings-card vertical">
        ${checkLine("Detectar node_modules", "detectNodeModules")}
        ${checkLine("Detectar builds e caches", "detectBuildCaches")}
        ${checkLine("Detectar instaladores antigos", "detectOldInstallers")}
        ${checkLine("Detectar downloads antigos", "detectOldDownloads")}
        ${checkLine("Detectar compactados antigos", "detectOldArchives")}
        ${checkLine("Detectar logs grandes e temporários", "detectLogsAndTemps")}
        <span>Itens sensíveis como Windows, System32, drivers e programas ativos continuam fora dos candidatos normais.</span>
      </section>

      <h2>Quarentena</h2>
      <section class="panel settings-card vertical">
        <div class="settings-stats">
          <span><strong>${activeQuarantine.length}</strong> itens em quarentena</span>
          <span><strong>${compactBytes(totalQuarantined())}</strong> protegidos</span>
        </div>
        <p>Local atual: ${escapeHtml(state.settings.quarantinePath || "Pasta de dados do DiskSnoop")}</p>
        <div class="detail-actions">
          <button class="secondary" data-action="choose-quarantine">${icon("folder")}Alterar pasta</button>
          <button class="secondary" data-action="open-quarantine">${icon("external")}Abrir quarentena</button>
          <button class="secondary" data-action="reset-quarantine-path">${icon("reset")}Usar padrão</button>
        </div>
        ${checkLine("Sugerir D: quando C: estiver cheio", "suggestDForC")}
      </section>

      <h2>Escopo do scan</h2>
      <section class="panel settings-card vertical">
        <div class="scope-head">
          <div>
            <p>Pastas incluídas: <strong>${includedCount}</strong></p>
            <span>Quando houver inclusões, o scan varre somente essas pastas dentro do disco escolhido.</span>
          </div>
          <button class="secondary" data-action="add-included-folder">${icon("folder")}Adicionar pasta</button>
        </div>
        ${pathList(state.settings.includedPaths || [], "included")}
        <div class="detail-actions compact-actions">
          <button class="secondary" data-action="clear-included" ${includedCount ? "" : "disabled"}>${icon("trash")}Limpar incluídas</button>
        </div>
      </section>

      <h2>Ignorados</h2>
      <section class="panel settings-card vertical">
        <div class="scope-head">
          <div>
            <p>Pastas ignoradas: <strong>${ignoredCount}</strong></p>
            <span>Itens ignorados não entram nos próximos scans nem nas sugestões.</span>
          </div>
          <button class="secondary" data-action="add-ignored-folder">${icon("folder")}Adicionar pasta</button>
        </div>
        ${pathList(state.settings.ignoredPaths || [], "ignored")}
        <div class="detail-actions compact-actions">
          <button class="secondary" data-action="reset-ignored" ${ignoredCount ? "" : "disabled"}>${icon("reset")}Resetar ignorados</button>
        </div>
      </section>

      <h2>Manutenção</h2>
      <section class="panel settings-card vertical">
        <div class="settings-stats">
          <span><strong>${state.history.length}</strong> scans no histórico</span>
          <span><strong>${state.scanResult ? "1" : "0"}</strong> scan carregado nesta sessão</span>
        </div>
        <div class="detail-actions">
          <button class="secondary" data-action="open-data-folder">${icon("external")}Abrir dados do app</button>
          <button class="secondary" data-action="clear-local-scan">${icon("trash")}Limpar último scan local</button>
          <button class="secondary" data-action="clear-history">${icon("trash")}Limpar histórico</button>
          <button class="outline-danger" data-action="reset-settings">${icon("reset")}Restaurar configurações</button>
        </div>
        <span>Essas ações limpam apenas dados do DiskSnoop. Elas não apagam arquivos analisados nem itens fora da quarentena.</span>
      </section>
    </section>
  `;
}
function settingSelect(label, field, options, current) {
  return `
    <div class="setting-row">
      <span>${escapeHtml(label)}</span>
      <div class="select-shell"><select data-setting="${field}">
        ${options.map(([text, value]) => `<option value="${value}" ${Number(current) === Number(value) ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
      </select>${icon("chevron")}</div>
    </div>
  `;
}

function pathList(paths, type) {
  if (!paths.length) return `<div class="path-empty">Nenhuma pasta ${type === "included" ? "incluída" : "ignorada"}.</div>`;
  return `
    <div class="path-list">
      ${paths.map((itemPath, index) => `
        <div class="path-row">
          <span title="${escapeHtml(itemPath)}">${escapeHtml(itemPath)}</span>
          <button class="icon-button" data-action="open-config-path" data-path="${escapeHtml(itemPath)}" title="Abrir">${icon("external")}</button>
          <button class="icon-button" data-action="remove-${type}-path" data-index="${index}" title="Remover">${icon("trash")}</button>
        </div>
      `).join("")}
    </div>
  `;
}

function checkLine(label, field) {
  const checked = state.settings[field] !== false ? "checked" : "";
  return `<label class="check-line"><input type="checkbox" data-setting-toggle="${field}" ${checked}>${escapeHtml(label)}</label>`;
}

function render() {
  applyTheme();
  const app = $("#app");
  const content = $(".content");
  const shouldRestoreContentScroll = state.screen === "app" && lastRenderedTab === state.tab && content;
  const contentScrollTop = shouldRestoreContentScroll ? content.scrollTop : 0;

  if (state.screen === "welcome") app.innerHTML = welcomeScreen();
  if (state.screen === "disks") app.innerHTML = disksScreen();
  if (state.screen === "scanning") app.innerHTML = scanningScreen();
  if (state.screen === "app") app.innerHTML = appShell();

  if (shouldRestoreContentScroll) {
    const nextContent = $(".content");
    if (nextContent) nextContent.scrollTop = contentScrollTop;
  }
  lastRenderedTab = state.screen === "app" ? state.tab : null;
}

const MIN_BOOT_MS = 7000;

async function loadBasics() {
  const bootStart = Date.now();
  try {
    const loadedSettings = normalizeTheme(await api.getSettings());
    state.settings = loadedSettings;
    api.saveSettings(loadedSettings).catch(() => {});

    const [drives, quarantine, history] = await Promise.all([
      api.listDrives(),
      api.listQuarantine(),
      api.listHistory()
    ]);

    const elapsed = Date.now() - bootStart;
    if (elapsed < MIN_BOOT_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_BOOT_MS - elapsed));
    }

    state.drives = drives;
    state.quarantine = quarantine;
    state.history = history;
    state.selectedDrive = mostUrgentDrive();
    restoreLastScan();
    render();

    api.listInstalledApps()
      .then((apps) => {
        state.installedApps = apps;
        if (state.screen === "app" && state.tab === "leftovers") render();
      })
      .catch(() => {
        state.installedApps = [];
      });
  } catch (error) {
    const app = $("#app");
    app.innerHTML = `
      <main class="boot-screen">
        <section class="boot-card">
          ${appLogo("big")}
          <h1>Não foi possível iniciar</h1>
          <p>${escapeHtml(error.message || "Erro ao carregar dados iniciais.")}</p>
          <button class="primary" onclick="location.reload()">Tentar novamente</button>
        </section>
      </main>
    `;
  }
}

function restoreLastScan() {
  try {
    const cached = JSON.parse(localStorage.getItem(LAST_SCAN_KEY) || "null");
    if (!cached?.drive || !Array.isArray(cached.candidates)) return;
    state.scanResult = cached;
    state.selectedDrive = state.drives.find((drive) => drive.letter === cached.drive.letter) || cached.drive;
    state.screen = "app";
    state.tab = "overview";
  } catch {
    localStorage.removeItem(LAST_SCAN_KEY);
  }
}

function createTestScan() {
  const drive = state.selectedDrive || mostUrgentDrive() || { letter: "C:", used: 104 * GB, total: 111 * GB, free: 7 * GB, type: "Unknown" };
  const now = new Date().toISOString();
  const mk = (id, name, path, size, type, security, reason, days = 120) => ({
    id,
    name,
    path,
    size,
    type,
    security,
    risk: security === "Sensivel" ? "Sensivel" : "Verificar antes",
    reason,
    modifiedAt: new Date(Date.now() - days * 86400000).toISOString(),
    children: []
  });
  const root = `${drive.letter}\\`;
  const candidates = [
    mk("test-cache-1", "Cache", `${root}Users\\Voce\\AppData\\Local\\Cache`, 6 * GB, "Caches", "Seguro revisar", "Cache local detectado. Revise antes, mas normalmente e um dado recriavel.", 70),
    mk("test-node-1", "node_modules", `${root}Projetos\\AppAntigo\\node_modules`, 5.6 * GB, "Projetos dev", "Seguro revisar", "Esta pasta pode ser recriada com npm install quando o projeto esta parado.", 130),
    mk("test-dist-1", "dist", `${root}Projetos\\AppAntigo\\dist`, 1.2 * GB, "Projetos dev", "Seguro revisar", "Pasta de build recriavel pelo processo de desenvolvimento.", 90),
    mk("test-setup-1", "setup_old.exe", `${root}Users\\Voce\\Downloads\\setup_old.exe`, 900 * MB, "Instaladores antigos", "Seguro revisar", "Instalador antigo detectado em Downloads.", 210),
    mk("test-log-1", "logs", `${root}Apps\\Logs`, 620 * MB, "Logs grandes", "Verificar antes", "Logs antigos e grandes detectados.", 180),
    mk("test-video-1", "aula-backup.mp4", `${root}Users\\Voce\\Videos\\aula-backup.mp4`, 1.4 * GB, "Arquivos grandes", "Verificar antes", "Arquivo grande detectado.", 40),
    mk("test-video-2", "aula-backup.mp4", `${root}Users\\Voce\\Downloads\\aula-backup.mp4`, 1.4 * GB, "Arquivos grandes", "Verificar antes", "Arquivo grande detectado.", 120)
  ];
  const largeFolders = [
    mk("test-folder-downloads", "Downloads", `${root}Users\\Voce\\Downloads`, 24 * GB, "Pasta", "Verificar antes", "Contem muitos instaladores, zips e videos.", 1),
    mk("test-folder-projects", "Projetos", `${root}Projetos`, 21 * GB, "Pasta", "Seguro revisar", "Projetos de desenvolvimento ocupando espaco relevante.", 0),
    mk("test-folder-node", "node_modules", `${root}Projetos\\AppAntigo\\node_modules`, 5.6 * GB, "Pasta", "Seguro revisar", "Dependencias Node recriaveis.", 90),
    mk("test-folder-appdata", "AppData/Local", `${root}Users\\Voce\\AppData\\Local`, 6 * GB, "Pasta", "Verificar antes", "Area de dados de aplicativos. Revise com cuidado.", 0)
  ];
  return {
    id: `test-${Date.now()}`,
    drive,
    root,
    startedAt: now,
    finishedAt: now,
    files: 1000,
    directories: 126,
    skipped: 3,
    mappedBytes: drive.used || 104 * GB,
    rootSummary: null,
    scanRoots: [root],
    largeFolders,
    candidates,
    duplicateGroups: [{
      id: "test-duplicate-1",
      name: "aula-backup.mp4",
      size: 1.4 * GB,
      copies: 2,
      reviewableBytes: 1.4 * GB,
      confidence: "Possível duplicado",
      reason: "Arquivos com mesmo nome e tamanho encontrados em caminhos diferentes. Confirme o conteúdo antes de mover qualquer cópia.",
      items: [
        { id: "dup-test-1", name: "aula-backup.mp4", path: `${root}Users\\Voce\\Videos\\aula-backup.mp4`, size: 1.4 * GB, modifiedAt: new Date(Date.now() - 40 * 86400000).toISOString() },
        { id: "dup-test-2", name: "aula-backup.mp4", path: `${root}Users\\Voce\\Downloads\\aula-backup.mp4`, size: 1.4 * GB, modifiedAt: new Date(Date.now() - 120 * 86400000).toISOString() }
      ]
    }]
  };
}

function findFolder(id) {
  return (state.scanResult?.largeFolders || []).find((item) => item.id === id);
}

function findCandidate(id) {
  return (state.scanResult?.candidates || []).find((item) => item.id === id);
}

function findDuplicateGroup(id) {
  return (state.scanResult?.duplicateGroups || []).find((group) => group.id === id);
}

async function startScan(letter) {
  const drive = state.drives.find((item) => item.letter === letter) || state.selectedDrive;
  state.selectedDrive = drive;
  state.scanProgress = { progress: 0, currentPath: drive?.letter || "", files: 0, skipped: 0, mappedBytes: 0, candidates: 0 };
  state.paused = false;

  if (state.settings.suggestDForC !== false && !state.settings.quarantinePath && drive?.letter?.toUpperCase().startsWith("C:")) {
    const d = state.drives.find((item) => item.letter.toUpperCase().startsWith("D:") && item.free > 10 * GB);
    if (d) {
      state.settings.quarantinePath = `${d.letter}\\Quarantine`;
      await api.saveSettings(state.settings);
    }
  }

  state.screen = "scanning";
  render();
  await api.startScan({ drive });
}

async function refreshData() {
  state.quarantine = await api.listQuarantine();
  state.history = await api.listHistory();
}

async function ignoreItem(item) {
  if (!item) return;
  await api.addIgnoredPath(item.path);
  state.settings = await api.getSettings();
  removeItemFromCurrentResult(item);
  setToast("Item ignorado nos próximos scans.");
}

function removeItemFromCurrentResult(item) {
  if (!state.scanResult || !item?.path) return;
  state.scanResult.candidates = (state.scanResult.candidates || []).filter((candidate) => candidate.path !== item.path);
  state.scanResult.largeFolders = (state.scanResult.largeFolders || []).filter((folder) => folder.path !== item.path);
  if (state.selectedItem?.path === item.path) state.selectedItem = null;
  localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(state.scanResult));
}

async function quarantineItems(items) {
  const valid = items.filter(Boolean);
  if (!valid.length) return;
  const ok = await confirmModal({
    title: "Mover para quarentena",
    message: `Mover ${valid.length} item(ns) para a quarentena? Nada será excluído permanentemente.`,
    confirmText: "Mover",
    icon: "shield"
  });
  if (!ok) return;
  for (const item of valid) {
    try {
      await api.moveToQuarantine(item);
      state.selectedIds.delete(item.id);
      removeItemFromCurrentResult(item);
    } catch (error) {
      await confirmModal(friendlyMoveError(error, item));
      return;
    }
  }
  await refreshData();
  setToast("Item(ns) movido(s) para quarentena.");
}

function persistSettingsSoon() {
  api.saveSettings(state.settings)
    .then((saved) => {
      state.settings = normalizeTheme(saved);
      if (state.screen === "app" && state.tab === "settings") render();
    })
    .catch((error) => setToast(`Não foi possível salvar: ${error.message}`));
}

function updateSettingsControl(target) {
  const setting = target?.dataset?.setting;
  const toggle = target?.dataset?.settingToggle;
  if (!setting && !toggle) return false;
  const next = { ...state.settings };
  if (setting) next[setting] = Number(target.value);
  if (toggle) next[toggle] = target.checked;
  state.settings = normalizeTheme(next);
  persistSettingsSoon();
  return true;
}

function updateSelectField(target) {
  const field = target?.dataset?.field;
  if (!field) return false;
  if (field === "sizeFilter") state.sizeFilter = Number(target.value || 1);
  if (field === "sort") state.sort = target.value;
  if (field === "fileSizeFilter") state.fileSizeFilter = Number(target.value || 500 * MB);
  if (field === "fileSort") state.fileSort = target.value;
  if (field === "candidateScope") {
    state.candidateScope = target.value;
    state.candidateLimit = 80;
  }
  if (field === "candidateSafety") {
    state.candidateSafety = target.value;
    state.candidateLimit = 80;
  }
  if (field === "candidateAge") {
    state.candidateAge = target.value;
    state.candidateLimit = 80;
  }
  if (field === "candidateMinSize") {
    state.candidateMinSize = Number(target.value || 0);
    state.candidateLimit = 80;
  }
  if (field === "duplicateSearch") state.duplicateSearch = target.value;
  if (field === "duplicateMinWaste") state.duplicateMinWaste = Number(target.value || 0);
  if (field === "leftoversStatus") {
    state.leftoversStatus = target.value;
    state.leftoversLimit = 80;
  }
  if (field === "leftoversLocation") {
    state.leftoversLocation = target.value;
    state.leftoversLimit = 80;
  }
  if (field === "theme") {
    state.settings.theme = Object.entries(themeLabels).find(([, label]) => label === target.value)?.[0] || "light";
    state.settings = normalizeTheme(state.settings);
    persistSettingsSoon();
  }
  return true;
}

document.addEventListener("click", async (event) => {
  if (event.target.classList.contains("modal-overlay")) {
    const modal = state.modal;
    state.modal = null;
    render();
    modal?.resolve?.(false);
    return;
  }
  if (event.target.classList.contains("content-preview-overlay")) {
    state.contentPreview = null;
    render();
    return;
  }

  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === "modal-cancel") {
    const modal = state.modal;
    state.modal = null;
    render();
    modal?.resolve?.(false);
    return;
  }
  if (action === "modal-confirm") {
    const modal = state.modal;
    if (!modal) return;
    if (modal.requireText) {
      const value = $("[data-modal-input]")?.value || "";
      if (value !== modal.requireText) {
        state.modal = { ...modal, value, error: `Digite ${modal.requireText} exatamente para continuar.` };
        render();
        return;
      }
    }
    state.modal = null;
    render();
    modal.resolve(true);
    return;
  }

  if (action === "show-disks") {
    state.screen = "disks";
    render();
  }
  if (action === "window-minimize") await api.minimizeWindow();
  if (action === "window-maximize") await api.maximizeWindow();
  if (action === "window-close") await api.closeWindow();
  if (action === "start-scan") await startScan(target.dataset.drive);
  if (action === "load-cached-scan") {
    restoreLastScan();
    render();
  }
  if (action === "load-test-scan") {
    state.scanResult = createTestScan();
    state.selectedDrive = state.scanResult.drive;
    state.screen = "app";
    state.tab = "overview";
    state.selectedItem = null;
    state.selectedIds.clear();
    localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(state.scanResult));
    setToast("Bypass de teste carregado.");
  }
  if (action === "new-scan") {
    if (state.screen === "app") {
      state.screen = "disks";
      state.scanResult = null;
      state.selectedItem = null;
      state.selectedIds.clear();
      render();
    } else {
      await startScan(state.selectedDrive?.letter);
    }
  }
  if (action === "pause-scan") {
    state.paused = true;
    await api.controlScan("pause");
    render();
  }
  if (action === "resume-scan") {
    state.paused = false;
    await api.controlScan("resume");
    render();
  }
  if (action === "cancel-scan") {
    await api.controlScan("cancel");
    state.screen = "disks";
    render();
  }
  if (action === "tab") {
    state.tab = target.dataset.tab;
    state.selectedItem = null;
    render();
  }
  if (action === "select-overview-candidate") {
    state.selectedItem = findCandidate(id);
    state.tab = "candidates";
    render();
  }
  if (action === "select-folder") {
    state.selectedItem = findFolder(id);
    render();
  }
  if (action === "select-file") {
    state.selectedItem = findCandidate(id);
    render();
  }
  if (action === "select-candidate") {
    state.selectedItem = findCandidate(id);
    render();
  }
  if (action === "select-duplicate") {
    state.selectedDuplicateId = id;
    render();
  }
  if (action === "select-leftover") {
    state.selectedItem = findFolder(id);
    render();
  }
  if (action === "toggle-select") {
    event.stopPropagation();
    state.selectedIds[target.checked ? "add" : "delete"](id);
    render();
  }
  if (action === "toggle-all-candidates") {
    const items = filteredCandidates().slice(0, state.candidateLimit);
    if (target.checked) items.forEach((item) => state.selectedIds.add(item.id));
    else items.forEach((item) => state.selectedIds.delete(item.id));
    render();
  }
  if (action === "show-more-candidates") {
    state.candidateLimit += 80;
    render();
  }
  if (action === "show-more-leftovers") {
    state.leftoversLimit += 80;
    render();
  }
  if (action === "open-selected" && state.selectedItem) await api.showInFolder(state.selectedItem.path);
  if (action === "open-path") await api.showInFolder(target.dataset.path);
  if (action === "show-selected" && state.selectedItem) {
    try {
      const items = await api.listContents(state.selectedItem.path);
      state.contentPreview = { path: state.selectedItem.path, items };
      render();
    } catch (error) {
      setToast(`Não foi possível listar o conteúdo: ${error.message}`);
    }
  }
  if (action === "close-content-preview") {
    state.contentPreview = null;
    render();
  }
  if (action === "ignore-selected" && state.selectedItem) await ignoreItem(state.selectedItem);
  if (action === "quarantine-selected-item" && state.selectedItem) await quarantineItems([state.selectedItem]);
  if (action === "quarantine-leftover" && state.selectedItem) await quarantineItems([state.selectedItem]);
  if (action === "quarantine-selected") {
    const items = (state.scanResult?.candidates || []).filter((item) => state.selectedIds.has(item.id));
    await quarantineItems(items);
  }
  if (action === "select-quarantine") {
    state.selectedQuarantineId = id;
    render();
  }
  if (action === "open-quarantine-item") {
    const targetPath = target.dataset.path;
    if (targetPath) await api.showInFolder(targetPath);
  }
  if (action === "restore-quarantine") {
    try {
      await api.restoreQuarantine(id);
      await refreshData();
      setToast("Item restaurado.");
    } catch (error) {
      setToast(cleanIpcError(error));
    }
  }
  if (action === "delete-quarantine") {
    const ok = await confirmModal({
      title: "Excluir permanentemente",
      message: "Esta ação não pode ser desfeita pelo DiskSnoop.",
      confirmText: "Excluir",
      icon: "trash",
      variant: "danger",
      requireText: "EXCLUIR"
    });
    if (!ok) return;
    try {
      await api.deletePermanent(id);
      await refreshData();
      setToast("Item excluído permanentemente.");
    } catch (error) {
      setToast(cleanIpcError(error));
    }
  }
  if (action === "forget-missing-quarantine") {
    const ok = await confirmModal({
      title: "Remover registro ausente",
      message: "Esse arquivo não existe mais na quarentena. Apenas o registro do DiskSnoop será removido; nenhum arquivo será apagado.",
      confirmText: "Remover registro",
      icon: "ban"
    });
    if (!ok) return;
    try {
      await api.forgetMissingQuarantine(id);
      state.selectedQuarantineId = "";
      await refreshData();
      render();
      setToast("Registro ausente removido.");
    } catch (error) {
      setToast(cleanIpcError(error));
    }
  }
  if (action === "choose-quarantine") {
    const folder = await api.chooseQuarantineFolder();
    if (folder) {
      state.settings.quarantinePath = folder;
      state.settings = await api.saveSettings(state.settings);
      render();
      setToast(`Quarentena criada em ${folder}.`);
    }
  }
  if (action === "add-included-folder") {
    const folder = await api.chooseFolder();
    if (folder && !state.settings.includedPaths.includes(folder)) {
      state.settings.includedPaths.push(folder);
      state.settings = await api.saveSettings(state.settings);
      render();
    }
  }
  if (action === "add-ignored-folder") {
    const folder = await api.chooseFolder();
    if (folder && !state.settings.ignoredPaths.includes(folder)) {
      state.settings.ignoredPaths.push(folder);
      state.settings = await api.saveSettings(state.settings);
      render();
    }
  }
  if (action === "remove-included-path") {
    state.settings.includedPaths.splice(Number(target.dataset.index), 1);
    state.settings = await api.saveSettings(state.settings);
    render();
  }
  if (action === "remove-ignored-path") {
    state.settings.ignoredPaths.splice(Number(target.dataset.index), 1);
    state.settings = await api.saveSettings(state.settings);
    render();
  }
  if (action === "open-config-path") {
    await api.openPath(target.dataset.path);
  }
  if (action === "open-quarantine") {
    const paths = await api.appPaths();
    await api.openPath(state.settings.quarantinePath || paths.defaultQuarantine);
  }
  if (action === "reset-quarantine-path") {
    state.settings.quarantinePath = "";
    state.settings = await api.saveSettings(state.settings);
    render();
    setToast("Quarentena voltou para o local padrão.");
  }
  if (action === "clear-included") {
    state.settings.includedPaths = [];
    state.settings = await api.saveSettings(state.settings);
    render();
    setToast("Pastas incluídas limpas.");
  }
  if (action === "reset-ignored") {
    state.settings.ignoredPaths = [];
    state.settings = await api.saveSettings(state.settings);
    render();
    setToast("Ignorados resetados.");
  }
  if (action === "show-ignored") {
    setToast((state.settings.ignoredPaths || []).join(" | ") || "Nenhum item ignorado.");
  }
  if (action === "open-data-folder") {
    const paths = await api.appPaths();
    await api.openPath(paths.userData);
  }
  if (action === "clear-local-scan") {
    localStorage.removeItem(LAST_SCAN_KEY);
    render();
    setToast("Último scan local limpo.");
  }
  if (action === "clear-history") {
    const ok = await confirmModal({
      title: "Limpar histórico",
      message: "Limpar histórico de scans e snapshots salvos?",
      confirmText: "Limpar histórico",
      icon: "trash",
      variant: "danger"
    });
    if (!ok) return;
    state.history = await api.clearHistory();
    render();
    setToast("Histórico limpo.");
  }
  if (action === "reset-settings") {
    const ok = await confirmModal({
      title: "Restaurar configurações",
      message: "Ignorados, incluídos e local de quarentena serão resetados. Arquivos analisados não serão apagados.",
      confirmText: "Restaurar",
      icon: "reset",
      variant: "danger"
    });
    if (!ok) return;
    state.settings = normalizeTheme(await api.resetSettings());
    render();
    setToast("Configurações restauradas.");
  }
  if (action === "load-history-scan") {
    const snapshot = await api.loadScanSnapshot(id);
    if (!snapshot) {
      setToast("Esse scan antigo não tem snapshot salvo.");
      return;
    }
    state.scanResult = snapshot;
    state.selectedDrive = snapshot.drive;
    state.screen = "app";
    state.tab = "overview";
    state.selectedItem = null;
    state.selectedIds.clear();
    localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(snapshot));
    setToast("Scan histórico carregado.");
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-modal-input]")) {
    state.modal = { ...state.modal, value: event.target.value, error: "" };
    return;
  }
  if (event.target.matches("select")) {
    if (updateSelectField(event.target) || updateSettingsControl(event.target)) render();
    return;
  }
  const field = event.target.dataset.field;
  if (!field) return;
  if (field === "search") state.search = event.target.value;
  if (field === "fileSearch") state.fileSearch = event.target.value;
  if (field === "candidateSearch") {
    state.candidateSearch = event.target.value;
    state.candidateLimit = 80;
  }
  if (field === "duplicateSearch") state.duplicateSearch = event.target.value;
  if (field === "leftoversSearch") {
    state.leftoversSearch = event.target.value;
    state.leftoversLimit = 80;
  }
  render();
});

document.addEventListener("change", async (event) => {
  if (event.target.dataset.action === "drive-select") {
    state.selectedDrive = state.drives.find((drive) => drive.letter === event.target.value) || state.selectedDrive;
    render();
    return;
  }

  if (updateSelectField(event.target) || updateSettingsControl(event.target)) {
    render();
  }
});

api.onScanProgress((payload) => {
  state.scanProgress = payload;
  if (state.screen === "scanning") render();
});

api.onScanDone(async (result) => {
  state.scanResult = result;
  state.selectedDrive = result.drive;
  state.screen = "app";
  state.tab = "overview";
  state.selectedItem = null;
  state.selectedIds.clear();
  localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(result));
  await refreshData();
  render();
});

api.onScanError((payload) => {
  setToast(payload.error || "Erro durante o scan.");
  if (state.screen === "scanning") {
    state.screen = "disks";
    render();
  }
});

loadBasics();
