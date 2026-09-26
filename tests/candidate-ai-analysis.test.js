const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildAnalysisPrompt,
  parseAnalysisResponse,
  associateAnalysisResponse
} = require("../src/renderer/candidate-ai-analysis");

const candidates = [
  { id: "candidate-cache-a1", name: "Cache", path: "C:\\Cache" },
  { id: "candidate-node-b2", name: "node_modules", path: "D:\\Project\\node_modules" },
  { id: "candidate-log-c3", name: "Logs", path: "C:\\Logs" }
];

test("gera texto de exportação com o ID de cada candidato", () => {
  const text = buildAnalysisPrompt(candidates.slice(0, 2), {
    intro: "Candidatos:",
    idLabel: "ID",
    formatDetails: (item) => [`- Caminho: ${item.path}`],
    footerLines: ["Use <ID> | APAGAR, MANTER ou REVISAR."]
  });

  assert.match(text, /- ID: candidate-cache-a1/);
  assert.match(text, /- ID: candidate-node-b2/);
  assert.match(text, /<ID> \| APAGAR/);
});

test("interpreta os três estados aceitos", () => {
  const parsed = parseAnalysisResponse([
    "candidate-cache-a1 | APAGAR",
    "candidate-node-b2 | MANTER",
    "candidate-log-c3 | REVISAR"
  ].join("\n"));

  assert.deepEqual(parsed.entries.map((entry) => entry.state), ["APAGAR", "MANTER", "REVISAR"]);
  assert.equal(parsed.invalid, 0);
});

test("ignora texto livre antes e depois das linhas classificadas", () => {
  const parsed = parseAnalysisResponse("Minha análise:\ncandidate-cache-a1 | APAGAR\nRevise os detalhes acima.");

  assert.deepEqual(parsed.entries, [{ id: "candidate-cache-a1", state: "APAGAR" }]);
  assert.equal(parsed.invalid, 0);
});

test("ignora IDs desconhecidos, repetidos e estados inválidos", () => {
  const imported = associateAnalysisResponse([
    "candidate-cache-a1 | APAGAR",
    "candidate-cache-a1 | MANTER",
    "unknown-id | REVISAR",
    "candidate-node-b2 | REMOVER"
  ].join("\n"), candidates);

  assert.equal(imported.classifications.get("candidate-cache-a1"), "APAGAR");
  assert.equal(imported.classifications.has("unknown-id"), false);
  assert.equal(imported.notFound, 3);
});

test("associa cada classificação ao candidato correspondente", () => {
  const imported = associateAnalysisResponse([
    "candidate-log-c3 | REVISAR",
    "candidate-node-b2 | MANTER",
    "candidate-cache-a1 | APAGAR"
  ].join("\n"), candidates);

  assert.deepEqual([...imported.classifications.entries()], [
    ["candidate-log-c3", "REVISAR"],
    ["candidate-node-b2", "MANTER"],
    ["candidate-cache-a1", "APAGAR"]
  ]);
  assert.deepEqual(imported.counts, { APAGAR: 1, MANTER: 1, REVISAR: 1 });
  assert.equal(imported.notFound, 0);
});
