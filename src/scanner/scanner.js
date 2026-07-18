const fs = require("node:fs/promises");
const fscb = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { isSensitiveWindowsPath } = require("../main/quarantine-safety");

let paused = false;
let cancelled = false;
let config = null;
let lastProgressAt = 0;

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

const safeReviewFolders = new Set(["node_modules", "dist", "build", ".next", ".cache", ".turbo", "coverage", "target", "obj"]);
const devFolders = new Set(["node_modules", ".venv", "dist", "build", ".next", ".turbo", "coverage", "target", "bin", "obj"]);
const installerExtensions = new Set([".exe", ".msi", ".iso"]);
const archiveExtensions = new Set([".zip", ".rar", ".7z"]);
const tempExtensions = new Set([".tmp", ".temp", ".bak", ".old"]);
const MIN_INSTALLER_CANDIDATE_SIZE = 50 * MB;
const MIN_ARCHIVE_CANDIDATE_SIZE = 50 * MB;
const MIN_DOWNLOAD_CANDIDATE_SIZE = 10 * MB;
const MIN_TEMP_CANDIDATE_SIZE = 10 * MB;

const state = {
  files: 0,
  directories: 0,
  skipped: 0,
  mappedBytes: 0,
  candidates: [],
  largeFolders: [],
  duplicateBuckets: new Map(),
  duplicateHashSkipped: 0,
  currentPath: "",
  startedAt: ""
};

function nowIso() {
  return new Date().toISOString();
}

function post(type, payload) {
  if (process.send) process.send({ type, payload });
}

function toLowerPath(value) {
  return String(value || "").toLowerCase();
}

function isSensitive(itemPath) {
  return isSensitiveWindowsPath(itemPath);
}

function ageDays(date) {
  return (Date.now() - date.getTime()) / 86400000;
}

function isOld(date) {
  return ageDays(date) >= config.oldFileDays;
}

function isDownloadsPath(itemPath) {
  return toLowerPath(itemPath).replaceAll("/", "\\").includes("\\downloads\\");
}

function isIgnored(itemPath) {
  const normalized = toLowerPath(path.resolve(itemPath));
  return config.ignoredPaths.some((ignored) => {
    const ignoredPath = toLowerPath(path.resolve(ignored));
    return normalized === ignoredPath || normalized.startsWith(`${ignoredPath}${path.sep}`);
  });
}

function isInsideRoot(itemPath, rootPath) {
  const normalized = toLowerPath(path.resolve(itemPath));
  const root = toLowerPath(path.resolve(rootPath));
  return normalized === root || normalized.startsWith(`${root}${path.sep}`);
}

function scanRoots(rootPath) {
  const included = (config.includedPaths || [])
    .filter(Boolean)
    .filter((itemPath) => isInsideRoot(itemPath, rootPath));
  return included.length ? [...new Set(included)] : [rootPath];
}

async function waitIfPaused() {
  while (paused && !cancelled) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (cancelled) throw new Error("Scan cancelado pelo usuario.");
}

function maybeProgress(force = false) {
  const now = Date.now();
  if (!force && now - lastProgressAt < 350) return;
  lastProgressAt = now;
  const progress = Math.min(96, 8 + Math.floor(Math.log10(state.files + state.directories + 10) * 18));
  post("progress", {
    progress,
    currentPath: state.currentPath,
    files: state.files,
    directories: state.directories,
    skipped: state.skipped,
    mappedBytes: state.mappedBytes,
    candidates: state.candidates.length
  });
}

function securityForPath(itemPath, kind) {
  if (isSensitive(itemPath)) return "Sensivel";
  if (kind === "personal") return "Verificar antes";
  if (kind === "logs" || kind === "temporary") return "Provavel removivel";
  return "Seguro revisar";
}

function addCandidate(candidate) {
  if (!candidate.path || candidate.size <= 0) return;
  if (candidate.security === "Sensivel") return;
  state.candidates.push({
    id: `${candidate.type}-${state.candidates.length}-${Buffer.from(candidate.path).toString("base64").slice(0, 14)}`,
    ...candidate
  });
}

