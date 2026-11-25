const fs = require("node:fs/promises");
const fscb = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { isSensitiveWindowsPath } = require("../main/quarantine-safety");
const candidateSpace = require("../renderer/candidate-space");
const { classifyFile, classifyFolder, cacheChildLayout, directoryProtection, directoryContentRestriction, entryNames, protectedContext, statIdentity } = require("./cleanup-context");

let paused = false;
let cancelled = false;
let config = null;
let lastProgressAt = 0;

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

const state = {
  files: 0,
  directories: 0,
  skipped: 0,
  skippedPaths: new Map(),
  mappedBytes: 0,
  candidates: [],
  largeFolders: [],
  duplicateBuckets: new Map(),
  duplicateHashSkipped: 0,
  currentPath: "",
  candidateRunId: "",
  startedAt: ""
};

function nowIso() {
  return new Date().toISOString();
}

function post(type, payload) {
  if (process.send) process.send({ type, payload });
}

function skippedReason(error) {
  const code = String(error?.code || "").trim();
  if (code) return code;
  const message = String(error?.message || "").trim();
  return message || "UNKNOWN";
}

function recordSkippedPath(itemPath, error) {
  state.skipped += 1;
  const normalizedPath = String(itemPath || "").trim();
  if (!normalizedPath) return;
  state.skippedPaths.set(normalizedPath.toLowerCase(), {
    path: normalizedPath,
    reason: skippedReason(error)
  });
}

function toLowerPath(value) {
  return String(value || "").toLowerCase();
}

function isSensitive(itemPath) {
  return isSensitiveWindowsPath(itemPath);
}

function isIgnored(itemPath) {
  return config.ignoredPaths.some((ignored) => isInsideRoot(itemPath, ignored));
}

function isInsideRoot(itemPath, rootPath) {
  const normalized = toLowerPath(path.resolve(itemPath));
  const root = toLowerPath(path.resolve(rootPath));
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return normalized === root || normalized.startsWith(prefix);
}

