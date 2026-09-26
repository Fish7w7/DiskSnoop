const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  canNavigateWithinRoot,
  createContentNavigation,
  navigateContentPath,
  canGoBackContent,
  backContentPath,
  contentBreadcrumbs,
  compactContentBreadcrumbs,
  knownLargeFolderSizes,
  decorateContentItems,
  sortContentItems,
  unknownContentFolders,
  measureUnknownContentFolders
} = require("../src/renderer/content-browser");

test("navegação começa na pasta selecionada, entra em subpasta e volta", () => {
  const navigation = createContentNavigation("C:\\Users\\oloco\\AppData");

  assert.equal(navigation.currentPath, "C:\\Users\\oloco\\AppData");
  assert.equal(navigation.currentPath, navigation.rootPath);
  assert.deepEqual(navigation.history, [navigation.rootPath]);
  assert.equal(canGoBackContent(navigation), false);
  assert.equal(navigateContentPath(navigation, "C:\\Users\\oloco\\AppData\\Local"), true);
  assert.equal(navigation.currentPath, "C:\\Users\\oloco\\AppData\\Local");
  assert.equal(canGoBackContent(navigation), true);
  assert.equal(backContentPath(navigation), "C:\\Users\\oloco\\AppData");
  assert.equal(canGoBackContent(navigation), false);
});

test("breadcrumb representa ancestrais clicáveis dentro da raiz", () => {
  const navigation = createContentNavigation("C:\\Users\\oloco\\AppData");
  navigateContentPath(navigation, "C:\\Users\\oloco\\AppData\\Local\\NVIDIA Corporation");

  assert.deepEqual(contentBreadcrumbs(navigation), [
    { label: "AppData", path: "C:\\Users\\oloco\\AppData" },
    { label: "Local", path: "C:\\Users\\oloco\\AppData\\Local" },
    { label: "NVIDIA Corporation", path: "C:\\Users\\oloco\\AppData\\Local\\NVIDIA Corporation" }
  ]);
  assert.equal(navigateContentPath(navigation, "C:\\Users\\oloco\\AppData\\Local"), true);
  assert.equal(navigation.currentPath, "C:\\Users\\oloco\\AppData\\Local");
  assert.deepEqual(navigation.history, [
    "C:\\Users\\oloco\\AppData",
    "C:\\Users\\oloco\\AppData\\Local"
  ]);
  assert.equal(backContentPath(navigation), "C:\\Users\\oloco\\AppData");
});

test("breadcrumb comprimido preserva raiz, pasta atual e níveis finais", () => {
  const navigation = createContentNavigation("C:\\ProgramData");
  navigateContentPath(navigation, "C:\\ProgramData\\NVIDIA Corporation\\NVIDIA App\\UpdateFramework\\grd\\post-processing\\Display.Driver");

  const compact = compactContentBreadcrumbs(contentBreadcrumbs(navigation), 5);

  assert.equal(compact[0].label, "ProgramData");
  assert.equal(compact[1].isEllipsis, true);
  assert.deepEqual(compact[1].hiddenLabels, ["NVIDIA Corporation", "NVIDIA App", "UpdateFramework"]);
  assert.deepEqual(compact.slice(-2).map((crumb) => crumb.label), ["post-processing", "Display.Driver"]);
});

test("bloqueia navegação acima da raiz original", () => {
  const navigation = createContentNavigation("C:\\Users\\oloco\\AppData");

  assert.equal(canNavigateWithinRoot(navigation.rootPath, "C:\\Users\\oloco"), false);
  assert.equal(navigateContentPath(navigation, "C:\\Users\\oloco"), false);
  assert.equal(navigation.currentPath, navigation.rootPath);
  assert.equal(backContentPath(navigation), null);
});

test("Voltar deriva o nível anterior do caminho mesmo com histórico incompleto", () => {
  const navigation = createContentNavigation("C:\\ProgramData");
  navigation.currentPath = "C:\\ProgramData\\NVIDIA Corporation\\NVIDIA App";
  navigation.history = [navigation.rootPath];

  assert.equal(canGoBackContent(navigation), true);
  assert.equal(backContentPath(navigation), "C:\\ProgramData\\NVIDIA Corporation");
  assert.deepEqual(navigation.history, ["C:\\ProgramData", "C:\\ProgramData\\NVIDIA Corporation"]);
});

