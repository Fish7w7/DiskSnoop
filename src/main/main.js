const { app, BrowserWindow, ipcMain, shell, dialog, clipboard, nativeTheme, nativeImage, screen } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const fscb = require("node:fs");
const crypto = require("node:crypto");
const https = require("node:https");
const { execFile } = require("node:child_process");
const { fork } = require("node:child_process");
const { createInstalledAppsInventory } = require("./installed-apps");
const { createAuthenticodeVerifier } = require("./authenticode");
const { createDiskHealthService } = require("./disk-health");
const {
  createElevatedRechecker,
  measurePath,
  parseElevatedRecheckArgs,
  runElevatedWorker,
  validateHandoffPaths
} = require("./elevated-recheck");
const { resolveBootBackground, resolveBootThemePreference } = require("./boot-theme");
const { createTaskbarBadgeController } = require("./taskbar-badge");
const { isSupportedLanguage, resolveInitialLanguage } = require("./system-language");
const candidateSpace = require("../renderer/candidate-space");
const { statIdentity } = require("../scanner/cleanup-context");
const { verifiedReportItem, validateLiveSource, validateQuarantinedItem, validateRestoreDestination, assertCurrentIdentity, removeQuarantinedTree } = require("./quarantine-source");
const {
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  resolveWindowState
} = require("./window-state");
const {
  assertCanCrossVolumeMove,
  assertPermanentDeletionAllowed,
  assertNotInternalPath: assertNotInternalQuarantinePath,
  assertTrustedQuarantineRecord,
  isProtectedAppDataPath,
  isElevatedDeletionRisk,
  isSensitiveWindowsPath,
  pathProtection,
  quarantineFolderName,
  quarantineRecordRoot,
  sameOrInsidePath
} = require("./quarantine-safety");

let autoUpdater = null;
try {
  ({ autoUpdater } = require("electron-updater"));
} catch {
  autoUpdater = null;
}

let mainWindow;
let activeScan = null;
let scanRevision = 0;
let protectedActionCount = 0;
let updateDownload = null;
let autoUpdaterConfigured = false;
let windowStateSaveTimer = null;

app.commandLine.appendSwitch("disable-features", "AutofillServerCommunication,AutofillEnableAccountWalletStorage");
app.setName("DiskSnoop");
app.setAppUserModelId("com.disksnoop.app");

const paths = {
  scanner: path.join(__dirname, "..", "scanner", "scanner.js"),
  renderer: path.join(__dirname, "..", "renderer", "index.html"),
  icon: path.join(__dirname, "..", "assets", "app-icon.ico"),
  badgeScanComplete: path.join(__dirname, "..", "assets", "badge-scan-complete.png")
};

function dataFile(name) {
  return path.join(app.getPath("userData"), name);
}

function loadRendererLocale(locale) {
  try {
    const safeLocale = locale === "en-US" ? "en-US" : "pt-BR";
    const filePath = path.join(__dirname, "..", "renderer", "i18n", `${safeLocale}.json`);
    return JSON.parse(fscb.readFileSync(filePath, "utf8"));
  } catch {
    return { messages: {} };
  }
}

const taskbarBadge = createTaskbarBadgeController({
  nativeImage,
  iconPath: paths.badgeScanComplete,
  translate(locale, key) {
    return loadRendererLocale(locale)?.messages?.[key] || "";
  }
});

ipcMain.on("locale:load", (event, locale) => {
  event.returnValue = loadRendererLocale(locale);
});

const defaultSettings = {
  settingsVersion: 2,
  theme: "light",
  language: "en-US",
  appearance: {
    customAccent: null
  },
  largeFileSize: 1024 * 1024 * 1024,
  largeFolderSize: 2 * 1024 * 1024 * 1024,
  duplicateFileSize: 50 * 1024 * 1024,
  verifyDuplicateHashes: true,
  oldFileDays: 90,
  detectNodeModules: true,
  detectBuildCaches: true,
  detectOldInstallers: true,
  detectOldDownloads: true,
  detectOldArchives: true,
  detectLogsAndTemps: true,
  ignoredPaths: [],
  includedPaths: [],
  quarantinePath: "",
  update: {
    checkOnStartup: true,
    autoDownload: true,
    includeBeta: false,
    preferManual: false,
    ignoredVersion: "",
    remindAfter: ""
  }
};

const updateConfig = {
  owner: "Fish7w7",
  repo: "DiskSnoop",
  releasesApi: "https://api.github.com/repos/Fish7w7/DiskSnoop/releases",
  releasesPage: "https://github.com/Fish7w7/DiskSnoop/releases"
};

