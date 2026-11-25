const fs = require("node:fs/promises");
const path = require("node:path");
const { CLEANUP_CONTEXT_VERSION, pathKey, riskLevel } = require("../renderer/candidate-space");
const { classifyFolder, cacheChildLayout, directoryProtection, directoryContentRestriction, entryNames, protectedContext, statIdentity } = require("../scanner/cleanup-context");

function verifiedReportItem(report, requestedPath) {
  if (report?.cleanupVersion !== CLEANUP_CONTEXT_VERSION || typeof requestedPath !== "string" || !requestedPath) return null;
  const key = pathKey(requestedPath);
  const matches = [
    ...(report.candidates || []),
    ...(report.largeFolders || []),
    ...(report.duplicateGroups || []).flatMap((group) => group.items || [])
  ].filter((item) => pathKey(item.path) === key);
  if (matches.some((item) => ["protected", "high"].includes(riskLevel(item)))) return null;
  // A case-folded key is useful for checking restrictions but is not an item identity.
  return matches.find((item) => item.identity && item.kind && path.normalize(item.path) === path.normalize(requestedPath)) || null;
}

function requireLiteralPath(itemPath) {
  const relative = itemPath.slice(path.parse(itemPath).root.length);
  if (!path.isAbsolute(itemPath) || !relative || /^\\\\[.?]\\/.test(itemPath)
    || relative.split(/[\\/]/).some((part) => part === "." || part === ".." || /[:. ]$/.test(part) || part.includes(":"))) {
    throw new Error("Caminho protegido ou fora do formato esperado.");
  }
}

function assertPlainItem(stat) {
  if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink !== 1) || (!stat.isFile() && !stat.isDirectory())) {
    throw new Error("Item protegido: link simbólico, junction, hard link ou tipo de arquivo especial.");
  }
}

async function checkAncestors(itemPath, { checkContext = false, allowMissing = false } = {}) {
  const root = path.parse(itemPath).root;
  let parentNames;
  for (let current = path.dirname(itemPath); current !== root; current = path.dirname(current)) {
    const stat = await fs.lstat(current).catch((error) => {
      if (allowMissing && error.code === "ENOENT") return null;
      throw error;
    });
    if (!stat) continue;
    assertPlainItem(stat);
    if (!stat.isDirectory() || pathKey(await fs.realpath(current)) !== pathKey(current)) {
      throw new Error("O caminho passa por um local protegido ou redirecionado.");
    }
    if (checkContext) {
      const names = entryNames(await fs.readdir(current, { withFileTypes: true }));
      parentNames ??= names;
      if (directoryProtection(current, names)) throw new Error("O item pertence a uma pasta protegida do Windows, aplicativo ou runtime.");
    }
  }
  return parentNames;
}

async function inspectTree(physicalPath, originalPath, stat, checkContext) {
  assertPlainItem(stat);
  if (checkContext && protectedContext(originalPath)) {
    throw new Error("O item contém ou pertence a um componente protegido do Windows, aplicativo ou runtime.");
  }
  if (!stat.isDirectory()) return { bytes: stat.size, files: 1, modifiedAt: +stat.mtime };

  const entries = await fs.readdir(physicalPath, { withFileTypes: true });
  const names = checkContext ? entryNames(entries) : null;
  if (checkContext) {
    if (directoryProtection(originalPath, names) || directoryContentRestriction(originalPath, names)) {
      throw new Error("A pasta contém um aplicativo, runtime, perfil persistente ou outro componente protegido.");
    }
  }
  const footprint = { bytes: 0, files: 0, modifiedAt: -Infinity };
  let children;
  for (const entry of entries) {
    const child = path.join(physicalPath, entry.name);
    const childStat = await fs.lstat(child);
    const childFootprint = await inspectTree(child, path.join(originalPath, entry.name), childStat, checkContext);
    if (childFootprint.cacheLayout !== undefined) (children ||= Object.create(null))[entry.name.toLowerCase()] = childFootprint.cacheLayout;
    footprint.bytes += childFootprint.bytes;
    footprint.files += childFootprint.files;
    footprint.modifiedAt = Math.max(footprint.modifiedAt, childFootprint.modifiedAt);
  }
  if (checkContext) {
    footprint.names = names;
    footprint.entries = entries;
    footprint.cacheChildren = children;
    footprint.cacheLayout = cacheChildLayout(path.basename(originalPath).toLowerCase(), entries, children);
  }
  return footprint;
}

