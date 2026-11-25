const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const {
  assertPermanentDeletionAllowed,
  canMoveToQuarantineByPolicy,
  pathProtection
} = require("../src/main/quarantine-safety");
const {
  createInstalledAppsInventory,
  parseInstalledAppsOutput
} = require("../src/main/installed-apps");
const { buildLargeFolderItem } = require("../src/scanner/scanner");
const { statIdentity } = require("../src/scanner/cleanup-context");
const { verifiedReportItem, validateLiveSource, validateQuarantinedItem } = require("../src/main/quarantine-source");

const STORE_PATH = "C:\\Users\\User\\AppData\\Local\\Packages\\Microsoft.WindowsStore_8wekyb3d8bbwe";

test("fluxo completo bloqueia pacote Store do scan ate a exclusao", () => {
  const scannedItem = buildLargeFolderItem({
    name: "Microsoft.WindowsStore_8wekyb3d8bbwe",
    path: STORE_PATH,
    size: 8 * 1024 * 1024 * 1024,
    files: 120,
    risk: "Verificar antes",
    children: []
  });

  assert.equal(scannedItem.security, "Sensivel");
  assert.equal(pathProtection(scannedItem.path).protected, true);
  assert.equal(canMoveToQuarantineByPolicy(scannedItem), false);
  assert.throws(
    () => assertPermanentDeletionAllowed({ originalPath: scannedItem.path }),
    /nao permite a exclusao permanente/
  );
});

test("falha ou resposta vazia do AppX fecha a protecao por padrao", () => {
  assert.equal(parseInstalledAppsOutput("").appxReliable, false);
  assert.equal(parseInstalledAppsOutput("invalid-json").appxReliable, false);
  const parsed = parseInstalledAppsOutput(JSON.stringify({ apps: [], appxReliable: false, appxError: "denied" }));
  assert.equal(parsed.appxReliable, false);
  assert.match(parsed.appxError, /denied/);
});

test("inventario AppX executa uma vez e reutiliza cache da sessao", async () => {
  let calls = 0;
  const inventory = createInstalledAppsInventory({
    platform: "win32",
    runPowerShell: async () => {
      calls += 1;
      return JSON.stringify({
        apps: [{ name: "Microsoft.WindowsStore", kind: "appx", packageFamilyName: "Microsoft.WindowsStore_8wekyb3d8bbwe" }],
        appxReliable: true,
        appxError: ""
      });
    }
  });

  const [first, concurrent] = await Promise.all([inventory.load(), inventory.load()]);
  const cached = await inventory.load();
  assert.equal(calls, 1);
  assert.equal(first.appxReliable, true);
  assert.equal(concurrent.apps.length, 1);
  assert.equal(cached.cached, true);
});

test("erro do PowerShell nunca vira inventario confiavel", async () => {
  const inventory = createInstalledAppsInventory({
    platform: "win32",
    runPowerShell: async () => {
      throw new Error("PowerShell timeout");
    }
  });
  const result = await inventory.load();
  assert.equal(result.appxReliable, false);
  assert.match(result.appxError, /timeout/);
});