function trackDuplicateCandidate(filePath, stat) {
  const minSize = Number(config.duplicateFileSize || 50 * MB);
  if (stat.size < minSize || isSensitive(filePath)) return;
  const name = path.basename(filePath);
  const key = `${name.toLowerCase()}::${stat.size}`;
  const list = state.duplicateBuckets.get(key) || [];
  list.push({
    id: `dup-file-${Buffer.from(filePath).toString("base64").slice(0, 18)}`,
    name,
    path: filePath,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString()
  });
  state.duplicateBuckets.set(key, list);
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fscb.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on("data", (chunk) => {
      if (cancelled) {
        stream.destroy(new Error("Scan cancelado pelo usuario."));
        return;
      }
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function duplicateGroupFromItems(items, index) {
  const sorted = [...items].sort((a, b) => new Date(b.modifiedAt || 0) - new Date(a.modifiedAt || 0));
  const size = sorted[0]?.size || 0;
  const contentHash = sorted[0]?.contentHash || "";
  const hashConfirmed = Boolean(contentHash);
  return {
    id: hashConfirmed
      ? `duplicate-hash-${index}-${contentHash.slice(0, 16)}`
      : `duplicate-${index}-${Buffer.from(`${sorted[0]?.name || ""}${size}`).toString("base64").slice(0, 12)}`,
    name: sorted[0]?.name || "Arquivo",
    size,
    copies: sorted.length,
    reviewableBytes: size * Math.max(0, sorted.length - 1),
    confidence: hashConfirmed ? "Hash confirmado" : "Possível duplicado",
    contentHash: hashConfirmed ? contentHash : "",
    algorithm: hashConfirmed ? "SHA-256" : "Nome e tamanho",
    reason: hashConfirmed
      ? "Arquivos com mesmo nome, mesmo tamanho e mesmo hash SHA-256. Ainda assim, o DiskSnoop não move nada automaticamente."
      : "Arquivos com mesmo nome e tamanho encontrados em caminhos diferentes. Ative a verificação por hash ou compare o conteúdo antes de mover qualquer cópia.",
    items: sorted
  };
}

async function duplicateGroups() {
  const candidateGroups = [...state.duplicateBuckets.values()]
    .filter((items) => items.length > 1)
    .sort((a, b) => (b[0]?.size || 0) * b.length - (a[0]?.size || 0) * a.length)
    .slice(0, 250);

  if (config.verifyDuplicateHashes === false) {
    return candidateGroups
      .map((items, index) => duplicateGroupFromItems(items, index))
      .sort((a, b) => b.reviewableBytes - a.reviewableBytes)
      .slice(0, 250);
  }

  const groups = [];
  let processed = 0;
  for (const items of candidateGroups) {
    await waitIfPaused();
    processed += 1;
    const byHash = new Map();
    for (const item of items) {
      await waitIfPaused();
      state.currentPath = item.path;
      maybeProgress(true);
      try {
        const contentHash = await hashFile(item.path);
        const hashedItem = { ...item, contentHash };
        const list = byHash.get(contentHash) || [];
        list.push(hashedItem);
        byHash.set(contentHash, list);
      } catch {
        state.duplicateHashSkipped += 1;
      }
    }

    for (const [contentHash, hashedItems] of byHash.entries()) {
      if (hashedItems.length < 2) continue;
      groups.push(duplicateGroupFromItems(hashedItems, processed));
    }
  }

  return groups
    .sort((a, b) => b.reviewableBytes - a.reviewableBytes)
    .slice(0, 250);
}

function summarizeChild(record, child) {
  record.children.push({ name: child.name, path: child.path, size: child.size, type: child.type });
  record.children.sort((a, b) => b.size - a.size);
  if (record.children.length > 8) record.children.length = 8;
}

function folderType(name, dirPath) {
  const lower = name.toLowerCase();
  if (lower === "node_modules") {
    if (config.detectNodeModules === false) return null;
    return { type: "Projetos dev", reason: "Dependencias Node podem ser recriadas com npm install quando o projeto ainda existe." };
  }
  if (lower === ".venv") {
    if (config.detectBuildCaches === false) return null;
    return { type: "Projetos dev", reason: "Ambiente Python local geralmente pode ser recriado a partir das dependencias do projeto." };
  }
  if (["dist", "build", ".next", ".turbo", "coverage", "target", "bin", "obj"].includes(lower)) {
    if (config.detectBuildCaches === false) return null;
    return { type: "Projetos dev", reason: "Pasta de build/cache de projeto; costuma ser recriavel pelo processo de desenvolvimento." };
  }
  if (lower.includes("cache") || lower === ".cache") {
    if (config.detectBuildCaches === false) return null;
    return { type: "Caches", reason: "Cache local detectado. Revise antes, mas normalmente e um dado recriavel." };
  }
  if (isDownloadsPath(dirPath)) {
    if (config.detectOldDownloads === false) return null;
    return { type: "Downloads antigos", reason: "Conteudo na pasta Downloads com idade acima do limite configurado." };
  }
  return null;
}

function fileCandidate(filePath, stat) {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath);
  const modified = stat.mtime;
  const sensitive = isSensitive(filePath);

  if (stat.size >= config.largeFileSize) {
    addCandidate({
      name: base,
      path: filePath,
      size: stat.size,
      modifiedAt: modified.toISOString(),
      type: "Arquivos grandes",
      security: sensitive ? "Sensivel" : "Verificar antes",
      reason: "Arquivo acima do limite configurado para arquivos grandes."
    });
  }

  if (config.detectOldInstallers !== false && installerExtensions.has(ext) && stat.size >= MIN_INSTALLER_CANDIDATE_SIZE && isOld(modified)) {
    addCandidate({
      name: base,
      path: filePath,
      size: stat.size,
      modifiedAt: modified.toISOString(),
      type: "Instaladores antigos",
      security: sensitive ? "Sensivel" : "Seguro revisar",
      reason: "Instalador antigo detectado. Pode estar esquecido apos a instalacao do aplicativo."
    });
  }

  if (config.detectOldArchives !== false && archiveExtensions.has(ext) && stat.size >= MIN_ARCHIVE_CANDIDATE_SIZE && isOld(modified)) {
    addCandidate({
      name: base,
      path: filePath,
      size: stat.size,
      modifiedAt: modified.toISOString(),
      type: "Compactados antigos",
      security: sensitive ? "Sensivel" : "Verificar antes",
      reason: "Arquivo compactado antigo. Revise o conteudo antes de mover para quarentena."
    });
  }

  if (config.detectLogsAndTemps !== false && ((ext === ".log" && stat.size >= 100 * MB && isOld(modified)) || (tempExtensions.has(ext) && stat.size >= MIN_TEMP_CANDIDATE_SIZE))) {
    addCandidate({
      name: base,
      path: filePath,
      size: stat.size,
      modifiedAt: modified.toISOString(),
      type: ext === ".log" ? "Logs grandes" : "Temporarios",
      security: securityForPath(filePath, ext === ".log" ? "logs" : "temporary"),
      reason: ext === ".log" ? "Log antigo e grande detectado." : "Arquivo temporario detectado."
    });
  }

  if (config.detectOldDownloads !== false && isDownloadsPath(filePath) && stat.size >= MIN_DOWNLOAD_CANDIDATE_SIZE && isOld(modified)) {
    addCandidate({
      name: base,
      path: filePath,
      size: stat.size,
      modifiedAt: modified.toISOString(),
      type: "Downloads antigos",
      security: sensitive ? "Sensivel" : "Seguro revisar",
      reason: "Arquivo antigo dentro de Downloads."
    });
  }
}

async function scanDir(dirPath) {
  await waitIfPaused();
  if (isIgnored(dirPath)) return null;

  state.directories += 1;
  state.currentPath = dirPath;
  maybeProgress();

  const record = {
    name: path.basename(dirPath) || dirPath,
    path: dirPath,
    size: 0,
    files: 0,
    type: "Pasta",
    modifiedAt: null,
    children: [],
    risk: isSensitive(dirPath) ? "Sensivel" : "Verificar antes"
  };

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    state.skipped += 1;
    return record;
  }

  for (const entry of entries) {
    await waitIfPaused();
    const fullPath = path.join(dirPath, entry.name);
    state.currentPath = fullPath;

    let stat;
    try {
      stat = await fs.lstat(fullPath);
    } catch {
      state.skipped += 1;
      continue;
    }
    if (stat.isSymbolicLink()) continue;

    if (stat.isDirectory()) {
      const child = await scanDir(fullPath);
      if (!child) continue;
      record.size += child.size;
      record.files += child.files;
      if (!record.modifiedAt || (child.modifiedAt && child.modifiedAt > record.modifiedAt)) record.modifiedAt = child.modifiedAt;
      summarizeChild(record, child);
      continue;
    }

    if (!stat.isFile()) continue;
    state.files += 1;
    state.mappedBytes += stat.size;
    record.size += stat.size;
    record.files += 1;
    if (!record.modifiedAt || stat.mtime > record.modifiedAt) record.modifiedAt = stat.mtime;
    trackDuplicateCandidate(fullPath, stat);
    fileCandidate(fullPath, stat);
    maybeProgress();
  }

  const modifiedAt = record.modifiedAt ? record.modifiedAt.toISOString() : null;
  if (record.size >= config.largeFolderSize) {
    state.largeFolders.push(buildLargeFolderItem(record, state.largeFolders.length, modifiedAt));
  }

  const kind = folderType(record.name, record.path);
  if (kind && (record.size >= 50 * MB || safeReviewFolders.has(record.name.toLowerCase()))) {
    addCandidate({
      name: record.name,
      path: record.path,
      size: record.size,
      modifiedAt,
      type: kind.type,
      security: securityForPath(record.path, "safe"),
      reason: kind.reason,
      children: record.children
    });
  }

  return record;
}

function buildLargeFolderItem(record, index = 0, modifiedAt = null) {
  const sensitive = isSensitive(record?.path);
  return {
    id: `folder-${index}-${Buffer.from(record.path).toString("base64").slice(0, 14)}`,
    name: record.name,
    path: record.path,
    size: record.size,
    files: record.files,
    modifiedAt: modifiedAt || (record.modifiedAt instanceof Date ? record.modifiedAt.toISOString() : record.modifiedAt || null),
    risk: sensitive ? "Sensivel" : record.risk,
    security: sensitive ? "Sensivel" : "Verificar antes",
    reason: sensitive
      ? "Componente protegido mostrado apenas para transparência de uso do disco."
      : "Pasta acima do limite configurado para pastas grandes.",
    children: record.children || []
  };
}

async function start(payload) {
  config = {
    ...payload.settings,
    ignoredPaths: payload.settings.ignoredPaths || [],
    includedPaths: payload.settings.includedPaths || []
  };
  state.startedAt = nowIso();
  post("progress", { progress: 2, currentPath: payload.root, files: 0, directories: 0, skipped: 0, mappedBytes: 0, candidates: 0 });

  try {
    const roots = scanRoots(payload.root);
    const rootSummaries = [];
    for (const rootPath of roots) {
      state.currentPath = rootPath;
      maybeProgress(true);
      const summary = await scanDir(rootPath);
      if (summary) rootSummaries.push(summary);
    }
    state.largeFolders.sort((a, b) => b.size - a.size);
    state.candidates.sort((a, b) => b.size - a.size);
    const result = {
      id: `${Date.now()}`,
      drive: payload.drive,
      root: payload.root,
      startedAt: state.startedAt,
      finishedAt: nowIso(),
      files: state.files,
      directories: state.directories,
      skipped: state.skipped,
      mappedBytes: state.mappedBytes,
      rootSummary: rootSummaries[0] || null,
      scanRoots: roots,
      largeFolders: state.largeFolders.slice(0, 500),
      candidates: state.candidates.slice(0, 1000),
      duplicateGroups: await duplicateGroups(),
      duplicateHashSkipped: state.duplicateHashSkipped
    };
    post("progress", { progress: 100, currentPath: payload.root, files: state.files, directories: state.directories, skipped: state.skipped, mappedBytes: state.mappedBytes, candidates: state.candidates.length });
    if (process.send) process.send({ type: "done", result });
  } catch (error) {
    post("error", { error: error.message });
  }
}

process.on("message", (message) => {
  if (!message || !message.type) return;
  if (message.type === "start") start(message.payload);
  if (message.type === "pause") paused = true;
  if (message.type === "resume") paused = false;
  if (message.type === "cancel") {
    cancelled = true;
    post("error", { error: "Scan cancelado." });
    setTimeout(() => process.exit(0), 20);
  }
});

module.exports = {
  buildLargeFolderItem
};
