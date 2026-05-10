const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const fscb = require("node:fs");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { fork } = require("node:child_process");

let mainWindow;
let activeScan = null;

app.commandLine.appendSwitch("disable-features", "AutofillServerCommunication,AutofillEnableAccountWalletStorage");
app.setName("DiskSnoop");
app.setAppUserModelId("com.disksnoop.app");

const paths = {
  scanner: path.join(__dirname, "..", "scanner", "scanner.js"),
  renderer: path.join(__dirname, "..", "renderer", "index.html"),
  icon: path.join(__dirname, "..", "assets", "app-icon.ico")
};

function dataFile(name) {
  return path.join(app.getPath("userData"), name);
}

const defaultSettings = {
  theme: "light",
  largeFileSize: 1024 * 1024 * 1024,
  largeFolderSize: 2 * 1024 * 1024 * 1024,
  duplicateFileSize: 50 * 1024 * 1024,
  oldFileDays: 90,
  detectNodeModules: true,
  detectBuildCaches: true,
  detectOldInstallers: true,
  detectOldDownloads: true,
  detectOldArchives: true,
  detectLogsAndTemps: true,
  suggestDForC: true,
  ignoredPaths: [],
  includedPaths: [],
  quarantinePath: ""
};

async function readJson(fileName, fallback) {
  try {
    const raw = await fs.readFile(dataFile(fileName), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(fileName, value) {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(dataFile(fileName), JSON.stringify(value, null, 2), "utf8");
  return value;
}

async function getSettings() {
  return { ...defaultSettings, ...(await readJson("settings.json", {})) };
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 },
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
  if (!letter) return "";
  return letter.endsWith("\\") ? letter : `${letter}\\`;
}

function friendlyFsError(error) {
  if (["EPERM", "EACCES", "EBUSY", "ENOTEMPTY"].includes(error?.code)) {
    return new Error("O Windows bloqueou o acesso a este item. Ele pode estar protegido, em uso ou exigir permissoes de administrador.");
  }
  return error;
}

async function copyThenRemove(source, target) {
  try {
    const stat = await fs.lstat(source);
    if (stat.isDirectory()) {
      await fs.cp(source, target, { recursive: true, errorOnExist: false, force: false });
      await fs.rm(source, { recursive: true, force: true });
      return;
    }
    await fs.copyFile(source, target, fscb.constants.COPYFILE_EXCL);
    await fs.rm(source, { force: true });
  } catch (error) {
    await fs.rm(target, { recursive: true, force: true }).catch(() => {});
    throw friendlyFsError(error);
  }
}

async function movePath(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    await fs.rename(source, target);
  } catch (error) {
    try {
      if (error.code !== "EXDEV") throw friendlyFsError(error);
      await copyThenRemove(source, target);
    } catch (moveError) {
      await fs.rm(target, { recursive: true, force: true }).catch(() => {});
      throw moveError;
    }
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
  return readJson("quarantine.json", []);
}

async function quarantineRoots(records = []) {
  const settings = await getSettings();
  const roots = new Set([
    normalizeQuarantineRoot(settings.quarantinePath),
    normalizeQuarantineRoot("")
  ]);
  for (const record of records) {
    if (record.quarantinePath) roots.add(path.dirname(record.quarantinePath));
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
  return fileName.replace(/^\d{10,}-[a-f0-9]+-/i, "") || fileName;
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

  for (const record of records) {
    const existsInQuarantine = record.quarantinePath && fscb.existsSync(record.quarantinePath);
    if (existsInQuarantine && record.status !== "Em quarentena") {
      record.status = "Em quarentena";
      delete record.deletedAt;
      delete record.restoredAt;
      delete record.missingAt;
      changed = true;
      continue;
    }
    if (record.status === "Em quarentena" && !existsInQuarantine) {
      record.status = "Arquivo ausente";
      record.missingAt = new Date().toISOString();
      changed = true;
    }
  }

  for (const root of await quarantineRoots(records)) {
    let entries = [];
    try {
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
  return writeJson("quarantine.json", items);
}

function ipcOk(value) {
  return { ok: true, value };
}

function ipcError(error) {
  return { ok: false, error: error?.message || "Erro inesperado." };
}

async function saveScanSnapshot(result) {
  const snapshots = await readJson("scan-snapshots.json", []);
  snapshots.unshift({
    id: result.id,
    date: result.finishedAt,
    drive: result.drive?.letter || "",
    result
  });
  return writeJson("scan-snapshots.json", snapshots.slice(0, 20));
}

async function findScanSnapshot(id) {
  const snapshots = await readJson("scan-snapshots.json", []);
  return snapshots.find((item) => String(item.id) === String(id))
    || snapshots.find((item) => String(item.result?.id) === String(id))
    || null;
}

async function updateLatestHistory(patch) {
  const history = await readJson("history.json", []);
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
  await writeJson("history.json", history.slice(0, 50));
  return history;
}

function safeName(name) {
  return String(name || "item").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 80);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 700,
    title: "DiskSnoop",
    frame: false,
    autoHideMenuBar: true,
    icon: paths.icon,
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: process.env.DISKSNOOP_DEVTOOLS === "1"
    }
  });
  mainWindow.setIcon(paths.icon);

  await mainWindow.loadFile(paths.renderer);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle("drives:list", async () => getDrives());
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
ipcMain.handle("settings:get", async () => getSettings());
ipcMain.handle("settings:save", async (_event, nextSettings) => {
  const settings = { ...(await getSettings()), ...nextSettings };
  return writeJson("settings.json", settings);
});
ipcMain.handle("settings:reset", async () => writeJson("settings.json", defaultSettings));
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
ipcMain.handle("history:clear", async () => {
  await writeJson("history.json", []);
  await writeJson("scan-snapshots.json", []);
  return [];
});
ipcMain.handle("scan:snapshot", async (_event, id) => {
  const snapshot = await findScanSnapshot(id);
  return snapshot?.result || null;
});
ipcMain.handle("app:paths", async () => {
  const userData = app.getPath("userData");
  const defaultQuarantine = path.join(userData, "Quarantine");
  await fs.mkdir(defaultQuarantine, { recursive: true });
  return { userData, defaultQuarantine, isPackaged: app.isPackaged };
});
ipcMain.handle("quarantine:list", async () => syncedQuarantine());

ipcMain.handle("path:listContents", async (_event, targetPath) => {
  if (!targetPath) return [];
  let listPath = targetPath;
  try {
    const targetStat = await fs.lstat(targetPath);
    if (targetStat.isFile()) listPath = path.dirname(targetPath);
  } catch {
    return [];
  }
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
  return items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "Pasta" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
});

ipcMain.handle("apps:listInstalled", async () => {
  if (process.platform !== "win32") return [];
  const script = `
$paths = @(
  "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
  "HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
  "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
)
$paths | ForEach-Object {
  Get-ItemProperty $_ -ErrorAction SilentlyContinue
} | Where-Object { $_.DisplayName } | Select-Object DisplayName, DisplayVersion, Publisher, InstallLocation | ConvertTo-Json -Depth 3
`;
  try {
    const output = await runPowerShell(script);
    if (!output) return [];
    const parsed = JSON.parse(output);
    return (Array.isArray(parsed) ? parsed : [parsed]).map((appInfo) => ({
      name: appInfo.DisplayName || "",
      version: appInfo.DisplayVersion || "",
      publisher: appInfo.Publisher || "",
      installLocation: appInfo.InstallLocation || ""
    }));
  } catch {
    return [];
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

ipcMain.handle("ignore:add", async (_event, itemPath) => {
  const settings = await getSettings();
  if (itemPath && !settings.ignoredPaths.includes(itemPath)) {
    settings.ignoredPaths.push(itemPath);
    await writeJson("settings.json", settings);
  }
  return settings;
});

ipcMain.handle("quarantine:move", async (_event, item) => {
  try {
    const settings = await getSettings();
    const quarantineRoot = normalizeQuarantineRoot(settings.quarantinePath);
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const target = path.join(quarantineRoot, `${id}-${safeName(path.basename(item.path))}`);
    await movePath(item.path, target);
    const records = await syncedQuarantine();
    const record = {
      id,
      name: item.name || path.basename(item.path),
      originalPath: item.path,
      quarantinePath: target,
      size: item.size || 0,
      movedAt: new Date().toISOString(),
      status: "Em quarentena",
      type: item.type || "Item",
      scanId: item.scanId || ""
    };
    records.unshift(record);
    await saveQuarantine(records);
    await updateLatestHistory({ scanId: record.scanId, movedToQuarantineDelta: record.size });
    return ipcOk(record);
  } catch (error) {
    return ipcError(error);
  }
});

ipcMain.handle("quarantine:restore", async (_event, id) => {
  try {
    const records = await syncedQuarantine();
    const record = records.find((entry) => entry.id === id);
    if (!record) throw new Error("Item de quarentena nao encontrado.");
    if (record.status !== "Em quarentena") throw new Error("Este item nao esta disponivel para restauracao.");
    if (!record.originalPath) throw new Error("Este item nao tem origem registrada. Abra a quarentena e restaure manualmente.");
    if (!fscb.existsSync(record.quarantinePath)) {
      record.status = "Arquivo ausente";
      record.missingAt = new Date().toISOString();
      await saveQuarantine(records);
      throw new Error("O arquivo nao existe mais na pasta de quarentena. O registro foi marcado como ausente.");
    }
    if (fscb.existsSync(record.originalPath)) {
      throw new Error("O caminho original ja existe. Restauracao manual recomendada.");
    }
    await fs.mkdir(path.dirname(record.originalPath), { recursive: true });
    await movePath(record.quarantinePath, record.originalPath);
    record.status = "Restaurado";
    record.restoredAt = new Date().toISOString();
    await saveQuarantine(records);
    await updateLatestHistory({ scanId: record.scanId, restoredFromQuarantineDelta: record.size || 0 });
    return ipcOk(record);
  } catch (error) {
    return ipcError(error);
  }
});

ipcMain.handle("quarantine:deletePermanent", async (_event, id) => {
  try {
    const records = await syncedQuarantine();
    const record = records.find((entry) => entry.id === id);
    if (!record) throw new Error("Item de quarentena nao encontrado.");
    if (record.status !== "Em quarentena") throw new Error("Este item nao esta disponivel para exclusao permanente.");
    await fs.rm(record.quarantinePath, { recursive: true, force: true });
    if (fscb.existsSync(record.quarantinePath)) {
      throw new Error("O Windows nao confirmou a exclusao do item. Abra a quarentena e revise manualmente.");
    }
    record.status = "Excluido permanentemente";
    record.deletedAt = new Date().toISOString();
    await saveQuarantine(records);
    await updateLatestHistory({ scanId: record.scanId, permanentlyDeletedDelta: record.size || 0 });
    return ipcOk(record);
  } catch (error) {
    return ipcError(error);
  }
});

ipcMain.handle("quarantine:forgetMissing", async (_event, id) => {
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
});

ipcMain.handle("quarantine:cleanupRecords", async () => {
  try {
    const records = await syncedQuarantine();
    const kept = records.filter((record) => record.status === "Em quarentena");
    const removed = records.length - kept.length;
    if (removed) await saveQuarantine(kept);
    return ipcOk({ removed });
  } catch (error) {
    return ipcError(error);
  }
});

ipcMain.handle("scan:start", async (_event, options) => {
  if (activeScan) {
    activeScan.kill();
    activeScan = null;
  }

  const settings = await getSettings();
  const driveRoot = normalizeDriveRoot(options.drive.letter);
  activeScan = fork(paths.scanner, [], { windowsHide: true, stdio: ["pipe", "pipe", "pipe", "ipc"] });

  activeScan.on("message", async (message) => {
    if (!message || !message.type) return;
    if (message.type === "done") {
      const history = await readJson("history.json", []);
      const freshDrives = await getDrives();
      const freshDrive = freshDrives.find((drive) => drive.letter === options.drive.letter) || options.drive;
      const reviewable = message.result.candidates.reduce((sum, item) => sum + (item.size || 0), 0);
      message.result.drive = { ...message.result.drive, ...freshDrive };
      await saveScanSnapshot(message.result);
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
      await writeJson("history.json", history.slice(0, 50));
      send("scan:done", message.result);
      activeScan = null;
      return;
    }
    send(`scan:${message.type}`, message.payload);
  });

  activeScan.on("exit", (code) => {
    if (activeScan && code !== 0) send("scan:error", { error: "O scanner foi encerrado antes de concluir." });
    activeScan = null;
  });

  activeScan.send({ type: "start", payload: { drive: options.drive, root: driveRoot, settings } });
  return { ok: true };
});

ipcMain.handle("scan:control", async (_event, action) => {
  if (!activeScan) return { ok: false };
  activeScan.send({ type: action });
  return { ok: true };
});