async function readJson(fileName, fallback) {
  try {
    const raw = await fs.readFile(dataFile(fileName), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function readRecordList(fileName) {
  try {
    const records = JSON.parse(await fs.readFile(dataFile(fileName), "utf8"));
    if (!Array.isArray(records)) throw new Error("Invalid record format");
    return records;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error("Não foi possível ler os registros locais. Os registros existentes foram preservados.", { cause: error });
  }
}

async function writeJson(fileName, value) {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(dataFile(fileName), JSON.stringify(value, null, 2), "utf8");
  return value;
}

async function writeJsonAtomically(fileName, value) {
  const temporaryFile = `${fileName}-${crypto.randomUUID()}.tmp`;
  try {
    await writeJson(temporaryFile, value);
    await fs.rename(dataFile(temporaryFile), dataFile(fileName));
    return value;
  } catch (error) {
    await fs.rm(dataFile(temporaryFile), { force: true }).catch(() => {});
    throw error;
  }
}

function writeSettings(settings) {
  return writeJsonAtomically("settings.json", settings);
}

async function appendAuditEntry(action, details = {}) {
  try {
    await fs.mkdir(app.getPath("userData"), { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      appVersion: app.getVersion(),
      ...details
    };
    await fs.appendFile(dataFile("audit-log.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.error("DiskSnoop audit log failure:", error);
  }
}

async function getSettings() {
  const saved = await readJson("settings.json", {});
  const languageResolution = resolveInitialLanguage(
    saved.language,
    () => app.getPreferredSystemLanguages()[0],
    defaultSettings.language
  );
  const savedUpdate = saved.update || {};
  const shouldMigrateAutoDownload = saved.settingsVersion !== 2 && savedUpdate.autoDownload === false;
  const settings = {
    ...defaultSettings,
    ...saved,
    settingsVersion: defaultSettings.settingsVersion,
    theme: resolveBootThemePreference(saved.theme ?? defaultSettings.theme),
    language: languageResolution.language,
    appearance: normalizeAppearance(saved.appearance),
    ignoredPaths: Array.isArray(saved.ignoredPaths) ? saved.ignoredPaths : defaultSettings.ignoredPaths,
    includedPaths: Array.isArray(saved.includedPaths) ? saved.includedPaths : defaultSettings.includedPaths,
    update: {
      ...defaultSettings.update,
      ...savedUpdate,
      autoDownload: shouldMigrateAutoDownload
        ? true
        : savedUpdate.autoDownload !== undefined
          ? Boolean(savedUpdate.autoDownload)
          : defaultSettings.update.autoDownload
    }
  };
  if (languageResolution.shouldPersist || (saved.theme && saved.theme !== settings.theme)) {
    await writeSettings(settings);
  }
  return settings;
}

function normalizeAppearance(appearance) {
  const customAccent = typeof appearance?.customAccent === "string" && /^#[0-9a-f]{6}$/i.test(appearance.customAccent)
    ? appearance.customAccent.toLowerCase()
    : null;
  return { customAccent };
}

function runPowerShell(script, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        windowsHide: true,
        timeout: options.timeout || 15000,
        maxBuffer: options.maxBuffer || 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

const installedAppsInventory = createInstalledAppsInventory({ runPowerShell });
const authenticodeVerifier = createAuthenticodeVerifier({ runPowerShell });
const diskHealthService = createDiskHealthService({ runPowerShell });
const recheckPathsElevated = createElevatedRechecker({ app, execFile });

async function getDrives() {
  if (process.platform !== "win32") {
    const root = path.parse(app.getPath("home")).root;
    const stat = await fs.statfs(root);
    const total = stat.blocks * stat.bsize;
    const free = stat.bavail * stat.bsize;
    return [{ letter: root, name: "Sistema", type: "Unknown", total, free, used: total - free, fileSystem: "" }];
  }

  const script = `
$items = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  $letter = $_.DeviceID.TrimEnd(':')
  $media = "Unknown"
  try {
    $disk = Get-Partition -DriveLetter $letter -ErrorAction Stop | Get-Disk -ErrorAction Stop | Select-Object -First 1
    if ($disk.MediaType) { $media = $disk.MediaType.ToString() }
  } catch {}
  [PSCustomObject]@{
    letter = $_.DeviceID
    name = $_.VolumeName
    type = $media
    total = [Int64]$_.Size
    free = [Int64]$_.FreeSpace
    used = [Int64]($_.Size - $_.FreeSpace)
    fileSystem = $_.FileSystem
  }
}
$items | ConvertTo-Json -Depth 3
`;
  try {
    const output = await runPowerShell(script);
    if (!output) return fallbackWindowsDrives();
    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return fallbackWindowsDrives();
  }
}

async function fallbackWindowsDrives() {
  const drives = [];
  for (let code = 67; code <= 90; code += 1) {
    const letter = `${String.fromCharCode(code)}:`;
    try {
      const stat = await fs.statfs(`${letter}\\`);
      const total = stat.blocks * stat.bsize;
      const free = stat.bavail * stat.bsize;
      if (total > 0) {
        drives.push({
          letter,
          name: "Disco local",
          type: "Unknown",
          total,
          free,
          used: total - free,
          fileSystem: ""
        });
      }
    } catch {
      continue;
    }
  }
  return drives;
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function normalizeDriveRoot(letter) {
  if (typeof letter !== "string" || !/^[a-z]:[\\/]?$/i.test(letter)) throw new Error("Volume inválido.");
  return `${letter.slice(0, 2)}\\`;
}

function friendlyFsError(error) {
  if (error?.code === "EBUSY" || error?.code === "ENOTEMPTY") {
    return new Error(`[${error.code}] Item em uso por outro processo.`);
  }
  if (error?.code === "EACCES" || error?.code === "EPERM") {
    return new Error(`[${error.code}] Acesso negado ao mover este item.`);
  }
  return error;
}

function assertNotInternalPath(sourcePath, quarantineRoot) {
  const userData = app.getPath("userData");
  const defaultQuarantine = normalizeQuarantineRoot("");
  assertNotInternalQuarantinePath(sourcePath, { userData, defaultQuarantine, quarantineRoot });
}

async function validateQuarantineSource(item, quarantineRoot) {
  const history = await readJson("history.json", []);
  if (activeScan || !item?.scanId || String(item.scanId) !== String(history[0]?.id)) {
    throw new Error("O relatório não está atualizado. Faça um novo scan antes de mover itens.");
  }
  const snapshot = await findScanSnapshot(item.scanId);
  const source = verifiedReportItem(snapshot?.result, item.path);
  if (!source) throw new Error("Item protegido, de alto risco ou sem verificação atual. Revise o local ou faça um novo scan.");
  assertNotInternalPath(source.path, quarantineRoot);

  const inventory = await installedAppsInventory.load();
  const installed = installedLocations(inventory.apps).some((installLocation) => {
    return sameOrInsidePath(source.path, installLocation)
      || (source.kind === "directory" && sameOrInsidePath(installLocation, source.path));
  });
  if (installed || (source.kind === "directory" && /[\\/]appdata[\\/]/i.test(source.path) && !inventory.appxReliable)) {
    throw new Error("Pasta protegida: aplicativo instalado ou inventário AppX indisponível.");
  }
  return source;
}

function installedLocations(apps) {
  return apps.map(({ installLocation }) => String(installLocation || "").trim())
    .filter((location) => path.isAbsolute(location) && path.normalize(location) !== path.parse(location).root);
}

async function assertSafeQuarantineRecord(record) {
  if (!record?.quarantinePath) throw new Error("Registro de quarentena sem caminho interno.");
  const settings = await getSettings();
  const trustedRoots = [
    normalizeQuarantineRoot(settings.quarantinePath),
    normalizeQuarantineRoot(""),
    record.quarantineRoot
  ].filter(Boolean);
  assertTrustedQuarantineRecord(record, trustedRoots);
}

async function copyFileThenRemove(source, target, sourceStat) {
  let copiedStat;
  try {
    await fs.copyFile(source, target, fscb.constants.COPYFILE_EXCL);
    copiedStat = await fs.lstat(target);
    if (!copiedStat.isFile() || copiedStat.nlink !== 1 || copiedStat.size !== sourceStat.size) {
      throw new Error("A copia de seguranca nao bate com o arquivo original. Nada foi removido.");
    }
    await assertCurrentIdentity(source, sourceStat);
    await assertCurrentIdentity(target, copiedStat);
    await fs.unlink(source);
  } catch (error) {
    if (copiedStat) await assertCurrentIdentity(target, copiedStat).then(() => fs.unlink(target)).catch(() => {});
    throw friendlyFsError(error);
  }
}

async function movePath(source, target, sourceStat, { restoring = false } = {}) {
  await validateRestoreDestination(target);
  await assertCurrentIdentity(source, sourceStat);
  if (restoring && sourceStat.isFile()) {
    try {
      await fs.link(source, target);
    } catch (error) {
      if (!["EXDEV", "ENOTSUP", "EPERM", "ENOSYS"].includes(error.code)) throw friendlyFsError(error);
      return copyFileThenRemove(source, target, sourceStat);
    }
    const isOriginal = (stat) => stat.isFile() && stat.dev === sourceStat.dev && stat.ino === sourceStat.ino
      && stat.birthtimeMs === sourceStat.birthtimeMs && stat.size === sourceStat.size && stat.mtimeMs === sourceStat.mtimeMs;
    try {
      const [current, linked] = await Promise.all([fs.lstat(source), fs.lstat(target)]);
      if (!isOriginal(current) || !isOriginal(linked) || current.nlink !== 2 || linked.nlink !== 2) {
        throw new Error("A origem ou o destino mudou durante a restauração.");
      }
      await fs.unlink(source);
    } catch (error) {
      const retained = await fs.lstat(target).catch(() => null);
      if (retained && isOriginal(retained) && retained.nlink === 2) await fs.unlink(target).catch(() => {});
      throw friendlyFsError(error);
    }
    return;
  }
  try {
    await fs.rename(source, target);
  } catch (error) {
    if (error.code !== "EXDEV") throw friendlyFsError(error);
    await assertCurrentIdentity(source, sourceStat);
    assertCanCrossVolumeMove(sourceStat);
    await copyFileThenRemove(source, target, sourceStat);
  }
}

function normalizeQuarantineRoot(selectedPath) {
  const fallback = path.join(app.getPath("userData"), "Quarantine");
  const base = selectedPath || fallback;
  const normalized = path.normalize(base);
  const folderName = path.basename(normalized).toLowerCase();
  if (folderName === "quarantine" || folderName === "disksnoop quarantine") return normalized;
  return path.join(normalized, "Quarantine");
}

async function listQuarantine() {
  return readRecordList("quarantine.json");
}

async function quarantineRoots(records = []) {
  const settings = await getSettings();
  const roots = new Set([
    normalizeQuarantineRoot(settings.quarantinePath),
    normalizeQuarantineRoot("")
  ]);
  for (const record of records) {
    const recordRoot = quarantineRecordRoot(record);
    if (recordRoot) roots.add(recordRoot);
  }
  return [...roots];
}

async function pathSize(targetPath) {
  try {
    const stat = await fs.lstat(targetPath);
    if (stat.isSymbolicLink()) return 0;
    if (stat.isFile()) return stat.size;
    if (!stat.isDirectory()) return 0;
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      total += await pathSize(path.join(targetPath, entry.name));
    }
    return total;
  } catch {
    return 0;
  }
}

function recoveredQuarantineName(fileName) {
  return fileName.replace(/^\d{10,}-(?:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}|[a-f0-9]+)-/i, "") || fileName;
}

function stableQuarantineId(record) {
  const source = path.normalize(record.quarantinePath || `${record.originalPath || ""}|${record.name || ""}|${record.movedAt || ""}`).toLowerCase();
  return `quarantine-${crypto.createHash("sha1").update(source).digest("hex").slice(0, 20)}`;
}

function ensureUniqueQuarantineIds(records) {
  const seen = new Set();
  let changed = false;
  for (const record of records) {
    const currentId = String(record.id || "");
    if (!currentId || seen.has(currentId)) {
      record.id = stableQuarantineId(record);
      changed = true;
    }
    while (seen.has(record.id)) {
      record.id = `${stableQuarantineId(record)}-${seen.size}`;
      changed = true;
    }
    seen.add(record.id);
  }
  return changed;
}

async function syncedQuarantine() {
  const records = await listQuarantine();
  let changed = ensureUniqueQuarantineIds(records);
  const knownPaths = new Set(records.map((record) => path.normalize(record.quarantinePath || "").toLowerCase()).filter(Boolean));
  const inspectEntry = async (itemPath) => {
    if (!itemPath) return null;
    try { return await fs.lstat(itemPath); }
    catch (error) { return error.code === "ENOENT" || error.code === "ENOTDIR" ? null : undefined; }
  };

  for (const record of [...records]) {
    if (record.quarantinePath && !record.quarantineRoot) {
      const root = path.dirname(record.quarantinePath);
      if (quarantineFolderName(root)) {
        record.quarantineRoot = root;
        changed = true;
      }
    }
    const target = await inspectEntry(record.quarantinePath);
    if (target === undefined) continue;
    if (record.status === "Movimentação pendente") {
      const source = await inspectEntry(record.originalPath);
      if (source === undefined || (source && target)) continue;
      if (source) records.splice(records.indexOf(record), 1);
      else if (target) {
        const identity = statIdentity(target);
        if (target.isSymbolicLink() || !record.sourceIdentity
          || !identity.every((value, index) => index === 4 || value === record.sourceIdentity[index])) continue;
        record.quarantineIdentity = identity;
        record.status = "Em quarentena";
      }
      else {
        record.status = "Arquivo ausente";
        record.missingAt = new Date().toISOString();
      }
      changed = true;
      continue;
    }
    if (target && record.status === "Arquivo ausente") {
      record.status = "Em quarentena";
      delete record.deletedAt;
      delete record.restoredAt;
      delete record.missingAt;
      changed = true;
      continue;
    }
    if (record.status === "Em quarentena" && !target) {
      record.status = "Arquivo ausente";
      record.missingAt = new Date().toISOString();
      changed = true;
    }
  }

  for (const root of await quarantineRoots(records)) {
    let entries = [];
    try {
      const stat = await fs.lstat(root);
      if (!stat.isDirectory() || stat.isSymbolicLink() || candidateSpace.pathKey(await fs.realpath(root)) !== candidateSpace.pathKey(root)) continue;
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(root, entry.name);
      const normalized = path.normalize(fullPath).toLowerCase();
      if (knownPaths.has(normalized)) continue;
      const stat = await fs.lstat(fullPath).catch(() => null);
      if (!stat || stat.isSymbolicLink()) continue;
      const id = `recovered-${Buffer.from(normalized).toString("base64url")}`;
      records.unshift({
        id,
        name: recoveredQuarantineName(entry.name),
        originalPath: "",
        quarantinePath: fullPath,
        size: await pathSize(fullPath),
        movedAt: stat.mtime.toISOString(),
        status: "Em quarentena",
        type: entry.isDirectory() ? "Pasta" : "Arquivo",
        recovered: true
      });
      knownPaths.add(normalized);
      changed = true;
    }
  }

  if (changed) await saveQuarantine(records);
  return records;
}

async function saveQuarantine(items) {
  return writeJsonAtomically("quarantine.json", items);
}

function ipcOk(value) {
  return { ok: true, value };
}

function ipcError(error) {
  return { ok: false, error: error?.message || "Erro inesperado." };
}

async function saveScanSnapshot(result) {
  const snapshots = await readRecordList("scan-snapshots.json");
  snapshots.unshift({
    id: result.id,
    date: result.finishedAt,
    drive: result.drive?.letter || "",
    result
  });
  return writeJsonAtomically("scan-snapshots.json", snapshots.slice(0, 20));
}

async function findScanSnapshot(id) {
  const snapshots = await readJson("scan-snapshots.json", []);
  return snapshots.find((item) => String(item.id) === String(id))
    || snapshots.find((item) => String(item.result?.id) === String(id))
    || null;
}

async function updateLatestHistory(patch) {
  const history = await readRecordList("history.json");
  if (!history.length) return history;
  const hasScanId = Object.prototype.hasOwnProperty.call(patch, "scanId");
  if (hasScanId && !patch.scanId) return history;
  const targetIndex = hasScanId
    ? history.findIndex((item) => String(item.id) === String(patch.scanId))
    : 0;
  if (targetIndex === -1) return history;
  const nextPatch = { ...patch };
  delete nextPatch.scanId;
  history[targetIndex] = {
    ...history[targetIndex],
    ...nextPatch,
    movedToQuarantine: (history[targetIndex].movedToQuarantine || 0) + (patch.movedToQuarantineDelta || 0),
    permanentlyDeleted: (history[targetIndex].permanentlyDeleted || 0) + (patch.permanentlyDeletedDelta || 0),
    restoredFromQuarantine: (history[targetIndex].restoredFromQuarantine || 0) + (patch.restoredFromQuarantineDelta || 0)
  };
  delete history[targetIndex].movedToQuarantineDelta;
  delete history[targetIndex].permanentlyDeletedDelta;
  delete history[targetIndex].restoredFromQuarantineDelta;
  await writeJsonAtomically("history.json", history.slice(0, 50));
  return history;
}

function safeName(name) {
  return String(name || "item").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 80);
}

function versionFromText(value) {
  const match = String(value || "").match(/v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/);
  return match ? match[1] : "";
}

function parseVersion(value) {
  const clean = versionFromText(value);
  if (!clean) return null;
  const [core, prerelease = ""] = clean.split("-");
  const [major = 0, minor = 0, patch = 0] = core.split(".").map((part) => Number(part) || 0);
  return { major, minor, patch, prerelease, raw: clean };
}

function comparePrerelease(left, right) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const a = leftParts[index] || "";
    const b = rightParts[index] || "";
    if (a === b) continue;
    const aNumber = /^\d+$/.test(a) ? Number(a) : NaN;
    const bNumber = /^\d+$/.test(b) ? Number(b) : NaN;
    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return Math.sign(aNumber - bNumber);
    if (Number.isFinite(aNumber)) return -1;
    if (Number.isFinite(bNumber)) return 1;
    return a.localeCompare(b);
  }
  return 0;
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return 0;
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return Math.sign(a[key] - b[key]);
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

function appChannel(settings) {
  return settings?.update?.includeBeta || parseVersion(app.getVersion())?.prerelease ? "Beta" : "Estável";
}

function appBuildMode() {
  if (!app.isPackaged) return "Desenvolvimento";
  if (process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR) return "Portable";
  return "Instalado";
}

function canUseAutoUpdater(settings) {
  return Boolean(autoUpdater && appBuildMode() === "Instalado" && !settings?.update?.preferManual);
}

function isNetworkError(error) {
  return ["ENOTFOUND", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH"].includes(error?.code);
}

function updateStateBase(settings) {
  return {
    status: "idle",
    currentVersion: app.getVersion(),
    latestVersion: "",
    lastCheckAt: "",
    channel: appChannel(settings),
    buildMode: appBuildMode(),
    updateMode: canUseAutoUpdater(settings) ? "auto" : "assisted",
    autoUpdaterAvailable: Boolean(autoUpdater),
    releasesPage: updateConfig.releasesPage,
    release: null,
    asset: null,
    downloaded: null,
    progress: 0,
    error: "",
    ignoredVersion: settings?.update?.ignoredVersion || "",
    remindAfter: settings?.update?.remindAfter || ""
  };
}

async function getUpdateState() {
  const settings = await getSettings();
  const saved = await readJson("update-state.json", {});
  const next = {
    ...updateStateBase(settings),
    ...saved,
    currentVersion: app.getVersion(),
    channel: appChannel(settings),
    buildMode: appBuildMode(),
    updateMode: canUseAutoUpdater(settings) ? "auto" : "assisted",
    autoUpdaterAvailable: Boolean(autoUpdater),
    releasesPage: updateConfig.releasesPage,
    ignoredVersion: settings.update.ignoredVersion || saved.ignoredVersion || "",
    remindAfter: settings.update.remindAfter || saved.remindAfter || ""
  };
  const staleUpdateStatus = ["available", "downloaded", "restart-required", "ignored"].includes(next.status);
  if (next.latestVersion && staleUpdateStatus && compareVersions(next.latestVersion, app.getVersion()) <= 0) {
    return {
      ...next,
      status: "up-to-date",
      latestVersion: app.getVersion(),
      release: null,
      asset: null,
      downloaded: null,
      progress: 0,
      error: "",
      hiddenUntilReminder: false
    };
  }
  return next;
}

async function saveUpdateState(patch) {
  const next = { ...(await getUpdateState()), ...patch };
  await writeJson("update-state.json", next);
  send("update:state", next);
  return next;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        "User-Agent": "DiskSnoop",
        "Accept": "application/vnd.github+json"
      },
      timeout: 15000
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        requestJson(response.headers.location).then(resolve, reject);
        return;
      }
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { raw += chunk; });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`GitHub respondeu com status ${response.statusCode}.`));
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error("A resposta de releases veio em formato invalido."));
        }
      });
    });
    request.on("timeout", () => request.destroy(Object.assign(new Error("Tempo esgotado ao verificar atualizacao."), { code: "ETIMEDOUT" })));
    request.on("error", reject);
  });
}

