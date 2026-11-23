const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const {
  languageFromSystemLocale,
  resolveInitialLanguage
} = require("../src/main/system-language");

test("primeiro uso escolhe português para variantes do idioma", () => {
  for (const locale of ["pt-BR", "pt-PT", "PT-br", "pt"]) {
    assert.equal(languageFromSystemLocale(locale), "pt-BR");
    assert.deepEqual(resolveInitialLanguage(undefined, () => locale), {
      language: "pt-BR",
      shouldPersist: true
    });
  }
});

test("primeiro uso escolhe inglês para locales não portugueses", () => {
  for (const locale of ["en-US", "en-GB", "es-ES", "de-DE"]) {
    assert.equal(languageFromSystemLocale(locale), "en-US");
    assert.deepEqual(resolveInitialLanguage(undefined, () => locale), {
      language: "en-US",
      shouldPersist: true
    });
  }
});

test("falha ou locale inesperado mantém o fallback en-US", () => {
  for (const locale of [undefined, null, "", "   ", 42, "ptinvalid"]) {
    assert.equal(languageFromSystemLocale(locale), "en-US");
  }
  assert.deepEqual(resolveInitialLanguage(undefined, () => {
    throw new Error("locale unavailable");
  }), {
    language: "en-US",
    shouldPersist: true
  });
});

test("idioma salvo é definitivo e não consulta novamente o sistema", () => {
  for (const savedLanguage of ["pt-BR", "en-US"]) {
    let localeChecks = 0;
    const resolution = resolveInitialLanguage(savedLanguage, () => {
      localeChecks += 1;
      return savedLanguage === "pt-BR" ? "en-US" : "pt-BR";
    });
    assert.deepEqual(resolution, {
      language: savedLanguage,
      shouldPersist: false
    });
    assert.equal(localeChecks, 0);
  }
});

const mainFile = path.resolve(__dirname, "../src/main/main.js");
const rendererFile = path.resolve(__dirname, "../src/renderer/renderer.js");
const i18nFile = path.resolve(__dirname, "../src/renderer/i18n.js");
const html = fs.readFileSync(path.resolve(__dirname, "../src/renderer/index.html"), "utf8");

async function startMain(directory, systemLanguage) {
  const handlers = new Map();
  const display = { id: 1, workArea: { x: 0, y: 0, width: 1440, height: 900 } };
  let bootQuery;
  let initialize;
  const electron = {
    app: {
      commandLine: { appendSwitch() {} },
      setName() {},
      setAppUserModelId() {},
      whenReady: () => ({ then(callback) { initialize = callback; } }),
      on() {},
      getPath: () => directory,
      getPreferredSystemLanguages: () => [systemLanguage]
    },
    BrowserWindow: class {
      setIcon() {}
      setBackgroundColor() {}
      isDestroyed() { return false; }
      on() {}
      once() {}
      async loadFile(_file, { query }) { bootQuery = query; }
    },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler), on() {} },
    nativeImage: { createFromPath() {} },
    nativeTheme: { shouldUseDarkColors: false },
    screen: { getPrimaryDisplay: () => display, getAllDisplays: () => [display] }
  };
  runScript(mainFile, {
    process,
    require: (id) => id === "electron" ? electron : createRequire(mainFile)(id)
  });
  await initialize();
  return {
    bootQuery,
    getSettings: () => handlers.get("settings:get")(),
    saveSettings: (value) => handlers.get("settings:save")(null, value),
    resetSettings: () => handlers.get("settings:reset")()
  };
}

function runScript(file, globals) {
  const moduleGlobals = { __dirname: path.dirname(file), require: createRequire(file) };
  const context = vm.isContext(globals)
    ? Object.assign(globals, moduleGlobals)
    : vm.createContext({ ...moduleGlobals, ...globals });
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return context;
}

