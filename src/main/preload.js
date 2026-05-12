const { contextBridge, ipcRenderer } = require("electron");

async function unwrapInvoke(channel, payload) {
  const result = await ipcRenderer.invoke(channel, payload);
  if (result && result.ok === false) throw new Error(result.error || "Erro inesperado.");
  return result?.ok === true ? result.value : result;
}

contextBridge.exposeInMainWorld("diskScope", {
  listDrives: () => ipcRenderer.invoke("drives:list"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window:maximizeToggle"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  resetSettings: () => ipcRenderer.invoke("settings:reset"),
  appPaths: () => ipcRenderer.invoke("app:paths"),
  chooseFolder: () => ipcRenderer.invoke("dialog:chooseFolder"),
  chooseQuarantineFolder: () => ipcRenderer.invoke("dialog:chooseQuarantineFolder"),
  openPath: (targetPath) => ipcRenderer.invoke("path:open", targetPath),
  showInFolder: (targetPath) => ipcRenderer.invoke("path:showInFolder", targetPath),
  listContents: (targetPath) => ipcRenderer.invoke("path:listContents", targetPath),
  listInstalledApps: () => ipcRenderer.invoke("apps:listInstalled"),
  addIgnoredPath: (targetPath) => ipcRenderer.invoke("ignore:add", targetPath),
  startScan: (options) => ipcRenderer.invoke("scan:start", options),
  controlScan: (action) => ipcRenderer.invoke("scan:control", action),
  listQuarantine: () => ipcRenderer.invoke("quarantine:list"),
  moveToQuarantine: (item) => unwrapInvoke("quarantine:move", item),
  restoreQuarantine: (id) => unwrapInvoke("quarantine:restore", id),
  deletePermanent: (id) => unwrapInvoke("quarantine:deletePermanent", id),
  forgetMissingQuarantine: (id) => unwrapInvoke("quarantine:forgetMissing", id),
  cleanupQuarantineRecords: () => unwrapInvoke("quarantine:cleanupRecords"),
  listHistory: () => ipcRenderer.invoke("history:list"),
  clearHistory: () => ipcRenderer.invoke("history:clear"),
  loadScanSnapshot: (id) => ipcRenderer.invoke("scan:snapshot", id),
  getUpdateState: () => ipcRenderer.invoke("update:getState"),
  checkForUpdates: (payload) => ipcRenderer.invoke("update:check", payload),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdateAndRestart: () => ipcRenderer.invoke("update:installRestart"),
  openReleases: () => ipcRenderer.invoke("update:openReleases"),
  openUpdateRelease: () => ipcRenderer.invoke("update:openRelease"),
  openDownloadedUpdate: () => unwrapInvoke("update:openDownloaded"),
  showDownloadedUpdate: () => unwrapInvoke("update:showDownloaded"),
  ignoreUpdateVersion: () => ipcRenderer.invoke("update:ignoreVersion"),
  rememberUpdateLater: () => ipcRenderer.invoke("update:rememberLater"),
  onScanProgress: (callback) => ipcRenderer.on("scan:progress", (_event, payload) => callback(payload)),
  onScanDone: (callback) => ipcRenderer.on("scan:done", (_event, payload) => callback(payload)),
  onScanError: (callback) => ipcRenderer.on("scan:error", (_event, payload) => callback(payload)),
  onUpdateState: (callback) => ipcRenderer.on("update:state", (_event, payload) => callback(payload))
});
