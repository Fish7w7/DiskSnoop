const api = window.diskScope;
if (!api) {
  const bootStatus = document.querySelector("[data-boot-status]");
  if (bootStatus) {
    bootStatus.textContent = document.documentElement.lang === "en-US"
      ? "Could not connect to the main process. Restart the app and check the terminal."
      : "Não foi possível conectar ao processo principal. Reinicie o app e verifique o terminal.";
  }
  throw new Error("DiskSnoop preload failed: window.diskScope is unavailable.");
}
const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
const SIGNABLE_EXTENSIONS = new Set([".exe", ".dll", ".msi", ".sys", ".cab", ".ocx"]);
const LAST_SCAN_KEY = "disksnoop:lastScan";
const HIDDEN_PATHS_KEY = "disksnoop:hiddenPaths";
let APP_VERSION_LABEL = "1.8.0-beta.1";

const state = {
  screen: "welcome",
  tab: "overview",
  drives: [],
  selectedDrive: null,
  settings: null,
  scanProgress: null,
  scanResult: null,
  scanComparison: null,
  reportMode: "none",
  hiddenPaths: new Set(),
  selectedItem: null,
  selectedIds: new Set(),
  selectedQuarantineId: "",
  quarantineFilter: "Ativos",
  quarantine: [],
  history: [],
  installedApps: [],
  appInventory: { appxReliable: false, appxError: "Inventário AppX ainda não confirmado.", loaded: false },
  isPackaged: false,
  appPaths: null,
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
  candidateSafety: "Revisáveis",
  candidateConfidence: "Todas",
  candidateAge: "Prioridade",
  candidateMinSize: 10 * MB,
  candidateLimit: 80,
  duplicateSearch: "",
  duplicateMinWaste: 100 * MB,
  selectedDuplicateId: "",
  leftoversSearch: "",
  leftoversStatus: "Possível sobra",
  leftoversLocation: "Todos",
  leftoversLimit: 80,
  settingsSection: "appearance",
  paused: false,
  toast: "",
  quarantineUndo: null,
  copiedDoubtKey: "",
  detailOverlayOpen: false,
  signatureCache: new Map(),
  signatureLoading: new Set(),
  update: {
    status: "idle",
    currentVersion: APP_VERSION_LABEL,
    latestVersion: "",
    lastCheckAt: "",
    channel: "Estável",
    buildMode: "Desenvolvimento",
    updateMode: "assisted",
    autoUpdaterAvailable: false,
    releasesPage: "",
    release: null,
    asset: null,
    downloaded: null,
    progress: 0,
    error: "",
    ignoredVersion: "",
    remindAfter: "",
    hiddenUntilReminder: false
  }
};

let lastRenderedTab = null;
let pendingTableRefresh = 0;
const animatedMetricValues = new Map();
const animatedMetricTargets = new Map();
const metricAnimationFrames = new Map();

const tabs = [
  ["overview", "nav.overview", "home"],
  ["folders", "nav.folders", "folder"],
  ["files", "nav.files", "file"],
  ["candidates", "nav.candidates", "clipboard"],
  ["duplicates", "nav.duplicates", "copy"],
  ["leftovers", "nav.leftovers", "cube"],
  ["quarantine", "nav.quarantine", "shield"],
  ["history", "nav.history", "clock"],
  ["updates", "nav.updates", "download"],
  ["settings", "nav.settings", "settings"]
];

const themeLabels = {
  light: "Claro",
  dark: "Escuro",
  hacker: "Hacker",
  neon: "Neon",
  system: "Sistema"
};

const themeDisplayLabels = {
  "pt-BR": themeLabels,
  "en-US": {
    light: "Light",
    dark: "Dark",
    hacker: "Hacker",
    neon: "Neon",
    system: "System"
  }
};

function themeDisplayLabel(theme) {
  return themeDisplayLabels[currentLanguage()]?.[theme] || themeLabels[theme] || themeLabels.light;
}

const languageOptions = [
  ["Português (Brasil)", "pt-BR"],
  ["English", "en-US"]
];
const languageLabels = Object.fromEntries(languageOptions.map(([label, value]) => [value, label]));

function normalizeTheme(settings) {
  const normalized = { ...(settings || {}) };
  if (normalized.theme === "black") normalized.theme = "dark";
  if (!themeLabels[normalized.theme]) normalized.theme = "light";
  if (!languageLabels[normalized.language]) normalized.language = "pt-BR";
  normalized.ignoredPaths = Array.isArray(normalized.ignoredPaths) ? normalized.ignoredPaths : [];
  normalized.includedPaths = Array.isArray(normalized.includedPaths) ? normalized.includedPaths : [];
  if (normalized.verifyDuplicateHashes === undefined) normalized.verifyDuplicateHashes = true;
  normalized.update = {
    checkOnStartup: true,
    autoDownload: true,
    includeBeta: false,
    preferManual: false,
    ignoredVersion: "",
    remindAfter: "",
    ...(normalized.update || {})
  };
  return normalized;
}

const iconPaths = {
  logo: '<path d="M12 2C8 6.2 5 9.5 5 13.4A7 7 0 0 0 19 13.4C19 9.5 16 6.2 12 2Z"/><path d="M12 10a3 3 0 0 0-3 3 3 3 0 0 0 6 0" class="icon-cut"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
  clipboard: '<path d="M8 4h8l1 3H7z"/><path d="M6 6H5v15h14V6h-1"/><path d="M9 11h6M9 15h6"/>',
  shield: '<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-5"/>',
  lock: '<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
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
  refresh: '<path d="M21 12a9 9 0 0 1-15.1 6.6"/><path d="M3 12A9 9 0 0 1 18.1 5.4"/><path d="M6 18.6H2.5V22"/><path d="M18 5.4h3.5V2"/>',
  reset: '<path d="M9 7H4V2"/><path d="M4.6 7A8 8 0 1 1 4 12"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/>',
  external: '<path d="M14 3h7v7"/><path d="M21 3 10 14"/><path d="M19 14v7H3V5h7"/>',
  check: '<path d="m5 12 4 4 10-10"/>'
};

function icon(name, className = "") {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || ""}</svg>`;
}

const emptyIllustrations = {
  folder: `<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 18h19l6 7h23v25H8z"/><path d="M8 26h48"/><path d="M25 38h14"/></svg>`,
  search: `<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="28" cy="28" r="18"/><path d="m41 41 13 13"/><path d="M21 28h14"/></svg>`,
  history: `<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="33" cy="33" r="22"/><path d="M33 20v14l9 6"/><path d="M11 14v12h12"/><path d="M13 24A24 24 0 0 1 33 9"/></svg>`
};

function emptyPanel(kind, title, text = "") {
  return `
    <section class="empty-panel">
      <div class="empty-illustration">${emptyIllustrations[kind] || emptyIllustrations.search}</div>
      <div>
        <h3>${escapeHtml(title)}</h3>
        ${text ? `<p>${escapeHtml(text)}</p>` : ""}
      </div>
    </section>
  `;
}

function skeletonRows(count = 6) {
  return Array.from({ length: count }, () => `
    <tr class="skeleton-table-row" aria-hidden="true">
      <td colspan="100">
        <div class="skeleton-row">
          <div class="skeleton-block" style="width: 24px;"></div>
          <div class="skeleton-block" style="width: 40%;"></div>
          <div class="skeleton-block" style="width: 15%;"></div>
          <div class="skeleton-block" style="width: 15%;"></div>
          <div class="skeleton-block" style="width: 15%;"></div>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderTableRefresh(source) {
  const tbody = $(".content .table-panel table tbody");
  if (!tbody) {
    render();
    return;
  }
  tbody.innerHTML = skeletonRows();
  const field = source?.dataset?.field || "";
  const selectionStart = source?.selectionStart;
  const selectionEnd = source?.selectionEnd;
  if (pendingTableRefresh) clearTimeout(pendingTableRefresh);
  pendingTableRefresh = setTimeout(() => {
    pendingTableRefresh = 0;
    render();
    if (!field || typeof selectionStart !== "number") return;
    const nextField = document.querySelector(`[data-field="${CSS.escape(field)}"]`);
    nextField?.focus({ preventScroll: true });
    nextField?.setSelectionRange?.(selectionStart, selectionEnd);
  }, 32);
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

function currentLanguage() {
  return languageLabels[state.settings?.language] ? state.settings.language : "pt-BR";
}

function storedLanguage() {
  try {
    const language = localStorage.getItem("disksnoop-language");
    return languageLabels[language] ? language : "pt-BR";
  } catch {
    return "pt-BR";
  }
}

function rememberLanguage(language = currentLanguage()) {
  try { localStorage.setItem("disksnoop-language", languageLabels[language] ? language : "pt-BR"); } catch {}
}

function setBootStep(step) {
  const language = state.settings ? currentLanguage() : storedLanguage();
  if (state.settings) rememberLanguage(language);
  window.diskSnoopBoot?.setLanguage?.(language);
  window.diskSnoopBoot?.setStep?.(step);
}

function t(key, values = {}) {
  const i18n = window.diskSnoopI18n;
  if (!i18n?.translate) return key;
  return i18n.translate(currentLanguage(), key, values);
}

function applyRenderedTranslations(root) {
  const i18n = window.diskSnoopI18n;
  const language = currentLanguage();
  if (language === "pt-BR" || !i18n?.translateRenderedText || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const original = node.nodeValue || "";
    const trimmed = original.trim();
    if (!trimmed) continue;
    const translated = i18n.translateRenderedText(language, trimmed);
    if (!translated) continue;
    const leading = original.match(/^\s*/)?.[0] || "";
    const trailing = original.match(/\s*$/)?.[0] || "";
    node.nodeValue = `${leading}${translated}${trailing}`;
  }
  root.querySelectorAll?.("input[placeholder], textarea[placeholder]").forEach((field) => {
    const translated = i18n.translatePlaceholder?.(language, field.getAttribute("placeholder"));
    if (translated) field.setAttribute("placeholder", translated);
  });
  root.querySelectorAll?.("[title]").forEach((element) => {
    const translated = i18n.translateRenderedText?.(language, element.getAttribute("title"));
    if (translated) element.setAttribute("title", translated);
  });
}

function formatCount(value) {
  return Number(value || 0).toLocaleString(currentLanguage());
}

function animateMetricValue(elementId, targetValue, formatFn) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const target = Number(targetValue || 0);
  const startValue = animatedMetricValues.get(elementId) ?? 0;
  const previousTarget = animatedMetricTargets.get(elementId);
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const existingFrame = metricAnimationFrames.get(elementId);
  if (existingFrame) cancelAnimationFrame(existingFrame);

  if (prefersReducedMotion || previousTarget === target || startValue === target) {
    element.textContent = formatFn(target);
    animatedMetricValues.set(elementId, target);
    animatedMetricTargets.set(elementId, target);
    metricAnimationFrames.delete(elementId);
    return;
  }

  animatedMetricTargets.set(elementId, target);
  element.textContent = formatFn(startValue);
  const duration = 600;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startValue + (target - startValue) * eased);
    element.textContent = formatFn(current);
    animatedMetricValues.set(elementId, current);
    if (progress < 1) {
      metricAnimationFrames.set(elementId, requestAnimationFrame(tick));
    } else {
      animatedMetricValues.set(elementId, target);
      metricAnimationFrames.delete(elementId);
    }
  }

  metricAnimationFrames.set(elementId, requestAnimationFrame(tick));
}

function animateOverviewMetrics() {
  if (state.screen !== "app" || state.tab !== "overview" || !state.scanResult) return;
  animateMetricValue("metric-safe-space", safeRecoverableTotal(), compactBytes);
  animateMetricValue("metric-reviewable-space", totalReviewable(), compactBytes);
  animateMetricValue("metric-candidates", visibleCandidates().length, formatCount);
  animateMetricValue("metric-leftovers", possibleLeftoversCount(), formatCount);
  animateMetricValue("metric-files", state.scanResult.files, formatCount);
}

function formatBytes(bytes = 0) {
  if (!Number.isFinite(Number(bytes)) || !bytes) return "0 B";
  const sign = bytes < 0 ? "-" : "";
  const value = Math.abs(bytes);
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${sign}${(value / 1024 ** index).toFixed(index < 2 ? 0 : 1)} ${units[index]}`;
}

function compactBytes(bytes = 0) {
  if (!Number.isFinite(Number(bytes)) || !bytes) return "0 B";
  const sign = bytes < 0 ? "-" : "";
  const value = Math.abs(bytes);
  if (value >= GB) return `${sign}${Math.round(value / GB)} GB`;
  if (value >= MB) return `${sign}${Math.round(value / MB)} MB`;
  return formatBytes(bytes);
}

function relativeDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const days = Math.max(0, Math.round(diff / 86400000));
  if (currentLanguage() === "en-US") {
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 60) return `${days} days`;
    if (days < 730) return days >= 365 ? "1 year" : `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} years`;
  }
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 60) return `${days} dias`;
  if (days < 730) return days >= 365 ? "1 ano" : `${Math.round(days / 30)} meses`;
  return `${Math.round(days / 365)} anos`;
}

function fullDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(currentLanguage(), { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function updateDate(value) {
  if (!value) return currentLanguage() === "en-US" ? "Not checked yet" : "Ainda não verificado";
  return new Intl.DateTimeFormat(currentLanguage(), { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
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

function updateStatusMeta(status) {
  const map = {
    idle: [t("status.idle"), "neutral"],
    checking: [t("status.checking"), "info"],
    "up-to-date": [t("status.upToDate"), "success"],
    available: [t("status.available"), "warning"],
    downloading: [t("status.downloading"), "info"],
    downloaded: [t("status.downloaded"), "success"],
    "restart-required": [t("status.restartRequired"), "warning"],
    error: [t("status.error"), "danger"],
    offline: [t("status.offline"), "neutral"],
    ignored: [t("status.ignored"), "neutral"]
  };
  const [label, kind] = map[status] || map.idle;
  return { label, kind };
}

function updateBadge() {
  const update = state.update || {};
  if (update.hiddenUntilReminder || update.status === "ignored" || update.status === "up-to-date") return "";
  if (update.status === "available") return "Update";
  if (update.status === "downloaded") return "Baixado";
  if (update.status === "restart-required") return "Reiniciar";
  if (update.status === "downloading") return `${Math.round(update.progress || 0)}%`;
  return "";
}

function updateChangelogSections(body) {
  const text = normalizeReleaseNotesBody(body);
  if (!text) return [];
  const sections = [];
  const fallbackItems = [];
  let current = null;
  const pushCurrent = () => {
    if (current?.items.length) sections.push(current);
  };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^#{1,4}\s+/.test(line)) {
      const heading = cleanReleaseNotesText(line.replace(/^#+\s*/, "").trim());
      pushCurrent();
      current = shouldShowChangelogSection(heading) ? { title: heading, items: [] } : null;
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+[.)]\s+(.+)$/);
    const item = cleanReleaseNotesText(bullet?.[1] || "");
    if (item && current) current.items.push(item);
    else if (item) fallbackItems.push(item);
  }
  pushCurrent();
  if (!sections.length && fallbackItems.length) {
    sections.push({ title: "Novidades", items: fallbackItems });
  }
  return sections.slice(0, 6).map((section) => ({
    title: section.title,
    items: section.items.slice(0, 8)
  }));
}

function normalizeReleaseNotesBody(body) {
  return decodeHtmlEntities(String(body || ""))
    .replace(/\r/g, "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*h([1-4])[^>]*>/gi, (_match, level) => `\n${"#".repeat(Number(level))} `)
    .replace(/<\s*\/h[1-4]\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<\s*\/li\s*>/gi, "\n")
    .replace(/<\s*\/?(ul|ol)[^>]*>/gi, "\n")
    .replace(/<\s*p[^>]*>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function cleanReleaseNotesText(value) {
  return decodeHtmlEntities(value)
    .replace(/<\/?[^>]+>/g, "")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldShowChangelogSection(title) {
  const normalized = String(title || "").toLowerCase();
  if (!normalized) return false;
  if (/^disksnoop\s+v?\d/i.test(normalized)) return false;
  return ![
    "como instalar",
    "limites conhecidos",
    "how to install",
    "known limits"
  ].includes(normalized);
}

function localChangelogSections(version) {
  const entries = window.diskSnoopLocalChangelog || {};
  const versionEntry = entries[String(version || APP_VERSION_LABEL)] || entries[APP_VERSION_LABEL];
  const entry = versionEntry?.[currentLanguage()] || versionEntry?.["pt-BR"] || versionEntry;
  if (!entry || !Array.isArray(entry.sections)) return [];
  return entry.sections
    .filter((section) => section?.title && Array.isArray(section.items) && section.items.length)
    .slice(0, 6)
    .map((section) => ({
      title: section.title,
      items: section.items.filter(Boolean).slice(0, 8)
    }));
}

function localizedUpdateChannel(value) {
  return value === "Estável" ? t("updates.channelStable") : value || t("updates.channelStable");
}

function localizedBuildMode(value) {
  const map = {
    Desenvolvimento: "updates.buildDevelopment",
    Portable: "updates.buildPortable",
    Instalado: "updates.buildInstalled"
  };
  return map[value] ? t(map[value]) : value || t("updates.buildDevelopment");
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
  const preference = themeLabels[state.settings?.theme] ? state.settings.theme : "light";
  const theme = preference === "system" ? "system" : preference;
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("disksnoop-theme", theme); } catch {}
  rememberLanguage();
}

function setToast(messageOrOptions) {
  const toast = typeof messageOrOptions === "string"
    ? { message: messageOrOptions }
    : { ...(messageOrOptions || {}) };
  state.toast = toast.message ? toast : "";
  render();
  if (toast.message) {
    const duration = Number(toast.duration || (toast.action ? 8000 : 3500));
    setTimeout(() => {
      if (state.toast === toast) {
        state.toast = "";
        if (toast.action === "undo-quarantine") state.quarantineUndo = null;
        render();
      }
    }, duration);
  }
}

function cleanIpcError(error) {
  let message = String(error?.message || error || "Erro inesperado.");
  message = message.replace(/^Error invoking remote method '[^']+':\s*/i, "");
  message = message.replace(/^Error:\s*/i, "");
  return message.trim();
}

function isMissingPathError(error) {
  const message = cleanIpcError(error).toLowerCase();
  return message.includes("caminho nao encontrado")
    || message.includes("caminho não encontrado")
    || message.includes("path not found")
    || message.includes("file not found")
    || message.includes("cannot find")
    || message.includes("não encontrado")
    || message.includes("nÃ£o encontrado");
}

function friendlyMoveError(error, item) {
  const message = cleanIpcError(error);
  if (message.includes("O Windows bloqueou o acesso")
    || message.includes("EBUSY")
    || message.includes("ENOTEMPTY")
    || message.includes("directory not empty")
    || message.includes("resource busy or locked")) {
    return {
      title: "Item em uso ou protegido",
      message: `${item?.name || "Este item"} não pôde ser movido agora. Algum app, driver ou serviço do Windows ainda está usando ou alterando essa pasta. Feche o aplicativo relacionado ou reinicie o PC antes de tentar de novo. O DiskSnoop não mantém cópias parciais quando a operação falha.`,
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

function candidatePrimaryStatus(item) {
  if (!canMoveToQuarantine(item)) return badge("Protegido", "high");
  if (confidenceLevel(item)[0] === "Alta" && isLowRiskCandidate(item)) return badge("Plano seguro", "low");
  if (item.security === "Provavel removivel" || item.security === "Provável removível") return badge("Provável", "warn");
  return badge("Revisar", "neutral");
}

function confidenceBadgeFor(item, context = "candidate") {
  const [label, kind] = confidenceLevel(item, context);
  return badge(label, kind);
}

function confidenceLevel(item, context = "candidate") {
  if (!item || isViewingHistoricalReport()) return ["Baixa", "high"];
  if (context === "leftover") {
    const [status] = leftoverStatus(item);
    if (status === "Possível sobra") return ["Média", "medium"];
    if (status === "App instalado") return ["Baixa", "high"];
    return ["Baixa", "high"];
  }
  if (context === "duplicate") {
    return item?.contentHash || item?.confidence === "Hash confirmado" ? ["Alta", "low"] : ["Média", "medium"];
  }
  if (!canMoveToQuarantine(item)) return ["Baixa", "high"];
  if (item.security === "Seguro revisar" || isProbablyRemovable(item)) return ["Alta", "low"];
  if (item.security === "Verificar antes") return ["Média", "medium"];
  return ["Baixa", "high"];
}

function normalizeItemPath(value) {
  return String(value || "").toLowerCase().replaceAll("/", "\\");
}

function volumeKey(value) {
  const match = String(value || "").match(/^[a-zA-Z]:/);
  return match ? match[0].toUpperCase() : "";
}

function currentQuarantineLocation() {
  return state.settings?.quarantinePath || state.appPaths?.defaultQuarantine || "";
}

function isQuarantineOnDifferentVolume(item) {
  const sourceVolume = volumeKey(item?.path);
  const quarantineVolume = volumeKey(currentQuarantineLocation());
  return Boolean(sourceVolume && quarantineVolume && sourceVolume !== quarantineVolume);
}

function crossVolumeQuarantineNote(item) {
  if (!isQuarantineOnDifferentVolume(item)) return "";
  return "A quarentena está em outro disco. Arquivos podem ser copiados com verificação antes da remoção; pastas entre volumes podem ser bloqueadas por segurança. Para pastas grandes, escolha uma quarentena no mesmo disco.";
}

function isHiddenPath(item) {
  const itemPath = normalizeItemPath(item?.path);
  if (!itemPath) return false;
  for (const hiddenPath of state.hiddenPaths) {
    if (itemPath === hiddenPath || itemPath.startsWith(`${hiddenPath}\\`)) return true;
  }
  return false;
}

function hidePathFromViews(item) {
  const itemPath = normalizeItemPath(item?.path);
  if (!itemPath) return;
  state.hiddenPaths.add(itemPath);
  persistHiddenPaths();
}

function unhidePathFromViews(item) {
  const itemPath = normalizeItemPath(item?.path);
  if (!itemPath) return;
  state.hiddenPaths.delete(itemPath);
  persistHiddenPaths();
}

function loadHiddenPaths() {
  try {
    const paths = JSON.parse(localStorage.getItem(HIDDEN_PATHS_KEY) || "[]");
    state.hiddenPaths = new Set(Array.isArray(paths) ? paths.map(normalizeItemPath).filter(Boolean) : []);
  } catch {
    state.hiddenPaths = new Set();
  }
}

function persistHiddenPaths() {
  try {
    localStorage.setItem(HIDDEN_PATHS_KEY, JSON.stringify([...state.hiddenPaths]));
  } catch {}
}

function clearHiddenPaths() {
  state.hiddenPaths.clear();
  persistHiddenPaths();
}

function readCachedScan() {
  try {
    const cached = JSON.parse(localStorage.getItem(LAST_SCAN_KEY) || "null");
    if (!cached?.id || !cached?.drive || !Array.isArray(cached.candidates)) return null;
    return cached;
  } catch {
    localStorage.removeItem(LAST_SCAN_KEY);
    return null;
  }
}

function hasValidCachedScan() {
  return Boolean(readCachedScan());
}

function syncHiddenPathsFromQuarantine(records = state.quarantine) {
  let changed = false;
  const blockedOriginals = new Set();
  const restoredOriginals = new Set();
  for (const record of records || []) {
    const originalPath = normalizeItemPath(record.originalPath);
    if (!originalPath) continue;
    if (record.status === "Restaurado") restoredOriginals.add(originalPath);
    else blockedOriginals.add(originalPath);
  }
  for (const restoredPath of restoredOriginals) {
    if (!blockedOriginals.has(restoredPath) && state.hiddenPaths.delete(restoredPath)) changed = true;
  }
  for (const blockedPath of blockedOriginals) {
    if (!state.hiddenPaths.has(blockedPath)) {
      state.hiddenPaths.add(blockedPath);
      changed = true;
    }
  }
  if (changed) persistHiddenPaths();
}

function selectedCandidateItems() {
  return visibleCandidates().filter((item) => state.selectedIds.has(item.id) && canMoveToQuarantine(item));
}

function shellTopRight() {
  if (state.screen === "welcome" || state.screen === "disks") return "";
  if (state.screen === "scanning") return `<button class="primary" data-action="cancel-scan">${t("top.cancelScan")}</button>`;
  if (state.tab === "candidates") return `<button class="primary" data-action="quarantine-selected" ${selectedCandidateItems().length ? "" : "disabled"}>${t("top.moveSelected")}</button>`;
  if (state.tab === "quarantine") return `<div class="top-stat">${t("top.quarantineProtected")} <strong>${compactBytes(totalQuarantined())}</strong></div>`;
  if (state.tab === "settings") return "";
  return `
    <div class="select-shell">
      <select data-action="drive-select">${state.drives.map((drive) => `<option value="${escapeHtml(drive.letter)}" ${state.selectedDrive?.letter === drive.letter ? "selected" : ""}>[${escapeHtml(drive.letter.replace(":", ""))}]</option>`).join("")}</select>
      ${icon("chevron")}
    </div>
    <button class="primary" data-action="new-scan">${state.scanResult ? t("top.newScan") : t("top.scanNow")}</button>
  `;
}

function appHeader() {
  const themeText = state.tab === "settings" ? t("top.theme", { theme: themeDisplayLabel(state.settings?.theme) }) : "";
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
        ${tabs.map(([id, labelKey, iconName]) => `
          <button class="nav-item ${state.tab === id ? "active" : ""}" data-action="tab" data-tab="${id}">
            ${icon(iconName)}
            <span>${escapeHtml(t(labelKey))}</span>
            ${id === "updates" && updateBadge() ? `<em class="nav-badge">${escapeHtml(updateBadge())}</em>` : ""}
          </button>
        `).join("")}
      </nav>
      <footer class="sidebar-info" aria-label="DiskSnoop v${escapeHtml(APP_VERSION_LABEL)}">
        <span>DiskSnoop</span>
        <span aria-hidden="true">·</span>
        <span>v${escapeHtml(APP_VERSION_LABEL)}</span>
      </footer>
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
            <h1 class="welcome-title">${escapeHtml(t("welcome.titleLine1"))}<br>${escapeHtml(t("welcome.titleLine2"))}</h1>
            <p class="welcome-sub">${escapeHtml(t("welcome.subtitle"))}</p>
            <div class="welcome-actions">
              <button class="primary large" data-action="show-disks">
                ${icon("search")} ${escapeHtml(t("welcome.start"))}
              </button>
              <div class="welcome-safe-badge">
                ${icon("shield")}
                ${escapeHtml(t("welcome.safeBadge"))}
              </div>
            </div>
          </div>

          <div class="welcome-features">
            <div class="welcome-feature-card">
              <div class="wf-icon">
                ${icon("folder")}
              </div>
              <h3>${escapeHtml(t("welcome.largeFoldersTitle"))}</h3>
              <p>${escapeHtml(t("welcome.largeFoldersText"))}</p>
            </div>
            <div class="welcome-feature-card">
              <div class="wf-icon">
                ${icon("clipboard")}
              </div>
              <h3>${escapeHtml(t("welcome.cleanupTitle"))}</h3>
              <p>${escapeHtml(t("welcome.cleanupText"))}</p>
            </div>
            <div class="welcome-feature-card">
              <div class="wf-icon">
                ${icon("shield")}
              </div>
              <h3>${escapeHtml(t("welcome.quarantineTitle"))}</h3>
              <p>${escapeHtml(t("welcome.quarantineText"))}</p>
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
  const hasCachedScan = hasValidCachedScan();
  return `
    <div class="window">
      ${appHeader()}
      <main class="disk-page">
        <div class="disk-heading">
          <div class="page-heading">
            <h1>${escapeHtml(t("disks.title"))}</h1>
            <p>${urgent ? escapeHtml(t("disks.suggestion", { drive: urgent.letter, free: compactBytes(urgent.free), total: compactBytes(urgent.total) })) : escapeHtml(t("disks.none"))}</p>
          </div>
          <div class="button-row">
            ${hasCachedScan ? `<button class="secondary" data-action="load-cached-scan">${escapeHtml(t("disks.lastScan"))}</button>` : ""}
            ${state.isPackaged ? "" : `<button class="secondary" data-action="load-test-scan">${escapeHtml(t("disks.testBypass"))}</button>`}
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
                    <p>${escapeHtml(drive.name || t("disks.localDisk"))}</p>
                    ${isPriority ? `<p class="priority-copy">${escapeHtml(t("disks.highPriority"))}</p>` : ""}
                  </div>
                  ${badge(status.label, status.className)}
                </div>
                <div class="drive-divider"></div>
                <div class="drive-space">
                  <span>${escapeHtml(t("disks.usedOf", { used: compactBytes(drive.used), total: compactBytes(drive.total) }))}</span>
                  <span class="drive-space-pct">${pct}%</span>
                </div>
                <div class="drive-bar-wrap">
                  <div class="drive-bar-fill ${barClass}" style="width:${pct}%"></div>
                </div>
                <div class="drive-numbers">
                  <span>${escapeHtml(t("disks.total"))}<b>${formatBytes(drive.total)}</b></span>
                  <span>${escapeHtml(t("disks.used"))}<b>${formatBytes(drive.used)}</b></span>
                  <span>${escapeHtml(t("disks.free"))}<b>${formatBytes(drive.free)}</b></span>
                </div>
                <button class="primary wide" data-action="start-scan" data-drive="${escapeHtml(drive.letter)}">${escapeHtml(t("disks.analyze", { drive: drive.letter }))}</button>
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
          <h1>${escapeHtml(t("scan.title", { drive: state.selectedDrive?.letter || "" }))}</h1>
          <p>${escapeHtml(progress.currentPath || t("scan.preparing"))}</p>
          ${progressBar(progress.progress || 0)}
          <div class="scan-grid">
            <div><span>${escapeHtml(t("scan.files"))}</span><strong>${formatCount(progress.files)}</strong></div>
            <div><span>${escapeHtml(t("scan.mapped"))}</span><strong>${formatBytes(progress.mappedBytes || 0)}</strong></div>
            <div><span>${escapeHtml(t("scan.candidates"))}</span><strong>${formatCount(progress.candidates)}</strong></div>
            <div><span>${escapeHtml(t("scan.skipped"))}</span><strong>${formatCount(progress.skipped)}</strong></div>
          </div>
          <div class="button-row">
            <button class="secondary" data-action="${state.paused ? "resume-scan" : "pause-scan"}">${state.paused ? escapeHtml(t("scan.resume")) : escapeHtml(t("scan.pause"))}</button>
            <button class="danger" data-action="cancel-scan">${escapeHtml(t("scan.cancel"))}</button>
          </div>
        </section>
      </main>
    </div>
  `;
}

function toastOverlay() {
  const toast = typeof state.toast === "string" ? { message: state.toast } : state.toast;
  if (!toast?.message) return "";
  return `
    <div class="toast ${escapeHtml(toast.tone || "")}" role="status" aria-live="polite">
      <span>${escapeHtml(toast.message)}</span>
      ${toast.action ? `<button data-action="${escapeHtml(toast.action)}">${escapeHtml(toast.actionLabel || "Desfazer")}</button>` : ""}
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
      ${toastOverlay()}
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
            ${modal.details?.length ? `
              <ul class="modal-points">
                ${modal.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}
              </ul>
            ` : ""}
            ${modal.requireText ? `
              <label class="modal-input">
                <span>Digite ${escapeHtml(modal.requireText)} para confirmar</span>
                <input data-modal-input value="${escapeHtml(modal.value || "")}" autocomplete="off">
              </label>
            ` : ""}
            ${modal.error ? `<p class="modal-error">${escapeHtml(modal.error)}</p>` : ""}
          </div>
        </header>
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
  if (state.tab === "updates") return updatesTabV1();
  if (state.tab === "settings") return settingsTab();
  return "";
}

function groupedCandidates() {
  const groups = new Map();
  for (const item of visibleCandidates()) {
    groups.set(item.type, (groups.get(item.type) || 0) + item.size);
  }
  return [...groups.entries()].sort((a, b) => b[1] - a[1]);
}

function visibleCandidates() {
  return (state.scanResult?.candidates || []).filter((item) => !isHiddenPath(item));
}

function visibleLargeFolders() {
  return (state.scanResult?.largeFolders || []).filter((item) => !isHiddenPath(item));
}

function totalReviewable() {
  return visibleCandidates().reduce((sum, item) => sum + item.size, 0);
}

function safeRecoverableTotal() {
  return visibleCandidates()
    .filter((item) => canMoveToQuarantine(item) && isLowRiskCandidate(item))
    .reduce((sum, item) => sum + item.size, 0);
}

function currentHistoryEntry() {
  return (state.history || []).find((item) => item.id === state.scanResult?.id);
}

function isDevTestScan() {
  return state.reportMode === "test" || (!state.isPackaged && String(state.scanResult?.id || "").startsWith("test-"));
}

function isLatestTrackedReport() {
  if (!state.scanResult?.id) return false;
  if (isDevTestScan()) return true;
  if (state.reportMode === "current") return true;
  return Boolean(state.history?.[0]?.id && state.history[0].id === state.scanResult.id);
}

function isViewingHistoricalReport() {
  if (!state.scanResult?.id || isDevTestScan()) return false;
  if (state.reportMode === "review") return true;
  return !isLatestTrackedReport();
}

function historicalReportNote() {
  if (!isViewingHistoricalReport()) return "";
  return safetyNote(
    "Relatório antigo",
    "Relatório antigo ou sem vínculo com o último scan. Para evitar ações em dados possivelmente desatualizados, mover para quarentena fica bloqueado aqui. Faça um novo scan para agir sobre o estado atual do disco.",
    "clock",
    "warning"
  );
}

function duplicateReviewableTotal() {
  return duplicateGroups().reduce((sum, group) => sum + (group.reviewableBytes || 0), 0);
}

function duplicateConfidenceKind(confidence = "") {
  return confidence.toLowerCase().includes("hash") ? "low" : "medium";
}

function possibleLeftoversCount() {
  return visibleLargeFolders().filter((item) => {
    const lower = item.path.toLowerCase();
    return lower.includes("\\appdata\\local\\") || lower.includes("\\appdata\\roaming\\") || lower.includes("\\programdata\\");
  }).length;
}

function isMetricSafeCandidate(item) {
  if (!item?.path) return false;
  if (item.security === "Sensivel" || item.security === "Sensível") return false;
  if (isProtectedUiPath(item.path)) return false;
  return isLowRiskCandidate(item);
}

function scanMetrics(result = state.scanResult) {
  const candidates = (result?.candidates || []).filter((item) => !isHiddenPath(item));
  const duplicateGroups = result?.duplicateGroups || [];
  const safeBytes = candidates
    .filter(isMetricSafeCandidate)
    .reduce((sum, item) => sum + (item.size || 0), 0);
  const reviewableBytes = candidates.reduce((sum, item) => sum + (item.size || 0), 0);
  const duplicateBytes = duplicateGroups.reduce((sum, group) => sum + (group.reviewableBytes || 0), 0);
  const categories = new Map();
  for (const item of candidates) {
    const type = cleanCandidateType(item.type);
    categories.set(type, (categories.get(type) || 0) + (item.size || 0));
  }
  return {
    safeBytes,
    reviewableBytes,
    duplicateBytes,
    candidates: candidates.length,
    categories
  };
}

function buildScanComparison(current, previous) {
  if (!current?.id || !previous?.id) return null;
  const now = scanMetrics(current);
  const before = scanMetrics(previous);
  const categoryRows = [...now.categories.entries()]
    .map(([name, size]) => {
      const previousSize = before.categories.get(name) || 0;
      return { name, size, delta: size - previousSize };
    })
    .filter((row) => Math.abs(row.delta) >= 10 * MB)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);
  return {
    previousId: previous.id,
    previousDate: previous.finishedAt,
    safeDelta: now.safeBytes - before.safeBytes,
    reviewableDelta: now.reviewableBytes - before.reviewableBytes,
    duplicateDelta: now.duplicateBytes - before.duplicateBytes,
    candidateDelta: now.candidates - before.candidates,
    categoryRows
  };
}

function signedBytes(value) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${compactBytes(Math.abs(value || 0))}`;
}

function signedCount(value) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value || 0).toLocaleString("pt-BR")}`;
}

function deltaBadge(value) {
  const kind = value > 0 ? "medium" : value < 0 ? "low" : "neutral";
  return badge(signedBytes(value), kind);
}

function scanComparisonPanel() {
  const comparison = state.scanComparison;
  if (!comparison) {
    return `
      <section class="overview-comparison comparison-empty">
        <span class="mini-icon">${icon("clock")}</span>
        <div>
          <strong>Sem base anterior para este disco</strong>
          <p>O próximo scan mostrará, aqui, quanto o espaço revisável aumentou ou diminuiu.</p>
        </div>
      </section>
    `;
  }
  return `
    <section class="overview-comparison">
      <span class="mini-icon">${icon("clock")}</span>
      <div>
        <strong>Desde ${escapeHtml(relativeDate(comparison.previousDate))}</strong>
        <p>${signedBytes(comparison.reviewableDelta)} revisáveis · ${signedBytes(comparison.safeDelta)} no plano seguro · ${signedCount(comparison.candidateDelta)} candidatos</p>
      </div>
    </section>
  `;
}

function overviewTab() {
  const result = state.scanResult;
  const drive = result.drive;
  const historyEntry = currentHistoryEntry();
  const categories = groupedCandidates();
  const reviewable = totalReviewable();
  const safeRecoverable = safeRecoverableTotal();
  const duplicateReviewable = duplicateReviewableTotal();
  const safeCandidates = visibleCandidates().filter((item) => canMoveToQuarantine(item) && isLowRiskCandidate(item)).length;
  const leftoversCount = possibleLeftoversCount();
  const top = categories.slice(0, 4);
  const largest = top[0]?.[1] || 1;
  const durationMs = historyEntry?.durationMs || (new Date(result.finishedAt).getTime() - new Date(result.startedAt).getTime());
  const scannedRoots = result.scanRoots?.length || 1;
  const isHistoricalReport = isViewingHistoricalReport();

  return `
    <section class="overview">
      <div class="page-heading split-heading overview-heading">
        <div>
          <h1>${escapeHtml(normalizeMediaType(drive.type))} ${escapeHtml(drive.letter)}</h1>
          <p>${compactBytes(drive.used)} usados de ${compactBytes(drive.total)}</p>
        </div>
        <span class="overview-recency">${isHistoricalReport ? escapeHtml(t("overview.historical")) : escapeHtml(t("overview.latest"))}: ${relativeDate(result.finishedAt)}</span>
      </div>
      ${isHistoricalReport ? historicalReportNote() : ""}

      <section class="overview-hero">
        <div class="overview-hero-main">
          <span class="overview-eyebrow"><span></span>Plano seguro disponível</span>
          <strong class="overview-hero-value" id="metric-safe-space">${compactBytes(safeRecoverable)}</strong>
          <p>${safeCandidates} item(ns) de baixo risco podem ser revisados sem alterar nada agora.</p>
          <div class="overview-hero-actions">
            <button class="primary" data-action="overview-safe-plan" ${safeCandidates ? "" : "disabled"}>${icon("shield")}Simular plano seguro</button>
            <button class="secondary" data-action="tab" data-tab="candidates">Ver todos os candidatos</button>
          </div>
        </div>
        <div class="overview-secondary-metrics">
          <div><span>${escapeHtml(t("overview.reviewable"))}</span><strong id="metric-reviewable-space">${compactBytes(reviewable)}</strong></div>
          <div><span>${escapeHtml(t("overview.found"))}</span><strong id="metric-candidates">${formatCount(visibleCandidates().length)}</strong></div>
          <div><span>${escapeHtml(t("overview.leftovers"))}</span><strong id="metric-leftovers">${formatCount(leftoversCount)}</strong></div>
        </div>
      </section>

      ${scanComparisonPanel()}

      ${reviewAssistantPanel({ safeCandidates, safeRecoverable, duplicateReviewable, leftoversCount })}

      <div class="overview-detail-grid">
        <section class="overview-section">
          <h2>${escapeHtml(t("overview.categoryUsage"))}</h2>
          <div class="category-panel">
            ${(top.length ? top : [[t("overview.noCandidates"), 0]]).map(([name, size]) => `
              <div class="category-row">
                <span>${escapeHtml(cleanCategory(name))}</span>
                <div class="category-bar">${progressBar(largest ? (size / largest) * 80 : 0)}</div>
                <strong>${compactBytes(size)}</strong>
              </div>
            `).join("")}
          </div>
        </section>

        <section class="overview-section">
          <h2>${escapeHtml(t("overview.scanReport"))}</h2>
          <div class="scan-report">
            <div class="report-grid">
              <div><span>${escapeHtml(t("overview.finished"))}</span><strong>${fullDate(result.finishedAt)}</strong></div>
              <div><span>${escapeHtml(t("overview.duration"))}</span><strong>${durationLabel(durationMs)}</strong></div>
              <div><span>${escapeHtml(t("overview.files"))}</span><strong id="metric-files">${formatCount(result.files)}</strong></div>
              <div><span>${escapeHtml(t("overview.folders"))}</span><strong>${formatCount(result.directories)}</strong></div>
              <div><span>${escapeHtml(t("overview.skipped"))}</span><strong>${formatCount(result.skipped)}</strong></div>
              <div><span>${escapeHtml(t("overview.roots"))}</span><strong>${formatCount(scannedRoots)}</strong></div>
            </div>
            <div class="report-note">
              ${icon("shield")}
              <span>${escapeHtml(t("overview.noAutoDelete"))} ${escapeHtml(duplicateReviewable ? t("overview.duplicatesNeedManual", { size: compactBytes(duplicateReviewable) }) : t("overview.reviewBeforeDelete"))}</span>
            </div>
          </div>
        </section>
      </div>

      <h2>Achados importantes</h2>
      <section class="finding-list overview-finding-list">
        ${visibleCandidates().slice(0, 4).map((item) => `
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

function reviewAssistantPanel({ safeCandidates, safeRecoverable, duplicateReviewable, leftoversCount }) {
  const steps = [
    {
      title: "Comece pelo seguro",
      text: `${safeCandidates} item(ns) de baixo risco somam ${compactBytes(safeRecoverable)}.`,
      tab: "candidates",
      iconName: "shield",
      status: safeCandidates ? "Pronto" : "Nada agora"
    },
    {
      title: "Revise duplicados",
      text: duplicateReviewable
        ? `${compactBytes(duplicateReviewable)} parecem revisáveis, mas exigem escolha manual.`
        : "Nenhum espaço revisável por duplicados neste scan.",
      tab: "duplicates",
      iconName: "copy",
      status: duplicateReviewable ? "Revisar" : "Limpo"
    },
    {
      title: "Cheque sobras de apps",
      text: leftoversCount
        ? `${leftoversCount} pasta(s) parecem sobras possíveis em áreas de apps.`
        : "Nenhuma sobra de app apareceu como prioridade.",
      tab: "leftovers",
      iconName: "cube",
      status: leftoversCount ? "Checar" : "Limpo"
    }
  ];
  return `
    <div class="overview-section-heading">
      <div>
        <h2>Próximos passos</h2>
        <p>Uma ordem simples para revisar o que mais importa.</p>
      </div>
    </div>
    <section class="review-steps">
      ${steps.map((step) => `
        <button class="review-step" data-action="tab" data-tab="${step.tab}">
          <span class="mini-icon">${icon(step.iconName)}</span>
          <span>
            <strong>${escapeHtml(step.title)}</strong>
            <small>${escapeHtml(step.text)}</small>
          </span>
          <span class="review-step-status">${escapeHtml(step.status)} ${icon("chevron")}</span>
        </button>
      `).join("")}
    </section>
  `;
}

function ignoredPresetCandidates(preset) {
  const items = [...visibleCandidates(), ...visibleLargeFolders()].filter((item) => item?.path);
  const existing = new Set((state.settings?.ignoredPaths || []).map(normalizeItemPath));
  const generatedNames = new Set(["node_modules", "dist", "build", ".next", ".cache", ".turbo", "coverage", "target", "obj"]);
  const candidates = items.filter((item) => {
    const lowerPath = normalizeItemPath(item.path);
    const name = String(item.name || item.path.split(/[\\/]/).pop() || "").toLowerCase();
    const type = cleanCandidateType(item.type);
    if (preset === "generated") return generatedNames.has(name) || type === "Dev";
    if (preset === "caches") return type === "Cache" || lowerPath.includes("\\cache\\") || lowerPath.includes("\\caches\\");
    if (preset === "downloads") return lowerPath.includes("\\downloads\\") && ["Download", "Instalador", "Compactado"].includes(type);
    return false;
  });
  const seen = new Set();
  return candidates
    .map((item) => item.path)
    .filter((itemPath) => {
      const key = normalizeItemPath(itemPath);
      if (!key || existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function ignoredPresetCards() {
  const presets = [
    {
      key: "generated",
      title: "Gerados por projetos",
      description: "node_modules, builds, caches de build e saídas recriáveis encontrados neste scan."
    },
    {
      key: "caches",
      title: "Caches detectados",
      description: "Pastas de cache encontradas pelo scanner para sair dos próximos relatórios."
    },
    {
      key: "downloads",
      title: "Downloads antigos",
      description: "Instaladores, compactados e downloads antigos já sinalizados neste scan."
    }
  ].map((preset) => ({ ...preset, count: ignoredPresetCandidates(preset.key).length }));
  return `
    <div class="ignored-suggestions">
      ${presets.map((preset) => `
        <article class="ignored-suggestion ${preset.count ? "" : "is-empty"}">
          <div class="ignored-suggestion-copy">
            <strong>${escapeHtml(preset.title)}</strong>
            <p>${escapeHtml(preset.description)}</p>
          </div>
          <div class="ignored-suggestion-footer">
            <span class="ignored-suggestion-count">
              <strong>${escapeHtml(preset.count)}</strong>
              <small>Encontrados</small>
            </span>
            <button class="secondary ignored-suggestion-action" data-action="apply-ignore-preset" data-preset="${preset.key}" ${preset.count ? "" : "disabled"}>
              Ignorar
            </button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function filteredFolders() {
  const query = state.search.toLowerCase();
  return [...visibleLargeFolders()]
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
  if (isProtectedUiPath(item.path)) return ["Protegido", "high"];
  if (item.risk === "Sensivel" || item.risk === "Sensível") return ["Alto", "high"];
  if (item.name.toLowerCase().includes("appdata") || item.path.toLowerCase().includes("\\appdata\\")) return ["Alto", "high"];
  if (item.path.toLowerCase().includes("\\downloads\\") || item.name.toLowerCase().includes("videos")) return ["Médio", "medium"];
  return ["Baixo", "low"];
}

function foldersTab() {
  const items = filteredFolders();
  const selected = items.find((item) => item.id === state.selectedItem?.id) || items[0];
  if (state.selectedItem?.id !== selected?.id) state.selectedItem = selected || null;
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
      <section class="master-detail-layout">
        <div class="master-detail-list">
          <section class="panel table-panel">
            <table class="folders-table">
              <thead><tr><th>Nome</th><th>Tamanho</th><th>Modificado</th><th>Risco</th></tr></thead>
              <tbody>
                ${items.slice(0, 60).map((item) => {
                  const [label, kind] = folderRisk(item);
                  const protection = protectedPathInfo(item.path);
                  return `
                    <tr class="${state.selectedItem?.id === item.id ? "selected" : ""}" data-action="select-folder" data-id="${escapeHtml(item.id)}">
                      <td class="name-cell" title="${escapeHtml(item.name)}">
                        <div class="name-cell-layout">
                          <span class="folder-icon">${icon("folder")}</span>
                          <span class="name-cell-copy">${escapeHtml(item.name)}</span>
                          ${protection.protected ? `<span class="protection-marker" title="${escapeHtml(`Protegido: ${protection.reason}`)}" aria-label="Componente protegido">${icon("lock")}</span>` : ""}
                        </div>
                      </td>
                      <td>${compactBytes(item.size)}</td>
                      <td>${relativeDate(item.modifiedAt)}</td>
                      <td>${badge(label, kind)}</td>
                    </tr>
                  `;
                }).join("") || `<tr><td colspan="4" class="empty-state-cell">${emptyPanel("folder", "Nenhuma pasta com os filtros atuais.")}</td></tr>`}
              </tbody>
            </table>
          </section>
        </div>
        ${detailOverlay("Detalhes", folderDetails(state.selectedItem), Boolean(state.selectedItem))}
      </section>
    </section>
  `;
}

function folderDetails(item) {
  if (!item) return `<section class="panel detail-strip"><p class="muted">Selecione uma pasta para ver detalhes.</p></section>`;
  const guidance = folderReviewGuidance(item);
  return `
    <section class="panel detail-strip">
      <span class="detail-icon">${icon("folder")}</span>
      <div class="detail-copy">
        <h3>${escapeHtml(item.path)}</h3>
        ${isProtectedUiPath(item.path) ? reviewCallout("Componente protegido", protectedPathInfo(item.path).reason, "shield", "warning") : ""}
        ${reviewCallout("Resumo seguro", item.reason || "Pasta grande detectada no scan.", "folder")}
        ${reviewCallout("O que conferir", guidance.text, guidance.icon, guidance.tone)}
        ${childrenSummary(item)}
        <div class="detail-actions">
          <button class="secondary" data-action="open-selected">${icon("folder")}Abrir pasta</button>
          <button class="secondary" data-action="show-selected">${icon("list")}Ver conteúdo</button>
          <button class="secondary" data-action="ignore-selected">${icon("ban")}Ignorar</button>
          ${copyDoubtButton(item, "folder")}
        </div>
      </div>
    </section>
  `;
}

function safetyNote(title, text, iconName = "shield", tone = "info") {
  return `
    <div class="safety-note ${tone === "warning" ? "warning" : ""}">
      ${icon(iconName)}
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(text)}</p>
      </div>
    </div>
  `;
}

function folderReviewGuidance(item) {
  const lower = String(item?.path || "").toLowerCase();
  if (lower.includes("\\appdata\\")) {
    return {
      text: "AppData costuma misturar cache, configurações e dados importantes de apps. Abra a pasta e use a lista de conteúdo para entender o que realmente pesa.",
      icon: "shield",
      tone: "warning"
    };
  }
  if (lower.includes("\\downloads\\") || lower.includes("\\videos\\") || lower.includes("\\documents\\")) {
    return {
      text: "Procure instaladores antigos, cópias repetidas e arquivos que você reconhece. Pastas pessoais merecem revisão manual antes de qualquer limpeza.",
      icon: "list",
      tone: "warning"
    };
  }
  return {
    text: "Veja os maiores itens dentro da pasta e confirme se ela ainda faz parte de um projeto, app ou backup ativo antes de ignorar ou limpar.",
    icon: "list",
    tone: "info"
  };
}

function reviewCallout(title, text, iconName = "shield", tone = "info") {
  if (!text) return "";
  return `
    <div class="detail-review-note ${tone === "warning" ? "warning" : ""}">
      <span>${icon(iconName)}</span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(text)}</p>
      </div>
    </div>
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
  return [...visibleCandidates()]
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
      ${historicalReportNote()}
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
      <section class="master-detail-layout">
        <div class="master-detail-list">
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
                `).join("") || `<tr><td colspan="5" class="empty-state-cell">${emptyPanel("search", "Nenhum arquivo grande com os filtros atuais.")}</td></tr>`}
              </tbody>
            </table>
          </section>
        </div>
        ${detailOverlay("Detalhes", fileDetails(state.selectedItem), Boolean(state.selectedItem))}
      </section>
    </section>
  `;
}

function fileDetails(item) {
  if (!item) return `<section class="panel explanation"><p class="muted">Selecione um arquivo para ver detalhes.</p></section>`;
  const canQuarantine = canMoveToQuarantine(item);
  const guidance = fileReviewGuidance(item);
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
          <span>Confiança ${confidenceBadgeFor(item)}</span>
        </div>
      </div>
      ${reviewCallout("Motivo do achado", item.reason || "Arquivo grande detectado no scan. Revise antes de mover, especialmente se for documento, vídeo ou arquivo pessoal.", "file")}
      ${reviewCallout("O que conferir", guidance.text, guidance.icon, guidance.tone)}
      <div class="detail-actions">
        <button class="secondary" data-action="open-selected">${icon("folder")}Abrir local</button>
        <button class="secondary" data-action="ignore-selected">${icon("ban")}Ignorar</button>
        <button class="secondary" data-action="quarantine-selected-item" ${canQuarantine ? "" : "disabled"}>${icon("shield")}Mover para quarentena</button>
      </div>
      ${canQuarantine && crossVolumeQuarantineNote(item) ? reviewCallout("Atenção antes de mover", crossVolumeQuarantineNote(item), "shield", "warning") : ""}
      ${canQuarantine ? "" : reviewCallout("Atenção antes de mover", blockedQuarantineReason(item), "shield", "warning")}
    </section>
  `;
}

function fileReviewGuidance(item) {
  const lower = `${item?.name || ""} ${item?.path || ""}`.toLowerCase();
  if (lower.includes("\\downloads\\") || lower.endsWith(".exe") || lower.endsWith(".msi")) {
    return {
      text: "Se for instalador antigo, confirme se o programa já está instalado ou se existe uma versão mais nova. Quando estiver em dúvida, mova para quarentena em vez de excluir.",
      icon: "download",
      tone: "info"
    };
  }
  if (lower.includes("\\videos\\") || lower.includes("\\pictures\\") || lower.includes("\\documents\\")) {
    return {
      text: "Arquivos pessoais podem ser únicos. Abra o local, confira o nome e a data, e só mova para quarentena quando tiver certeza de que não precisa mais deles.",
      icon: "shield",
      tone: "warning"
    };
  }
  return {
    text: "Abra o local para confirmar se o arquivo ainda é usado. A quarentena ajuda a testar a remoção sem apagar permanentemente.",
    icon: "list",
    tone: "info"
  };
}

function filteredCandidates() {
  const query = state.candidateSearch.toLowerCase().trim();
  return [...visibleCandidates()]
    .filter((item) => {
      if (query && !`${item.name} ${item.path} ${item.type}`.toLowerCase().includes(query)) return false;
      if (!query && Number(state.candidateMinSize || 0) > 0 && item.size < Number(state.candidateMinSize)) return false;
      if (state.candidateScope !== "Todos" && cleanCandidateType(item.type) !== state.candidateScope) return false;
      if (state.candidateSafety === "Revisáveis" && !isLowRiskCandidate(item)) return false;
      if (state.candidateSafety === "Seguro revisar" && item.security !== "Seguro revisar") return false;
      if (state.candidateSafety === "Verificar antes" && item.security !== "Verificar antes") return false;
      if ((state.candidateSafety === "Provavel removivel" || state.candidateSafety === "Provável removível") && item.security !== "Provavel removivel" && item.security !== "Provável removível") return false;
      return true;
    })
    .filter((item) => state.candidateConfidence === "Todas" || confidenceLevel(item)[0] === state.candidateConfidence)
    .sort((a, b) => {
      if (state.candidateAge === "Prioridade") return candidatePriorityScore(b) - candidatePriorityScore(a);
      if (state.candidateAge === "Mais antigos") return new Date(a.modifiedAt || 0) - new Date(b.modifiedAt || 0);
      return b.size - a.size;
    });
}

function isProbablyRemovable(item) {
  return item?.security === "Provavel removivel" || item?.security === "Provável removível";
}

function isLowRiskCandidate(item) {
  return item?.security === "Seguro revisar" || isProbablyRemovable(item);
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
    : isProbablyRemovable(item) ? 22
      : item.security === "Verificar antes" ? 8
        : -40;
  const sizeMb = Math.max(1, (item.size || 0) / MB);
  const sizeScore = Math.min(38, Math.log2(sizeMb) * 5);
  const days = Math.max(0, (Date.now() - new Date(item.modifiedAt || 0).getTime()) / 86400000);
  const ageScore = Math.min(18, days / 18);
  return typeScore + safetyScore + sizeScore + ageScore;
}

function candidateSafetySummary(items = visibleCandidates()) {
  return {
    safe: items.filter((item) => item.security === "Seguro revisar").length,
    likely: items.filter(isProbablyRemovable).length,
    review: items.filter((item) => item.security === "Verificar antes").length,
    blocked: items.filter((item) => !canMoveToQuarantine(item)).length
  };
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

function localizedRenderedText(value) {
  const source = String(value ?? "");
  if (!source || currentLanguage() === "pt-BR") return source;
  return window.diskSnoopI18n?.translateRenderedText?.(currentLanguage(), source) || source;
}

function signatureLabelFor(result) {
  if (!result || result.status === "not-applicable") return "";
  if (result.status === "valid" && result.isMicrosoft) return t("signature.validMicrosoft");
  if (result.status === "valid") {
    return t("signature.valid", { signer: result.signer || t("signature.unknownSigner") });
  }
  if (result.status === "unsigned") return t("signature.unsigned");
  if (result.status === "invalid") return t("signature.invalid");
  return t("signature.unknown");
}

function isSignablePath(itemPath) {
  const cleanPath = String(itemPath || "").split(/[?#]/, 1)[0];
  const dotIndex = cleanPath.lastIndexOf(".");
  return dotIndex >= 0 && SIGNABLE_EXTENSIONS.has(cleanPath.slice(dotIndex).toLowerCase());
}

function signatureResultBadge(result) {
  if (!result || result.status === "not-applicable") return "";
  const tone = result.status === "valid" ? "valid" : result.status === "unsigned" ? "unsigned" : result.status === "invalid" ? "invalid" : "unknown";
  return `<span class="signature-result ${tone}">${icon(result.status === "valid" ? "check" : "shield")}<span>${escapeHtml(signatureLabelFor(result))}</span></span>`;
}

function signatureControls(item) {
  if (!isSignablePath(item?.path)) return "";
  const cached = state.signatureCache.get(item.path);
  if (cached) return signatureResultBadge(cached);
  const loading = state.signatureLoading.has(item.path);
  return `<button class="secondary" data-action="verify-signature" data-id="${escapeHtml(item.id)}" ${loading ? "disabled" : ""}>${icon("shield")}${escapeHtml(t(loading ? "candidates.verifyingSignature" : "candidates.verifySignature"))}</button>`;
}

function doubtItemForContext(item, context = "candidate") {
  if (!item) return null;
  if (context === "duplicate") {
    const copies = item.items || [];
    const reference = copies[0] || {};
    const summary = duplicateReviewSummary(item);
    return {
      ...reference,
      id: item.id,
      name: item.name,
      path: reference.path || "-",
      paths: copies.map((copy) => copy.path).filter(Boolean),
      size: item.size,
      modifiedAt: reference.modifiedAt,
      type: "Possível duplicado",
      reason: item.reason || summary.text
    };
  }
  if (context === "leftover") {
    const match = matchingInstalledApp(item);
    const [status] = leftoverStatus(item);
    const summary = leftoverReviewSummary(status, match);
    return { ...item, type: status, reason: item.reason || summary.text };
  }
  if (context === "folder") {
    const [riskLabel] = folderRisk(item);
    const protection = protectedPathInfo(item.path);
    const guidance = folderReviewGuidance(item);
    return {
      ...item,
      type: "Pasta grande",
      reason: item.reason || "Pasta acima do limite configurado para pastas grandes.",
      safety: protection.protected ? `Protegido: ${protection.reason}` : riskLabel,
      guidance: guidance.text
    };
  }
  return item;
}

function buildDoubtText(item, context = "candidate") {
  const normalized = doubtItemForContext(item, context);
  if (!normalized) return "";
  const paths = normalized.paths?.length ? normalized.paths : [normalized.path || "-"];
  const lines = [t("doubt.intro")];
  paths.forEach((itemPath, index) => {
    const pathLabel = paths.length > 1 ? `${t("doubt.path")} ${index + 1}` : t("doubt.path");
    lines.push(`- ${pathLabel}: ${itemPath}`);
  });
  lines.push(`- ${t("doubt.size")}: ${compactBytes(normalized.size)}`);
  lines.push(`- ${t("doubt.modified")}: ${normalized.modifiedAt ? fullDate(normalized.modifiedAt) : "-"}`);
  lines.push(`- ${t("doubt.category")}: ${localizedRenderedText(cleanCandidateType(normalized.type || "-"))}`);
  if (normalized.reason) lines.push(`- ${t("doubt.reason")}: ${localizedRenderedText(normalized.reason)}`);
  if (normalized.safety) lines.push(`- ${t("doubt.safety")}: ${localizedRenderedText(normalized.safety)}`);
  if (normalized.guidance) lines.push(`- ${t("doubt.guidance")}: ${localizedRenderedText(normalized.guidance)}`);

  const signatureEntries = paths
    .map((itemPath) => [itemPath, state.signatureCache.get(itemPath)])
    .filter(([, result]) => result && result.status !== "not-applicable");
  signatureEntries.forEach(([itemPath, result]) => {
    const suffix = paths.length > 1 ? ` (${itemPath})` : "";
    lines.push(`- ${t("doubt.signature")}${suffix}: ${signatureLabelFor(result)}`);
  });
  lines.push("", t("doubt.question"));
  return lines.join("\n");
}

function doubtItemByContext(id, context) {
  if (context === "duplicate") return findDuplicateGroup(id);
  if (context === "leftover") return findFolder(id) || state.selectedItem;
  if (context === "folder") return findFolder(id) || state.selectedItem;
  return findCandidate(id) || state.selectedItem;
}

function copyDoubtButton(item, context) {
  if (!item?.id) return "";
  const key = `${context}:${item.id}`;
  const copied = state.copiedDoubtKey === key;
  return `<button class="secondary copy-doubt-button ${copied ? "copied" : ""}" data-action="copy-doubt" data-context="${escapeHtml(context)}" data-id="${escapeHtml(item.id)}">${icon(copied ? "check" : "clipboard")}${escapeHtml(t(copied ? "candidates.copyDoubtDone" : "candidates.copyDoubt"))}</button>`;
}

function selectionSimulationPanel(selectedItems, visibleItems) {
  const selectedSize = selectedItems.reduce((sum, item) => sum + (item.size || 0), 0);
  const safePlan = visibleItems.filter((item) => canMoveToQuarantine(item) && confidenceLevel(item)[0] === "Alta");
  const safePlanSize = safePlan.reduce((sum, item) => sum + (item.size || 0), 0);
  const previewItems = selectedItems.length ? selectedItems : safePlan.slice(0, 8);
  const previewSize = selectedItems.length ? selectedSize : safePlanSize;
  return `
    <section class="simulation-panel">
      <div class="simulation-main">
        <span class="metric-icon">${icon("shield")}</span>
        <div>
          <strong>${compactBytes(previewSize)}</strong>
          <p>${selectedItems.length ? `${selectedItems.length} item(ns) na simulacao atual.` : `${safePlan.length} item(ns) no plano seguro visivel.`}</p>
        </div>
      </div>
      <div class="simulation-actions">
        <button class="secondary" data-action="select-safe-plan" ${safePlan.length ? "" : "disabled"}>${icon("clipboard")}Selecionar plano seguro</button>
        <button class="secondary" data-action="clear-candidate-selection" ${state.selectedIds.size ? "" : "disabled"}>${icon("ban")}Limpar selecao</button>
      </div>
      <div class="simulation-preview">
        ${previewItems.slice(0, 4).map((item) => `
          <span>${escapeHtml(item.name)} <strong>${compactBytes(item.size)}</strong></span>
        `).join("") || "<span>Nada selecionado para simular.</span>"}
      </div>
    </section>
  `;
}

function candidatesTab() {
  const items = filteredCandidates();
  const selected = items.find((item) => item.id === state.selectedItem?.id) || items[0];
  if (state.selectedItem?.id !== selected?.id) state.selectedItem = selected || null;
  const totalCandidates = state.scanResult?.candidates?.length || 0;
  const summary = candidateSafetySummary();
  const selectedItems = selectedCandidateItems();
  const selectedSize = selectedItems.reduce((sum, item) => sum + item.size, 0);
  const visibleItems = items.slice(0, state.candidateLimit);
  const selectableVisibleItems = visibleItems.filter(canMoveToQuarantine);
  return `
    <section class="candidates-view">
      <div class="page-heading">
        <h1>Candidatos à Limpeza</h1>
        <p>${items.length} itens visíveis de ${totalCandidates}. O filtro padrão mostra achados revisáveis e evita itens que exigem cautela maior.</p>
      </div>
      ${historicalReportNote()}
      ${safetyNote("Revisão protegida", "Candidatos são sugestões de revisão, não comandos de limpeza. Itens protegidos, sensíveis ou ligados a apps instalados ficam bloqueados para quarentena normal.")}
      <div class="leftover-summary candidate-summary">
        <span><strong>${summary.safe}</strong> seguros</span>
        <span><strong>${summary.likely}</strong> prováveis removíveis</span>
        <span><strong>${summary.review}</strong> verificar antes</span>
        <span><strong>${summary.blocked}</strong> bloqueados</span>
      </div>
      <h2>Simulacao de limpeza</h2>
      ${selectionSimulationPanel(selectedItems, visibleItems)}
      <div class="filters-row candidates-filters">
        <label class="search-box">${icon("search")}<input data-field="candidateSearch" value="${escapeHtml(state.candidateSearch)}" placeholder="Buscar item ou caminho..."></label>
        ${selectControl("candidateScope", ["Todos", "Dev", "Instalador", "Cache", "Logs", "Arquivo grande", "Download", "Compactado", "Temporario"], state.candidateScope)}
        ${selectControl("candidateSafety", ["Revisáveis", "Seguro revisar", "Provável removível", "Verificar antes", "Todos"], state.candidateSafety)}
        ${selectControl("candidateConfidence", ["Todas", "Alta", "Média", "Baixa"], state.candidateConfidence)}
        ${selectControl("candidateMinSize", [["Relevantes: 10 MB+", 10 * MB], ["Qualquer tamanho", 0], ["100 MB+", 100 * MB], ["1 GB+", GB]], state.candidateMinSize)}
        ${selectControl("candidateAge", ["Prioridade", "Maiores", "Mais antigos"], state.candidateAge)}
      </div>
      <div class="selection-summary">
        <span>Mostrando ${visibleItems.length} de ${items.length}</span>
        <span>${selectedItems.length} selecionado(s)</span>
        <strong>${compactBytes(selectedSize)}</strong>
      </div>
      <section class="master-detail-layout">
        <div class="master-detail-list">
          <section class="panel table-panel candidates-panel">
            <table class="candidates-table">
              <thead><tr><th class="check-col"><input type="checkbox" data-action="toggle-all-candidates" ${selectableVisibleItems.length && selectableVisibleItems.every((item) => state.selectedIds.has(item.id)) ? "checked" : ""} ${selectableVisibleItems.length ? "" : "disabled"}></th><th>Item</th><th>Tipo</th><th>Tamanho</th><th>Status</th></tr></thead>
              <tbody>
                ${visibleItems.map((item) => {
                  const canSelect = canMoveToQuarantine(item);
                  return `
                  <tr class="${state.selectedItem?.id === item.id ? "selected" : ""}" data-action="select-candidate" data-id="${escapeHtml(item.id)}">
                    <td><input type="checkbox" data-action="toggle-select" data-id="${escapeHtml(item.id)}" ${state.selectedIds.has(item.id) && canSelect ? "checked" : ""} ${canSelect ? "" : "disabled"}></td>
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
                    <td>${candidatePrimaryStatus(item)}</td>
                  </tr>
                `; }).join("") || `<tr><td colspan="5" class="empty-state-cell">${emptyPanel("search", "Nenhum candidato com os filtros atuais.")}</td></tr>`}
              </tbody>
            </table>
          </section>
          ${items.length > visibleItems.length ? `<button class="secondary load-more" data-action="show-more-candidates">${icon("list")}Mostrar mais ${Math.min(80, items.length - visibleItems.length)}</button>` : ""}
        </div>
        ${detailOverlay("Por que apareceu aqui?", candidateDetails(state.selectedItem), Boolean(state.selectedItem))}
      </section>
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
  const canQuarantine = canMoveToQuarantine(item);
  const guidance = candidateReviewGuidance(item);
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
          <span>Confiança ${confidenceBadgeFor(item)}</span>
        </div>
      </div>
      ${reviewCallout("Motivo do achado", item.reason || "Este item parece ocupar espaço relevante e merece revisão.", "shield")}
      ${reviewCallout("O que conferir", guidance.text, guidance.icon, guidance.tone)}
      ${childrenSummary(item)}
      <div class="detail-actions">
        <button class="secondary" data-action="open-selected">${icon("folder")}Abrir</button>
        <button class="secondary" data-action="show-selected">${icon("list")}Ver conteúdo</button>
        <button class="secondary" data-action="ignore-selected">${icon("ban")}Ignorar</button>
        ${signatureControls(item)}
        ${copyDoubtButton(item, "candidate")}
        <button class="secondary" data-action="quarantine-selected-item" ${canQuarantine ? "" : "disabled"}>${icon("shield")}Mover para quarentena</button>
      </div>
      ${canQuarantine && crossVolumeQuarantineNote(item) ? reviewCallout("Atenção antes de mover", crossVolumeQuarantineNote(item), "shield", "warning") : ""}
      ${canQuarantine ? "" : reviewCallout("Atenção antes de mover", blockedQuarantineReason(item), "shield", "warning")}
    </section>
  `;
}

function candidateReviewGuidance(item) {
  const type = cleanCandidateType(item?.type);
  if (type === "Dev") {
    return {
      text: "Confirme se o projeto ainda está em uso. Dependências e builds geralmente podem ser recriados, mas código-fonte e arquivos locais não devem ser movidos.",
      icon: "folder",
      tone: "info"
    };
  }
  if (type === "Cache" || type === "Logs" || type === "Temporario") {
    return {
      text: "Caches, logs e temporários costumam ser recriados pelos apps. Mesmo assim, abra o conteúdo se o caminho pertencer a um app importante.",
      icon: "database",
      tone: "info"
    };
  }
  if (type === "Download" || type === "Instalador" || type === "Compactado") {
    return {
      text: "Confira se existe uma cópia mais nova ou se o arquivo já cumpriu sua função. Itens antigos em Downloads são bons candidatos para quarentena.",
      icon: "download",
      tone: "info"
    };
  }
  if (type === "Arquivo grande") {
    return {
      text: "Arquivos grandes podem ser pessoais ou difíceis de recuperar. Abra o local e confirme o conteúdo antes de mover.",
      icon: "shield",
      tone: "warning"
    };
  }
  return {
    text: "Use o conteúdo e o caminho como pistas. Se o item parecer ligado a algo ativo, mantenha fora da quarentena.",
    icon: "list",
    tone: "warning"
  };
}

function isProtectedUiPath(itemPath) {
  return protectedPathInfo(itemPath).protected;
}

function themeCardPicker(currentTheme) {
  const themes = ["light", "dark", "hacker", "neon", "system"];
  return `
    <div class="theme-picker">
      ${themes.map((value) => `
        <button
          class="theme-card ${value === currentTheme ? "is-active" : ""}"
          data-action="select-theme"
          data-value="${value}"
          type="button"
        >
          <span class="theme-swatches" data-theme-preview="${value}">
            <span class="swatch swatch-bg"></span>
            <span class="swatch swatch-surface"></span>
            <span class="swatch swatch-accent"></span>
          </span>
          <span class="theme-card-label">${escapeHtml(themeDisplayLabel(value))}</span>
          ${value === currentTheme ? icon("check") : ""}
        </button>
      `).join("")}
    </div>
  `;
}

function detailOverlay(title, content, hasSelection) {
  if (!state.detailOverlayOpen || !hasSelection) return "";
  const closeLabel = t("details.close");
  return `
    <div class="detail-overlay" data-detail-overlay="true">
      <button class="detail-overlay-backdrop" type="button" data-action="close-detail" aria-label="${escapeHtml(closeLabel)}" tabindex="-1"></button>
      <aside class="detail-overlay-panel" role="dialog" aria-modal="true" aria-labelledby="detail-overlay-title" tabindex="-1">
        <header class="detail-overlay-header">
          <h2 id="detail-overlay-title">${escapeHtml(title)}</h2>
          <button class="detail-overlay-close" type="button" data-action="close-detail" aria-label="${escapeHtml(closeLabel)}" title="${escapeHtml(closeLabel)}">&times;</button>
        </header>
        <div class="detail-overlay-body">${content}</div>
      </aside>
    </div>
  `;
}

function protectedPathInfo(itemPath) {
  if (api?.getPathProtection) return api.getPathProtection(itemPath);
  const protectedPath = Boolean(api?.isProtectedPath?.(itemPath));
  return {
    protected: protectedPath,
    label: protectedPath ? "Componente protegido" : "",
    reason: protectedPath ? "Área protegida pelo DiskSnoop." : ""
  };
}

function canMoveToQuarantine(item) {
  if (!item?.path) return false;
  if (isViewingHistoricalReport()) return false;
  if (item.security === "Sensivel" || item.security === "Sensível") return false;
  if (isProtectedUiPath(item.path)) return false;
  const lower = item.path.toLowerCase();
  const looksLikeAppLeftover = lower.includes("\\appdata\\")
    || lower.includes("\\programdata\\")
    || lower.includes("\\program files\\");
  if (looksLikeAppLeftover && item.type === "Pasta") {
    const [status] = leftoverStatus(item);
    if (status !== "Possível sobra") return false;
  }
  return true;
}

function blockedQuarantineReason(item) {
  if (isViewingHistoricalReport()) {
    return "Este item vem de um relatório histórico. Faça um novo scan antes de mover para quarentena, para garantir que o caminho e o tamanho ainda estão atuais.";
  }
  if (item?.security === "Sensivel" || item?.security === "Sensível" || isProtectedUiPath(item?.path)) {
    return "Este item fica em área sensível ou protegida do Windows. O DiskSnoop mostra o espaço, mas não coloca isso como ação normal de quarentena.";
  }
  return "Este item precisa de revisão manual antes de qualquer ação. Abra a pasta e confirme se ela não pertence a um app instalado.";
}

function duplicateGroups() {
  const query = state.duplicateSearch.toLowerCase().trim();
  return [...(state.scanResult?.duplicateGroups || [])]
    .map((group) => {
      const items = (group.items || []).filter((item) => !isHiddenPath(item));
      return {
        ...group,
        items,
        copies: items.length,
        reviewableBytes: (group.size || 0) * Math.max(0, items.length - 1)
      };
    })
    .filter((group) => (group.items || []).length > 1)
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
  if (!selected && state.selectedDuplicateId) state.selectedDuplicateId = "";
  const reviewable = groups.reduce((sum, group) => sum + (group.reviewableBytes || 0), 0);
  const totalCopies = groups.reduce((sum, group) => sum + (group.items?.length || 0), 0);
  const hashSkipped = Number(state.scanResult?.duplicateHashSkipped || 0);
  const hashEnabled = state.settings?.verifyDuplicateHashes !== false;
  return `
    <section>
      <div class="page-heading">
        <h1>Possíveis Duplicados</h1>
        <p>${groups.length} grupos visíveis. Espaço revisável estimado: ${compactBytes(reviewable)}.</p>
      </div>
      ${safetyNote("Duplicados com cautela", hashEnabled
        ? "Duplicados são pré-filtrados por nome e tamanho e confirmados por hash SHA-256 quando o arquivo pode ser lido. Nada é removido automaticamente."
        : "Hash de duplicados está desativado nas configurações. Os grupos abaixo são apenas suspeitas por nome e tamanho.",
      "shield",
      hashEnabled ? "info" : "warning")}
      <div class="leftover-summary duplicate-summary">
        <span><strong>${groups.length}</strong> grupos</span>
        <span><strong>${totalCopies}</strong> cópias</span>
        <span><strong>${compactBytes(reviewable)}</strong> estimado</span>
        ${hashEnabled
          ? `<span><strong>${hashSkipped.toLocaleString("pt-BR")}</strong> sem hash</span>`
          : "<span><strong>Hash</strong> desativado</span>"}
      </div>
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
      <section class="master-detail-layout">
        <div class="master-detail-list">
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
                    <td>${badge(group.confidence || "Possível", duplicateConfidenceKind(group.confidence))}</td>
                  </tr>
                `).join("") || `<tr><td colspan="5" class="empty-state-cell">${emptyPanel("search", "Nenhum possível duplicado neste scan.")}</td></tr>`}
              </tbody>
            </table>
          </section>
        </div>
        ${detailOverlay("Revisão do grupo", duplicateDetails(selected), Boolean(selected))}
      </section>
    </section>
  `;
}

function duplicateDetails(group) {
  if (!group) {
    return `<section class="panel explanation"><p class="muted">Nenhum grupo selecionado.</p></section>`;
  }
  const items = group.items || [];
  const summary = duplicateReviewSummary(group);
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
          <span>Verificação <strong>${escapeHtml(group.algorithm || "Nome e tamanho")}</strong></span>
          <span>Confiança ${confidenceBadgeFor(group, "duplicate")}</span>
        </div>
      </div>
      ${reviewCallout(summary.title, summary.text, summary.icon, summary.tone)}
      ${group.contentHash ? `<p class="hash-line">Hash SHA-256: <code>${escapeHtml(group.contentHash)}</code></p>` : ""}
      <div class="duplicate-copy-list">
        ${items.map((item, index) => `
          <div class="duplicate-copy-row ${index === 0 ? "reference" : "suspect"}">
            <span>${icon("file")}<strong>${index === 0 ? "Referência mais recente" : `Cópia suspeita ${index}`}</strong></span>
            <code title="${escapeHtml(item.path)}">${escapeHtml(item.path)}</code>
            <small>${relativeDate(item.modifiedAt)}</small>
            <button class="table-action" data-action="open-path" data-path="${escapeHtml(item.path)}">Abrir</button>
          </div>
        `).join("")}
      </div>
      ${reviewCallout("Como revisar", "A primeira linha é só a cópia mais recente por data de modificação. Mesmo com hash confirmado, abra os caminhos quando houver dúvida antes de mover qualquer cópia.", "shield")}
      <div class="detail-actions">
        ${copyDoubtButton(group, "duplicate")}
      </div>
    </section>
  `;
}

function duplicateReviewSummary(group) {
  if (group?.contentHash || group?.confidence === "Hash confirmado") {
    return {
      title: "Hash confirmado",
      text: "As cópias lidas têm o mesmo conteúdo SHA-256. Ainda assim, escolha manualmente qual caminho manter antes de agir fora desta tela.",
      icon: "shield",
      tone: "info"
    };
  }
  return {
    title: "Possível duplicado",
    text: "Este grupo foi montado por nome e tamanho. Abra os caminhos antes de decidir, porque arquivos diferentes podem parecer iguais por fora.",
    icon: "copy",
    tone: "warning"
  };
}

function totalQuarantined() {
  return (state.quarantine || []).filter((item) => item.status === "Em quarentena").reduce((sum, item) => sum + item.size, 0);
}

function isQuarantineFinalized(item) {
  return ["Excluido permanentemente", "Excluído permanentemente", "Restaurado"].includes(item?.status);
}

function isQuarantineProblem(item) {
  return item?.status === "Arquivo ausente";
}

function selectedQuarantine() {
  const items = filteredQuarantine();
  return items.find((item) => item.id === state.selectedQuarantineId) || items[0] || null;
}

function quarantineStatusBadge(status = "Em quarentena") {
  if (status === "Em quarentena") return badge(status, "low");
  if (status === "Arquivo ausente") return badge(status, "high");
  return badge(status, "medium");
}

function quarantineItemIcon(item) {
  const type = String(item?.type || "").toLowerCase();
  if (type.includes("arquivo") || type.includes("instalador") || type.includes("download")) return "file";
  return "folder";
}

function filteredQuarantine() {
  const items = state.quarantine || [];
  if (state.quarantineFilter === "Ativos") return items.filter((item) => item.status === "Em quarentena");
  if (state.quarantineFilter === "Ausentes" || state.quarantineFilter === "Problemas") return items.filter(isQuarantineProblem);
  if (state.quarantineFilter === "Finalizados") return items.filter(isQuarantineFinalized);
  return items;
}

function quarantineSummary() {
  const items = state.quarantine || [];
  const finalized = items.filter(isQuarantineFinalized).length;
  const missing = items.filter(isQuarantineProblem).length;
  return {
    active: items.filter((item) => item.status === "Em quarentena").length,
    missing,
    finalized,
    archived: missing + finalized
  };
}

function possibleLeftovers() {
  return visibleLargeFolders()
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
    .sort((a, b) => {
      const statusOrder = {
        "Possível sobra": 0,
        "App não encontrado?": 1,
        "Verificar manualmente": 2,
        "App instalado": 3,
        "Nome parecido": 4,
        "Componente do sistema": 5,
        "Verificação indisponível": 6
      };
      const statusA = statusOrder[leftoverStatus(a)[0]] ?? 9;
      const statusB = statusOrder[leftoverStatus(b)[0]] ?? 9;
      if (statusA !== statusB) return statusA - statusB;
      return b.size - a.size;
    });
}

function leftoverStatus(item) {
  if (isProtectedUiPath(item?.path)) return ["Componente do sistema", "high"];
  const match = matchingInstalledApp(item);
  if (match) return ["App instalado", "low"];
  const lower = item.path.toLowerCase();
  if (lower.includes("\\appdata\\") && !state.appInventory.appxReliable) return ["Verificação indisponível", "high"];
  if (lower.includes("\\program files\\")) return ["Verificar manualmente", "medium"];
  if (isGenericAppDataFolder(item.name)) return ["Verificar manualmente", "medium"];
  if (lower.includes("\\appdata\\")) return ["Possível sobra", "medium"];
  if (lower.includes("\\programdata\\")) return ["App não encontrado?", "medium"];
  return ["Nome parecido", "low"];
}

function matchingInstalledApp(item) {
  const itemName = String(item?.name || "").toLowerCase();
  const packagedMatch = state.installedApps.find((appInfo) => {
    const familyName = String(appInfo.packageFamilyName || "").toLowerCase();
    const fullName = String(appInfo.packageFullName || "").toLowerCase();
    return (familyName && itemName === familyName) || (fullName && itemName === fullName);
  });
  if (packagedMatch) return packagedMatch;
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
  const protectedCount = allItems.filter((item) => leftoverStatus(item)[0] === "Componente do sistema").length;
  const unavailable = allItems.filter((item) => leftoverStatus(item)[0] === "Verificação indisponível").length;
  const manual = allItems.length - possible - installed - protectedCount - unavailable;
  return `
    <section>
      <div class="page-heading">
        <h1>Sobras de Apps</h1>
        <p>Possíveis pastas órfãs encontradas em AppData, ProgramData e Program Files. Esta tela é conservadora.</p>
      </div>
      ${historicalReportNote()}
      ${safetyNote("Achados conservadores", "Esses achados são pistas, não confirmação de sobra. Só itens marcados como possível sobra ficam disponíveis para quarentena normal; o restante deve ser aberto e revisado manualmente.")}
      ${state.appInventory.appxReliable ? "" : safetyNote("Descoberta AppX indisponível", "O DiskSnoop não conseguiu confirmar os pacotes da Microsoft Store. Por segurança, dados em AppData ficam bloqueados até uma nova inicialização com a consulta disponível.", "shield", "warning")}
      <div class="leftover-summary">
        <span><strong>${allItems.length}</strong> analisadas</span>
        <span><strong>${possible}</strong> possíveis sobras</span>
        <span><strong>${installed}</strong> ligadas a apps instalados</span>
        <span><strong>${protectedCount}</strong> componentes protegidos</span>
        <span><strong>${unavailable}</strong> verificação indisponível</span>
        <span><strong>${manual}</strong> verificar</span>
      </div>
      <div class="filters-row leftovers-filters">
        <label class="search-box">${icon("search")}<input data-field="leftoversSearch" value="${escapeHtml(state.leftoversSearch)}" placeholder="Buscar app ou caminho..."></label>
        ${selectControl("leftoversStatus", ["Todos", "Possível sobra", "App não encontrado?", "Verificar manualmente", "App instalado", "Componente do sistema", "Verificação indisponível"], state.leftoversStatus)}
        ${selectControl("leftoversLocation", ["Todos", "AppData Local", "AppData Roaming", "ProgramData", "Program Files", "Program Files (x86)"], state.leftoversLocation)}
      </div>
      <section class="master-detail-layout">
        <div class="master-detail-list">
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
                }).join("") || `<tr><td colspan="4" class="empty-state-cell">${emptyPanel("folder", "Nenhuma possível sobra de app encontrada neste scan.")}</td></tr>`}
              </tbody>
            </table>
          </section>
          ${items.length > visibleItems.length ? `<button class="secondary load-more" data-action="show-more-leftovers">${icon("list")}Mostrar mais ${Math.min(80, items.length - visibleItems.length)}</button>` : ""}
        </div>
        ${detailOverlay("Revisão segura", leftoverDetails(state.selectedItem), Boolean(state.selectedItem))}
      </section>
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
  const canQuarantine = canMoveToQuarantine(item);
  const summary = leftoverReviewSummary(status, match);
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
          <span>Confiança ${confidenceBadgeFor(item, "leftover")}</span>
        </div>
      </div>
      ${reviewCallout(summary.title, summary.text, summary.icon, summary.tone)}
      ${reviewCallout(summary.reviewTitle, summary.reviewText, "list", summary.reviewTone)}
      ${childrenSummary(item)}
      <div class="detail-actions">
        <button class="secondary" data-action="open-selected">${icon("folder")}Abrir pasta</button>
        <button class="secondary" data-action="show-selected">${icon("list")}Ver conteúdo</button>
        <button class="secondary" data-action="ignore-selected">${icon("ban")}Ignorar</button>
        ${copyDoubtButton(item, "leftover")}
        <button class="secondary" data-action="quarantine-leftover" ${canQuarantine ? "" : "disabled"}>${icon("shield")}Mover para quarentena</button>
      </div>
      ${canQuarantine && crossVolumeQuarantineNote(item) ? reviewCallout("Atenção antes de mover", crossVolumeQuarantineNote(item), "shield", "warning") : ""}
      ${canQuarantine ? "" : reviewCallout("Atenção antes de mover", blockedQuarantineReason(item), "shield", "warning")}
    </section>
  `;
}

function leftoverReviewSummary(status, match) {
  if (status === "Verificação indisponível") {
    return {
      title: "Verificação de apps indisponível",
      text: "A consulta de pacotes instalados falhou ou não respondeu. O DiskSnoop bloqueou este item por padrão em vez de assumir que ele é uma sobra.",
      icon: "shield",
      tone: "warning",
      reviewTitle: "Proteção fail-safe",
      reviewText: "Reinicie o aplicativo para tentar a consulta novamente. Enquanto ela não for confirmada, este item não pode ser movido ou excluído pelo DiskSnoop.",
      reviewTone: "warning"
    };
  }
  if (status === "Componente do sistema") {
    return {
      title: "Componente protegido do sistema",
      text: "Este caminho guarda dados ativos do Windows, da Microsoft Store ou de outro aplicativo integrado. O DiskSnoop permite apenas abrir e inspecionar o local.",
      icon: "shield",
      tone: "warning",
      reviewTitle: "Ação bloqueada",
      reviewText: "Este item nunca entra em quarentena ou exclusão em lote. Não apague seu conteúdo manualmente, pois isso pode impedir que aplicativos do Windows funcionem.",
      reviewTone: "warning"
    };
  }
  if (match) {
    return {
      title: "App instalado encontrado",
      text: `O nome lembra ${match.name}. Isso geralmente indica que a pasta ainda pertence a um app instalado ou usado recentemente.`,
      icon: "shield",
      tone: "warning",
      reviewTitle: "Como revisar",
      reviewText: "Abra a pasta e confira se os arquivos ainda parecem ligados ao app. Se estiver em dúvida, mantenha o item fora da quarentena.",
      reviewTone: "warning"
    };
  }
  if (status === "Possível sobra") {
    return {
      title: "Possível sobra de app",
      text: "Encontramos esta pasta em uma área comum de dados de aplicativos, mas ela não apareceu como app instalado. Pode ser cache antigo, configuração esquecida ou dado ainda útil.",
      icon: "folder",
      tone: "info",
      reviewTitle: "Antes de mover",
      reviewText: "Abra a pasta, confira os maiores itens e veja se o app ainda existe. Se nada parecer importante, use a quarentena para testar com segurança.",
      reviewTone: "info"
    };
  }
  return {
    title: "Revisão manual necessária",
    text: "Esta pasta fica em uma área onde apps costumam guardar dados compartilhados ou sensíveis. O DiskSnoop mostra o espaço, mas deixa a decisão para revisão manual.",
    icon: "shield",
    tone: "warning",
    reviewTitle: "Como revisar",
    reviewText: "Abra o local e revise manualmente. Este status não entra no fluxo normal de quarentena para evitar mexer em dados de apps ativos.",
    reviewTone: "warning"
  };
}

function quarantineTab() {
  const summary = quarantineSummary();
  const visibleItems = filteredQuarantine();
  const selected = selectedQuarantine();
  if (selected && state.selectedQuarantineId !== selected.id) state.selectedQuarantineId = selected.id;
  const canRestoreSelected = selected?.status === "Em quarentena" && Boolean(selected.originalPath);
  const protectedOriginal = Boolean(selected?.originalPath && isProtectedUiPath(selected.originalPath));
  const canDeleteSelected = selected?.status === "Em quarentena" && !protectedOriginal;
  const emptyMessage = state.quarantineFilter === "Ativos"
    ? "Nenhum item ativo na quarentena. Registros antigos ficam em Ausentes ou Finalizados."
    : "Nenhum item neste filtro.";
  return `
    <section class="quarantine-view">
      <div class="page-heading">
        <h1>Quarentena</h1>
        <p>${summary.active} itens ativos. A lista principal mostra apenas o que ainda pode ser restaurado ou excluído.</p>
      </div>
      ${safetyNote("Quarentena organizada", "Registros finalizados e arquivos ausentes ficam separados para não bagunçar sua revisão. Limpar registros encerrados remove apenas o histórico local da quarentena.")}
      <div class="quarantine-toolbar">
        <div class="quarantine-tabs">
          ${["Ativos", "Ausentes", "Finalizados", "Todos"].map((filter) => `
            <button class="${state.quarantineFilter === filter ? "active" : ""}" data-action="quarantine-filter" data-filter="${filter}">
              ${escapeHtml(filter)}
            </button>
          `).join("")}
        </div>
        <button class="secondary" data-action="cleanup-quarantine-records" ${summary.archived ? "" : "disabled"}>${icon("trash")}Limpar registros encerrados</button>
      </div>
      <div class="quarantine-summary">
        <span><strong>${summary.active}</strong> ativos</span>
        <span><strong>${summary.missing}</strong> ausentes</span>
        <span><strong>${summary.finalized}</strong> finalizados</span>
        <span><strong>${compactBytes(totalQuarantined())}</strong> protegidos</span>
      </div>
      <section class="panel table-panel quarantine-panel">
        <table class="quarantine-table">
          <thead><tr><th class="check-col"></th><th>Item</th><th>Origem</th><th>Tamanho</th><th>Data</th><th>Status</th></tr></thead>
          <tbody>
            ${visibleItems.map((item) => `
              <tr class="${selected?.id === item.id ? "selected" : ""}" data-action="select-quarantine" data-id="${escapeHtml(item.id)}">
                <td><span class="row-selector ${selected?.id === item.id ? "active" : ""}"></span></td>
                <td class="name-cell"><span class="folder-icon">${icon(quarantineItemIcon(item))}</span><span>${escapeHtml(item.name)}</span></td>
                <td>${escapeHtml(shortOrigin(item.originalPath))}</td>
                <td>${compactBytes(item.size)}</td>
                <td>${relativeDate(item.movedAt)}</td>
                <td>${quarantineStatusBadge(item.status)}</td>
              </tr>
            `).join("") || `<tr><td colspan="6" class="empty-state-cell">${emptyPanel("folder", emptyMessage)}</td></tr>`}
          </tbody>
        </table>
      </section>
      <h2>Ações</h2>
      <section class="panel action-panel">
        ${selected ? `
          <p>Item selecionado: <strong>${escapeHtml(selected.name)}</strong></p>
          <p>Origem: ${escapeHtml(selected.originalPath || "Origem não registrada")}</p>
          <p>Quarentena: ${escapeHtml(selected.quarantinePath || "-")}</p>
          <p>Status: ${escapeHtml(selected.status || "Em quarentena")}</p>
          ${protectedOriginal ? reviewCallout("Origem protegida", "Este item veio de dados ativos do Windows ou de um aplicativo instalado. A exclusão permanente foi bloqueada; restaure o item ou abra a quarentena para revisão manual.", "shield", "warning") : ""}
          ${selected.recovered ? reviewCallout("Origem não registrada", "Este item foi encontrado na pasta de quarentena, mas o registro original não estava no histórico do DiskSnoop. Você pode abrir ou excluir permanentemente, mas a restauração automática fica indisponível sem o caminho original.", "shield", "warning") : ""}
          <div class="detail-actions">
            <button class="secondary" data-action="open-quarantine-item" data-path="${escapeHtml(selected.quarantinePath || "")}" ${selected.status !== "Em quarentena" ? "disabled" : ""}>${icon("folder")}Abrir na quarentena</button>
            <button class="outline-primary" data-action="restore-quarantine" data-id="${escapeHtml(selected.id)}" ${canRestoreSelected ? "" : "disabled"}>${icon("reset")}Restaurar</button>
            <button class="outline-danger" data-action="delete-quarantine" data-id="${escapeHtml(selected.id)}" ${canDeleteSelected ? "" : "disabled"}>${icon("trash")}Excluir permanentemente</button>
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

function smoothHistoryPath(points, valueKey) {
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0].x},${points[0][valueKey]}`;
  let pathData = `M${points[0].x},${points[0][valueKey]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] || points[index];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] || next;
    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current[valueKey] + (next[valueKey] - previous[valueKey]) / 6;
    const control2X = next.x - (afterNext.x - current.x) / 6;
    const control2Y = next[valueKey] - (afterNext[valueKey] - current[valueKey]) / 6;
    pathData += ` C${control1X.toFixed(2)},${control1Y.toFixed(2)} ${control2X.toFixed(2)},${control2Y.toFixed(2)} ${next.x},${next[valueKey]}`;
  }
  return pathData;
}

function historyTimeline(scans) {
  if (!scans.length) return "";
  const ordered = [...scans].slice(0, 20).reverse();
  const safeBytes = (value) => {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  };
  const width = 960;
  const height = 260;
  const chartLeft = 72;
  const chartRight = width - 28;
  const chartTop = 24;
  const chartBottom = 210;
  const values = ordered.flatMap((item) => [
    safeBytes(item.reviewable),
    safeBytes(item.permanentlyDeleted)
  ]);
  const maxValue = Math.max(1, ...values);
  const step = ordered.length > 1 ? (chartRight - chartLeft) / (ordered.length - 1) : 0;
  const yFor = (value) => chartBottom - (Number(value || 0) / maxValue) * (chartBottom - chartTop);
  const points = ordered.map((item, index) => {
    const reviewable = safeBytes(item.reviewable);
    const freed = safeBytes(item.permanentlyDeleted);
    return {
      x: ordered.length === 1 ? (chartLeft + chartRight) / 2 : chartLeft + step * index,
      reviewableY: yFor(reviewable),
      freedY: yFor(freed),
      reviewable,
      freed,
      item
    };
  });
  const reviewablePath = smoothHistoryPath(points, "reviewableY");
  const freedPath = smoothHistoryPath(points, "freedY");
  const areaPath = points.length > 1
    ? `${reviewablePath} L${points.at(-1).x},${chartBottom} L${points[0].x},${chartBottom} Z`
    : "";
  const gridSteps = [0, 1 / 3, 2 / 3, 1];
  const labelInterval = Math.max(1, Math.ceil(ordered.length / 6));
  const latest = ordered.at(-1);
  return `
    <section class="history-timeline">
      <div class="history-chart-header">
        <div>
          <span>${escapeHtml(t("history.chartTitle"))}</span>
          <strong>${compactBytes(latest?.reviewable || 0)}</strong>
          <small>${escapeHtml(t("history.latestReviewable"))}</small>
        </div>
        <div class="history-chart-legend" aria-hidden="true">
          <span><i class="reviewable"></i>${escapeHtml(t("history.reviewable"))}</span>
          <span><i class="freed"></i>${escapeHtml(t("history.freed"))}</span>
        </div>
      </div>
      <p class="history-chart-subtitle">${escapeHtml(t("history.chartSubtitle"))}</p>
      <div class="history-chart-scroll">
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(t("history.timelineAria"))}">
          <defs>
            <linearGradient id="history-reviewable-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.2" />
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
            </linearGradient>
          </defs>
          ${gridSteps.map((ratio) => {
            const y = chartBottom - ratio * (chartBottom - chartTop);
            return `
              <line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" class="history-chart-grid" />
              <text x="${chartLeft - 12}" y="${y + 4}" class="history-chart-axis" text-anchor="end">${escapeHtml(compactBytes(maxValue * ratio))}</text>
            `;
          }).join("")}
          ${areaPath ? `<path d="${areaPath}" class="history-chart-area" />` : ""}
          <path d="${reviewablePath}" class="history-chart-line reviewable" />
          <path d="${freedPath}" class="history-chart-line freed" />
        ${points.map((point) => {
          const available = point.item.snapshotAvailable !== false;
          const tooltip = `${fullDate(point.item.date)} — ${t("history.reviewable")}: ${compactBytes(point.reviewable)} — ${t("history.freed")}: ${compactBytes(point.freed)}`;
          const index = points.indexOf(point);
          const showLabel = index === 0 || index === points.length - 1 || index % labelInterval === 0;
          const hitboxLeft = index === 0 ? chartLeft - Math.max(18, step / 2) : point.x - Math.max(18, step / 2);
          const hitboxWidth = Math.max(36, step || 72);
          const pointDate = new Date(point.item.date);
          const dateLabel = Number.isNaN(pointDate.getTime())
            ? "-"
            : new Intl.DateTimeFormat(currentLanguage(), { day: "2-digit", month: "2-digit" }).format(pointDate);
          return `
            <g class="history-timeline-point ${available ? "" : "unavailable"}"
               ${available ? `data-action="load-history-scan" data-id="${escapeHtml(point.item.id)}"` : "aria-disabled=\"true\""}>
              <title>${escapeHtml(tooltip)}</title>
              <rect x="${hitboxLeft}" y="${chartTop}" width="${hitboxWidth}" height="${chartBottom - chartTop}" class="history-chart-hitbox" />
              <circle cx="${point.x}" cy="${point.reviewableY}" r="4" class="history-chart-dot reviewable" />
              <circle cx="${point.x}" cy="${point.freedY}" r="4" class="history-chart-dot freed" />
              ${showLabel ? `<text x="${point.x}" y="${height - 16}" class="history-chart-date" text-anchor="middle">${escapeHtml(dateLabel)}</text>` : ""}
            </g>
          `;
        }).join("")}
        </svg>
      </div>
    </section>
  `;
}

function historyTab() {
  const scans = state.history || [];
  const totalMoved = scans.reduce((sum, item) => sum + (item.movedToQuarantine || 0), 0);
  const totalRestored = scans.reduce((sum, item) => sum + (item.restoredFromQuarantine || 0), 0);
  const totalDeleted = scans.reduce((sum, item) => sum + (item.permanentlyDeleted || 0), 0);
  const unavailable = scans.filter((item) => item.snapshotAvailable === false).length;
  const last = scans[0];
  const hasFreeDelta = Number.isFinite(Number(last?.freeAfter)) && Number.isFinite(Number(last?.freeBefore));
  const freeDelta = hasFreeDelta ? Number(last.freeAfter) - Number(last.freeBefore) : 0;
  const freeDeltaLabel = hasFreeDelta ? `${freeDelta >= 0 ? "+" : ""}${compactBytes(freeDelta)}` : "-";
  return `
    <section>
      <div class="page-heading">
        <h1>Histórico</h1>
        <p>Scans anteriores e ações registradas pelo DiskSnoop.</p>
      </div>
      <section class="history-summary-cards">
        <article class="history-summary-card"><span>Scans</span><strong>${scans.length}</strong></article>
        <article class="history-summary-card"><span>Movido para quarentena</span><strong>${compactBytes(totalMoved)}</strong></article>
        <article class="history-summary-card"><span>Restaurado</span><strong>${compactBytes(totalRestored)}</strong></article>
        <article class="history-summary-card"><span>Excluído permanente</span><strong>${compactBytes(totalDeleted)}</strong></article>
        <article class="history-summary-card"><span>Relatórios indisponíveis</span><strong>${unavailable}</strong></article>
      </section>
      ${historyTimeline(scans)}
      <section class="history-list">
        ${scans.map((item) => `
          <article class="history-scan-card">
            <div class="history-scan-main">
              <span class="history-scan-icon">${icon(item.snapshotAvailable === false ? "ban" : "clock")}</span>
              <div>
                <h3>${fullDate(item.date)}</h3>
                <p>Disco ${escapeHtml(item.drive || "-")} · ${durationLabel(item.durationMs)} · livre ${Number.isFinite(Number(item.freeBefore)) ? compactBytes(Number(item.freeBefore)) : "-"} → ${Number.isFinite(Number(item.freeAfter)) ? compactBytes(Number(item.freeAfter)) : "-"}</p>
              </div>
            </div>
            <div class="history-scan-metrics">
              <span><strong>${Number(item.candidates || 0).toLocaleString("pt-BR")}</strong> candidatos</span>
              <span><strong>${Number(item.duplicates || 0).toLocaleString("pt-BR")}</strong> duplicados</span>
              <span><strong>${Number(item.skipped || 0).toLocaleString("pt-BR")}</strong> sem acesso</span>
              <span><strong>${compactBytes(item.reviewable || 0)}</strong> revisável</span>
              <span><strong>${compactBytes(item.movedToQuarantine || 0)}</strong> quarentena</span>
              <span><strong>${compactBytes(item.restoredFromQuarantine || 0)}</strong> restaurado</span>
              <span><strong>${compactBytes(item.permanentlyDeleted || 0)}</strong> excluído</span>
            </div>
            <div class="history-scan-actions">
              <span class="${item.snapshotAvailable === false ? "history-status missing" : "history-status"}">
                ${item.snapshotAvailable === false ? "Snapshot ausente" : "Relatório carregável"}
              </span>
              <button class="table-action" data-action="load-history-scan" data-id="${escapeHtml(item.id)}" ${item.snapshotAvailable === false ? "disabled" : ""}>
                ${item.snapshotAvailable === false ? "Indisponível" : "Carregar"}
              </button>
            </div>
          </article>
        `).join("") || emptyPanel("history", "Nenhum scan registrado ainda", "Quando você concluir um scan, ele aparecerá aqui com métricas e link para carregar o relatório salvo.")}
      </section>
      <h2>Resumo atual</h2>
      <section class="panel history-panel">
        <p>${icon("clock")} Último scan carregado: ${state.scanResult ? fullDate(state.scanResult.finishedAt) : "nenhum"}</p>
        <p>${icon("shield")} Em quarentena agora: ${compactBytes(totalQuarantined())}</p>
        <p>${icon("disk")} Última variação livre registrada: ${freeDeltaLabel}</p>
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

function updatesTabV1() {
  const update = state.update || {};
  const status = updateStatusMeta(update.status);
  const settings = state.settings?.update || {};
  const hasAsset = Boolean(update.asset?.url);
  const remoteChangelogSections = updateChangelogSections(update.release?.body);
  const localChangelogFallback = localChangelogSections(update.currentVersion || APP_VERSION_LABEL);
  const changelogSections = remoteChangelogSections.length ? remoteChangelogSections : localChangelogFallback;
  const changelogSource = remoteChangelogSections.length ? "remote" : localChangelogFallback.length ? "local" : "none";
  const isAutoUpdate = update.updateMode === "auto" && update.buildMode === "Instalado";
  const isAssisted = !isAutoUpdate || settings.preferManual;
  const canDownloadUpdate = isAutoUpdate || hasAsset;
  const buildMode = update.buildMode || state.appPaths?.buildMode || "Desconhecido";
  const isDevelopmentBuild = buildMode === "Desenvolvimento" || buildMode === "Development";
  const dataLocation = state.appPaths?.userData || "Pasta de dados do DiskSnoop";
  const modeLabel = isAutoUpdate
    ? t("updates.autoMode")
    : buildMode === "Instalado" && settings.preferManual
      ? t("updates.manualPreferenceMode")
      : t("updates.assistedMode");
  const updateEngine = isDevelopmentBuild
    ? (isAutoUpdate
      ? t("updates.engineActive")
      : buildMode === "Instalado" && settings.preferManual
        ? t("updates.engineManualPreference")
        : buildMode === "Instalado" && update.autoUpdaterAvailable === false
          ? t("updates.engineMissing")
          : t("updates.engineAssisted"))
    : "";
  const releaseRequirement = isDevelopmentBuild
    ? (buildMode === "Instalado" && !settings.preferManual
      ? t("updates.expectedInstalled")
      : t("updates.expectedAssisted"))
    : "";
  const diagnosticsNote = isDevelopmentBuild
    ? (buildMode === "Instalado" && settings.preferManual
      ? t("updates.manualNote")
      : settings.includeBeta
        ? t("updates.betaNote")
        : "")
    : "";
  const appInfoCard = isDevelopmentBuild ? `
    <article class="panel update-card update-diagnostics">
      <h2>${escapeHtml(t("updates.diagnosticsTitle"))}</h2>
      <p>${escapeHtml(t("updates.diagnosticsText"))}</p>
      <div class="update-diagnostics-grid">
        <div><span>${escapeHtml(t("updates.appMode"))}</span><strong>${escapeHtml(localizedBuildMode(buildMode))}</strong></div>
        <div><span>${escapeHtml(t("updates.engine"))}</span><strong>${escapeHtml(updateEngine)}</strong></div>
        <div><span>${escapeHtml(t("updates.expectedRelease"))}</span><strong>${escapeHtml(releaseRequirement)}</strong></div>
        <div><span>${escapeHtml(t("updates.localData"))}</span><strong title="${escapeHtml(dataLocation)}">${escapeHtml(dataLocation)}</strong></div>
      </div>
      ${diagnosticsNote ? `<p class="muted">${escapeHtml(diagnosticsNote)}</p>` : ""}
      <div class="detail-actions update-actions">
        <button class="secondary" data-action="open-data-folder">${icon("external")}${t("updates.openData")}</button>
      </div>
    </article>
  ` : `
    <article class="panel update-card update-diagnostics">
      <h2>${escapeHtml(t("updates.appInfoTitle"))}</h2>
      <p>${escapeHtml(t("updates.appInfoText"))}</p>
      <div class="update-diagnostics-grid compact">
        <div><span>${escapeHtml(t("updates.appMode"))}</span><strong>${escapeHtml(localizedBuildMode(buildMode))}</strong></div>
        <div><span>${escapeHtml(t("updates.localData"))}</span><strong title="${escapeHtml(dataLocation)}">${escapeHtml(dataLocation)}</strong></div>
      </div>
      <div class="detail-actions update-actions">
        <button class="secondary" data-action="open-data-folder">${icon("external")}${t("updates.openData")}</button>
      </div>
    </article>
  `;
  const actionByState = {
    idle: `<button class="primary" data-action="update-check">${icon("refresh")}${t("updates.checkNow")}</button>`,
    checking: `<button class="primary" disabled>${icon("refresh")}${t("updates.checking")}</button>`,
    "up-to-date": `<button class="primary" data-action="update-check">${icon("refresh")}${t("updates.checkNow")}</button>`,
    available: `
      <button class="primary" data-action="update-download" ${canDownloadUpdate ? "" : "disabled"}>${icon("download")}${t("updates.download")}</button>
      <button class="secondary" data-action="update-remind">${icon("clock")}${t("updates.remind")}</button>
      <button class="secondary" data-action="update-ignore">${icon("ban")}${t("updates.ignore")}</button>
    `,
    downloading: `<button class="primary" disabled>${icon("download")}${t("updates.downloading", { progress: Math.round(update.progress || 0) })}</button>`,
    downloaded: `
      <button class="primary" data-action="update-open-downloaded">${icon("external")}${t("updates.openDownloaded")}</button>
      <button class="secondary" data-action="update-show-downloaded">${icon("folder")}${t("updates.showInFolder")}</button>
      <button class="secondary" disabled>${icon("refresh")}${t("updates.restartUnavailablePortable")}</button>
    `,
    "restart-required": `<button class="primary" data-action="update-install-restart">${icon("refresh")}${t("updates.restart")}</button>`,
    error: `<button class="primary" data-action="update-check">${icon("refresh")}${t("updates.retry")}</button>`,
    offline: `<button class="primary" data-action="update-check">${icon("refresh")}${t("updates.checkAgain")}</button>`,
    ignored: `<button class="primary" data-action="update-check">${icon("refresh")}${t("updates.checkNow")}</button>`
  };
  return `
    <section>
      <div class="page-heading update-heading">
        <span class="page-heading-icon">${icon("download")}</span>
        <div>
          <h1>${escapeHtml(t("updates.title"))}</h1>
          <p>${escapeHtml(t("updates.subtitle"))}</p>
        </div>
      </div>

      <section class="update-grid">
        <article class="panel update-card update-status-card">
          <div class="update-card-title">
            <span class="update-hero-icon">${icon("download")}</span>
            <div>
              <span class="status-pill ${status.kind}">${escapeHtml(status.label)}</span>
              <h2>${update.status === "available" ? `DiskSnoop ${escapeHtml(update.latestVersion)}` : escapeHtml(t("updates.safeTitle"))}</h2>
              <p>${update.status === "available"
                ? escapeHtml(t("updates.availableText"))
                : update.status === "downloaded"
                  ? escapeHtml(t("updates.downloadedText"))
                  : update.status === "restart-required"
                    ? escapeHtml(t("updates.restartText"))
                  : update.error
                    ? escapeHtml(update.error)
                    : escapeHtml(t("updates.defaultText"))}</p>
            </div>
          </div>
          <div class="update-status-grid">
            <div><span>${escapeHtml(t("updates.installedVersion"))}</span><strong>${escapeHtml(update.currentVersion || APP_VERSION_LABEL)}</strong></div>
            <div><span>${escapeHtml(t("updates.latestVersion"))}</span><strong>${escapeHtml(update.latestVersion || t("common.notAvailable"))}</strong></div>
            <div><span>${escapeHtml(t("updates.lastCheck"))}</span><strong>${escapeHtml(updateDate(update.lastCheckAt))}</strong></div>
            <div><span>${escapeHtml(t("updates.channel"))}</span><strong>${escapeHtml(localizedUpdateChannel(update.channel))}</strong></div>
            <div><span>${escapeHtml(t("updates.mode"))}</span><strong>${escapeHtml(modeLabel)}</strong></div>
            <div><span>${escapeHtml(t("updates.artifact"))}</span><strong>${escapeHtml(isAutoUpdate ? t("updates.installerManaged") : (update.asset?.name || t("updates.notSelected")))}</strong></div>
          </div>
        </article>

        <article class="panel update-card">
          <h2>${escapeHtml(t("updates.actions"))}</h2>
          <p>${isAssisted
            ? escapeHtml(t("updates.assistedText"))
            : escapeHtml(t("updates.autoText"))}</p>
          ${update.status === "downloading" ? `<div class="update-progress">${progressBar(update.progress || 0)}<span>${Math.round(update.progress || 0)}%</span></div>` : ""}
          <div class="detail-actions update-actions">
            ${actionByState[update.status] || actionByState.idle}
            <button class="secondary" data-action="update-open-releases">${icon("external")}${t("updates.openReleases")}</button>
            ${update.release?.url ? `<button class="secondary" data-action="update-open-release">${icon("list")}${t("updates.openThisRelease")}</button>` : ""}
          </div>
        </article>

        ${appInfoCard}

        <article class="panel update-card">
          <h2>${escapeHtml(t("updates.changelog"))}</h2>
          ${changelogSource === "local" ? `<p class="muted">${escapeHtml(t("updates.localChangelog"))}</p>` : ""}
          ${changelogSections.length ? `
            <div class="update-changelog">
              ${changelogSections.map((section) => `
                <section>
                  <h3>${escapeHtml(section.title)}</h3>
                  <ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
                </section>
              `).join("")}
            </div>
          ` : `<p class="muted">${escapeHtml(t("updates.noChangelog"))}</p>`}
        </article>

        <article class="panel update-card">
          <h2>${escapeHtml(t("updates.preferences"))}</h2>
          <div class="update-preferences">
            <label><input type="checkbox" data-update-pref="checkOnStartup" ${settings.checkOnStartup === false ? "" : "checked"}> ${escapeHtml(t("updates.prefCheckStartup"))}</label>
            <label><input type="checkbox" data-update-pref="includeBeta" ${settings.includeBeta === false ? "" : "checked"}> ${escapeHtml(t("updates.prefBeta"))}</label>
            <label><input type="checkbox" data-update-pref="autoDownload" ${settings.autoDownload === false ? "" : "checked"} ${settings.preferManual ? "disabled" : ""}> ${escapeHtml(t("updates.prefAutoDownload"))} <span>${escapeHtml(t("updates.prefAutoDownloadHelp"))}</span></label>
            <label><input type="checkbox" data-update-pref="preferManual" ${settings.preferManual ? "checked" : ""}> ${escapeHtml(t("updates.prefManual"))}</label>
          </div>
          ${update.ignoredVersion ? `<p class="muted">${escapeHtml(t("updates.ignored", { version: update.ignoredVersion }))}</p>` : ""}
          ${update.remindAfter ? `<p class="muted">${escapeHtml(t("updates.reminder", { date: updateDate(update.remindAfter) }))}</p>` : ""}
        </article>
      </section>
    </section>
  `;
}

function settingsTab() {
  const ignoredCount = state.settings.ignoredPaths?.length || 0;
  const includedCount = state.settings.includedPaths?.length || 0;
  const activeQuarantine = state.quarantine.filter((item) => item.status === "Em quarentena");
  const hasCachedScan = hasValidCachedScan();
  const historyCount = state.history.length;
  const loadedScanCount = state.scanResult ? 1 : 0;
  const historyCountLabel = historyCount === 1 ? "scan no histórico" : "scans no histórico";
  const loadedScanCountLabel = loadedScanCount === 1 ? "scan carregado nesta sessão" : "scans carregados nesta sessão";
  const defaultQuarantine = state.appPaths?.defaultQuarantine || "Pasta de dados do DiskSnoop";
  const quarantineLocation = state.settings.quarantinePath || defaultQuarantine;
  const dataLocation = state.appPaths?.userData || "Pasta de dados do DiskSnoop";
  const section = state.settingsSection || "appearance";
  const categories = [
    ["appearance", "Aparência", "settings"],
    ["analysis", "Análise", "search"],
    ["quarantine", "Quarentena", "shield"],
    ["scope", "Escopo do scan", "folder"],
    ["maintenance", "Manutenção", "database"],
    ["updates", "Atualização", "refresh"]
  ];
  const content = {
    appearance: `
      <div class="settings-detail-heading"><span>${icon("settings")}</span><div><h2>Aparência e idioma</h2><p>Personalize como o DiskSnoop aparece e se comunica.</p></div></div>
      <section class="settings-card">
        <div><p>${escapeHtml(t("settings.currentTheme"))}</p><span>${escapeHtml(t("settings.themeHelp"))}</span></div>
        ${themeCardPicker(state.settings.theme)}
      </section>
      <section class="settings-card">
        <div><p>${escapeHtml(t("settings.languageLabel"))}</p><span>${escapeHtml(t("settings.languageHelp"))}</span></div>
        ${selectControl("language", languageOptions, state.settings.language || "pt-BR")}
      </section>
    `,
    analysis: `
      <div class="settings-detail-heading"><span>${icon("search")}</span><div><h2>Análise</h2><p>Defina os limites e detectores usados nos próximos scans.</p></div></div>
      <section class="settings-card vertical">
        <h3>Limites do scan</h3>
        ${settingSelect("Arquivo grande a partir de:", "largeFileSize", [["250 MB", 250 * MB], ["500 MB", 500 * MB], ["1 GB", GB], ["5 GB", 5 * GB], ["10 GB", 10 * GB]], state.settings.largeFileSize)}
        ${settingSelect("Pasta grande a partir de:", "largeFolderSize", [["500 MB", 500 * MB], ["1 GB", GB], ["2 GB", 2 * GB], ["5 GB", 5 * GB], ["10 GB", 10 * GB]], state.settings.largeFolderSize)}
        ${settingSelect("Possível duplicado a partir de:", "duplicateFileSize", [["10 MB", 10 * MB], ["50 MB", 50 * MB], ["100 MB", 100 * MB], ["500 MB", 500 * MB], ["1 GB", GB]], state.settings.duplicateFileSize || 50 * MB)}
        ${settingSelect("Considerar arquivo antigo após:", "oldFileDays", [["30 dias", 30], ["90 dias", 90], ["180 dias", 180], ["365 dias", 365]], state.settings.oldFileDays)}
      </section>
      <section class="settings-card vertical">
        <h3>Detectores</h3>
        ${checkLine("Detectar node_modules", "detectNodeModules")}
        ${checkLine("Detectar builds e caches", "detectBuildCaches")}
        ${checkLine("Detectar instaladores antigos", "detectOldInstallers")}
        ${checkLine("Detectar downloads antigos", "detectOldDownloads")}
        ${checkLine("Detectar compactados antigos", "detectOldArchives")}
        ${checkLine("Detectar logs grandes e temporários", "detectLogsAndTemps")}
        ${checkLine("Confirmar duplicados com hash SHA-256", "verifyDuplicateHashes")}
        <span>Itens sensíveis como Windows, System32, drivers e programas ativos continuam fora dos candidatos normais.</span>
      </section>
    `,
    quarantine: `
      <div class="settings-detail-heading"><span>${icon("shield")}</span><div><h2>Quarentena</h2><p>Escolha onde os itens reversíveis ficam protegidos.</p></div></div>
      <section class="settings-card vertical">
        <div class="settings-stats"><span><strong>${activeQuarantine.length}</strong> itens em quarentena</span><span><strong>${compactBytes(totalQuarantined())}</strong> protegidos</span></div>
        <p>Local atual: ${escapeHtml(quarantineLocation)}</p>
        <div class="detail-actions">
          <button class="secondary" data-action="choose-quarantine">${icon("folder")}Alterar pasta</button>
          <button class="secondary" data-action="open-quarantine">${icon("external")}Abrir quarentena</button>
          <button class="secondary" data-action="reset-quarantine-path">${icon("reset")}Usar padrão</button>
        </div>
        <span>Para mover pastas grandes, prefira uma quarentena no mesmo disco do item. O DiskSnoop pode bloquear pastas entre discos para evitar cópia parcial seguida de remoção.</span>
      </section>
    `,
    scope: `
      <div class="settings-detail-heading"><span>${icon("folder")}</span><div><h2>Escopo do scan</h2><p>Controle o que entra e o que fica fora das análises.</p></div></div>
      <section class="settings-card vertical">
        <div class="scope-head"><div><p>Pastas incluídas: <strong>${includedCount}</strong></p><span>Quando houver inclusões, o scan varre somente essas pastas dentro do disco escolhido.</span></div><button class="secondary" data-action="add-included-folder">${icon("folder")}Adicionar pasta</button></div>
        ${pathList(state.settings.includedPaths || [], "included")}
        <div class="detail-actions compact-actions"><button class="secondary" data-action="clear-included" ${includedCount ? "" : "disabled"}>${icon("trash")}Limpar incluídas</button></div>
      </section>
      <section class="settings-card vertical">
        <div class="scope-head"><div><p>Pastas ignoradas: <strong>${ignoredCount}</strong></p><span>Itens ignorados não entram nos próximos scans nem nas sugestões.</span></div><button class="secondary" data-action="add-ignored-folder">${icon("folder")}Adicionar pasta</button></div>
        ${ignoredPresetCards()}
        ${pathList(state.settings.ignoredPaths || [], "ignored")}
        <div class="detail-actions compact-actions"><button class="secondary" data-action="show-ignored" ${ignoredCount ? "" : "disabled"}>${icon("list")}Ver ignorados</button><button class="secondary" data-action="reset-ignored" ${ignoredCount ? "" : "disabled"}>${icon("reset")}Resetar ignorados</button></div>
      </section>
    `,
    maintenance: `
      <div class="settings-detail-heading"><span>${icon("database")}</span><div><h2>Manutenção</h2><p>Gerencie apenas os dados locais criados pelo DiskSnoop.</p></div></div>
      <section class="settings-card vertical">
        <div class="settings-stats"><span><strong>${historyCount}</strong> ${historyCountLabel}</span><span><strong>${loadedScanCount}</strong> ${loadedScanCountLabel}</span><span><strong>${hasCachedScan ? "sim" : "não"}</strong> relatório salvo para abertura rápida</span></div>
        <p>Dados do app: ${escapeHtml(dataLocation)}</p>
        <p>Log de auditoria: ${escapeHtml(state.appPaths?.auditLog || `${dataLocation}\\audit-log.jsonl`)}</p>
        <div class="detail-actions"><button class="secondary" data-action="open-data-folder">${icon("external")}Abrir dados do app</button><button class="secondary" data-action="clear-local-scan" ${hasCachedScan ? "" : "disabled"}>${icon("trash")}Limpar último scan local</button><button class="secondary" data-action="clear-history">${icon("trash")}Limpar histórico</button><button class="outline-danger" data-action="reset-settings">${icon("reset")}Restaurar configurações</button></div>
        <span>Essas ações limpam apenas dados do DiskSnoop. Elas não apagam arquivos analisados nem itens fora da quarentena.</span>
      </section>
    `,
    updates: `
      <div class="settings-detail-heading"><span>${icon("refresh")}</span><div><h2>Atualização</h2><p>Consulte a versão instalada e procure novas versões.</p></div></div>
      <section class="settings-card vertical settings-update-shortcut">
        <p>Versão instalada: <strong>v${escapeHtml(APP_VERSION_LABEL)}</strong></p>
        <span>As opções de canal, verificação automática e instalação continuam na tela dedicada de Atualização.</span>
        <div class="detail-actions"><button class="primary" data-action="tab" data-tab="updates">${icon("refresh")}Abrir Atualização</button></div>
      </section>
    `
  };
  return `
    <section class="settings-view">
      <div class="page-heading">
        <h1>${escapeHtml(t("settings.title"))}</h1>
        <p>${escapeHtml(t("settings.subtitle"))}</p>
      </div>
      <div class="settings-layout">
        <nav class="settings-categories" aria-label="Categorias de configurações">
          ${categories.map(([id, label, iconName]) => `<button class="${section === id ? "active" : ""}" data-action="settings-section" data-section="${id}">${icon(iconName)}<span>${escapeHtml(label)}</span></button>`).join("")}
        </nav>
        <main class="settings-detail">${content[section] || content.appearance}</main>
      </div>
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
  document.documentElement.lang = currentLanguage();
  const app = $("#app");
  const content = $(".content");
  const shouldAnimateTab = state.screen === "app" && lastRenderedTab !== null && lastRenderedTab !== state.tab;
  const shouldRestoreContentScroll = state.screen === "app" && lastRenderedTab === state.tab && content;
  const contentScrollTop = shouldRestoreContentScroll ? content.scrollTop : 0;

  if (state.screen === "welcome") app.innerHTML = welcomeScreen();
  if (state.screen === "disks") app.innerHTML = disksScreen();
  if (state.screen === "scanning") app.innerHTML = scanningScreen();
  if (state.screen === "app") app.innerHTML = appShell();
  applyRenderedTranslations(app);

  if (shouldRestoreContentScroll) {
    const nextContent = $(".content");
    if (nextContent) nextContent.scrollTop = contentScrollTop;
  }
  if (shouldAnimateTab) {
    const nextContent = $(".content");
    if (nextContent) {
      nextContent.classList.remove("tab-enter");
      void nextContent.offsetWidth;
      nextContent.classList.add("tab-enter");
    }
  }
  animateOverviewMetrics();
  const detailPanel = $(".detail-overlay-panel");
  if (detailPanel) detailPanel.focus({ preventScroll: true });
  lastRenderedTab = state.screen === "app" ? state.tab : null;
}

const MIN_BOOT_MS = 900;
const MIN_READY_BOOT_MS = 420;

async function loadBasics() {
  const bootStart = Date.now();
  try {
    setBootStep("loading");
    loadHiddenPaths();
    const loadedSettings = normalizeTheme(await api.getSettings());
    state.settings = loadedSettings;
    api.saveSettings(loadedSettings).catch(() => {});

    const [drives, quarantine, history, appPaths] = await Promise.all([
      api.listDrives(),
      api.listQuarantine(),
      api.listHistory(),
      api.appPaths()
    ]);
    const elapsed = Date.now() - bootStart;
    setBootStep("ready");
    const readyDelay = Math.max(MIN_BOOT_MS - elapsed, MIN_READY_BOOT_MS);
    if (readyDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, readyDelay));
    }

    state.drives = drives;
    state.isPackaged = Boolean(appPaths?.isPackaged);
    state.appPaths = appPaths || null;
    APP_VERSION_LABEL = appPaths?.version || APP_VERSION_LABEL;
    state.update.currentVersion = APP_VERSION_LABEL;
    state.quarantine = quarantine;
    syncHiddenPathsFromQuarantine(quarantine);
    state.history = history;
    state.selectedDrive = mostUrgentDrive();
    const restoredScan = restoreLastScan();
    render();
    if (restoredScan) refreshLoadedScanState({ toast: false }).catch(() => {});

    refreshUpdateState()
      .then(() => {
        if (state.settings?.update?.checkOnStartup !== false) runUpdateCheck(false);
      })
      .catch(() => {});

    api.listInstalledApps()
      .then((inventory) => {
        state.installedApps = Array.isArray(inventory) ? inventory : inventory?.apps || [];
        state.appInventory = {
          appxReliable: Array.isArray(inventory) ? false : inventory?.appxReliable === true,
          appxError: Array.isArray(inventory) ? "Formato antigo sem confirmação AppX." : inventory?.appxError || "",
          loaded: true
        };
        if (state.screen === "app" && state.tab === "leftovers") render();
      })
      .catch(() => {
        state.installedApps = [];
        state.appInventory = { appxReliable: false, appxError: "Falha ao consultar aplicativos instalados.", loaded: true };
      });
  } catch (error) {
    const app = $("#app");
    app.innerHTML = `
      <main class="boot-screen">
        <section class="boot-card">
          ${appLogo("big")}
          <h1>${escapeHtml(t("boot.startFailed"))}</h1>
          <p>${escapeHtml(error.message || t("boot.initialDataError"))}</p>
          <button class="primary" data-action="retry-load">${escapeHtml(t("boot.retry"))}</button>
        </section>
      </main>
    `;
  }
}

function restoreLastScan() {
  const cached = readCachedScan();
  if (!cached) return false;
  state.scanResult = cached;
  state.selectedDrive = state.drives.find((drive) => drive.letter === cached.drive.letter) || cached.drive;
  state.screen = "app";
  state.tab = "overview";
  state.reportMode = state.history?.[0]?.id === cached.id ? "current" : "review";
  state.selectedItem = null;
  state.selectedDuplicateId = "";
  state.selectedIds.clear();
  syncHiddenPathsFromQuarantine();
  return true;
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
    mk("test-store-package", "Microsoft.WindowsStore_8wekyb3d8bbwe", `${root}Users\\Voce\\AppData\\Local\\Packages\\Microsoft.WindowsStore_8wekyb3d8bbwe`, 7.8 * GB, "Pasta", "Sensivel", "Componente protegido da Microsoft Store.", 0),
    mk("test-video-1", "aula-backup.mp4", `${root}Users\\Voce\\Videos\\aula-backup.mp4`, 1.4 * GB, "Arquivos grandes", "Verificar antes", "Arquivo grande detectado.", 40),
    mk("test-video-2", "aula-backup.mp4", `${root}Users\\Voce\\Downloads\\aula-backup.mp4`, 1.4 * GB, "Arquivos grandes", "Verificar antes", "Arquivo grande detectado.", 120)
  ];
  const largeFolders = [
    mk("test-folder-downloads", "Downloads", `${root}Users\\Voce\\Downloads`, 24 * GB, "Pasta", "Verificar antes", "Contem muitos instaladores, zips e videos.", 1),
    mk("test-folder-projects", "Projetos", `${root}Projetos`, 21 * GB, "Pasta", "Seguro revisar", "Projetos de desenvolvimento ocupando espaco relevante.", 0),
    mk("test-folder-node", "node_modules", `${root}Projetos\\AppAntigo\\node_modules`, 5.6 * GB, "Pasta", "Seguro revisar", "Dependencias Node recriaveis.", 90),
    mk("test-folder-appdata", "AppData/Local", `${root}Users\\Voce\\AppData\\Local`, 6 * GB, "Pasta", "Verificar antes", "Area de dados de aplicativos. Revise com cuidado.", 0),
    mk("test-folder-store", "Microsoft.WindowsStore_8wekyb3d8bbwe", `${root}Users\\Voce\\AppData\\Local\\Packages\\Microsoft.WindowsStore_8wekyb3d8bbwe`, 7.8 * GB, "Pasta", "Sensivel", "Componente protegido mostrado apenas para transparência.", 0)
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
      confidence: "Hash confirmado",
      algorithm: "SHA-256",
      contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      reason: "Arquivos com mesmo nome, mesmo tamanho e mesmo hash SHA-256. Ainda assim, o DiskSnoop não move nada automaticamente.",
      items: [
        { id: "dup-test-1", name: "aula-backup.mp4", path: `${root}Users\\Voce\\Videos\\aula-backup.mp4`, size: 1.4 * GB, modifiedAt: new Date(Date.now() - 40 * 86400000).toISOString(), contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
        { id: "dup-test-2", name: "aula-backup.mp4", path: `${root}Users\\Voce\\Downloads\\aula-backup.mp4`, size: 1.4 * GB, modifiedAt: new Date(Date.now() - 120 * 86400000).toISOString(), contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" }
      ]
    }]
  };
}

function findFolder(id) {
  return visibleLargeFolders().find((item) => item.id === id);
}

function findCandidate(id) {
  return visibleCandidates().find((item) => item.id === id);
}

function findDuplicateGroup(id) {
  return duplicateGroups().find((group) => group.id === id);
}

async function startScan(letter) {
  const drive = state.drives.find((item) => item.letter === letter) || state.selectedDrive;
  if (!drive?.letter) {
    setToast("Selecione um disco antes de iniciar o scan.");
    state.screen = "disks";
    render();
    return;
  }
  state.selectedDrive = drive;
  state.scanProgress = { progress: 0, currentPath: drive?.letter || "", files: 0, skipped: 0, mappedBytes: 0, candidates: 0 };
  state.scanComparison = null;
  state.paused = false;

  state.screen = "scanning";
  render();
  try {
    await api.startScan({ drive });
  } catch (error) {
    state.screen = "disks";
    render();
    setToast(`Não foi possível iniciar o scan: ${cleanIpcError(error)}`);
  }
}

async function refreshData() {
  state.quarantine = await api.listQuarantine();
  syncHiddenPathsFromQuarantine(state.quarantine);
  state.history = await api.listHistory();
}

async function refreshScanComparison() {
  state.scanComparison = null;
  if (!state.scanResult?.id || !api.loadScanSnapshot || isDevTestScan()) return;
  const history = state.history?.length ? state.history : await api.listHistory();
  const currentIndex = history.findIndex((item) => String(item.id) === String(state.scanResult.id));
  if (currentIndex < 0) return;
  const currentDrive = state.scanResult.drive?.letter;
  const previous = history
    .slice(currentIndex + 1)
    .find((item) => item.snapshotAvailable !== false && (!currentDrive || item.drive === currentDrive));
  if (!previous?.id) return;
  try {
    const snapshot = await api.loadScanSnapshot(previous.id);
    state.scanComparison = buildScanComparison(state.scanResult, snapshot);
  } catch {
    state.scanComparison = null;
  }
}

async function refreshUpdateState() {
  if (!api.getUpdateState) return;
  state.update = await api.getUpdateState();
  if (state.screen === "app") render();
}

async function runUpdateCheck(manual = true) {
  if (!api.checkForUpdates) return;
  state.update = { ...state.update, status: "checking", progress: 0, error: "" };
  render();
  try {
    state.update = await api.checkForUpdates({ manual });
    render();
    if (manual) {
      const meta = updateStatusMeta(state.update.status);
      setToast(meta.label);
    }
  } catch (error) {
    state.update = { ...state.update, status: "error", error: cleanIpcError(error), progress: 0 };
    render();
    if (manual) setToast(cleanIpcError(error));
  }
}

async function runUpdateDownload() {
  if (!api.downloadUpdate) return;
  state.update = { ...state.update, status: "downloading", progress: 0, error: "" };
  render();
  try {
    state.update = await api.downloadUpdate();
    render();
    if (state.update.status === "downloaded") setToast("Atualização baixada.");
    if (state.update.status === "error" || state.update.status === "offline") setToast(state.update.error || "Download interrompido.");
  } catch (error) {
    state.update = { ...state.update, status: "error", error: cleanIpcError(error), progress: 0 };
    render();
    setToast(cleanIpcError(error));
  }
}

function forgetMissingItemFromUi(targetPath, item = null) {
  const itemPath = item?.path || targetPath;
  if (!itemPath) return;
  removeMissingPathFromCurrentResult(itemPath);
  localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(state.scanResult));
  refreshScanComparison().then(render).catch(() => render());
}

async function openPathWithFeedback(targetPath, item = null) {
  if (!targetPath) {
    setToast("Caminho ausente.");
    return false;
  }
  const result = await api.openPath(targetPath);
  if (result?.ok === false) {
    if (isMissingPathError(result.error)) {
      forgetMissingItemFromUi(targetPath, item);
      setToast("Esse item nao existe mais e saiu do relatorio atual.");
      return false;
    }
    setToast(`Não foi possível abrir: ${cleanIpcError(result.error)}`);
    return false;
  }
  return true;
}

async function showPathWithFeedback(targetPath, item = null) {
  if (!targetPath) {
    setToast("Caminho ausente.");
    return false;
  }
  const result = await api.showInFolder(targetPath);
  if (result?.ok === false) {
    if (isMissingPathError(result.error)) {
      forgetMissingItemFromUi(targetPath, item);
      setToast("Esse item nao existe mais e saiu do relatorio atual.");
      return false;
    }
    setToast(`Não foi possível abrir no Explorer: ${cleanIpcError(result.error)}`);
    return false;
  }
  return true;
}

async function ignoreItem(item) {
  if (!item) return;
  try {
    await api.addIgnoredPath(item.path);
    state.settings = await api.getSettings();
    removeItemFromCurrentResult(item);
    setToast("Item ignorado nos próximos scans.");
  } catch (error) {
    setToast(`Não foi possível ignorar: ${cleanIpcError(error)}`);
  }
}

function removeItemFromCurrentResult(item) {
  if (!state.scanResult || !item?.path) return;
  hidePathFromViews(item);
  removePathFromCurrentResult(item.path, { persist: true });
}

function removePathFromCurrentResult(itemPath, options = {}) {
  if (!state.scanResult || !itemPath) return;
  const normalized = normalizeItemPath(itemPath);
  const samePath = (value) => normalizeItemPath(value) === normalized;
  const removeNested = (value) => {
    const key = normalizeItemPath(value);
    return key === normalized || key.startsWith(`${normalized}\\`);
  };
  for (const item of [...(state.scanResult.candidates || []), ...(state.scanResult.largeFolders || [])]) {
    if (samePath(item.path) && item.id) state.selectedIds.delete(item.id);
  }
  state.scanResult.candidates = (state.scanResult.candidates || []).filter((candidate) => !samePath(candidate.path));
  state.scanResult.largeFolders = (state.scanResult.largeFolders || []).filter((folder) => !samePath(folder.path));
  state.scanResult.duplicateGroups = (state.scanResult.duplicateGroups || [])
    .map((group) => {
      const items = (group.items || []).filter((duplicate) => !removeNested(duplicate.path));
      return {
        ...group,
        items,
        copies: items.length,
        reviewableBytes: (group.size || 0) * Math.max(0, items.length - 1)
      };
    })
    .filter((group) => (group.items || []).length > 1);
  if (samePath(state.selectedItem?.path)) state.selectedItem = null;
  if (options.persist !== false) localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(state.scanResult));
}

function removeMissingPathFromCurrentResult(itemPath) {
  removePathFromCurrentResult(itemPath, { persist: false });
}

function scanResultPaths(result = state.scanResult) {
  const paths = [];
  for (const item of result?.candidates || []) if (item?.path) paths.push(item.path);
  for (const item of result?.largeFolders || []) if (item?.path) paths.push(item.path);
  for (const group of result?.duplicateGroups || []) {
    for (const item of group.items || []) if (item?.path) paths.push(item.path);
  }
  return [...new Set(paths)];
}

async function pruneMissingScanItems(options = {}) {
  if (!state.scanResult?.id || !api.pathsExist) return 0;
  const paths = scanResultPaths();
  if (!paths.length) return 0;
  const existing = await api.pathsExist(paths);
  const missing = paths.filter((itemPath) => existing[itemPath] === false);
  for (const itemPath of missing) removeMissingPathFromCurrentResult(itemPath);
  if (missing.length) {
    localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(state.scanResult));
    await refreshScanComparison();
    if (options.toast !== false) setToast(`${missing.length} item(ns) apagado(s) fora do DiskSnoop foram removidos deste relatorio.`);
  }
  return missing.length;
}

async function refreshLoadedScanState(options = {}) {
  const removed = await pruneMissingScanItems(options);
  if (!removed) await refreshScanComparison();
  render();
  return removed;
}

async function quarantineItems(items) {
  const blocked = items.filter((item) => item && !canMoveToQuarantine(item));
  const valid = items.filter((item) => item && canMoveToQuarantine(item));
  if (!valid.length) {
    if (blocked.length) {
      await confirmModal({
        title: "Revisão manual necessária",
        message: "Este item parece protegido, sensível ou ligado a um app instalado. O DiskSnoop pode abrir o local para você revisar, mas não vai mover isso para quarentena como candidato normal.",
        details: ["Abra o local para confirmar o conteúdo antes de qualquer ação manual."],
        confirmText: "Entendi",
        icon: "shield"
      });
    }
    return;
  }
  if (blocked.length) {
    await confirmModal({
      title: "Alguns itens exigem revisão manual",
      message: `${blocked.length} item(ns) ficaram de fora porque parecem protegidos, sensíveis ou ligados a apps instalados. O DiskSnoop não move esse tipo de item para quarentena automaticamente.`,
      details: ["Os demais itens continuam disponíveis para revisão e quarentena."],
      confirmText: "Entendi",
      icon: "shield"
    });
  }
  const totalSize = valid.reduce((sum, item) => sum + Number(item.size || 0), 0);
  const isLargeBatch = valid.length >= 10 || totalSize >= 10 * GB;
  if (isLargeBatch && !(await offerRestorePoint("lote grande de quarentena"))) return;
  const scanSnapshot = state.scanResult ? structuredClone(state.scanResult) : null;
  let movedCount = 0;
  const movedRecords = [];
  for (const item of valid) {
    try {
      const record = await api.moveToQuarantine({ ...item, scanId: state.scanResult?.id || "" });
      movedRecords.push(record);
      movedCount += 1;
      state.selectedIds.delete(item.id);
      removeItemFromCurrentResult(item);
    } catch (error) {
      await refreshData().catch(() => {});
      await confirmModal(friendlyMoveError(error, item));
      if (movedCount) setToast(`${movedCount} item(ns) movido(s). O restante ficou para revisão manual.`);
      return;
    }
  }
  await refreshData();
  state.quarantineUndo = {
    records: movedRecords,
    scanSnapshot,
    scanId: scanSnapshot?.id || ""
  };
  setToast({
    message: `${movedCount} item(ns) movido(s) para a quarentena.`,
    action: "undo-quarantine",
    actionLabel: "Desfazer",
    duration: 9000
  });
}

async function undoLastQuarantine() {
  const undo = state.quarantineUndo;
  if (!undo?.records?.length) {
    setToast("O tempo para desfazer terminou. O item continua disponível na Quarentena.");
    return;
  }
  state.quarantineUndo = null;
  state.toast = "";
  render();
  let restoredCount = 0;
  let lastError = null;
  for (const record of [...undo.records].reverse()) {
    try {
      await api.restoreQuarantine(record.id);
      restoredCount += 1;
    } catch (error) {
      lastError = error;
      break;
    }
  }
  await refreshData();
  if (restoredCount === undo.records.length && undo.scanSnapshot && state.scanResult?.id === undo.scanId) {
    state.scanResult = undo.scanSnapshot;
    localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(state.scanResult));
    await refreshScanComparison();
  }
  if (lastError) {
    setToast(`${restoredCount} item(ns) restaurado(s). Não foi possível desfazer o restante: ${cleanIpcError(lastError)}`);
    return;
  }
  setToast(`${restoredCount} item(ns) restaurado(s).`);
}

