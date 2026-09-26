const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  processItemsIndependently,
  replaceSelectionWithAiDelete,
  moveFailureKind
} = require("../src/renderer/candidate-batch-actions");

test("falha em um item não interrompe os demais nem registra o item como movido", async () => {
  const items = [{ id: "a" }, { id: "blocked" }, { id: "c" }];
  const attempted = [];
  const result = await processItemsIndependently(items, async (item) => {
    attempted.push(item.id);
    if (item.id === "blocked") throw new Error("EBUSY");
    return { id: `record-${item.id}` };
  });

  assert.deepEqual(attempted, ["a", "blocked", "c"]);
  assert.deepEqual(result.successes.map(({ item }) => item.id), ["a", "c"]);
  assert.deepEqual(result.failures.map(({ item }) => item.id), ["blocked"]);
  assert.equal(result.movedCount, 2);
  assert.equal(result.failedCount, 1);
});

test("Selecionar APAGAR substitui a seleção e exclui MANTER, REVISAR e protegidos", () => {
  const selectedIds = new Set(["old", "keep", "review"]);
  const candidates = [
    { id: "delete-ok", allowed: true },
    { id: "delete-protected", allowed: false },
    { id: "keep", allowed: true },
    { id: "review", allowed: true }
  ];
  const classifications = new Map([
    ["delete-ok", "APAGAR"],
    ["delete-protected", "APAGAR"],
    ["keep", "MANTER"],
    ["review", "REVISAR"]
  ]);

  const summary = replaceSelectionWithAiDelete(selectedIds, candidates, classifications, (item) => item.allowed);

  assert.deepEqual([...selectedIds], ["delete-ok"]);
  assert.deepEqual(summary, { total: 2, selectedCount: 1, protectedCount: 1 });
});

test("diferencia item em uso, acesso negado e proteção do DiskSnoop", () => {
  assert.equal(moveFailureKind("[EBUSY] Item em uso por outro processo."), "in-use");
  assert.equal(moveFailureKind("[EACCES] Acesso negado ao mover este item."), "access-denied");
  assert.equal(moveFailureKind("O DiskSnoop nao move este caminho sensivel."), "protected");
});

test("backend preserva códigos úteis de falha na mensagem", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "src", "main", "main.js"), "utf8");
  assert.match(main, /error\?\.code === "EBUSY" \|\| error\?\.code === "ENOTEMPTY"/);
  assert.match(main, /error\?\.code === "EACCES" \|\| error\?\.code === "EPERM"/);
});