function startRenderer(main, staleLanguage = "pt-BR") {
  const listeners = new Map();
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const app = {
    markup: "",
    get innerHTML() { return this.markup; },
    set innerHTML(value) {
      this.markup = value;
      resolveReady();
    }
  };
  const status = { textContent: "" };
  const document = {
    documentElement: { lang: "en-US", dataset: {}, style: { removeProperty() {} } },
    querySelector: (selector) => ({ "#app": app, "[data-boot-status]": status }[selector] ?? null),
    createTreeWalker: () => ({ nextNode: () => false }),
    addEventListener: (name, listener) => listeners.set(name, listener)
  };
  const context = runScript(i18nFile, {
    document,
    window: {
      diskScope: {
        getSettings: main.getSettings,
        saveSettings: main.saveSettings,
        listDrives: async () => [],
        listQuarantine: async () => [],
        listHistory: async () => [],
        appPaths: async () => ({}),
        listInstalledApps: async () => [],
        onScanProgress() {},
        onScanDone() {},
        onScanError() {}
      }
    },
    location: { search: new URLSearchParams(main.bootQuery).toString() },
    localStorage: {
      getItem: (key) => key === "disksnoop-language" ? staleLanguage : null,
      setItem() {}
    },
    URLSearchParams,
    NodeFilter: { SHOW_TEXT: 4 },
    setTimeout: (callback) => callback()
  });
  for (const [, inlineScript] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    vm.runInContext(inlineScript, context);
  }
  const bootText = status.textContent;
  runScript(rendererFile, context);
  return {
    app,
    document,
    bootText,
    ready,
    changeLanguage: (value) => listeners.get("change")({ target: { dataset: { field: "language" }, value } }),
    displaySettings: () => vm.runInContext('state.screen = "app"; state.tab = "settings"; render()', context),
    displayWelcome: () => vm.runInContext('state.screen = "welcome"; state.tab = "overview"; render()', context)
  };
}

test("troca imediata na tela inicial, sincronização e persistência em nova sessão", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "disksnoop-language-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const main = await startMain(directory, "fr-FR");
  assert.equal(main.bootQuery.bootLanguage, "en-US");
  const renderer = startRenderer(main);
  assert.equal(renderer.bootText, "Preparing DiskSnoop...");
  await renderer.ready;
  assert.match(renderer.app.innerHTML, /welcome-language-select[\s\S]*English<\/option>/);
  assert.match(renderer.app.innerHTML, /value="en-US" selected>English/);
  assert.match(renderer.app.innerHTML, /Step 1/);

  const fromWelcome = renderer.changeLanguage("pt-BR");
  assert.equal(renderer.document.documentElement.lang, "pt-BR");
  assert.match(renderer.app.innerHTML, /Passo 1/);
  assert.match(renderer.app.innerHTML, /value="pt-BR" selected>Português \(BR\)/);
  await fromWelcome;

  renderer.displaySettings();
  assert.match(renderer.app.innerHTML, /Idioma da interface/);
  assert.match(renderer.app.innerHTML, /value="pt-BR" selected>Português \(BR\)/);
  const fromSettings = renderer.changeLanguage("en-US");
  assert.match(renderer.app.innerHTML, /Interface language/);
  await fromSettings;
  renderer.displayWelcome();
  assert.match(renderer.app.innerHTML, /value="en-US" selected>English/);

  await Promise.all([renderer.changeLanguage("en-US"), renderer.changeLanguage("pt-BR")]);
  await main.saveSettings({ language: "unsupported", theme: "paper" });
  assert.equal((await main.resetSettings()).language, "pt-BR");
  const restarted = await startMain(directory, "en-US");
  assert.equal(restarted.bootQuery.bootLanguage, "pt-BR");
  assert.equal((await restarted.getSettings()).language, "pt-BR");
  const restartedRenderer = startRenderer(restarted, "en-US");
  assert.equal(restartedRenderer.bootText, "Preparando DiskSnoop...");
  await restartedRenderer.ready;
  await restarted.saveSettings({});
});
