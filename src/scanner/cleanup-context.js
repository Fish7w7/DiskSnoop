const { isSensitiveWindowsPath } = require("../main/quarantine-safety");
const { reliableModifiedTime } = require("../renderer/candidate-space");

const MB = 1024 ** 2;
const nodeManifest = "package.json";
const nodeLocks = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"];
const workspaceFiles = ["pnpm-workspace.yaml", "lerna.json", "nx.json", "turbo.json"];
const pythonManifests = ["pyproject.toml", "requirements.txt", "setup.py", "setup.cfg", "Pipfile", "poetry.lock", "uv.lock"].map((name) => name.toLowerCase());
const buildFolders = new Set(["build", "dist", ".next", ".turbo", "coverage", "target", "obj"]);
const browserCacheFolders = new Set(["cache", "code cache", "gpucache"]);
const browserMarkers = ["preferences", "secure preferences", "local state", "history", "network", "indexeddb"];
const installerName = /(?:^|[ ._-])(?:setup|install(?:er|ation)?|instalador)(?:$|[ ._-]|\d)|(?:setup|installer)$/i;
const maintenanceName = /(?:^|[ ._-])(?:unins\d*|uninstall(?:er)?|update(?:r)?|squirrel|maintenance(?:tool)?|patch|repair)(?:$|[ ._-])|(?:uninstaller|updater)$/i;
const dependencyOutputs = new Set([...buildFolders, "bin", "lib", "lib64", "out"]);
const profileLocations = /\/(?:bravesoftware\/brave-browser|google\/chrome|microsoft\/edge|chromium)\/user data\//;
const conventionalProfile = /\/(?:bravesoftware\/brave-browser|google\/chrome|microsoft\/edge|chromium)\/user data\/(?:default\/|profile \d+\/)?[^/]+\/$/;
const knownWebProfiles = /\/appdata\/(?:local\/electron|roaming\/(?:discord(?:canary|ptb)?|riot client|code(?: - insiders)?))\/[^/]+\/$/;
const cefProfiles = /\/appdata\/local\/(?:stove\/cache_cef|capcut\/user data\/cef|nvidia corporation\/nvidia app\/cefcache)\/(?:default\/|profile \d+\/)?[^/]+\/$/;
const storeLocations = /\/(?:npm-cache\/_npx|corepack\/v\d+\/(?:npm|pnpm|yarn|bun)|appdata\/(?:local\/(?:node\/)?corepack|local\/yarn\/cache|roaming\/npm)|\.cache\/node\/corepack|\.pnpm-store|pnpm\/store|yarn\/berry\/(?:cache|global)|yarn\/data\/global|\.yarn\/(?:cache|unplugged|releases)|\.bun\/(?:install\/cache|bin))\//;
const persistentProfileEntries = ["preferences", "secure preferences", "local state", "history", "network", "indexeddb", "cookies", "local storage", "session storage", "sessions", "login data", "service worker"];
const profileDataMarkers = ["preferences", "secure preferences", "local state", "indexeddb", "cookies", "login data", "session storage"];
const nvidiaCefRoot = /\/appdata\/local\/nvidia corporation\/nvidia app\/cefcache\/$/;
const webCacheEntry = /^(?:cache_data|index|index-dir|index\.old|data_\d+|f_[0-9a-f]+|js|wasm|journal)$/;
const cacheShard = /^(?:[a-f0-9]{16}(?:_\d+|_s)?|index(?:-dir|\.old)?|data_\d+|f_[0-9a-f]+|journal)$/;
const cacheChildNames = new Set(["cache_data", "no_vary_search", "js", "wasm", "electron-preload", "index-dir"]);

function partsOf(itemPath) {
  return String(itemPath || "").toLowerCase().split(/[\\/]+/).filter(Boolean);
}

function protectedContext(itemPath) {
  if (isSensitiveWindowsPath(itemPath)) return "system";
  const parts = partsOf(itemPath);
  const segments = `/${parts.join("/")}/`;
  if (parts.includes("shared dictionary")) return "sharedDictionary";
  if (parts.slice(0, -1).includes("node_modules")) return "installedDependency";
  if (storeLocations.test(segments)) return "packageManager";
  if (parts.some((part) => /^(?:runtime|runtimes|sdk|sdks|site-packages|dist-packages|\.venv|venv)$|(?:^|[._-])runtimes?$/.test(part))) {
    return "runtime";
  }
  if (parts.some((part) => /^(?:plugins?|extensions?|app\.asar(?:\.unpacked)?)$/.test(part))
    || /\/(?:resources\/app|appdata\/local\/programs|steamapps\/(?:common|downloading)|package cache|installer cache)\//.test(segments)) {
    return "application";
  }
  const name = parts.at(-1) || "";
  if (/^(?:node|pythonw?|pip\d*)(?:\d+(?:\.\d+)*)?\.exe$/.test(name)) return "runtime";
  if (/\.(?:exe|msi)$/.test(name) && maintenanceName.test(name.slice(0, -4))) return "application";
  return "";
}

