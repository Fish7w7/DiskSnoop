const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { fork } = require("node:child_process");
const { classifyFile, classifyFolder, directoryProtection, protectedContext } = require("../src/scanner/cleanup-context");
const { removeRedundantChildCandidates, isInsideRoot } = require("../src/scanner/scanner");
const { deduplicatePaths, isDescendant, pathKey, removeCoveredItems, uniqueBytes, reliableModifiedTime } = require("../src/renderer/candidate-space");

const MB = 1024 ** 2;
const settings = { oldFileDays: 90, largeFileSize: 100 * MB, largeFolderSize: 100 * MB, verifyDuplicateHashes: false };
const oldFile = { size: 200 * MB, mtime: new Date("2020-01-01") };
const workspace = path.resolve(__dirname, "..", "tmp");

test("limita raízes incluídas a caminhos do volume mesmo quando a raiz já termina com separador", () => {
  const root = path.parse(workspace).root;
  assert.equal(isInsideRoot(workspace, root), true);
  assert.equal(isInsideRoot(path.join(root, "Temp-old"), path.join(root, "Temp")), false);
});

test("Node e Python precisam de manifestos adjacentes e bin genérico não é saída de build", () => {
  const project = "C:/Projetos/MeuApp/";
  const node = { parentNames: new Set(["package.json", "pnpm-workspace.yaml"]) };
  const python = { parentNames: new Set(["pyproject.toml", "requirements.txt"]) };
  assert.equal(classifyFolder(project + "node_modules", settings), null);
  assert.equal(classifyFolder(project + "bin", settings, node), null);
  assert.equal(classifyFolder(project + "build", settings), null);
  assert.equal(classifyFolder(project + "node_modules", settings, node).riskLevel, "review");
  assert.equal(classifyFolder(project + "dist", settings, node).reasonCode, "projectOutput");
  assert.equal(classifyFolder(project + "build", settings, python).riskLevel, "review");
  assert.equal(classifyFolder(project + ".venv", settings, python).riskLevel, "protected");
  assert.equal(classifyFolder(project + "node_modules", { ...settings, detectNodeModules: false }, node), null);
});

test("estruturas de runtime e aplicativos prevalecem sobre nome, manifesto e versão", () => {
  const directories = [
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules",
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin",
    ".codex/plugins/cache/openai-bundled/chrome/version/node_modules",
    "python/Lib/site-packages/pip/_internal/operations/build",
    "python/Lib/site-packages/artifact_tool_v2/bin",
    "Runtimes/previous/node_modules",
    "Runtimes/current/bin",
    "AppData/Local/Programs/Electron/resources/app.asar.unpacked/node_modules",
    "Steam/steamapps/common/Game/build",
    "IDE/extensions/publisher.extension/node_modules"
  ];
  const options = { parentNames: new Set(["package.json", "package-lock.json"]) };
  for (const directory of directories) {
    const result = classifyFolder(`C:/Users/User/${directory}`, settings, options);
    assert.equal(result?.riskLevel, "protected", directory);
  }
  assert.equal(directoryProtection("C:/CustomEnvironment", new Set(["pyvenv.cfg", "Scripts"])), "runtime");
  assert.equal(directoryProtection("C:/CustomApp", new Set(["resources", "stove.exe"])), "application");
  assert.equal(directoryProtection("C:/Windows/System32", new Set()), "system");
  assert.equal(classifyFile("C:/pagefile.sys", oldFile, settings).riskLevel, "protected");
  assert.equal(classifyFile("C:/Users/User/NTUSER.DAT", oldFile, settings).riskLevel, "protected");
  assert.equal(classifyFolder("C:/Projetos/old/build", settings, options).riskLevel, "review");
});