function selectWindowsAsset(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const scored = assets
    .filter((asset) => asset?.browser_download_url && asset?.name)
    .map((asset) => {
      const name = String(asset.name).toLowerCase();
      let score = 0;
      if (name.endsWith(".exe")) score += 80;
      if (name.endsWith(".msi")) score += 70;
      if (name.endsWith(".zip")) score += 35;
      if (name.includes("disksnoop")) score += 20;
      if (name.includes("win") || name.includes("windows")) score += 15;
      if (name.includes("x64") || name.includes("amd64")) score += 15;
      if (name.includes("blockmap") || name.includes("latest")) score -= 100;
      return { asset, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.asset || null;
}

function normalizeRelease(release) {
  const version = versionFromText(release?.tag_name || release?.name);
  return {
    id: release?.id || "",
    version,
    tag: release?.tag_name || version,
    name: release?.name || release?.tag_name || version,
    url: release?.html_url || updateConfig.releasesPage,
    publishedAt: release?.published_at || "",
    prerelease: Boolean(release?.prerelease),
    body: release?.body || "",
    asset: selectWindowsAsset(release)
  };
}

function normalizeReleaseNotes(notes) {
  if (!notes) return "";
  if (typeof notes === "string") return notes;
  if (Array.isArray(notes)) {
    return notes.map((item) => {
      if (typeof item === "string") return item;
      return item.note || item.notes || item.body || "";
    }).filter(Boolean).join("\n");
  }
  return notes.note || notes.notes || notes.body || "";
}

function installedUpdaterRelease(info = {}) {
  const version = versionFromText(info.version || info.tag || info.releaseName);
  return {
    id: version || info.releaseName || "",
    version,
    tag: info.tag || (version ? `v${version}` : ""),
    name: info.releaseName || (version ? `DiskSnoop ${version}` : "Nova versão"),
    url: updateConfig.releasesPage,
    publishedAt: info.releaseDate || "",
    prerelease: Boolean(parseVersion(version)?.prerelease),
    body: normalizeReleaseNotes(info.releaseNotes),
    asset: null
  };
}

function configureAutoUpdater(settings) {
  if (!autoUpdater || autoUpdaterConfigured) return;
  autoUpdaterConfigured = true;
  // O download automatico fica sob controle do DiskSnoop para respeitar scan/quarentena.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = Boolean(settings?.update?.includeBeta);
  autoUpdater.allowDowngrade = false;

  autoUpdater.on("checking-for-update", () => {
    saveUpdateState({ status: "checking", progress: 0, error: "", lastCheckAt: new Date().toISOString() }).catch(() => {});
  });

  autoUpdater.on("update-available", async (info) => {
    const release = installedUpdaterRelease(info);
    await saveUpdateState({
      status: "available",
      latestVersion: release.version || info.version || "",
      release,
      asset: null,
      downloaded: null,
      progress: 0,
      error: "",
      hiddenUntilReminder: false,
      lastCheckAt: new Date().toISOString()
    }).catch(() => {});
    await maybeDownloadInstalledUpdateAutomatically().catch(() => {});
  });

  autoUpdater.on("update-not-available", () => {
    saveUpdateState({
      status: "up-to-date",
      latestVersion: app.getVersion(),
      release: null,
      asset: null,
      downloaded: null,
      progress: 0,
      error: "",
      hiddenUntilReminder: false,
      lastCheckAt: new Date().toISOString()
    }).catch(() => {});
  });

  autoUpdater.on("download-progress", (progress) => {
    saveUpdateState({
      status: "downloading",
      progress: Math.max(0, Math.min(99, Math.round(progress.percent || 0))),
      error: ""
    }).catch(() => {});
  });

  autoUpdater.on("update-downloaded", (info) => {
    const release = installedUpdaterRelease(info);
    saveUpdateState({
      status: "restart-required",
      latestVersion: release.version || info.version || "",
      release,
      progress: 100,
      downloaded: {
        name: release.name,
        downloadedAt: new Date().toISOString()
      },
      error: ""
    }).catch(() => {});
  });

  autoUpdater.on("error", (error) => {
    saveUpdateState({
      status: isNetworkError(error) ? "offline" : "error",
      progress: 0,
      error: error?.message || "Nao foi possivel atualizar pelo instalador.",
      hiddenUntilReminder: false,
      lastCheckAt: new Date().toISOString()
    }).catch(() => {});
  });
}

async function maybeDownloadInstalledUpdateAutomatically() {
  const settings = await getSettings();
  if (!canUseAutoUpdater(settings) || settings.update.autoDownload === false) return null;
  const state = await getUpdateState();
  if (state.status !== "available") return state;
  if (activeScan) {
    return saveUpdateState({ error: "Atualizacao encontrada. O download automatico ficou aguardando o scan terminar." });
  }
  if (protectedActionCount > 0) {
    return saveUpdateState({ error: "Atualizacao encontrada. O download automatico ficou aguardando a quarentena terminar." });
  }
  return downloadUpdate();
}

async function checkInstalledUpdater(settings) {
  if (!autoUpdater) throw new Error("electron-updater nao esta instalado neste build.");
  configureAutoUpdater(settings);
  autoUpdater.allowPrerelease = Boolean(settings.update.includeBeta);
  autoUpdater.autoDownload = false;
  await saveUpdateState({ status: "checking", progress: 0, error: "", lastCheckAt: new Date().toISOString() });
  try {
    await autoUpdater.checkForUpdates();
    return getUpdateState();
  } catch (error) {
    return saveUpdateState({
      status: isNetworkError(error) ? "offline" : "error",
      progress: 0,
      error: error?.message || "Nao foi possivel verificar atualizacao pelo instalador.",
      hiddenUntilReminder: false,
      lastCheckAt: new Date().toISOString()
    });
  }
}

function chooseLatestRelease(releases, settings) {
  const current = app.getVersion();
  return releases
    .filter((release) => !release.draft)
    .filter((release) => settings.update.includeBeta || !release.prerelease)
    .map(normalizeRelease)
    .filter((release) => release.version && compareVersions(release.version, current) > 0)
    .sort((a, b) => compareVersions(b.version, a.version) || new Date(b.publishedAt) - new Date(a.publishedAt))[0] || null;
}

async function checkForUpdates({ manual = false } = {}) {
  const settings = await getSettings();
  if (canUseAutoUpdater(settings)) return checkInstalledUpdater(settings);
  await saveUpdateState({ status: "checking", progress: 0, error: "", lastCheckAt: new Date().toISOString() });
  try {
    const releases = await requestJson(updateConfig.releasesApi);
    if (!Array.isArray(releases)) throw new Error("A resposta de releases veio em formato invalido.");
    const latest = chooseLatestRelease(releases, settings);
    if (!latest) {
      return saveUpdateState({
        status: "up-to-date",
        latestVersion: app.getVersion(),
        release: null,
        asset: null,
        downloaded: null,
        progress: 0,
        error: "",
        hiddenUntilReminder: false,
        lastCheckAt: new Date().toISOString()
      });
    }

    const ignored = settings.update.ignoredVersion && settings.update.ignoredVersion === latest.version;
    const reminded = settings.update.remindAfter && new Date(settings.update.remindAfter).getTime() > Date.now() && !manual;
    return saveUpdateState({
      status: ignored ? "ignored" : "available",
      latestVersion: latest.version,
      release: latest,
      asset: latest.asset ? {
        name: latest.asset.name,
        size: latest.asset.size || 0,
        url: latest.asset.browser_download_url
      } : null,
      downloaded: null,
      progress: 0,
      error: "",
      ignoredVersion: settings.update.ignoredVersion || "",
      remindAfter: settings.update.remindAfter || "",
      hiddenUntilReminder: reminded,
      lastCheckAt: new Date().toISOString()
    });
  } catch (error) {
    return saveUpdateState({
      status: isNetworkError(error) ? "offline" : "error",
      progress: 0,
      error: isNetworkError(error)
        ? "Sem conexao com a internet ou GitHub indisponivel no momento."
        : (error.message || "Nao foi possivel verificar atualizacao."),
      hiddenUntilReminder: false,
      lastCheckAt: new Date().toISOString()
    });
  }
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const start = (targetUrl) => {
      const request = https.get(targetUrl, { headers: { "User-Agent": "DiskSnoop" }, timeout: 30000 }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          start(response.headers.location);
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Download respondeu com status ${response.statusCode}.`));
          return;
        }
        const total = Number(response.headers["content-length"] || 0);
        let received = 0;
        let lastProgress = 0;
        const stream = fscb.createWriteStream(destination);
        response.on("data", (chunk) => {
          received += chunk.length;
          if (total) {
            const progress = Math.max(1, Math.min(99, Math.round((received / total) * 100)));
            if (progress >= lastProgress + 2 || progress >= 99) {
              lastProgress = progress;
              saveUpdateState({ status: "downloading", progress }).catch(() => {});
            }
          }
        });
        response.pipe(stream);
        stream.on("finish", () => stream.close(resolve));
        stream.on("error", reject);
      });
      updateDownload = request;
      request.on("timeout", () => request.destroy(Object.assign(new Error("Tempo esgotado durante o download."), { code: "ETIMEDOUT" })));
      request.on("error", reject);
    };
    start(url);
  });
}

async function downloadUpdate() {
  if (activeScan) throw new Error("Finalize ou cancele o scan antes de baixar uma atualizacao.");
  if (protectedActionCount > 0) throw new Error("Aguarde a acao de quarentena terminar antes de baixar uma atualizacao.");
  const settings = await getSettings();
  if (canUseAutoUpdater(settings)) {
    configureAutoUpdater(settings);
    await saveUpdateState({ status: "downloading", progress: 0, error: "" });
    try {
      await autoUpdater.downloadUpdate();
      return getUpdateState();
    } catch (error) {
      return saveUpdateState({
        status: isNetworkError(error) ? "offline" : "error",
        progress: 0,
        error: error?.message || "O download pelo instalador foi interrompido."
      });
    }
  }
  const state = await getUpdateState();
  const asset = state.asset;
  if (!asset?.url) throw new Error("Esta release nao tem artefato de Windows disponivel. Abra a pagina de releases para baixar manualmente.");
  const updatesDir = path.join(app.getPath("userData"), "Updates");
  await fs.mkdir(updatesDir, { recursive: true });
  const fileName = `${state.latestVersion || "update"}-${safeName(asset.name)}`;
  const destination = path.join(updatesDir, fileName);
  const tempDestination = `${destination}.download`;
  await fs.rm(tempDestination, { force: true }).catch(() => {});
  await saveUpdateState({ status: "downloading", progress: 0, downloaded: null, error: "" });
  try {
    await downloadFile(asset.url, tempDestination);
    await fs.rename(tempDestination, destination);
    return saveUpdateState({
      status: "downloaded",
      progress: 100,
      downloaded: {
        path: destination,
        name: fileName,
        downloadedAt: new Date().toISOString()
      },
      error: ""
    });
  } catch (error) {
    await fs.rm(tempDestination, { force: true }).catch(() => {});
    return saveUpdateState({
      status: isNetworkError(error) ? "offline" : "error",
      progress: 0,
      error: error.message || "O download foi interrompido."
    });
  } finally {
    updateDownload = null;
  }
}

async function installDownloadedUpdate() {
  const settings = await getSettings();
  if (!canUseAutoUpdater(settings)) throw new Error("Reinicio automatico esta disponivel apenas no canal instalado.");
  if (activeScan) throw new Error("Finalize ou cancele o scan antes de reiniciar para atualizar.");
  if (protectedActionCount > 0) throw new Error("Aguarde a acao de quarentena terminar antes de reiniciar para atualizar.");
  const updateState = await getUpdateState();
  if (updateState.status !== "restart-required") throw new Error("Nenhuma atualizacao baixada esta pronta para instalar.");
  autoUpdater.quitAndInstall(false, true);
  return { ok: true };
}

function currentWindowState(window) {
  if (!window || window.isDestroyed()) return null;
  const bounds = window.getNormalBounds();
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    maximized: window.isMaximized()
  };
}

function saveWindowState(window) {
  const state = currentWindowState(window);
  if (!state) return Promise.resolve();
  return writeJson("window-state.json", state).catch((error) => {
    console.error("DiskSnoop window state save failure:", error);
  });
}

function scheduleWindowStateSave(window) {
  clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = setTimeout(() => {
    windowStateSaveTimer = null;
    void saveWindowState(window);
  }, 250);
}

function saveWindowStateBeforeClose(window) {
  clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = null;
  const state = currentWindowState(window);
  if (!state) return;
  try {
    fscb.mkdirSync(app.getPath("userData"), { recursive: true });
    fscb.writeFileSync(dataFile("window-state.json"), JSON.stringify(state, null, 2), "utf8");
  } catch (error) {
    console.error("DiskSnoop window state final save failure:", error);
  }
}

async function createWindow() {
  const savedSettings = await getSettings();
  const savedWindowState = await readJson("window-state.json", {});
  const primaryDisplay = screen.getPrimaryDisplay();
  const displays = [primaryDisplay, ...screen.getAllDisplays().filter((display) => display.id !== primaryDisplay.id)];
  const initialWindowState = resolveWindowState(savedWindowState, displays);
  const bootTheme = resolveBootThemePreference(savedSettings.theme);
  const bootBackground = resolveBootBackground(bootTheme, nativeTheme.shouldUseDarkColors);
  mainWindow = new BrowserWindow({
    x: initialWindowState.x,
    y: initialWindowState.y,
    width: initialWindowState.width,
    height: initialWindowState.height,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: "DiskSnoop",
    frame: false,
    autoHideMenuBar: true,
    icon: paths.icon,
    backgroundColor: bootBackground,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: process.env.DISKSNOOP_DEVTOOLS === "1"
    }
  });
  mainWindow.setIcon(paths.icon);
  mainWindow.on("focus", () => {
    taskbarBadge.clear(mainWindow);
  });
  mainWindow.on("resize", () => scheduleWindowStateSave(mainWindow));
  mainWindow.on("move", () => scheduleWindowStateSave(mainWindow));
  mainWindow.on("maximize", () => scheduleWindowStateSave(mainWindow));
  mainWindow.on("unmaximize", () => scheduleWindowStateSave(mainWindow));
  mainWindow.on("close", () => saveWindowStateBeforeClose(mainWindow));
  mainWindow.on("closed", () => {
    clearTimeout(windowStateSaveTimer);
    windowStateSaveTimer = null;
    mainWindow = null;
  });
  mainWindow.once("ready-to-show", () => {
    if (!mainWindow?.isDestroyed()) {
      if (initialWindowState.maximized) mainWindow.maximize();
      mainWindow.show();
    }
  });

  await mainWindow.loadFile(paths.renderer, { query: { bootTheme, bootLanguage: savedSettings.language } });
}

const elevatedRecheckMode = parseElevatedRecheckArgs(process.argv);
if (elevatedRecheckMode) {
  app.whenReady().then(async () => {
    try {
      if (!validateHandoffPaths(elevatedRecheckMode.requestFile, elevatedRecheckMode.resultFile, app.getPath("userData"))) {
        throw new Error("Arquivos de handoff fora da pasta de dados do DiskSnoop.");
      }
      await runElevatedWorker(elevatedRecheckMode.requestFile, elevatedRecheckMode.resultFile);
      app.exit(0);
    } catch (error) {
      console.error("DiskSnoop elevated recheck failure:", error);
      app.exit(1);
    }
  });
} else {
  app.whenReady().then(createWindow);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle("drives:list", async () => getDrives());
ipcMain.handle("disk:health", async (_event, driveLetter) => diskHealthService.get(driveLetter));
ipcMain.handle("access:recheckElevated", async (_event, pathsToRecheck = []) => {
  try {
    return ipcOk(await recheckPathsElevated(pathsToRecheck));
  } catch (error) {
    return ipcError(error);
  }
});
ipcMain.handle("window:minimize", async () => mainWindow?.minimize());
ipcMain.handle("window:maximizeToggle", async () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  }
  mainWindow.maximize();
  return true;
});
ipcMain.handle("window:close", async () => mainWindow?.close());
ipcMain.handle("taskbar:testBadge", async () => {
  if (app.isPackaged || !mainWindow || mainWindow.isDestroyed()) return false;
  const settings = await getSettings();
  const shown = taskbarBadge.showForTesting(mainWindow, settings.language);
  if (shown) mainWindow.minimize();
  return shown;
});
ipcMain.handle("settings:get", async () => getSettings());
let settingsSaveQueue = Promise.resolve();

function queueSettingsSave(save) {
  const result = settingsSaveQueue.then(save);
  settingsSaveQueue = result.catch(() => {});
  return result;
}

ipcMain.handle("settings:save", (_event, nextSettings) => queueSettingsSave(async () => {
  const current = await getSettings();
  const settings = {
    ...current,
    ...nextSettings,
    language: isSupportedLanguage(nextSettings?.language) ? nextSettings.language : current.language,
    theme: resolveBootThemePreference(nextSettings?.theme ?? current.theme),
    appearance: normalizeAppearance(nextSettings?.appearance ?? current.appearance),
    update: {
      ...current.update,
      ...(nextSettings?.update || {})
    }
  };
  const saved = await writeSettings(settings);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(resolveBootBackground(saved.theme, nativeTheme.shouldUseDarkColors));
  }
  return saved;
}));
ipcMain.handle("settings:reset", () => queueSettingsSave(async () => {
  const { language } = await getSettings();
  const saved = await writeSettings({ ...defaultSettings, language });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(resolveBootBackground(saved.theme, nativeTheme.shouldUseDarkColors));
  }
  return saved;
}));
ipcMain.handle("history:list", async () => {
  const [history, snapshots] = await Promise.all([
    readJson("history.json", []),
    readJson("scan-snapshots.json", [])
  ]);
  const snapshotIds = new Set(snapshots.flatMap((item) => [String(item.id), String(item.result?.id)].filter(Boolean)));
  return history.map((item) => ({
    ...item,
    snapshotAvailable: snapshotIds.has(String(item.id))
  }));
});
ipcMain.handle("history:clear", () => queueQuarantineAction(async () => {
  if (activeScan) throw new Error("Finalize o scan antes de limpar o histórico.");
  protectedActionCount += 1;
  try {
    await writeJsonAtomically("history.json", []);
    await writeJsonAtomically("scan-snapshots.json", []);
    return [];
  } finally {
    protectedActionCount -= 1;
  }
}));
ipcMain.handle("scan:snapshot", async (_event, id) => {
  const snapshot = await findScanSnapshot(id);
  return snapshot?.result || null;
});
ipcMain.handle("app:paths", async () => {
  const userData = app.getPath("userData");
  const defaultQuarantine = path.join(userData, "Quarantine");
  await fs.mkdir(defaultQuarantine, { recursive: true });
  return {
    userData,
    defaultQuarantine,
    auditLog: dataFile("audit-log.jsonl"),
    isPackaged: app.isPackaged,
    version: app.getVersion(),
    channel: parseVersion(app.getVersion())?.prerelease ? "Beta" : "Estável",
    buildMode: appBuildMode()
  };
});
ipcMain.handle("update:getState", async () => getUpdateState());
ipcMain.handle("update:check", async (_event, payload = {}) => checkForUpdates({ manual: Boolean(payload.manual) }));
ipcMain.handle("update:download", async () => downloadUpdate());
ipcMain.handle("update:installRestart", async () => installDownloadedUpdate());
ipcMain.handle("update:openReleases", async () => {
  await shell.openExternal(updateConfig.releasesPage);
  return { ok: true };
});
ipcMain.handle("update:openRelease", async () => {
  const updateState = await getUpdateState();
  await shell.openExternal(updateState.release?.url || updateConfig.releasesPage);
  return { ok: true };
});
ipcMain.handle("update:openDownloaded", async () => {
  const updateState = await getUpdateState();
  if (!updateState.downloaded?.path || !fscb.existsSync(updateState.downloaded.path)) {
    throw new Error("Arquivo baixado nao encontrado.");
  }
  const result = await shell.openPath(updateState.downloaded.path);
  return result ? { ok: false, error: result } : { ok: true };
});
ipcMain.handle("update:showDownloaded", async () => {
  const updateState = await getUpdateState();
  if (!updateState.downloaded?.path || !fscb.existsSync(updateState.downloaded.path)) {
    throw new Error("Arquivo baixado nao encontrado.");
  }
  shell.showItemInFolder(updateState.downloaded.path);
  return { ok: true };
});
ipcMain.handle("update:ignoreVersion", () => queueSettingsSave(async () => {
  const updateState = await getUpdateState();
  if (!updateState.latestVersion) throw new Error("Nenhuma versao disponivel para ignorar.");
  const settings = await getSettings();
  settings.update.ignoredVersion = updateState.latestVersion;
  await writeSettings(settings);
  return saveUpdateState({ status: "ignored", ignoredVersion: updateState.latestVersion, hiddenUntilReminder: false });
}));
ipcMain.handle("update:rememberLater", () => queueSettingsSave(async () => {
  const settings = await getSettings();
  settings.update.remindAfter = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await writeSettings(settings);
  return saveUpdateState({ remindAfter: settings.update.remindAfter, hiddenUntilReminder: true });
}));
ipcMain.handle("quarantine:list", () => queueQuarantineAction(syncedQuarantine));

ipcMain.handle("path:listContents", async (_event, targetPath) => {
  if (!targetPath) return ipcError(new Error("Caminho ausente."));
  try {
    let listPath = targetPath;
    const targetStat = await fs.lstat(targetPath);
    if (targetStat.isFile()) listPath = path.dirname(targetPath);
    const entries = await fs.readdir(listPath, { withFileTypes: true });
    const items = await Promise.all(entries.slice(0, 300).map(async (entry) => {
      const itemPath = path.join(listPath, entry.name);
      try {
        const stat = await fs.lstat(itemPath);
        return {
          name: entry.name,
          path: itemPath,
          type: entry.isDirectory() ? "Pasta" : "Arquivo",
          size: stat.isFile() ? stat.size : 0,
          modifiedAt: stat.mtime.toISOString()
        };
      } catch {
        return {
          name: entry.name,
          path: itemPath,
          type: entry.isDirectory() ? "Pasta" : "Arquivo",
          size: 0,
          modifiedAt: null
        };
      }
    }));
    return items;
  } catch (error) {
    const reason = error?.code || error?.message || "UNKNOWN";
    return ipcError(new Error(`Não foi possível acessar esta pasta: ${reason}`));
  }
});

ipcMain.handle("path:measureSize", async (_event, targetPath) => {
  if (!targetPath) return ipcError(new Error("Caminho ausente."));
  const result = await measurePath(targetPath);
  if (!result.accessible) return ipcError(new Error(`Não foi possível calcular o tamanho: ${result.error || "UNKNOWN"}`));
  return ipcOk(result);
});

ipcMain.handle("path:existsMany", async (_event, targetPaths = []) => {
  const paths = Array.isArray(targetPaths) ? targetPaths : [];
  const unique = [...new Set(paths.map((item) => String(item || "")).filter(Boolean))].slice(0, 2500);
  return Object.fromEntries(unique.map((itemPath) => [itemPath, fscb.existsSync(itemPath)]));
});

ipcMain.on("path:isProtected", (event, targetPath) => {
  event.returnValue = isSensitiveWindowsPath(targetPath);
});

ipcMain.on("path:protection", (event, targetPath) => {
  event.returnValue = pathProtection(targetPath);
});

ipcMain.on("path:deletionRisk", (event, targetPath) => {
  event.returnValue = isElevatedDeletionRisk({ originalPath: targetPath });
});

ipcMain.handle("apps:listInstalled", async () => installedAppsInventory.load());

ipcMain.handle("clipboard:writeText", async (_event, text) => {
  try {
    clipboard.writeText(String(text || ""));
    return ipcOk(true);
  } catch (error) {
    return ipcError(error);
  }
});

ipcMain.handle("signature:verify", async (_event, filePath) => {
  try {
    return ipcOk(await authenticodeVerifier.verify(String(filePath || "")));
  } catch (error) {
    return ipcError(error);
  }
});

ipcMain.handle("system:createRestorePoint", async () => {
  if (process.platform !== "win32") {
    return ipcError(new Error("Pontos de restauração estão disponíveis apenas no Windows."));
  }
  const description = `DiskSnoop v${app.getVersion()} - antes da quarentena`;
  const script = `
$ErrorActionPreference = "Stop"
Checkpoint-Computer -Description "${description.replaceAll('"', '')}" -RestorePointType "MODIFY_SETTINGS"
[PSCustomObject]@{ ok = $true; description = "${description.replaceAll('"', '')}" } | ConvertTo-Json -Compress
`;
  try {
    const output = await runPowerShell(script, { timeout: 60000 });
    const result = output ? JSON.parse(output) : { ok: true, description };
    await appendAuditEntry("restore-point-created", { description });
    return ipcOk(result);
  } catch (error) {
    await appendAuditEntry("restore-point-failed", { description, error: error.message });
    return ipcError(new Error("O Windows não criou o ponto de restauração. O recurso pode estar desativado, exigir administrador ou já ter criado um ponto recentemente."));
  }
});

ipcMain.handle("path:open", async (_event, targetPath) => {
  if (!targetPath) return { ok: false, error: "Caminho ausente." };
  const result = await shell.openPath(targetPath);
  return result ? { ok: false, error: result } : { ok: true };
});

ipcMain.handle("path:showInFolder", async (_event, targetPath) => {
  if (!targetPath) return { ok: false, error: "Caminho ausente." };
  if (!fscb.existsSync(targetPath)) return { ok: false, error: "Caminho nao encontrado." };
  shell.showItemInFolder(targetPath);
  return { ok: true };
});

ipcMain.handle("dialog:chooseFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory", "createDirectory"] });
  return result.canceled ? "" : result.filePaths[0];
});

ipcMain.handle("dialog:chooseQuarantineFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "Escolha onde criar a quarentena do DiskSnoop"
  });
  if (result.canceled) return "";
  const quarantineRoot = normalizeQuarantineRoot(result.filePaths[0]);
  await fs.mkdir(quarantineRoot, { recursive: true });
  return quarantineRoot;
});

ipcMain.handle("ignore:add", (_event, itemPath) => queueSettingsSave(async () => {
  const settings = await getSettings();
  if (itemPath && !settings.ignoredPaths.includes(itemPath)) {
    settings.ignoredPaths.push(itemPath);
    await writeSettings(settings);
  }
  return settings;
}));

let quarantineActions = Promise.resolve();

function queueQuarantineAction(action) {
  const result = quarantineActions.then(action);
  quarantineActions = result.catch(() => {});
  return result;
}

ipcMain.handle("quarantine:move", (_event, item) => queueQuarantineAction(async () => {
  protectedActionCount += 1;
  const reportRevision = scanRevision;
  try {
    const settings = await getSettings();
    const quarantineRoot = normalizeQuarantineRoot(settings.quarantinePath);
    const source = await validateQuarantineSource(item, quarantineRoot);
    const records = await syncedQuarantine();
    const id = `${Date.now()}-${crypto.randomUUID()}`;
    const target = path.join(quarantineRoot, `${id}-${safeName(path.basename(source.path))}`);
    await validateRestoreDestination(target);
    await fs.mkdir(quarantineRoot, { recursive: true });
    const sourceStat = await validateLiveSource(source);
    if (activeScan || reportRevision !== scanRevision) throw new Error("O relatório mudou. Faça um novo scan antes de mover itens.");
    const record = {
      id,
      name: source.name || path.basename(source.path),
      originalPath: source.path,
      quarantinePath: target,
      quarantineRoot,
      size: sourceStat.isFile() ? sourceStat.size : source.size,
      movedAt: new Date().toISOString(),
      status: "Movimentação pendente",
      sourceIdentity: statIdentity(sourceStat),
      type: source.type || (sourceStat.isDirectory() ? "Pasta" : "Arquivo"),
      scanId: item.scanId || ""
    };
    records.unshift(record);
    await saveQuarantine(records);
    if (activeScan || reportRevision !== scanRevision) throw new Error("O relatório mudou. Faça um novo scan antes de mover itens.");
    await movePath(source.path, target, sourceStat);
    record.quarantineIdentity = statIdentity(await fs.lstat(target));
    record.status = "Em quarentena";
    await saveQuarantine(records);
    await updateLatestHistory({ scanId: record.scanId, movedToQuarantineDelta: record.size }).catch((error) =>
      appendAuditEntry("quarantine-history-update-failed", { scanId: record.scanId, error: error.message }));
    await appendAuditEntry("quarantine-move", {
      result: "success",
      originalPath: record.originalPath,
      quarantinePath: record.quarantinePath,
      size: record.size,
      scanId: record.scanId
    });
    return ipcOk(record);
  } catch (error) {
    await appendAuditEntry("quarantine-move", {
      result: "blocked-or-failed",
      originalPath: item?.path || "",
      size: item?.size || 0,
      scanId: item?.scanId || "",
      error: error.message
    });
    return ipcError(error);
  } finally {
    protectedActionCount = Math.max(0, protectedActionCount - 1);
  }
}));

ipcMain.handle("quarantine:restore", (_event, id) => queueQuarantineAction(async () => {
  protectedActionCount += 1;
  let auditRecord = null;
  try {
    const records = await syncedQuarantine();
    const record = records.find((entry) => entry.id === id);
    auditRecord = record || null;
    if (!record) throw new Error("Item de quarentena nao encontrado.");
    if (record.status !== "Em quarentena") throw new Error("Este item nao esta disponivel para restauracao.");
    if (!record.originalPath) throw new Error("Este item nao tem origem registrada. Abra a quarentena e restaure manualmente.");
    await assertSafeQuarantineRecord(record);
    assertNotInternalPath(record.originalPath, path.dirname(record.quarantinePath));
    if (isSensitiveWindowsPath(record.originalPath) && !isProtectedAppDataPath(record.originalPath)) {
      throw new Error("O caminho original fica em area sensivel. Por seguranca, restaure manualmente pelo Explorer.");
    }
    await validateRestoreDestination(record.originalPath);
    await fs.mkdir(path.dirname(record.originalPath), { recursive: true });
    const sourceStat = await validateQuarantinedItem(record.quarantinePath, { expected: record.quarantineIdentity });
    await movePath(record.quarantinePath, record.originalPath, sourceStat, { restoring: true });
    record.status = "Restaurado";
    record.restoredAt = new Date().toISOString();
    await saveQuarantine(records);
    await updateLatestHistory({ scanId: record.scanId, restoredFromQuarantineDelta: record.size || 0 }).catch((error) =>
      appendAuditEntry("quarantine-history-update-failed", { scanId: record.scanId, error: error.message }));
    await appendAuditEntry("quarantine-restore", {
      result: "success",
      originalPath: record.originalPath,
      quarantinePath: record.quarantinePath,
      size: record.size,
      scanId: record.scanId
    });
    return ipcOk(record);
  } catch (error) {
    await appendAuditEntry("quarantine-restore", {
      result: "blocked-or-failed",
      originalPath: auditRecord?.originalPath || "",
      quarantinePath: auditRecord?.quarantinePath || "",
      error: error.message
    });
    return ipcError(error);
  } finally {
    protectedActionCount = Math.max(0, protectedActionCount - 1);
  }
}));

ipcMain.handle("quarantine:deletePermanent", (event, id) => queueQuarantineAction(async () => {
  protectedActionCount += 1;
  let auditRecord = null;
  try {
    const records = await syncedQuarantine();
    const record = records.find((entry) => entry.id === id);
    auditRecord = record || null;
    if (!record) throw new Error("Item de quarentena nao encontrado.");
    if (record.status !== "Em quarentena") throw new Error("Este item nao esta disponivel para exclusao permanente.");
    await assertSafeQuarantineRecord(record);
    assertPermanentDeletionAllowed(record);
    if (!mainWindow || mainWindow.isDestroyed() || event?.sender !== mainWindow.webContents) throw new Error("A confirmação requer a janela do DiskSnoop.");
    const { language } = await getSettings();
    const messages = loadRendererLocale(language).messages;
    const confirmation = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: messages["cleanup.nativeDeleteTitle"],
      message: messages["cleanup.nativeDeleteMessage"],
      detail: record.quarantinePath,
      buttons: [messages["cleanup.nativeCancel"], messages["cleanup.nativeDelete"]],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) return ipcOk(null);
    const sourceStat = await validateQuarantinedItem(record.quarantinePath, { originalPath: record.originalPath, deleting: true, expected: record.quarantineIdentity });
    await removeQuarantinedTree(record.quarantinePath, sourceStat, record.originalPath);
    if (fscb.existsSync(record.quarantinePath)) {
      throw new Error("O Windows nao confirmou a exclusao do item. Abra a quarentena e revise manualmente.");
    }
    record.status = "Excluido permanentemente";
    record.deletedAt = new Date().toISOString();
    await saveQuarantine(records);
    await updateLatestHistory({ scanId: record.scanId, permanentlyDeletedDelta: record.size || 0 }).catch((error) =>
      appendAuditEntry("quarantine-history-update-failed", { scanId: record.scanId, error: error.message }));
    await appendAuditEntry("quarantine-delete-permanent", {
      result: "success",
      originalPath: record.originalPath,
      quarantinePath: record.quarantinePath,
      size: record.size,
      scanId: record.scanId
    });
    return ipcOk(record);
  } catch (error) {
    await appendAuditEntry("quarantine-delete-permanent", {
      result: "blocked-or-failed",
      originalPath: auditRecord?.originalPath || "",
      quarantinePath: auditRecord?.quarantinePath || "",
      size: auditRecord?.size || 0,
      error: error.message
    });
    return ipcError(error);
  } finally {
    protectedActionCount = Math.max(0, protectedActionCount - 1);
  }
}));

ipcMain.handle("quarantine:forgetMissing", (_event, id) => queueQuarantineAction(async () => {
  try {
    const records = await syncedQuarantine();
    const index = records.findIndex((entry) => entry.id === id);
    if (index === -1) throw new Error("Item de quarentena nao encontrado.");
    if (records[index].status !== "Arquivo ausente") {
      throw new Error("Apenas registros ausentes podem ser removidos.");
    }
    const [record] = records.splice(index, 1);
    await saveQuarantine(records);
    return ipcOk(record);
  } catch (error) {
    return ipcError(error);
  }
}));

ipcMain.handle("quarantine:cleanupRecords", () => queueQuarantineAction(async () => {
  try {
    const records = await syncedQuarantine();
    const kept = records.filter((record) => ["Em quarentena", "Movimentação pendente"].includes(record.status));
    const removed = records.length - kept.length;
    if (removed) await saveQuarantine(kept);
    return ipcOk({ removed });
  } catch (error) {
    return ipcError(error);
  }
}));

ipcMain.handle("scan:start", async (_event, options) => {
  if (protectedActionCount) throw new Error("Finalize a operação de arquivos antes de iniciar o scan.");
  const driveRoot = normalizeDriveRoot(options?.drive?.letter);
  const revision = ++scanRevision;
  if (activeScan) {
    activeScan.kill();
    activeScan = null;
  }

  const settings = await getSettings();
  if (protectedActionCount) throw new Error("Finalize a operação de arquivos antes de iniciar o scan.");
  if (revision !== scanRevision) return { ok: false };
  const worker = fork(paths.scanner, [], { windowsHide: true, stdio: ["pipe", "pipe", "pipe", "ipc"] });
  activeScan = worker;

  worker.on("message", async (message) => {
    if (activeScan !== worker || !message?.type) return;
    if (message.type === "done") {
      try {
        const history = await readRecordList("history.json");
        const freshDrives = await getDrives();
        if (activeScan !== worker) return;
        const freshDrive = freshDrives.find((drive) => drive.letter === options.drive.letter) || options.drive;
        const reviewable = candidateSpace.uniqueBytes(message.result.candidates.filter(candidateSpace.isReviewable));
        message.result.drive = { ...message.result.drive, ...freshDrive };
        await saveScanSnapshot(message.result);
        if (activeScan !== worker) return;
        history.unshift({
          id: message.result.id,
          date: message.result.finishedAt,
          drive: options.drive.letter,
          candidates: message.result.candidates.length,
          duplicates: message.result.duplicateGroups?.length || 0,
          skipped: message.result.skipped || 0,
          reviewable,
          duplicateReviewable: (message.result.duplicateGroups || []).reduce((sum, group) => sum + (group.reviewableBytes || 0), 0),
          usedBefore: options.drive.used,
          freeBefore: options.drive.free,
          usedAfter: freshDrive.used,
          freeAfter: freshDrive.free,
          durationMs: new Date(message.result.finishedAt).getTime() - new Date(message.result.startedAt).getTime(),
          movedToQuarantine: 0,
          restoredFromQuarantine: 0,
          permanentlyDeleted: 0
        });
        await writeJsonAtomically("history.json", history.slice(0, 50));
        if (activeScan !== worker) return;
        send("scan:done", message.result);
        taskbarBadge.markScanCompleteIfUnfocused(mainWindow, settings.language);
      } catch (error) {
        console.error("Scan completion failed:", error);
        if (activeScan === worker) send("scan:error", { error: "Não foi possível concluir o scan com segurança." });
      } finally {
        if (activeScan === worker) activeScan = null;
        if (worker.connected) worker.disconnect();
      }
      return;
    }
    send(`scan:${message.type}`, message.payload);
  });

  worker.on("exit", (code) => {
    if (activeScan !== worker) return;
    if (code !== 0) send("scan:error", { error: "O scanner foi encerrado antes de concluir." });
    activeScan = null;
  });
  worker.on("error", (error) => {
    console.error("Scanner worker failed:", error);
    if (activeScan !== worker) return;
    activeScan = null;
    send("scan:error", { error: "Não foi possível concluir o scan com segurança." });
  });

  const installedRoots = installedLocations(installedAppsInventory.cachedApps());
  worker.send({ type: "start", payload: { drive: options.drive, root: driveRoot, settings: { ...settings, installedRoots } } });
  return { ok: true };
});

ipcMain.handle("scan:control", async (_event, action) => {
  if (!activeScan || !["pause", "resume", "cancel"].includes(action)) return { ok: false };
  activeScan.send({ type: action });
  return { ok: true };
});