function entryNames(entries) {
  return new Set(entries.map((entry) => entry.name.toLowerCase()));
}

function directoryProtection(itemPath, names) {
  const context = protectedContext(itemPath);
  if (context) return context;
  if (["pyvenv.cfg", "site-packages", "dist-packages", "node.exe", "python.exe", "pythonw.exe"].some((name) => names.has(name))) {
    return "runtime";
  }
  if (["app.asar", "app.asar.unpacked", "uninstall.exe", "unins000.exe", "steamapps", "appxmanifest.xml"].some((name) => names.has(name))
    || (names.has("resources") && [...names].some((name) => name.endsWith(".exe")))
    || (names.has("uninstall") && names.has("bin"))) {
    return "application";
  }
  return "";
}

function directoryContentRestriction(itemPath, names) {
  if (!profileDataMarkers.some((entry) => names.has(entry)) && !names.has("default")) return "";
  const name = itemPath.slice(Math.max(itemPath.lastIndexOf("\\"), itemPath.lastIndexOf("/")) + 1).toLowerCase();
  if (name === "cefcache" && names.has("default") && nvidiaCefRoot.test(`/${partsOf(itemPath).join("/")}/`)) return "persistentProfile";
  if (profileDataMarkers.some((entry) => names.has(entry))
    && (browserCacheFolders.has(name) || ["htmlcache", "cefcache"].includes(name) || evidenceIn(names, persistentProfileEntries).length >= 2)) return "persistentProfile";
  return "";
}

function evidenceIn(names, expected) {
  return expected.filter((name) => names?.has(name));
}

function classification(type, reasonCode, riskLevel, confidence, evidence = []) {
  return { type, reasonCode, riskLevel, confidence, evidence: Array.isArray(evidence) ? { path: evidence } : evidence };
}

function cacheChildLayout(name, entries, children) {
  if (!cacheChildNames.has(name)) return undefined;
  return (entries.length > 0 || name === "index-dir") && entries.every((entry) => {
    const value = entry.name.toLowerCase();
    if (name === "no_vary_search") return entry.isFile() && /^(?:journal\.baj|snapshot\.baf)$/.test(value);
    if (name === "electron-preload") return entry.isFile() && /^[a-f0-9]{32,128}(?:-[a-f0-9]{32,128})?\.cache$/.test(value);
    if (name === "index-dir") return entry.isFile() && /^(?:the-real-index|temp-index)$/.test(value);
    return value === "index-dir" ? entry.isDirectory() && children?.[value] === true : entry.isFile() && cacheShard.test(value);
  });
}