test("executáveis antigos precisam de evidência de instalação e localização em Downloads", () => {
  for (const file of [
    "C:/runtimes/node/bin/node.exe",
    "C:/Games/STOVE/STOVE.exe",
    "C:/python/python.exe",
    "C:/Downloads/PortableTool.exe",
    "C:/Downloads/GameUninstaller.exe",
    "C:/Downloads/App Update.msi",
    "C:/ProgramData/Package Cache/Installer.msi",
    "C:/Documents/Vendor Setup.exe"
  ]) {
    assert.notEqual(classifyFile(file, oldFile, settings)?.type, "Instaladores antigos", file);
  }
  assert.equal(classifyFile("C:/Downloads/App-Setup-x64.exe", oldFile, settings).type, "Instaladores antigos");
  assert.equal(classifyFile("C:/Downloads/App.msi", oldFile, settings).confidence, "high");
  assert.equal(classifyFile("C:/Downloads/App-Installer.iso", oldFile, settings).riskLevel, "review");
  assert.equal(classifyFile("C:/Downloads/PortableTool.exe", oldFile, settings).riskLevel, "high");
  assert.equal(classifyFile("C:/Downloads/backup.bak", oldFile, settings).riskLevel, "high");
  const recent = { ...oldFile, mtime: new Date() };
  assert.notEqual(classifyFile("C:/Downloads/App-Setup.exe", recent, settings)?.type, "Instaladores antigos");
});

test("caches conhecidos distinguem pacotes, dados offline e shaders de pastas genéricas", () => {
  const cases = [
    ["npm-cache/_cacache", "npmCache", "review"],
    ["npm-cache", "npmRoot", "review"],
    ["User Data/Profile 1/Cache", "browserCache", "review"],
    ["AppData/Roaming/Discord/Code Cache", "browserCache", "review"],
    ["AppData/Roaming/Code/GPUCache", "shaderCache", "review"],
    ["AppData/Roaming/Code/CachedData", "editorCache", "review"],
    ["AppData/Local/NVIDIA/DXCache", "shaderCache", "review"],
    ["AppData/Local/D3DSCache", "shaderCache", "review"],
    ["Steam/steamapps/shadercache", "shaderCache", "review"],
    ["AppData/Local/Steam/htmlcache", "browserCache", "review"],
    ["Electron/Profile/Service Worker/CacheStorage", "offlineCache", "review"],
    ["Adobe/Common/Media Cache Files", "mediaCache", "review"],
    ["plugins/cache", "unknownCache", "protected"],
    [".cache", "unknownCache", "high"]
  ];
  for (const [name, code, risk] of cases) {
    const result = classifyFolder(`C:/Users/User/${name}`, settings);
    assert.equal(result?.reasonCode, code, name);
    assert.equal(result?.riskLevel, risk, name);
  }
  const chromium = classifyFolder("C:/CustomApp/Profile/Cache", settings, { parentNames: new Set(["preferences"]) });
  assert.equal(chromium.reasonCode, "browserCache");
  assert.deepEqual(chromium.evidence, { candidate: ["cache"], profile: ["preferences"] });
  assert.equal(classifyFolder("C:/CustomApp/cache-backup", settings), null);
});

test("reproduz os 15 caminhos da análise com estruturas representativas", () => {
  const chromiumProfile = new Set(["preferences", "secure preferences", "history", "network", "indexeddb"]);
  const simpleCache = ["cache_data"];
  const brave = "Local/BraveSoftware/Brave-Browser/User Data/Default";
  const candidates = [
    ["Local/CapCut/User Data/Cache", simpleCache, "browserCache", "review"],
    ["Local/NVIDIA/DXCache", ["file.bin"], "shaderCache", "review"],
    [`${brave}/Service Worker/CacheStorage`, ["file"], "offlineCache", "review"],
    ["Local/npm-cache/_cacache", ["content-v2", "index-v5"], "npmCache", "low"],
    [`${brave}/Code Cache`, ["js", "wasm"], "browserCache", "low", chromiumProfile],
    ["Local/Steam/htmlcache", ["index", "data_0"], "browserCache", "low"],
    ["Local/D3DSCache", ["file.bin"], "shaderCache", "review"],
    ["Roaming/discord/Cache", simpleCache, "browserCache", "low", chromiumProfile],
    ["Roaming/Riot Client/Cache", simpleCache, "browserCache", "low", chromiumProfile],
    [`${brave}/Cache`, simpleCache, "browserCache", "low", chromiumProfile],
    ["Roaming/Code/CachedData", ["abcdef0123456789"], "editorCache", "low"],
    ["Local/STOVE/Cache_cef/Default/Cache", simpleCache, "browserCache", "low", chromiumProfile],
    ["Local/CapCut/User Data/CEF/Cache", simpleCache, "browserCache", "low"],
    ["Local/npm-cache/_npx/test-hash/node_modules/example-package/dist", ["worker.js"], "internalDependency", "protected", new Set(["package.json"])],
    ["Local/node/corepack/v1/pnpm/0.0.0-test/dist", ["pnpm.cjs"], "internalDependency", "protected", new Set(["package.json"])]
  ];
  for (const [relative, names, reasonCode, risk, parentNames] of candidates) {
    const result = classifyFolder(`C:/Users/Fixture/AppData/${relative}`, settings, { names: new Set(names), parentNames });
    assert.equal(result?.riskLevel, risk, relative);
    assert.equal(result?.reasonCode, reasonCode, relative);
  }
  const codeCache = classifyFolder(`C:/Users/Fixture/AppData/${brave}/Code Cache`, settings, {
    names: new Set(["js", "wasm"]), parentNames: chromiumProfile
  });
  assert.deepEqual(codeCache.evidence.candidate, ["code cache", "js", "wasm"]);
  assert.ok(codeCache.evidence.profile.includes("history"));
  assert.equal(codeCache.evidence.candidate.includes("history"), false);
});

