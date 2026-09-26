const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildLargeFolderTree,
  filterLargeFolderTree,
  flattenLargeFolderTree
} = require("../src/renderer/large-folder-tree");

const GB = 1024 * 1024 * 1024;

function folder(id, itemPath, size) {
  return {
    id,
    name: itemPath.split("\\").pop(),
    path: itemPath,
    size
  };
}

const hierarchyItems = [
  folder("windows", "C:\\Windows", 32 * GB),
  folder("winsxs", "C:\\Windows\\WinSxS", 17 * GB),
  folder("system32", "C:\\Windows\\System32", 8 * GB),
  folder("drivers", "C:\\Windows\\System32\\DriverStore", 3 * GB)
];

test("constrói relação pai e filho usando os caminhos completos", () => {
  const [windows] = buildLargeFolderTree(hierarchyItems);

  assert.equal(windows.item.id, "windows");
  assert.deepEqual(windows.children.map((node) => node.item.id), ["winsxs", "system32"]);
  assert.equal(windows.children[1].children[0].item.id, "drivers");
});

test("raízes iniciam recolhidas e expandir ou recolher controla os descendentes", () => {
  const roots = buildLargeFolderTree(hierarchyItems);

  assert.deepEqual(flattenLargeFolderTree(roots, new Set()).map((row) => row.item.id), ["windows"]);
  assert.deepEqual(
    flattenLargeFolderTree(roots, new Set(["windows"])).map((row) => row.item.id),
    ["windows", "winsxs", "system32"]
  );
  assert.deepEqual(
    flattenLargeFolderTree(roots, new Set(["windows", "system32"])).map((row) => row.item.id),
    ["windows", "winsxs", "system32", "drivers"]
  );
  assert.deepEqual(flattenLargeFolderTree(roots, new Set(["system32"])).map((row) => row.item.id), ["windows"]);
});

test("comprime cadeia linear com tamanhos praticamente iguais e seleciona o item final", () => {
  const roots = buildLargeFolderTree([
    folder("nvidia", "C:\\NVIDIA Corporation", 4 * GB),
    folder("app", "C:\\NVIDIA Corporation\\NVIDIA App", 4 * GB - 8 * 1024 * 1024),
    folder("updates", "C:\\NVIDIA Corporation\\NVIDIA App\\UpdateFramework", 4 * GB - 12 * 1024 * 1024),
    folder("artifacts", "C:\\NVIDIA Corporation\\NVIDIA App\\UpdateFramework\\ota-artifacts", 4 * GB - 18 * 1024 * 1024)
  ]);
  const [row] = flattenLargeFolderTree(roots, new Set());

  assert.equal(row.label, "NVIDIA Corporation › NVIDIA App › UpdateFramework › ota-artifacts");
  assert.equal(row.item.id, "artifacts");
  assert.equal(row.hasChildren, false);
});

test("não comprime cadeia quando existe ramificação relevante", () => {
  const roots = buildLargeFolderTree([
    folder("appdata", "C:\\Users\\User\\AppData", 26 * GB),
    folder("local", "C:\\Users\\User\\AppData\\Local", 19 * GB),
    folder("roaming", "C:\\Users\\User\\AppData\\Roaming", 7 * GB)
  ]);
  const [row] = flattenLargeFolderTree(roots, new Set());

  assert.equal(row.label, "AppData");
  assert.equal(row.hasChildren, true);
});

test("ordena filhos por tamanho decrescente dentro do pai", () => {
  const [root] = buildLargeFolderTree([
    folder("root", "D:\\Dados", 30 * GB),
    folder("small", "D:\\Dados\\Menor", 2 * GB),
    folder("large", "D:\\Dados\\Maior", 9 * GB),
    folder("medium", "D:\\Dados\\Media", 5 * GB)
  ]);

  assert.deepEqual(root.children.map((node) => node.item.id), ["large", "medium", "small"]);
});

test("filtro mantém ancestrais necessários para contextualizar um resultado", () => {
  const roots = buildLargeFolderTree(hierarchyItems);
  const filtered = filterLargeFolderTree(roots, (item) => item.name === "DriverStore");
  const rows = flattenLargeFolderTree(filtered, new Set(), { revealContext: true });

  assert.deepEqual(rows.map((row) => row.item.id), ["windows", "system32", "drivers"]);
});