function cacheClassification(name, parts, names, parentNames, children, entries) {
  const segments = `/${parts.join("/")}/`;
  if (name === "cache" && parts.at(-2) === "shared dictionary") {
    return classification("Caches", "sharedDictionaryCache", "protected", "high", {
      candidate: [name], parent: evidenceIn(parentNames, ["db", "db-journal", "db-wal", "db-shm"])
    });
  }
  if (name === "_cacache" && parts.at(-2) === "npm-cache") {
    const markers = evidenceIn(names, ["content-v2", "index-v5"]);
    const standard = markers.length === 2 && [...names].every((entry) => ["content-v2", "index-v5", "tmp"].includes(entry));
    return classification("Caches", "npmCache", standard ? "low" : "review", standard ? "high" : "medium", {
      candidate: [name, ...markers], parent: ["npm-cache"]
    });
  }
  if (name === "npm-cache") return classification("Caches", "npmRoot", "review", "medium", [name]);
  if (name === "cachestorage" && parts.at(-2) === "service worker") {
    return classification("Caches", "offlineCache", "review", "high", ["Service Worker/CacheStorage"]);
  }
  if (parts.slice(0, -1).some((part) => persistentProfileEntries.includes(part))) return null;
  if (/\/(?:appdata\/(?:local\/(?:d3dscache|nvidia(?: corporation)?\/(?:dxcache|glcache|nv_cache))|locallow\/nvidia(?: corporation)?\/dxcache)|steamapps\/shadercache)\/$/.test(segments)) {
    return classification("Caches", "shaderCache", "review", "high", [name]);
  }
  if (/\/(?:adobe\/common\/(?:media cache|media cache files)|blackmagic design\/davinci resolve\/cacheclip)\/$/.test(segments)) {
    return classification("Caches", "mediaCache", "review", "high", [parts.slice(-2).join("/")]);
  }
  if (name === "component_crx_cache" && profileLocations.test(segments) && parts.at(-2) === "user data") {
    return classification("Caches", "componentCache", "review", "high", { candidate: [name], profileContext: [parts.at(-3), "User Data"] });
  }
  if (/\/appdata\/roaming\/code(?: - insiders)?\/cacheddata\/$/.test(segments)) {
    const entries = [...(names || [])];
    const versioned = entries.length > 0 && entries.every((entry) => /^[0-9a-f]{7,64}$/.test(entry));
    return classification("Caches", "editorCache", versioned ? "low" : "review", versioned ? "high" : "medium", {
      candidate: [name, ...entries.slice(0, 3)], profileContext: [parts.at(-2)]
    });
  }
  const steam = /\/appdata\/local\/steam\/htmlcache\/$/.test(segments);
  const nvidiaCef = nvidiaCefRoot.test(segments);
  if (nvidiaCef && names?.has("default")) {
    const persistent = names.has("local state");
    return classification("Caches", "cefProfile", persistent ? "protected" : "high", "high", { candidate: ["Default", ...(persistent ? ["Local State"] : [])] });
  }
  if (/\/appdata\/local\/electron\/cache\/$/.test(segments) && names?.size && [...names].every((entry) => /^[a-f0-9]{64}$/.test(entry))) {
    return classification("Caches", "electronDownloads", "review", "medium", { candidate: [name], profileContext: ["Electron"] });
  }
  if (browserCacheFolders.has(name) || steam || nvidiaCef) {
    const recognized = steam || nvidiaCef || conventionalProfile.test(segments) || knownWebProfiles.test(segments) || cefProfiles.test(segments);
    const profile = evidenceIn(parentNames, browserMarkers);
    if (recognized || profile.length || /\/(?:user data|chromium)\//.test(segments)) {
      const cacheMarkers = [...(names || [])].filter((entry) => /^(?:cache_data|index|index-dir|data_\d+|f_[0-9a-f]+)$/.test(entry)).slice(0, 4);
      const codeLayout = name === "code cache" && names?.has("js") && names.has("wasm");
      const webLayout = names?.has("cache_data") || (names?.has("index") && cacheMarkers.length > 1) || codeLayout;
      const persistent = evidenceIn(names, persistentProfileEntries);
      const shader = name === "gpucache";
      const documentedProfile = /\/appdata\/(?:local|locallow|roaming)\//.test(segments) && profile.length >= 2
        && (profile.some((marker) => /preferences|local state/.test(marker)) || parts.some((part) => /^(?:cef|cache_cef|ebwebview)$/.test(part)));
      const verifiedChildren = children && (children.cache_data || children.js || children.wasm);
      const conventional = (!entries || entries.every((entry) => cacheChildNames.has(entry.name.toLowerCase()) ? entry.isDirectory() : entry.isFile()))
        && [...(names || [])].every((entry) => {
        if (cacheChildNames.has(entry)) {
          if (entry === "no_vary_search") return name === "cache" && names.has("cache_data") && children?.[entry] === true;
          if (entry === "electron-preload") return name === "code cache" && children?.[entry] === true;
          if ((entry === "js" || entry === "wasm") && name !== "code cache") return false;
          return !children || children[entry] === true;
        }
        return webCacheEntry.test(entry);
      });
      const low = !shader && (recognized || (documentedProfile && verifiedChildren)) && webLayout && conventional;
      return classification("Caches", shader ? "shaderCache" : "browserCache", persistent.length ? "high" : low ? "low" : "review", webLayout || profile.length || steam ? "high" : "medium", {
        candidate: [name, ...cacheMarkers, ...persistent, ...["no_vary_search", "js", "wasm", "electron-preload"].filter((entry) => names?.has(entry))], profile
      });
    }
  }
  if (["cache", ".cache", "caches", "code cache", "gpucache", "temp", "tmp"].includes(name)) {
    return classification("Caches", "unknownCache", "high", "low", [name]);
  }
  return null;
}

function classifyFolder(dirPath, settings, { names, parentNames, children, entries, modifiedAt, protectedReason = protectedContext(dirPath) } = {}) {
  const parts = partsOf(dirPath);
  const name = parts.at(-1);
  const result = classifyFolderContents(parts, name, settings, { names, parentNames, children, entries, modifiedAt, protectedReason });
  return result && protectedReason ? { ...result, riskLevel: "protected", restrictionCode: protectedReason } : result;
}