test("protege distribuições e manifestos internos sem proteger projetos de nome semelhante", () => {
  const paths = [
    "C:/Projects/Editor/node_modules/@scope/tool/lib",
    "C:/Projects/Editor/node_modules/compiler/bin",
    "C:/Projects/Editor/node_modules/compiler/build",
    "C:/Projects/Editor/node_modules/compiler/src/main.js",
    "C:/Managed/Corepack/v2/yarn/50/dist",
    "C:/Managed/Corepack/v2/npm/4/lib",
    "C:/Users/Fixture/AppData/Local/Yarn/Cache/v6/example/dist",
    "C:/Users/Fixture/.bun/install/cache/example/dist",
    "C:/Users/Fixture/.pnpm-store/v10/files/example"
  ];
  for (const location of paths) assert.ok(protectedContext(location), location);
  const project = { parentNames: new Set(["package.json", "package-lock.json"]) };
  for (const location of ["C:/Projects/corepack/v1/demo/dist", "C:/Projects/node_modules_backup/build"]) {
    assert.equal(classifyFolder(location, settings, project).reasonCode, "projectOutput");
  }
  assert.equal(classifyFolder("C:/Projects/Corepack/v5/Demo/node_modules", settings, project).riskLevel, "review");
});

test("identifica caches antes omitidos sem confundir cache com perfil persistente", () => {
  const appData = "C:/Users/Fixture/AppData";
  const nvidia = `${appData}/Local/NVIDIA Corporation/NVIDIA App/CefCache`;
  assert.equal(classifyFolder(`${appData}/LocalLow/NVIDIA/DXCache`, settings).reasonCode, "shaderCache");
  assert.equal(classifyFolder(`${appData}/Local/electron/Cache`, settings, { names: new Set(["a".repeat(64)]) }).reasonCode, "electronDownloads");
  assert.equal(classifyFolder(nvidia, settings, { names: new Set(["default", "local state"]) }).riskLevel, "protected");
  assert.equal(classifyFolder(`${nvidia}/Default/Cache`, settings, { names: new Set(["cache_data"]) }).riskLevel, "low");
  assert.equal(classifyFolder(`${appData}/Local/BraveSoftware/Brave-Browser/User Data/component_crx_cache`, settings).reasonCode, "componentCache");
  assert.equal(classifyFolder("C:/Projects/component_crx_cache", settings), null);
  assert.equal(classifyFolder(`${appData}/LocalLow/Other/DXCache`, settings), null);
  assert.equal(classifyFolder(`${appData}/Local/electron/Cache-old`, settings), null);
  const unexpected = classifyFolder(`${appData}/Roaming/Discord/Cache`, settings, { names: new Set(["cache_data", "important"]) });
  assert.equal(unexpected.riskLevel, "review");
  assert.equal(classifyFolder("C:/User Data/Default/IndexedDB/Cache", settings, { names: new Set(["cache_data"]) }), null);
});

