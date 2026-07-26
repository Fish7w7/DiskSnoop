const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  languageFromSystemLocale,
  resolveInitialLanguage
} = require("../src/main/system-language");

test("primeiro uso escolhe português para qualquer locale iniciado por pt", () => {
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

test("falha ou locale inesperado mantém o fallback pt-BR", () => {
  for (const locale of [undefined, null, "", "   ", 42]) {
    assert.equal(languageFromSystemLocale(locale), "pt-BR");
  }
  assert.deepEqual(resolveInitialLanguage(undefined, () => {
    throw new Error("locale unavailable");
  }), {
    language: "pt-BR",
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

test("decisão inicial persistida e troca manual continuam sendo a fonte de verdade", () => {
  const stored = {};
  const firstRun = resolveInitialLanguage(stored.language, () => "en-US");
  if (firstRun.shouldPersist) stored.language = firstRun.language;
  assert.equal(stored.language, "en-US");

  assert.equal(resolveInitialLanguage(stored.language, () => "pt-BR").language, "en-US");

  stored.language = "pt-BR";
  assert.equal(resolveInitialLanguage(stored.language, () => "en-US").language, "pt-BR");
});

test("main grava a primeira decisão no settings.json e preserva o save manual", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "src", "main", "main.js"), "utf8");
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "renderer.js"), "utf8");
  assert.match(main, /resolveInitialLanguage\(\s*saved\.language,\s*\(\) => app\.getLocale\(\),\s*defaultSettings\.language\s*\)/);
  assert.match(main, /if \(languageResolution\.shouldPersist \|\| \(saved\.theme && saved\.theme !== settings\.theme\)\)\s*\{[\s\S]*?writeJson\("settings\.json", settings\)/);
  assert.match(main, /ipcMain\.handle\("settings:save"[\s\S]*?writeJson\("settings\.json", settings\)/);
  assert.match(renderer, /if \(field === "language"\)\s*\{[\s\S]*?state\.settings\.language = languageLabels\[target\.value\][\s\S]*?persistSettingsSoon\(\);/);
});