function scanRoots(rootPath) {
  const requested = (config.includedPaths || []).filter(Boolean);
  if (!requested.length) return [rootPath];
  const included = requested.filter((itemPath) => path.isAbsolute(itemPath) && isInsideRoot(itemPath, rootPath));
  if (!included.length) throw new Error("Nenhuma pasta incluída pertence ao volume selecionado.");
  return candidateSpace.removeCoveredItems(included.map((itemPath) => ({ path: itemPath, kind: "directory" }))).map((item) => item.path);
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

function addCandidate(candidate) {
  if (!candidate.path || candidate.size <= 0) return;
  state.candidates.push({
    id: `candidate-${state.candidateRunId}-${state.candidates.length}`,
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
    modifiedAt: stat.mtime.toISOString(),
    kind: "file",
    identity: statIdentity(stat)
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

function removeRedundantChildCandidates(candidates) {
  return candidateSpace.removeCoveredItems(candidates, (parent, child) => (
    parent.type === child.type
      && candidateSpace.riskLevel(parent) === candidateSpace.riskLevel(child)
      && parent.reasonCode === child.reasonCode
  ));
}

function fileCandidate(filePath, stat, restriction) {
  if (stat.size < Math.min(10 * MB, config.largeFileSize)) return;
  const details = classifyFile(filePath, stat, config);
  if (!details) return;
  addCandidate({
    ...details,
    name: path.basename(filePath),
    path: filePath,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    kind: "file",
    identity: statIdentity(stat),
    isLargeFile: stat.size >= config.largeFileSize,
    ...(restriction && { riskLevel: "protected", restrictionCode: restriction })
  });
}

async function scanDir(dirPath, directoryStat, parentNames, inheritedRestriction = "") {
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
    risk: isSensitive(dirPath) ? "Sensivel" : "Verificar antes",
    identity: statIdentity(directoryStat),
    restriction: inheritedRestriction
  };

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    recordSkippedPath(dirPath, error);
    record.restriction ||= "unverified";
    return record;
  }
  const names = entryNames(entries);
  let cacheChildren;
  const pathRestriction = inheritedRestriction || (config.installedRoots.has(candidateSpace.pathKey(dirPath)) ? "application" : directoryProtection(dirPath, names));
  record.restriction = pathRestriction || directoryContentRestriction(dirPath, names);
  const dependencyRoot = record.name.toLowerCase() === "node_modules";

  for (const entry of entries) {
    await waitIfPaused();
    const fullPath = path.join(dirPath, entry.name);
    state.currentPath = fullPath;

    let stat;
    try {
      stat = await fs.lstat(fullPath);
    } catch (error) {
      recordSkippedPath(fullPath, error);
      record.restriction ||= "unverified";
      continue;
    }
    if (stat.isSymbolicLink()) {
      record.restriction ||= "linkedContent";
      continue;
    }

    if (stat.isDirectory()) {
      const child = await scanDir(fullPath, stat, names, pathRestriction);
      if (!child) {
        record.restriction ||= "unverified";
        continue;
      }
      if (child.restriction) record.restriction ||= "protectedDescendant";
      if (child.cacheLayout !== undefined) (cacheChildren ||= Object.create(null))[entry.name.toLowerCase()] = child.cacheLayout;
      record.size += child.size;
      record.files += child.files;
      if (!record.modifiedAt || (child.modifiedAt && child.modifiedAt > record.modifiedAt)) record.modifiedAt = child.modifiedAt;
      summarizeChild(record, child);
      continue;
    }

    if (!stat.isFile()) {
      record.restriction ||= "unverified";
      continue;
    }
    if (isIgnored(fullPath)) {
      record.restriction ||= "unverified";
      continue;
    }
    state.files += 1;
    state.mappedBytes += stat.size;
    record.size += stat.size;
    record.files += 1;
    if (!record.modifiedAt || stat.mtime > record.modifiedAt) record.modifiedAt = stat.mtime;
    const canBeProtectedFile = /\.(?:exe|msi|sys)$|^(?:bootmgr|bootnxt|ntuser\.dat|usrclass\.dat)/i.test(entry.name);
    const fileRestriction = stat.nlink !== 1 ? "linkedContent"
      : pathRestriction || (dependencyRoot ? "installedDependency" : canBeProtectedFile ? protectedContext(fullPath) : "");
    if (fileRestriction) record.restriction ||= fileRestriction === "linkedContent" ? fileRestriction : "protectedDescendant";
    if (!fileRestriction) trackDuplicateCandidate(fullPath, stat);
    fileCandidate(fullPath, stat, fileRestriction);
    maybeProgress();
  }

  const modifiedAt = record.modifiedAt ? record.modifiedAt.toISOString() : null;
  record.cacheLayout = cacheChildLayout(record.name.toLowerCase(), entries, cacheChildren);
  const details = classifyFolder(record.path, config, {
    names,
    parentNames,
    entries,
    children: cacheChildren || {},
    modifiedAt: record.modifiedAt,
    protectedReason: pathRestriction
  });
  if (record.size >= config.largeFolderSize) {
    state.largeFolders.push(buildLargeFolderItem(record, state.largeFolders.length, modifiedAt, details));
  }
  const recognizedCache = details?.type === "Caches" && !["unknownCache", "npmRoot"].includes(details.reasonCode);
  const minSize = recognizedCache || details?.type === "Componentes" ? 10 * MB : 50 * MB;
  if (details && (record.size >= minSize || details.type === "Projetos dev")) {
    addCandidate({
      ...details,
      name: record.name,
      path: record.path,
      size: record.size,
      files: record.files,
      modifiedAt,
      kind: "directory",
      identity: record.identity,
      ...(record.restriction && { riskLevel: "protected", restrictionCode: record.restriction }),
      children: record.children
    });
  }

  return record;
}

function buildLargeFolderItem(record, index = 0, modifiedAt = null, details = null) {
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
    kind: "directory",
    identity: record.identity,
    ...(details && { riskLevel: details.riskLevel }),
    ...(record.restriction && { riskLevel: "protected", restrictionCode: record.restriction }),
    reason: sensitive
      ? "Componente protegido mostrado apenas para transparência de uso do disco."
      : "Pasta acima do limite configurado para pastas grandes.",
    children: record.children || []
  };
}

async function inspectScanRoot(rootPath) {
  const stat = await fs.lstat(rootPath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("A raiz do scan precisa ser uma pasta real.");
  }
  if (candidateSpace.pathKey(await fs.realpath(rootPath)) !== candidateSpace.pathKey(rootPath)) {
    throw new Error("A raiz do scan aponta para outro local.");
  }
  let parent = path.dirname(rootPath);
  if (parent === rootPath) return scanDir(rootPath, stat);

  let parentNames;
  let restriction = "";
  for (let current = parent; current !== path.dirname(current); current = path.dirname(current)) {
    const parentStat = await fs.lstat(current);
    if (parentStat.isSymbolicLink()) throw new Error("A raiz do scan passa por um link ou junction.");
    const names = entryNames(await fs.readdir(current, { withFileTypes: true }));
    if (current === parent) parentNames = names;
    restriction ||= config.installedRoots.has(candidateSpace.pathKey(current)) ? "application" : directoryProtection(current, names);
  }
  return scanDir(rootPath, stat, parentNames, restriction);
}

async function start(payload) {
  config = {
    ...payload.settings,
    ignoredPaths: payload.settings.ignoredPaths || [],
    includedPaths: payload.settings.includedPaths || [],
    installedRoots: new Set((payload.settings.installedRoots || []).map(candidateSpace.pathKey))
  };
  state.candidateRunId = crypto.randomBytes(8).toString("hex");
  state.startedAt = nowIso();
  post("progress", { progress: 2, currentPath: payload.root, files: 0, directories: 0, skipped: 0, mappedBytes: 0, candidates: 0 });

  try {
    const roots = scanRoots(payload.root);
    const rootSummaries = [];
    for (const rootPath of roots) {
      state.currentPath = rootPath;
      maybeProgress(true);
      try {
        const summary = await inspectScanRoot(rootPath);
        if (summary) rootSummaries.push(summary);
      } catch (error) {
        if (cancelled) throw error;
        recordSkippedPath(rootPath, error);
      }
    }
    state.largeFolders.sort((a, b) => b.size - a.size);
    state.candidates = removeRedundantChildCandidates(state.candidates);
    state.candidates.sort((a, b) => Number(a.riskLevel === "protected") - Number(b.riskLevel === "protected") || b.size - a.size);
    const result = {
      cleanupVersion: candidateSpace.CLEANUP_CONTEXT_VERSION,
      id: `${Date.now()}`,
      drive: payload.drive,
      root: payload.root,
      startedAt: state.startedAt,
      finishedAt: nowIso(),
      files: state.files,
      directories: state.directories,
      skipped: state.skipped,
      skippedPaths: [...state.skippedPaths.values()],
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
  buildLargeFolderItem,
  removeRedundantChildCandidates,
  recordSkippedPath,
  isInsideRoot,
  skippedReason
};