test("data artificial não torna um instalador obsoleto e não altera seu metadado original", () => {
  const date = new Date("1985-10-26T08:15:00Z");
  assert.equal(reliableModifiedTime(date), null);
  assert.equal(reliableModifiedTime("2099-10-26T08:15:00Z"), null);
  assert.notEqual(classifyFile("C:/Downloads/Example-Setup.exe", { ...oldFile, mtime: date }, settings).type, "Instaladores antigos");
  assert.equal(date.toISOString(), "1985-10-26T08:15:00.000Z");
});

test("deduplica caminhos Windows, conta a pasta uma vez e mantém achados distintos para revisão", () => {
  const parent = { path: "C:\\Runtime\\node\\bin", kind: "directory", type: "Componentes", riskLevel: "protected", size: 89 * MB };
  const child = { path: "c:/runtime/node/BIN/node.exe", kind: "file", type: "Arquivos grandes", riskLevel: "review", size: 89 * MB };
  const duplicate = { ...child, path: "C:/RUNTIME//node/bin/./node.exe" };
  const neighbor = { path: "c:/runtime/node/binary/run.exe", kind: "file", size: 1 };
  const items = [child, parent, duplicate, neighbor];
  assert.equal(pathKey("\\\\?\\UNC\\SERVER\\Share\\x"), pathKey("\\\\server\\share\\dir\\..\\x"));
  assert.equal(isDescendant(child.path, parent.path), true);
  assert.equal(isDescendant(neighbor.path, parent.path), false);
  assert.equal(deduplicatePaths(items).length, 3);
  assert.equal(uniqueBytes(items), 89 * MB + 1);
  assert.deepEqual(removeCoveredItems(items), [parent, neighbor]);
  assert.deepEqual(removeRedundantChildCandidates(items), [child, parent, neighbor]);
  assert.deepEqual(removeRedundantChildCandidates([parent, { ...child, type: parent.type, riskLevel: parent.riskLevel }]), [parent]);
});