function assertIdentity(stat, expected) {
  const actual = statIdentity(stat);
  if (!Array.isArray(expected) || expected.length !== actual.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error("O item mudou desde a análise. Faça um novo scan antes de mover para quarentena.");
  }
}

async function assertCurrentIdentity(itemPath, expected) {
  await checkAncestors(itemPath);
  const current = await fs.lstat(itemPath);
  assertPlainItem(current);
  assertIdentity(current, statIdentity(expected));
}

async function removeQuarantinedTree(itemPath, expected, originalPath) {
  await assertCurrentIdentity(itemPath, expected);
  async function remove(currentPath, original, stat) {
    assertPlainItem(stat);
    if (protectedContext(original)) throw new Error("O item contém um componente protegido.");
    if (!stat.isDirectory()) return fs.unlink(currentPath);
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const names = entryNames(entries);
    if (directoryProtection(original, names) || directoryContentRestriction(original, names)) throw new Error("O item contém um componente protegido.");
    assertIdentity(await fs.lstat(currentPath), statIdentity(stat));
    for (const entry of entries) {
      const childPath = path.join(currentPath, entry.name);
      await remove(childPath, path.join(original, entry.name), await fs.lstat(childPath));
    }
    await fs.rmdir(currentPath);
  }
  await remove(itemPath, originalPath, expected);
}

async function validateLiveSource(item) {
  requireLiteralPath(item.path);
  const parentNames = await checkAncestors(item.path, { checkContext: true });
  const stat = await fs.lstat(item.path);
  assertPlainItem(stat);
  if ((stat.isDirectory() ? "directory" : "file") !== item.kind || pathKey(await fs.realpath(item.path)) !== pathKey(item.path)) {
    throw new Error("O tipo ou destino do caminho mudou. Faça um novo scan.");
  }
  assertIdentity(stat, item.identity);
  const footprint = await inspectTree(item.path, item.path, stat, true);
  if (stat.isDirectory() && item.riskLevel === "low" && item.reasonCode) {
    const live = classifyFolder(item.path, {}, { parentNames, names: footprint.names, entries: footprint.entries, children: footprint.cacheChildren || {} });
    if (live?.riskLevel !== "low" || live.reasonCode !== item.reasonCode) {
      throw new Error("O conteúdo da pasta mudou desde a análise. Faça um novo scan antes de mover para quarentena.");
    }
  }
  if (stat.isDirectory() && (footprint.bytes !== item.size || footprint.files !== item.files
    || footprint.modifiedAt !== (item.modifiedAt ? Date.parse(item.modifiedAt) : -Infinity))) {
    throw new Error("O conteúdo da pasta mudou desde a análise. Faça um novo scan antes de mover para quarentena.");
  }
  assertIdentity(await fs.lstat(item.path), item.identity);
  return stat;
}

async function validateQuarantinedItem(itemPath, { originalPath, deleting = false, expected } = {}) {
  requireLiteralPath(itemPath);
  await checkAncestors(itemPath);
  const stat = await fs.lstat(itemPath);
  if (expected) assertIdentity(stat, expected);
  if (pathKey(await fs.realpath(itemPath)) !== pathKey(itemPath)) throw new Error("O item de quarentena aponta para outro local.");
  await inspectTree(itemPath, originalPath || itemPath, stat, deleting);
  assertIdentity(await fs.lstat(itemPath), statIdentity(stat));
  return stat;
}

async function validateRestoreDestination(itemPath) {
  requireLiteralPath(itemPath);
  await checkAncestors(itemPath, { allowMissing: true });
  try {
    await fs.lstat(itemPath);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("O caminho original já existe. Restauração manual recomendada.");
}

module.exports = { verifiedReportItem, validateLiveSource, validateQuarantinedItem, validateRestoreDestination, assertCurrentIdentity, removeQuarantinedTree };