test("reutiliza tamanho conhecido de largeFolders sem calcular pastas desconhecidas", () => {
  const scanSizes = knownLargeFolderSizes([
    { path: "C:\\Users\\oloco\\AppData\\Local", size: 19 }
  ]);
  const items = decorateContentItems([
    { name: "Local", path: "C:\\Users\\oloco\\AppData\\Local", type: "Pasta", size: 0 },
    { name: "Roaming", path: "C:\\Users\\oloco\\AppData\\Roaming", type: "Pasta", size: 0 }
  ], scanSizes, new Map());

  assert.deepEqual(items.map((item) => [item.name, item.sizeKnown, item.displaySize]), [
    ["Local", true, 19],
    ["Roaming", false, null]
  ]);
});

test("resultado manual atualiza somente a pasta solicitada", () => {
  const source = [
    { name: "A", path: "D:\\Root\\A", type: "Pasta", size: 0 },
    { name: "B", path: "D:\\Root\\B", type: "Pasta", size: 0 }
  ];
  const measured = new Map([["d:\\root\\a", 1234]]);
  const items = decorateContentItems(source, new Map(), measured);

  assert.equal(items[0].displaySize, 1234);
  assert.equal(items[0].sizeKnown, true);
  assert.equal(items[1].displaySize, null);
  assert.equal(items[1].sizeKnown, false);
});

test("cálculo em lote processa somente pastas desconhecidas e continua após falha", async () => {
  const items = [
    { name: "Known", path: "D:\\Root\\Known", type: "Pasta", sizeKnown: true, displaySize: 10 },
    { name: "First", path: "D:\\Root\\First", type: "Pasta", sizeKnown: false, displaySize: null },
    { name: "Broken", path: "D:\\Root\\Broken", type: "Pasta", sizeKnown: false, displaySize: null },
    { name: "File", path: "D:\\Root\\file.bin", type: "Arquivo", sizeKnown: true, displaySize: 20 },
    { name: "Last", path: "D:\\Root\\Last", type: "Pasta", sizeKnown: false, displaySize: null }
  ];
  const calls = [];
  const progress = [];
  const result = await measureUnknownContentFolders(items, async (item) => {
    calls.push(item.name);
    if (item.name === "Broken") throw new Error("Acesso negado");
    return { size: item.name === "First" ? 100 : 300 };
  }, (entry) => progress.push([entry.item.name, entry.ok]));

  assert.deepEqual(unknownContentFolders(items).map((item) => item.name), ["First", "Broken", "Last"]);
  assert.deepEqual(calls, ["First", "Broken", "Last"]);
  assert.deepEqual(progress, [["First", true], ["Broken", false], ["Last", true]]);
  assert.equal(result.successes.length, 2);
  assert.equal(result.failures.length, 1);
});

test("resultados do lote permanecem reutilizáveis no cache temporário", () => {
  const cache = new Map([["d:\\root\\child", 4096]]);
  const revisited = decorateContentItems([
    { name: "Child", path: "D:\\Root\\Child", type: "Pasta", size: 0 }
  ], new Map(), cache);

  assert.equal(revisited[0].sizeKnown, true);
  assert.equal(revisited[0].displaySize, 4096);
});

test("ordena arquivos, pastas e tamanhos desconhecidos", () => {
  const items = [
    { name: "Unknown", type: "Pasta", sizeKnown: false, displaySize: null, modifiedAt: "2024-01-01" },
    { name: "File", type: "Arquivo", sizeKnown: true, displaySize: 20, modifiedAt: "2025-01-01" },
    { name: "Known", type: "Pasta", sizeKnown: true, displaySize: 10, modifiedAt: "2023-01-01" }
  ];

  assert.deepEqual(sortContentItems(items, "size", "asc").map((item) => item.name), ["Known", "File", "Unknown"]);
  assert.deepEqual(sortContentItems(items, "name", "desc").map((item) => item.name), ["Unknown", "Known", "File"]);
  assert.deepEqual(sortContentItems(items, "modified", "desc").map((item) => item.name), ["File", "Unknown", "Known"]);
  assert.deepEqual(sortContentItems(items, "type", "asc").map((item) => item.name), ["File", "Known", "Unknown"]);
});