function scan(root, overrides) {
  return new Promise((resolve, reject) => {
    const child = fork(path.resolve(__dirname, "../src/scanner/scanner.js"), [], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Scanner encerrou com código ${code}`)));
    child.on("message", (message) => {
      if (message.type === "done") {
        child.kill();
        resolve(message.result);
      } else if (message.type === "error") {
        child.kill();
        reject(new Error(message.payload.error));
      }
    });
    child.send({ type: "start", payload: { root, drive: {}, settings: { ...settings, ...overrides } } });
  });
}

test("scanner usa a listagem real, não segue junctions e bloqueia ancestrais de conteúdo protegido", async (t) => {
  await fs.mkdir(workspace, { recursive: true });
  const fixture = await fs.mkdtemp(path.join(workspace, "scan-context-"));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const root = path.join(fixture, "Volume");
  const project = path.join(root, "MeuApp");
  const linkedCache = path.join(root, "LinkedCache");
  const protectedCache = path.join(root, "cache", "runtime", "previous");
  const outside = path.join(fixture, "Outside");
  for (const directory of [path.join(project, "node_modules"), protectedCache, linkedCache, outside]) {
    await fs.mkdir(directory, { recursive: true });
  }
  await fs.writeFile(path.join(project, "package.json"), JSON.stringify({
    private: true,
    workspaces: ["packages/*"],
    dependencies: { "@private/internal": "1.0.0", local: "file:./packages/local" },
    pnpm: { patchedDependencies: { "local": "patches/local.patch" } }
  }));
  await fs.writeFile(path.join(project, "package-lock.json"), "{}");
  await fs.writeFile(path.join(project, "node_modules", "library.js"), "module");
  await fs.writeFile(path.join(protectedCache, "node.exe"), "fixture");
  const externalFile = path.join(outside, "unrelated.txt");
  await fs.writeFile(externalFile, "untouched");
  await fs.writeFile(path.join(linkedCache, "local.txt"), "fixture");
  let hasJunction = false;
  let hasHardLink = false;
  await t.test("cria junction ou link simbólico para o fixture externo", async (subtest) => {
    try {
      await fs.symlink(outside, path.join(linkedCache, "junction"), process.platform === "win32" ? "junction" : "dir");
      hasJunction = true;
    } catch (error) {
      if (!["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) throw error;
      subtest.skip(`Ambiente impediu a criação do link: ${error.code}`);
    }
  });
  await t.test("cria hard link para o fixture externo", async (subtest) => {
    try {
      await fs.link(externalFile, path.join(linkedCache, "hard-link.txt"));
      hasHardLink = true;
    } catch (error) {
      if (!["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) throw error;
      subtest.skip(`Ambiente impediu a criação do link: ${error.code}`);
    }
  });

  const result = await scan(root, { largeFolderSize: 1, largeFileSize: 1, includedPaths: [root, project] });
  assert.equal(result.cleanupVersion, 3);
  assert.deepEqual(result.scanRoots, [root]);
  assert.equal(result.files, hasHardLink ? 6 : 5);
  const lookup = (items, itemPath) => items.find((item) => pathKey(item.path) === pathKey(itemPath));
  assert.equal(lookup(result.candidates, path.join(project, "node_modules")).riskLevel, "protected");
  assert.equal(lookup(result.largeFolders, path.join(root, "cache")).riskLevel, "protected");
  if (hasJunction || hasHardLink) assert.equal(lookup(result.largeFolders, linkedCache).restrictionCode, "linkedContent");
  if (hasHardLink) assert.equal(lookup(result.candidates, path.join(linkedCache, "hard-link.txt")).riskLevel, "protected");
  assert.equal(result.candidates.some((item) => item.path.includes("junction")), false);
  assert.equal(await fs.readFile(externalFile, "utf8"), "untouched");
  const rescanned = await scan(root, { largeFolderSize: 1, largeFileSize: 1 });
  assert.notEqual(rescanned.candidates[0].id, result.candidates[0].id);
});

test("scan inclui cache conhecido de 11 MB e protege builds gerenciados abaixo de 50 MB", async (t) => {
  await fs.mkdir(workspace, { recursive: true });
  const fixture = await fs.mkdtemp(path.join(workspace, "scan-refinement-"));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const shader = path.join(fixture, "AppData", "LocalLow", "NVIDIA", "DXCache");
  const managedDist = path.join(fixture, "AppData", "Local", "node", "corepack", "v1", "pnpm", "0-test", "dist");
  for (const folder of [shader, managedDist]) {
    await fs.mkdir(folder, { recursive: true });
    const item = await fs.open(path.join(folder, "synthetic.bin"), "w");
    try { await item.truncate(11 * MB); } finally { await item.close(); }
  }
  const date = new Date("1985-10-26T08:15:00Z");
  await fs.utimes(path.join(managedDist, "synthetic.bin"), date, date);
  await fs.writeFile(path.join(path.dirname(managedDist), "package.json"), "{}");
  const result = await scan(fixture, { largeFolderSize: 1 });
  const byPath = new Map(result.candidates.map((item) => [pathKey(item.path), item]));
  assert.equal(byPath.get(pathKey(shader)).reasonCode, "shaderCache");
  assert.equal(byPath.get(pathKey(managedDist)).riskLevel, "protected");
  assert.equal(byPath.get(pathKey(managedDist)).modifiedAt, date.toISOString());
});

test("reproduz as estruturas dos caches observados em disco, inclusive seus subdiretórios", async (t) => {
  await fs.mkdir(workspace, { recursive: true });
  const fixture = await fs.mkdtemp(path.join(workspace, "scan-browser-layout-"));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const format = [
    ["Local/BraveSoftware/Brave-Browser/User Data/Default/Cache", "http", "low"],
    ["Roaming/discord/Cache", "http", "low"],
    ["Roaming/Riot Client/Cache", "http", "low"],
    ["Local/Steam/htmlcache/Default/Cache", "http", "low"],
    ["Local/STOVE/Cache_cef/Default/Cache", "http", "low"],
    ["Local/CapCut/User Data/CEF/Cache/Cache", "http", "low"],
    ["Roaming/Code/Partitions/vscode-browser/Cache", "http", "low"],
    ["Roaming/Code/Cache", "http", "low"],
    ["Roaming/Auri-Dev/cache", "mixed", "review"],
    ["Roaming/Auri/cache", "mixed", "review"],
    ["Local/Steam/htmlcache/Default/Code Cache", "code", "low"],
    ["Local/BraveSoftware/Brave-Browser/User Data/Default/Shared Dictionary/cache", "dictionary", "protected"],
    ["Local/Spotify/Browser/Cache", "http", "low"],
    ["Local/Roblox/UniversalApp/WebView2/EBWebView/Default/Cache", "http", "low"],
    ["Roaming/Riot Client/Code Cache", "preload", "low"],
    ["Roaming/UnknownA/Cache", "internal-settings", "protected"],
    ["Roaming/UnknownB/Cache", "incomplete-evidence", "review"],
    ["Roaming/UnknownC/Cache", "unknown-journal-content", "review"],
    ["Roaming/UnknownD/Cache", "wrong-entry-type", "review"],
    ["Local/Chromium/User Data/Default/Service Worker/CacheStorage", "offline", "review"]
  ];
  async function write(relative, bytes = 1) {
    await fs.mkdir(path.dirname(relative), { recursive: true });
    const file = await fs.open(relative, "w");
    try { await file.truncate(bytes); } finally { await file.close(); }
  }

  for (const [relative, kind] of format) {
    const cache = path.join(fixture, "AppData", relative);
    const parent = path.dirname(cache);
    if (kind === "dictionary") {
      await write(path.join(parent, "db"));
      await write(path.join(parent, "db-wal"));
      await write(path.join(cache, "index"), 11 * MB);
    } else if (kind === "offline") {
      await write(path.join(cache, "offline-content"), 11 * MB);
    } else if (["code", "preload"].includes(kind)) {
      await write(path.join(parent, "Preferences"));
      await fs.mkdir(path.join(parent, "Network"), { recursive: true });
      await write(path.join(cache, "JS", "1234abcd5678abcd_0"), 11 * MB);
      await write(path.join(cache, "wasm", "index"));
      await fs.mkdir(path.join(cache, "wasm", "index-dir"), { recursive: true });
      if (kind === "preload") await write(path.join(cache, "electron-preload", `${"a".repeat(64)}-${"b".repeat(64)}.cache`));
    } else {
      await write(path.join(parent, "Preferences"));
      if (kind !== "incomplete-evidence") await fs.mkdir(path.join(parent, "Network"), { recursive: true });
      await write(path.join(cache, "CaChe_DaTa", "9876abcd5678abcd_0"), 11 * MB);
      await write(path.join(cache, "No_Vary_Search", "journal.baj"));
      if (kind === "mixed") await write(path.join(cache, "covers", "sample.jpg"));
      if (kind === "internal-settings") await write(path.join(cache, "Preferences"));
      if (kind === "unknown-journal-content") await write(path.join(cache, "No_Vary_Search", "personal.txt"));
      if (kind === "wrong-entry-type") await fs.mkdir(path.join(cache, "index"), { recursive: true });
    }
  }
  const result = await scan(fixture, { largeFolderSize: 1 });
  const findings = new Map(result.candidates.map((item) => [pathKey(item.path), item]));
  for (const [relative, , expected] of format) {
    const item = findings.get(pathKey(path.join(fixture, "AppData", relative)));
    assert.equal(item?.riskLevel, expected, relative);
  }
  const brave = findings.get(pathKey(path.join(fixture, "AppData", format[0][0])));
  assert.ok(brave.evidence.candidate.includes("no_vary_search"));
  assert.ok(brave.evidence.profile.includes("preferences"));
  assert.ok(!brave.evidence.candidate.includes("preferences"));
  assert.equal(result.largeFolders.find((item) => item.name === "Shared Dictionary")?.riskLevel, "protected");
});

test("o escopo explícito não se amplia e arquivos excluídos tornam a pasta indisponível para mover", async (t) => {
  await fs.mkdir(workspace, { recursive: true });
  const fixture = await fs.mkdtemp(path.join(workspace, "scan-scope-"));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const root = path.join(fixture, "Volume");
  const cache = path.join(root, "AppData", "Roaming", "discord", "Cache");
  await fs.mkdir(cache, { recursive: true });
  const ignored = path.join(cache, "personal.bin");
  await fs.writeFile(ignored, "excluded");
  await fs.writeFile(path.join(cache, "index"), "cache");
  await assert.rejects(scan(root, { includedPaths: [path.join(fixture, "VolumeOther")] }), /Nenhuma pasta incluída/);
  const report = await scan(root, { includedPaths: [cache + path.sep], ignoredPaths: [ignored], largeFolderSize: 1 });
  assert.equal(report.files, 1);
  assert.equal(report.mappedBytes, 5);
  assert.equal(report.largeFolders[0].restrictionCode, "unverified");
});