async function createFixture(t) {
  const parent = path.join(__dirname, "..", "tmp");
  await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, "cleanup-safety-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

async function reportItem(itemPath, riskLevel = "review") {
  const stat = await fs.lstat(itemPath);
  return {
    name: path.basename(itemPath),
    path: itemPath,
    riskLevel,
    kind: stat.isDirectory() ? "directory" : "file",
    size: stat.size,
    identity: statIdentity(stat)
  };
}

test("revalidação impede pai protegido, junction, hard link e arquivo substituído", async (t) => {
  const root = await createFixture(t);
  const outside = path.join(root, "Outside");
  const cache = path.join(root, "cache");
  await fs.mkdir(path.join(cache, "nested", "runtime"), { recursive: true });
  await fs.mkdir(outside);
  const source = path.join(outside, "keep.txt");
  await fs.writeFile(source, "fixture");
  await fs.writeFile(path.join(cache, "nested", "runtime", "node.exe"), "metadata only");
  await assert.rejects(validateLiveSource(await reportItem(cache)), /protegido/);
  await assert.rejects(validateLiveSource(await reportItem(path.join(cache, "nested", "runtime", "node.exe"))), /protegida/);

  await t.test("recusa junctions e links mesmo quando a origem tem identidade válida", async (subtest) => {
    const link = path.join(root, "linked");
    try {
      await fs.symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (!["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) throw error;
      return subtest.skip(`Ambiente impediu a criação do link: ${error.code}`);
    }
    await assert.rejects(validateLiveSource(await reportItem(path.join(link, "keep.txt"))), /junction|redirecionado/);
    await assert.rejects(validateQuarantinedItem(link, { deleting: true }), /outro local|junction/);
  });
  await t.test("recusa arquivo com mais de um hard link", async (subtest) => {
    const hardLink = path.join(root, "alias.txt");
    try {
      await fs.link(source, hardLink);
    } catch (error) {
      if (!["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) throw error;
      return subtest.skip(`Ambiente impediu a criação do link: ${error.code}`);
    }
    await assert.rejects(validateLiveSource(await reportItem(hardLink)), /hard link/);
    await fs.unlink(hardLink);
  });

  const stale = await reportItem(source);
  await fs.writeFile(source, "updated");
  await fs.utimes(source, new Date("2021-04-05"), new Date("2021-04-05"));
  await assert.rejects(validateLiveSource(stale), /mudou desde a análise/);
  assert.equal(await fs.readFile(source, "utf8"), "updated");
});

test("pasta válida é aceita e alterações num subdiretório invalidam o relatório", async (t) => {
  const root = await createFixture(t);
  const parent = path.join(root, "ProjectOutput");
  const nested = path.join(parent, "assets");
  await fs.mkdir(nested, { recursive: true });
  const original = path.join(nested, "generated.txt");
  await fs.writeFile(original, "fixture");
  const report = {
    ...(await reportItem(parent)),
    files: 1,
    size: Buffer.byteLength("fixture"),
    modifiedAt: (await fs.stat(original)).mtime.toISOString()
  };
  await assert.doesNotReject(validateLiveSource(report));
  await fs.writeFile(path.join(nested, "new.txt"), "new data");
  await assert.rejects(validateLiveSource(report), /conteúdo da pasta mudou/);
});

test("revalida dependências, distribuições gerenciadas e perfis mantendo o cache vizinho elegível", async (t) => {
  const root = await createFixture(t);
  const nodeModules = path.join(root, "Project", "node_modules");
  const dependency = path.join(nodeModules, "sample-package", "dist");
  const managed = path.join(root, "AppData", "Local", "node", "corepack", "v1", "pnpm", "test-version", "dist");
  const cef = path.join(root, "AppData", "Local", "NVIDIA Corporation", "NVIDIA App", "CefCache");
  const profile = path.join(cef, "Default");
  const cache = path.join(profile, "Cache");
  for (const folder of [dependency, managed, cache]) await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(cef, "Local State"), "{}");
  await fs.writeFile(path.join(profile, "Preferences"), "{}");
  await fs.writeFile(path.join(profile, "History"), "private");
  await fs.writeFile(path.join(dependency, "asset.js"), "component");
  await fs.writeFile(path.join(managed, "asset.js"), "component");
  const cached = path.join(cache, "index");
  await fs.writeFile(cached, "cache");
  for (const folder of [dependency, nodeModules, managed, cef, profile]) {
    await assert.rejects(validateLiveSource(await reportItem(folder, "low")), /protegido|protegida/);
  }
  const scannedCache = { ...(await reportItem(cache)), files: 1, size: 5, modifiedAt: (await fs.stat(cached)).mtime.toISOString() };
  await assert.doesNotReject(validateLiveSource(scannedCache));
});

function loadQuarantineHandlers(userData, apps, { confirm = async () => ({ response: 0 }), fsOverrides } = {}) {
  const mainFile = path.resolve(__dirname, "../src/main/main.js");
  const requireFromMain = createRequire(mainFile);
  const handlers = new Map();
  const nativeWindow = { isDestroyed: () => false, webContents: {} };
  const electron = {
    app: {
      commandLine: { appendSwitch() {} },
      setName() {},
      setAppUserModelId() {},
      whenReady: () => ({ then() {} }),
      on() {},
      getPath: () => userData,
      getVersion: () => "test"
    },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler), on() {} },
    dialog: { showMessageBox: confirm },
    nativeImage: { createFromPath() {} }
  };
  const context = {
    __dirname: path.dirname(mainFile),
    Buffer,
    process,
    nativeWindow,
    require(id) {
      if (id === "electron") return electron;
      if (id === "./installed-apps") {
        return { createInstalledAppsInventory: () => ({ load: async () => ({ apps, appxReliable: true }) }) };
      }
      if (id === "node:fs/promises" && fsOverrides) return { ...fs, ...fsOverrides };
      return requireFromMain(id);
    }
  };
  return fs.readFile(mainFile, "utf8").then((source) => {
    vm.runInNewContext(source, context, { filename: mainFile });
    vm.runInContext("mainWindow = nativeWindow", context);
    return (channel, value, event = { sender: nativeWindow.webContents }) => handlers.get(`quarantine:${channel}`)(event, value);
  });
}

test("IPC usa scan atual e dados verificados, serializa duplicatas e restaura sem sobrescrever", async (t) => {
  const root = await createFixture(t);
  const userData = path.join(root, "AppConfig");
  const quarantine = path.join(root, "Storage", "Quarantine");
  const documents = path.join(root, "Documents");
  const installRoot = path.join(root, "CustomInstall");
  for (const dir of [userData, quarantine, documents, installRoot]) await fs.mkdir(dir, { recursive: true });
  const file = path.join(documents, "report.txt");
  const keep = path.join(documents, "protected.txt");
  const installed = path.join(installRoot, "application.dat");
  for (const item of [file, keep, installed]) await fs.writeFile(item, "synthetic");
  const candidates = await Promise.all([reportItem(file), reportItem(keep, "protected"), reportItem(installed)]);
  const saved = {
    "settings.json": { language: "en-US", quarantinePath: quarantine },
    "history.json": [{ id: "latest" }, { id: "older" }],
    "scan-snapshots.json": [{ id: "latest", result: { cleanupVersion: 3, candidates } }]
  };
  for (const [name, data] of Object.entries(saved)) await fs.writeFile(path.join(userData, name), JSON.stringify(data));
  const invoke = await loadQuarantineHandlers(userData, [{ installLocation: installRoot }]);

  const request = { path: file, scanId: "latest", size: 999, riskLevel: "low", recommendation: "APAGAR" };
  assert.equal(verifiedReportItem({ cleanupVersion: 2, candidates }, file), null);
  assert.equal(verifiedReportItem({ cleanupVersion: 3, candidates }, path.join(documents, "REPORT.TXT")), null);
  assert.equal((await invoke("move", { ...request, scanId: "older" })).ok, false);
  assert.equal((await invoke("move", { ...request, path: keep })).ok, false);
  assert.equal((await invoke("move", { ...request, path: installed })).ok, false);
  const attempts = await Promise.all([invoke("move", request), invoke("move", request)]);
  assert.deepEqual(attempts.map((result) => result.ok), [true, false]);
  const moved = attempts[0].value;
  assert.equal(moved.size, Buffer.byteLength("synthetic"));
  const records = await invoke("list");
  assert.equal(records.length, 1);
  assert.equal(await fs.readFile(moved.quarantinePath, "utf8"), "synthetic");

  await fs.writeFile(file, "occupying destination");
  assert.equal((await invoke("restore", moved.id)).ok, false);
  assert.equal(await fs.readFile(file, "utf8"), "occupying destination");
  await fs.unlink(file);
  assert.equal((await invoke("restore", moved.id)).ok, true);
  assert.equal(await fs.readFile(file, "utf8"), "synthetic");
  assert.equal(await fs.readFile(keep, "utf8"), "synthetic");
  assert.equal(await fs.readFile(installed, "utf8"), "synthetic");
});

test("a quarentena revalida a estrutura de baixo risco e bloqueia cache de dicionários", async (t) => {
  const root = await createFixture(t);
  const profile = path.join(root, "AppData", "Roaming", "SyntheticProfile");
  const cache = path.join(profile, "Cache");
  const entry = path.join(cache, "Cache_Data", "1234abcd5678abcd_0");
  const journal = path.join(cache, "No_Vary_Search", "journal.baj");
  const dictionary = path.join(profile, "Shared Dictionary", "cache");
  for (const folder of [path.dirname(entry), path.dirname(journal), dictionary]) await fs.mkdir(folder, { recursive: true });
  for (const file of [path.join(profile, "Preferences"), path.join(profile, "History"), entry, journal]) await fs.writeFile(file, "abc");
  const report = {
    ...(await reportItem(cache, "low")),
    reasonCode: "browserCache",
    size: 6,
    files: 2,
    modifiedAt: new Date(Math.max(+(await fs.stat(entry)).mtime, +(await fs.stat(journal)).mtime)).toISOString()
  };
  await assert.doesNotReject(validateLiveSource(report));
  await fs.rename(journal, path.join(path.dirname(journal), "personal.txt"));
  await assert.rejects(validateLiveSource(report), /conteúdo da pasta mudou/);
  await assert.rejects(validateLiveSource(await reportItem(dictionary)), /protegido|protegida/);
});

test("registra intenção antes de mover e exige confirmação nativa para exclusão", async (t) => {
  const root = await createFixture(t);
  const userData = path.join(root, "AppConfig");
  const quarantine = path.join(root, "Quarantine");
  const original = path.join(root, "Documents", "sample.txt");
  const anotherOriginal = path.join(path.dirname(original), "another.txt");
  for (const folder of [userData, quarantine, path.dirname(original)]) await fs.mkdir(folder, { recursive: true });
  for (const file of [original, anotherOriginal]) await fs.writeFile(file, "synthetic");
  const recordsFile = path.join(userData, "quarantine.json");
  const candidates = await Promise.all([reportItem(original), reportItem(anotherOriginal)]);
  const saved = {
    "settings.json": { language: "en-US", quarantinePath: quarantine },
    "history.json": [{ id: "latest" }],
    "scan-snapshots.json": [{ id: "latest", result: { cleanupVersion: 3, candidates } }]
  };
  for (const [name, data] of Object.entries(saved)) await fs.writeFile(path.join(userData, name), JSON.stringify(data));

  let confirmCount = 0;
  let allowDeletion = false;
  let intent;
  const invoke = await loadQuarantineHandlers(userData, [], {
    async confirm(_window, options) {
      confirmCount += 1;
      assert.equal(options.defaultId, 0);
      assert.equal(options.cancelId, 0);
      assert.equal(options.buttons[0], "Cancel");
      return { response: allowDeletion ? 1 : 0 };
    },
    fsOverrides: {
      async rename(from, to) {
        if (from === original) intent = JSON.parse(await fs.readFile(recordsFile, "utf8"));
        return fs.rename(from, to);
      }
    }
  });
  const moved = (await invoke("move", { path: original, scanId: "latest" })).value;
  assert.equal(intent[0].status, "Movimentação pendente");
  assert.equal(intent[0].originalPath, original);
  assert.equal(intent[0].quarantinePath, moved.quarantinePath);
  assert.equal((await invoke("deletePermanent", moved.id, { sender: {} })).ok, false);
  assert.equal(confirmCount, 0);
  assert.equal((await invoke("deletePermanent", moved.id)).value, null);
  assert.equal(await fs.readFile(moved.quarantinePath, "utf8"), "synthetic");

  // An incomplete cross-volume move can leave both copies behind.
  await fs.writeFile(original, "synthetic");
  await fs.writeFile(recordsFile, JSON.stringify(intent));
  assert.equal((await invoke("list"))[0].status, "Movimentação pendente");
  assert.equal((await invoke("cleanupRecords")).ok, true);
  assert.equal((await invoke("restore", moved.id)).ok, false);
  await fs.unlink(original);
  assert.equal((await invoke("list"))[0].status, "Em quarentena");
  allowDeletion = true;
  assert.equal((await invoke("deletePermanent", moved.id)).ok, true);
  await assert.rejects(fs.lstat(moved.quarantinePath), { code: "ENOENT" });

  const second = (await invoke("move", { path: anotherOriginal, scanId: "latest" })).value;
  await fs.rename(second.quarantinePath, second.quarantinePath + ".previous");
  await fs.writeFile(second.quarantinePath, "replacement");
  assert.equal((await invoke("deletePermanent", second.id)).ok, false);
  assert.equal(await fs.readFile(second.quarantinePath, "utf8"), "replacement");
  const recovered = (await invoke("list")).find((record) => record.recovered);
  assert.equal((await invoke("deletePermanent", recovered.id)).ok, false);
});

test("a cópia entre volumes usa destino exclusivo e preserva origens modificadas durante a cópia", async (t) => {
  const root = await createFixture(t);
  const userData = path.join(root, "AppConfig");
  const quarantine = path.join(root, "Quarantine");
  const documents = path.join(root, "Documents");
  for (const folder of [userData, quarantine, documents]) await fs.mkdir(folder, { recursive: true });
  const stable = path.join(documents, "stable.txt");
  const changing = path.join(documents, "changing.txt");
  const occupied = path.join(documents, "occupied.txt");
  const denied = path.join(documents, "denied.txt");
  const originals = [stable, changing, occupied, denied];
  for (const file of originals) await fs.writeFile(file, "synthetic");
  const candidates = await Promise.all(originals.map((file) => reportItem(file)));
  const saved = {
    "settings.json": { language: "en-US", quarantinePath: quarantine },
    "history.json": [{ id: "latest" }],
    "scan-snapshots.json": [{ id: "latest", result: { cleanupVersion: 3, candidates } }]
  };
  for (const [name, data] of Object.entries(saved)) await fs.writeFile(path.join(userData, name), JSON.stringify(data));

  const invoke = await loadQuarantineHandlers(userData, [], {
    fsOverrides: {
      async rename(from, to) {
        if (originals.includes(from)) throw Object.assign(new Error("fixture cross-device move"), { code: "EXDEV" });
        return fs.rename(from, to);
      },
      async copyFile(from, to, flags) {
        if (from === occupied) await fs.writeFile(to, "occupying destination");
        if (from === denied) throw Object.assign(new Error("fixture permission denied"), { code: "EACCES" });
        const result = await fs.copyFile(from, to, flags);
        if (from === changing) await fs.writeFile(from, "changed while copying");
        return result;
      }
    }
  });
  for (const file of [changing, occupied, denied]) {
    assert.equal((await invoke("move", { path: file, scanId: "latest" })).ok, false);
  }
  assert.equal(await fs.readFile(changing, "utf8"), "changed while copying");
  assert.equal(await fs.readFile(occupied, "utf8"), "synthetic");
  assert.equal(await fs.readFile(denied, "utf8"), "synthetic");
  const pending = (await invoke("list")).find((record) => record.originalPath === occupied);
  assert.equal(pending.status, "Movimentação pendente");
  assert.equal(await fs.readFile(pending.quarantinePath, "utf8"), "occupying destination");
  assert.equal((await invoke("list")).length, 1);

  const result = await invoke("move", { path: stable, scanId: "latest" });
  assert.equal(result.ok, true, result.error);
  assert.equal(await fs.readFile(result.value.quarantinePath, "utf8"), "synthetic");
  await assert.rejects(fs.lstat(stable), { code: "ENOENT" });
});

test("registros locais ilegíveis são preservados mesmo se a quarentena tiver arquivos", async (t) => {
  const root = await createFixture(t);
  const userData = path.join(root, "AppConfig");
  const quarantine = path.join(root, "Quarantine");
  await fs.mkdir(userData);
  await fs.mkdir(quarantine);
  await fs.writeFile(path.join(userData, "settings.json"), JSON.stringify({ language: "en-US", quarantinePath: quarantine }));
  const damaged = '{"truncated":';
  const recordsFile = path.join(userData, "quarantine.json");
  const fixture = path.join(quarantine, "unidentified.txt");
  await fs.writeFile(recordsFile, damaged);
  await fs.writeFile(fixture, "fixture");
  const invoke = await loadQuarantineHandlers(userData, []);
  await assert.rejects(invoke("list"), /registros existentes foram preservados/);
  assert.equal((await invoke("cleanupRecords")).ok, false);
  assert.equal(await fs.readFile(recordsFile, "utf8"), damaged);
  assert.equal(await fs.readFile(fixture, "utf8"), "fixture");
});