test("renderer carrega sob demanda, preserva o overlay em erro e calcula somente por ação manual", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "renderer.js"), "utf8");
  const loadStart = renderer.indexOf("async function loadContentPreviewDirectory(targetPath)");
  const loadEnd = renderer.indexOf("async function openContentPreview(item)", loadStart);
  const loadHandler = renderer.slice(loadStart, loadEnd);
  const calculateStart = renderer.indexOf("async function calculateContentItemSize(targetPath)");
  const calculateEnd = renderer.indexOf("function renderTab()", calculateStart);
  const calculateHandler = renderer.slice(calculateStart, calculateEnd);

  assert.match(renderer, /if \(action === "show-selected" && state\.selectedItem\)[\s\S]*?openContentPreview\(state\.selectedItem\)/);
  assert.match(renderer, /if \(action === "content-back"\) await backContentPreview\(\)/);
  assert.match(renderer, /if \(action === "content-breadcrumb"[\s\S]*?enterContentPreviewDirectory/);
  assert.match(renderer, /compactContentBreadcrumbs\(contentBrowser\.contentBreadcrumbs\(navigation\), 4\)/);
  assert.match(renderer, /contentBrowser\.canGoBackContent\(navigation\) \? "" : "disabled"/);
  assert.match(renderer, /if \(action === "select-content-item"[\s\S]*?selectContentPreviewItem[\s\S]*?return;/);
  assert.match(renderer, /document\.addEventListener\("dblclick"[\s\S]*?item\.type !== "Pasta"[\s\S]*?canNavigateWithinRoot[\s\S]*?enterContentPreviewDirectory\(item\.path\)/);
  assert.match(renderer, /if \(action === "content-refresh"[\s\S]*?loadContentPreviewDirectory\(state\.contentPreview\.navigation\.currentPath\)/);
  assert.match(renderer, /if \(action === "close-content-preview"\)[\s\S]*?state\.contentPreview = null/);
  assert.match(renderer, /async function openContentPreview\(item\)[\s\S]*?createContentNavigation\(item\.path\)[\s\S]*?sizeCache: new Map\(\)/);
  assert.match(loadHandler, /await api\.listContents\(targetPath\)/);
  assert.doesNotMatch(loadHandler, /navigation\.(?:rootPath|currentPath|history)\s*=/);
  assert.match(loadHandler, /preview\.error = t\("content\.readError"/);
  assert.doesNotMatch(loadHandler, /state\.contentPreview = null/);
  assert.match(calculateHandler, /await api\.measurePathSize\(targetPath\)/);
  assert.match(calculateHandler, /preview\.sizeCache\.set\(itemKey/);
  assert.match(calculateHandler, /measureUnknownContentFolders\([\s\S]*?preview\.measurementErrors\.set/);
  assert.match(renderer, /!unknownFolders\.length \? "disabled"/);
  assert.equal((renderer.match(/api\.measurePathSize\(/g) || []).length, 2);
});

test("backend lista apenas filhos imediatos e expõe medição separada", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "src", "main", "main.js"), "utf8");
  const preload = fs.readFileSync(path.join(__dirname, "..", "src", "main", "preload.js"), "utf8");
  const listStart = main.indexOf('ipcMain.handle("path:listContents"');
  const listEnd = main.indexOf('ipcMain.handle("path:measureSize"', listStart);
  const listHandler = main.slice(listStart, listEnd);

  assert.match(listHandler, /fs\.readdir\(listPath, \{ withFileTypes: true \}\)/);
  assert.doesNotMatch(listHandler, /measurePath\(/);
  assert.match(main, /ipcMain\.handle\("path:measureSize"[\s\S]*?await measurePath\(targetPath\)/);
  assert.match(preload, /listContents: \(targetPath\) => unwrapInvoke\("path:listContents", targetPath\)/);
  assert.match(preload, /measurePathSize: \(targetPath\) => unwrapInvoke\("path:measureSize", targetPath\)/);
});