async function offerRestorePoint(contextLabel) {
  if (!api.createRestorePoint) return true;
  const wantsRestorePoint = await confirmModal({
    title: "Proteção adicional do Windows",
    message: `Deseja tentar criar um ponto de restauração antes da operação: ${contextLabel}?`,
    details: [
      "O Windows pode exigir permissão de administrador ou limitar a frequência de criação.",
      "Pontos de restauração não substituem a quarentena e não garantem recuperar arquivos pessoais ou dados de aplicativos."
    ],
    confirmText: "Criar ponto",
    cancelText: "Continuar sem ponto",
    icon: "shield"
  });
  if (!wantsRestorePoint) return true;
  try {
    await api.createRestorePoint();
    setToast("Ponto de restauração criado pelo Windows.");
    return true;
  } catch (error) {
    return confirmModal({
      title: "Ponto de restauração não criado",
      message: cleanIpcError(error),
      details: ["Você pode cancelar a operação e criar um ponto manualmente nas configurações de Proteção do Sistema."],
      confirmText: "Continuar sem ponto",
      cancelText: "Cancelar operação",
      icon: "shield",
      variant: "danger"
    });
  }
}

function elevatedDeletionRisk(record) {
  if (api.isElevatedDeletionRisk) return api.isElevatedDeletionRisk(record?.originalPath || "");
  const originalPath = String(record?.originalPath || "").toLowerCase().replaceAll("/", "\\");
  return originalPath.includes("\\appdata\\")
    || originalPath.includes("\\programdata\\")
    || originalPath.includes("\\program files\\")
    || originalPath.includes("\\program files (x86)\\");
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
  if (["sizeFilter", "sort", "fileSizeFilter", "fileSort", "candidateScope", "candidateSafety", "candidateConfidence", "candidateAge", "candidateMinSize", "duplicateMinWaste", "leftoversStatus", "leftoversLocation"].includes(field)) {
    state.detailOverlayOpen = false;
  }
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
  if (field === "candidateConfidence") {
    state.candidateConfidence = target.value;
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
  if (field === "language") {
    state.settings.language = languageLabels[target.value] ? target.value : "pt-BR";
    state.settings = normalizeTheme(state.settings);
    rememberLanguage(state.settings.language);
    persistSettingsSoon();
  }
  return true;
}

function isTableFilterField(field) {
  return [
    "search", "sizeFilter", "sort", "fileSearch", "fileSizeFilter", "fileSort",
    "candidateSearch", "candidateScope", "candidateSafety", "candidateConfidence",
    "candidateAge", "candidateMinSize", "duplicateSearch", "duplicateMinWaste",
    "leftoversSearch", "leftoversStatus", "leftoversLocation"
  ].includes(field);
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
  if (action === "undo-quarantine") {
    await undoLastQuarantine();
    return;
  }
  if (action === "dismiss-toast") {
    state.toast = "";
    state.quarantineUndo = null;
    render();
    return;
  }

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
  if (action === "retry-load") {
    location.reload();
    return;
  }
  if (action === "window-minimize") await api.minimizeWindow();
  if (action === "window-maximize") await api.maximizeWindow();
  if (action === "window-close") await api.closeWindow();
  if (action === "start-scan") await startScan(target.dataset.drive);
  if (action === "load-cached-scan") {
    if (!restoreLastScan()) {
      setToast("Último scan salvo não está mais disponível.");
      state.screen = "disks";
    } else {
      setToast(isViewingHistoricalReport() ? "Relatório local carregado em modo revisão." : "Último scan local carregado.");
    }
    render();
    refreshLoadedScanState().catch(() => {});
  }
  if (action === "load-test-scan") {
    if (state.isPackaged) return;
    state.scanResult = createTestScan();
    state.selectedDrive = state.scanResult.drive;
    state.screen = "app";
    state.tab = "overview";
    state.reportMode = "test";
    state.scanComparison = null;
    state.selectedItem = null;
    clearHiddenPaths();
    state.selectedIds.clear();
    localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(state.scanResult));
    setToast("Bypass de teste carregado.");
  }
  if (action === "new-scan") {
    if (state.screen === "app") {
      state.screen = "disks";
      state.scanResult = null;
      state.scanComparison = null;
      state.reportMode = "none";
      state.selectedItem = null;
      clearHiddenPaths();
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
    state.detailOverlayOpen = false;
    if (state.tab === "quarantine") {
      await refreshData();
    }
    if (state.tab === "updates") {
      await refreshUpdateState();
    }
    render();
  }
  if (action === "update-check") {
    await runUpdateCheck(true);
  }
  if (action === "update-download") {
    await runUpdateDownload();
  }
  if (action === "update-open-releases") {
    await api.openReleases();
  }
  if (action === "update-open-release") {
    await api.openUpdateRelease();
  }
  if (action === "update-open-downloaded") {
    try {
      await api.openDownloadedUpdate();
    } catch (error) {
      setToast(cleanIpcError(error));
    }
  }
  if (action === "update-show-downloaded") {
    try {
      await api.showDownloadedUpdate();
    } catch (error) {
      setToast(cleanIpcError(error));
    }
  }
  if (action === "update-install-restart") {
    const ok = await confirmModal({
      title: "Reiniciar para atualizar",
      message: "O DiskSnoop será fechado e reaberto pelo instalador para aplicar a atualização baixada. Faça isso apenas quando nenhum scan ou ação de quarentena estiver em andamento.",
      confirmText: "Reiniciar",
      icon: "refresh"
    });
    if (!ok) return;
    try {
      await api.installUpdateAndRestart();
    } catch (error) {
      setToast(cleanIpcError(error));
    }
  }
  if (action === "update-ignore") {
    state.update = await api.ignoreUpdateVersion();
    render();
    setToast("Versão ignorada.");
  }
  if (action === "update-remind") {
    state.update = await api.rememberUpdateLater();
    render();
    setToast("Vou lembrar de novo amanhã.");
  }
  if (action === "select-overview-candidate") {
    state.selectedItem = findCandidate(id);
    state.tab = "candidates";
    state.detailOverlayOpen = true;
    render();
  }
  if (action === "settings-section") {
    state.settingsSection = target.dataset.section || "appearance";
    render();
  }
  if (action === "select-theme") {
    const theme = target.dataset.value;
    if (!themeLabels[theme]) return;
    state.settings.theme = theme;
    state.settings = normalizeTheme(state.settings);
    render();
    persistSettingsSoon();
  }
  if (action === "overview-safe-plan") {
    const safePlan = visibleCandidates().filter((item) => canMoveToQuarantine(item) && confidenceLevel(item)[0] === "Alta");
    state.selectedIds.clear();
    safePlan.forEach((item) => state.selectedIds.add(item.id));
    state.tab = "candidates";
    render();
    setToast(`${safePlan.length} item(ns) adicionados à simulação. Nenhum arquivo foi alterado.`);
  }
  if (action === "select-folder") {
    state.selectedItem = findFolder(id);
    state.detailOverlayOpen = true;
    render();
  }
  if (action === "select-file") {
    state.selectedItem = findCandidate(id);
    state.detailOverlayOpen = true;
    render();
  }
  if (action === "select-candidate") {
    state.selectedItem = findCandidate(id);
    state.detailOverlayOpen = true;
    render();
  }
  if (action === "select-duplicate") {
    state.selectedDuplicateId = id;
    state.detailOverlayOpen = true;
    render();
  }
  if (action === "select-leftover") {
    state.selectedItem = findFolder(id);
    state.detailOverlayOpen = true;
    render();
  }
  if (action === "close-detail") {
    state.detailOverlayOpen = false;
    render();
  }
  if (action === "toggle-select") {
    event.stopPropagation();
    const item = findCandidate(id);
    if (!canMoveToQuarantine(item)) {
      state.selectedIds.delete(id);
      render();
      return;
    }
    state.selectedIds[target.checked ? "add" : "delete"](id);
    render();
  }
  if (action === "toggle-all-candidates") {
    const items = filteredCandidates().slice(0, state.candidateLimit).filter(canMoveToQuarantine);
    if (target.checked) items.forEach((item) => state.selectedIds.add(item.id));
    else items.forEach((item) => state.selectedIds.delete(item.id));
    render();
  }
  if (action === "select-safe-plan") {
    filteredCandidates()
      .slice(0, state.candidateLimit)
      .filter((item) => canMoveToQuarantine(item) && confidenceLevel(item)[0] === "Alta")
      .forEach((item) => state.selectedIds.add(item.id));
    render();
  }
  if (action === "clear-candidate-selection") {
    state.selectedIds.clear();
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
  if (action === "verify-signature") {
    const item = findCandidate(id) || state.selectedItem;
    if (!item?.path || !isSignablePath(item.path) || state.signatureCache.has(item.path)) return;
    state.signatureLoading.add(item.path);
    render();
    try {
      const result = await api.verifySignature(item.path);
      state.signatureCache.set(item.path, result || { status: "unknown" });
    } catch {
      state.signatureCache.set(item.path, { status: "unknown" });
      setToast({ message: t("signature.unknown"), tone: "warning" });
    } finally {
      state.signatureLoading.delete(item.path);
      render();
    }
    return;
  }
  if (action === "copy-doubt") {
    const context = target.dataset.context || "candidate";
    const item = doubtItemByContext(id, context);
    if (!item) return;
    const text = buildDoubtText(item, context);
    if (!text) return;
    try {
      await api.copyText(text);
      const copiedKey = `${context}:${id}`;
      state.copiedDoubtKey = copiedKey;
      setToast({ message: t("candidates.copyDoubtToast"), tone: "success" });
      setTimeout(() => {
        if (state.copiedDoubtKey !== copiedKey) return;
        state.copiedDoubtKey = "";
        render();
      }, 1800);
    } catch {
      setToast({ message: t("candidates.copyDoubtError"), tone: "warning" });
    }
    return;
  }
  if (action === "open-selected" && state.selectedItem) await showPathWithFeedback(state.selectedItem.path, state.selectedItem);
  if (action === "open-path") await showPathWithFeedback(target.dataset.path);
  if (action === "show-selected" && state.selectedItem) {
    try {
      if (api.pathsExist) {
        const exists = await api.pathsExist([state.selectedItem.path]);
        if (exists[state.selectedItem.path] === false) {
          forgetMissingItemFromUi(state.selectedItem.path, state.selectedItem);
          setToast("Esse item nao existe mais e saiu do relatorio atual.");
          return;
        }
      }
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
    await quarantineItems(selectedCandidateItems());
  }
  if (action === "select-quarantine") {
    state.selectedQuarantineId = id;
    render();
  }
  if (action === "quarantine-filter") {
    state.quarantineFilter = target.dataset.filter || "Ativos";
    state.selectedQuarantineId = "";
    render();
  }
  if (action === "cleanup-quarantine-records") {
    const ok = await confirmModal({
      title: "Limpar registros encerrados",
      message: "Registros já excluídos, restaurados ou ausentes sairão da lista. Isso não apaga nenhum item que ainda esteja em quarentena.",
      confirmText: "Limpar registros",
      icon: "trash"
    });
    if (!ok) return;
    try {
      const result = await api.cleanupQuarantineRecords();
      state.selectedQuarantineId = "";
      state.quarantineFilter = "Ativos";
      await refreshData();
      render();
      setToast(`${result.removed || 0} registro(s) removido(s).`);
    } catch (error) {
      setToast(cleanIpcError(error));
    }
  }
  if (action === "open-quarantine-item") {
    const targetPath = target.dataset.path;
    await showPathWithFeedback(targetPath);
  }
  if (action === "restore-quarantine") {
    const record = state.quarantine.find((entry) => entry.id === id);
    try {
      await api.restoreQuarantine(id);
      if (record?.originalPath) unhidePathFromViews({ path: record.originalPath });
      await refreshData();
      setToast("Item restaurado.");
    } catch (error) {
      setToast(cleanIpcError(error));
    }
  }
  if (action === "delete-quarantine") {
    const record = state.quarantine.find((entry) => entry.id === id);
    const highRisk = elevatedDeletionRisk(record);
    const confirmationWord = highRisk ? "APAGAR" : "EXCLUIR";
    const ok = await confirmModal({
      title: "Excluir permanentemente",
      message: highRisk
        ? "Este item veio de uma área usada por aplicativos. A exclusão exige confirmação reforçada e não pode ser desfeita pelo DiskSnoop."
        : "Esta ação não pode ser desfeita pelo DiskSnoop.",
      details: highRisk ? ["Confira novamente o caminho original antes de continuar."] : [],
      confirmText: "Excluir",
      icon: "trash",
      variant: "danger",
      requireText: confirmationWord
    });
    if (!ok) return;
    if (!(await offerRestorePoint("exclusão permanente"))) return;
    try {
      await api.deletePermanent(id);
      if (record?.originalPath) hidePathFromViews({ path: record.originalPath });
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
  if (action === "apply-ignore-preset") {
    const preset = target.dataset.preset;
    const paths = ignoredPresetCandidates(preset);
    if (!paths.length) {
      setToast("Nenhuma nova pasta para ignorar neste preset.");
      return;
    }
    state.settings.ignoredPaths = [...(state.settings.ignoredPaths || []), ...paths];
    state.settings = await api.saveSettings(state.settings);
    render();
    setToast(`${paths.length} pasta(s) adicionada(s) aos ignorados.`);
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
    await openPathWithFeedback(target.dataset.path);
  }
  if (action === "open-quarantine") {
    const paths = await api.appPaths();
    await openPathWithFeedback(state.settings.quarantinePath || paths.defaultQuarantine);
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
    const ignored = state.settings.ignoredPaths || [];
    await confirmModal({
      title: "Itens ignorados",
      message: ignored.length
        ? `Pastas ignoradas neste perfil: ${ignored.join(" | ")}`
        : "Nenhum item ignorado.",
      confirmText: "Entendi",
      icon: "list"
    });
  }
  if (action === "open-data-folder") {
    const paths = await api.appPaths();
    await openPathWithFeedback(paths.userData);
  }
  if (action === "clear-local-scan") {
    const ok = await confirmModal({
      title: "Limpar último scan local",
      message: "Remove apenas o relatório salvo para abertura rápida. O histórico e os arquivos analisados não serão apagados.",
      confirmText: "Limpar",
      icon: "trash",
      variant: "danger"
    });
    if (!ok) return;
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
    try {
      const snapshot = await api.loadScanSnapshot(id);
      if (!snapshot?.id) {
        await confirmModal({
          title: "Relatório indisponível",
          message: "Este registro existe no histórico, mas o snapshot detalhado não foi encontrado nos dados locais do DiskSnoop.",
          confirmText: "Entendi",
          icon: "clock"
        });
        return;
      }
      state.scanResult = snapshot;
      state.selectedDrive = state.drives.find((drive) => drive.letter === snapshot.drive?.letter) || snapshot.drive || state.selectedDrive;
      state.screen = "app";
      state.tab = "overview";
      state.reportMode = state.history?.[0]?.id === snapshot.id ? "current" : "review";
      state.scanComparison = null;
      state.selectedItem = null;
      state.selectedDuplicateId = "";
      state.selectedIds.clear();
      syncHiddenPathsFromQuarantine();
      localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(snapshot));
      render();
      refreshLoadedScanState().catch(() => {});
      setToast(`Relatório de ${fullDate(snapshot.finishedAt)} carregado.`);
    } catch (error) {
      setToast(`Não foi possível carregar o relatório: ${cleanIpcError(error)}`);
    }
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-modal-input]")) {
    state.modal = { ...state.modal, value: event.target.value, error: "" };
    return;
  }
  if (event.target.matches("select")) {
    if (updateSelectField(event.target) || updateSettingsControl(event.target)) {
      if (isTableFilterField(event.target.dataset.field)) renderTableRefresh(event.target);
      else render();
    }
    return;
  }
  const field = event.target.dataset.field;
  if (!field) return;
  if (field === "search") state.search = event.target.value;
  if (field === "search") state.detailOverlayOpen = false;
  if (field === "fileSearch") {
    state.fileSearch = event.target.value;
    state.detailOverlayOpen = false;
  }
  if (field === "candidateSearch") {
    state.candidateSearch = event.target.value;
    state.candidateLimit = 80;
    state.detailOverlayOpen = false;
  }
  if (field === "duplicateSearch") {
    state.duplicateSearch = event.target.value;
    state.detailOverlayOpen = false;
  }
  if (field === "leftoversSearch") {
    state.leftoversSearch = event.target.value;
    state.leftoversLimit = 80;
    state.detailOverlayOpen = false;
  }
  renderTableRefresh(event.target);
});

document.addEventListener("keydown", (event) => {
  if (!state.detailOverlayOpen) return;
  if (event.key === "Escape") {
    state.detailOverlayOpen = false;
    render();
    return;
  }
  if (event.key !== "Tab") return;
  const panel = $(".detail-overlay-panel");
  const focusable = [...(panel?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
  if (!focusable.length) {
    event.preventDefault();
    panel?.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (document.activeElement === panel) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.dataset.action === "drive-select") {
    state.selectedDrive = state.drives.find((drive) => drive.letter === event.target.value) || state.selectedDrive;
    render();
    return;
  }

  if (event.target.dataset.updatePref) {
    const pref = event.target.dataset.updatePref;
    state.settings.update = {
      ...(state.settings.update || {}),
      [pref]: event.target.checked
    };
    state.settings = normalizeTheme(await api.saveSettings(state.settings));
    await refreshUpdateState();
    render();
    return;
  }

  if (updateSelectField(event.target) || updateSettingsControl(event.target)) {
    if (isTableFilterField(event.target.dataset.field)) renderTableRefresh(event.target);
    else render();
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
  state.reportMode = "current";
  state.scanComparison = null;
  state.selectedItem = null;
  clearHiddenPaths();
  state.selectedIds.clear();
  localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(result));
  await refreshData();
  await refreshLoadedScanState({ toast: false });
});

api.onScanError((payload) => {
  setToast(payload.error || "Erro durante o scan.");
  if (state.screen === "scanning") {
    state.screen = "disks";
    render();
  }
});

if (api.onUpdateState) {
  api.onUpdateState((payload) => {
    state.update = payload;
    if (state.screen === "app") render();
  });
}

loadBasics();
