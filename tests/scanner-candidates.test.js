const test = require("node:test");
const assert = require("node:assert/strict");

const {
  folderType,
  removeRedundantChildCandidates
} = require("../src/scanner/scanner");

const settings = {
  detectNodeModules: true,
  detectBuildCaches: true,
  detectOldDownloads: true
};

test("node_modules de projeto continua como candidato de desenvolvimento", () => {
  const result = folderType(
    "node_modules",
    "C:\\Users\\User\\Projects\\sample-app\\node_modules",
    settings
  );

  assert.equal(result?.type, "Projetos dev");
  assert.match(result?.reason || "", /npm install/);
});

test("node_modules de app.asar instalado não vira lixo de projeto", () => {
  const result = folderType(
    "node_modules",
    "C:\\Users\\User\\AppData\\Local\\Programs\\auri-desktop\\resources\\app.asar\\node_modules",
    settings
  );

  assert.equal(result, null);
});

test("node_modules de extensão do VS Code não vira lixo de projeto", () => {
  const result = folderType(
    "node_modules",
    "C:\\Users\\User\\.vscode\\extensions\\publisher.extension-1.0.0\\node_modules",
    settings
  );

  assert.equal(result, null);
});

test("remove filho redundante coberto por candidato pai equivalente", () => {
  const candidates = removeRedundantChildCandidates([
    { path: "C:\\Users\\User\\AppData\\Local\\npm-cache\\_cacache", type: "Caches", security: "Seguro revisar", size: 861 },
    { path: "C:\\Users\\User\\AppData\\Local\\npm-cache", type: "Caches", security: "Seguro revisar", size: 879 }
  ]);

  assert.deepEqual(candidates.map((item) => item.path), ["C:\\Users\\User\\AppData\\Local\\npm-cache"]);
});

test("mantém pai e filho quando classificação ou risco diferem", () => {
  const candidates = removeRedundantChildCandidates([
    { path: "D:\\workspace\\project\\build", type: "Projetos dev", security: "Seguro revisar", size: 900 },
    { path: "D:\\workspace\\project\\build\\review", type: "Projetos dev", security: "Verificar antes", size: 400 },
    { path: "D:\\workspace\\project\\build\\cache", type: "Caches", security: "Seguro revisar", size: 300 }
  ]);

  assert.equal(candidates.length, 3);
});