function classifyFolderContents(parts, name, settings, { names, parentNames, children, entries, modifiedAt, protectedReason }) {
  const installation = protectedReason === "installedDependency" ? ["node_modules"]
    : protectedReason === "packageManager" ? [storeLocations.exec(`/${parts.join("/")}/`)?.[0]?.slice(1, -1) || ""] : [];
  if (protectedReason && settings.detectBuildCaches !== false && dependencyOutputs.has(name)) {
    return classification("Componentes", "internalDependency", "protected", "high", { candidate: [name], installation });
  }
  if (name === "node_modules" && settings.detectNodeModules !== false) {
    if (protectedReason) return classification("Componentes", "internalDependency", "protected", "high", { candidate: [name], installation });
    if (!parentNames?.has(nodeManifest)) return null;
    const manifestEvidence = [nodeManifest, ...evidenceIn(parentNames, [...nodeLocks, ...workspaceFiles])];
    return classification("Projetos dev", "nodeProject", "review", manifestEvidence.length > 1 ? "high" : "medium", {
      candidate: [name], project: manifestEvidence
    });
  }
  if (settings.detectBuildCaches !== false) {
    if ((name === "bin" || name === ".venv" || name === "venv") && protectedReason) {
      return classification("Componentes", "internalDependency", "protected", "high", [name]);
    }
    if (buildFolders.has(name)) {
      const manifestEvidence = evidenceIn(parentNames, [nodeManifest, ...pythonManifests, "cargo.toml", "go.mod", "pom.xml", "build.gradle"]);
      if (manifestEvidence.length) return classification("Projetos dev", "projectOutput", "review", "medium", { candidate: [name], project: manifestEvidence });
    }
    const cache = cacheClassification(name, parts, names, parentNames, children, entries);
    if (cache) return cache;
  }
  if (settings.detectOldDownloads !== false && parts.slice(0, -1).includes("downloads") && isOld(modifiedAt, settings)) {
    return classification("Downloads antigos", "downloadFolder", "review", "medium", ["Downloads"]);
  }
  return null;
}

function isOld(date, settings) {
  const time = reliableModifiedTime(date);
  return time !== null && Date.now() - time >= Number(settings.oldFileDays ?? 90) * 86400000;
}

function classifyFile(filePath, stat, settings) {
  const parts = partsOf(filePath);
  const name = parts.at(-1) || "";
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot) : "";
  const downloads = parts.slice(0, -1).includes("downloads");
  const old = isOld(stat.mtime, settings);
  const large = stat.size >= settings.largeFileSize;
  const protectedReason = protectedContext(filePath);
  if (protectedReason) {
    return large ? { ...classification("Componentes", "internalDependency", "protected", "high", ext ? [ext] : []), restrictionCode: protectedReason } : null;
  }
  if (settings.detectOldInstallers !== false && downloads && old && stat.size >= 50 * MB
    && (ext === ".msi" || ([".exe", ".iso"].includes(ext) && installerName.test(name.slice(0, -ext.length))))) {
    return classification("Instaladores antigos", "downloadInstaller", "review", ext === ".msi" ? "high" : "medium", ["Downloads", ext]);
  }
  if (settings.detectOldArchives !== false && old && stat.size >= 50 * MB && [".zip", ".rar", ".7z"].includes(ext)) {
    return classification("Compactados antigos", "archive", "review", "high", [ext]);
  }
  if (settings.detectLogsAndTemps !== false && old) {
    if (ext === ".log" && stat.size >= 100 * MB) return classification("Logs grandes", "log", "review", "high", [ext]);
    if (stat.size >= 10 * MB && [".tmp", ".temp"].includes(ext)) return classification("Temporarios", "temp", "review", "medium", [ext]);
  }
  if (large || (downloads && old && stat.size >= 10 * MB && settings.detectOldDownloads !== false)) {
    const type = large ? "Arquivos grandes" : "Downloads antigos";
    if ([".exe", ".msi", ".iso", ".bak", ".old"].includes(ext)) {
      return classification(type, "unknownExecutableOrBackup", "high", "medium", [ext]);
    }
    return classification(type, large ? "largeFile" : "downloadFile", "review", large ? "high" : "medium", downloads ? ["Downloads"] : []);
  }
  return null;
}

function statIdentity(stat) {
  return [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs, stat.birthtimeMs];
}

module.exports = { classifyFile, classifyFolder, cacheChildLayout, directoryProtection, directoryContentRestriction, entryNames, protectedContext, statIdentity };
