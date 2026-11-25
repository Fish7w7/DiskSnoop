const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spaceTotals } = require("../src/renderer/candidate-space");

const {
  REVIEWABLE_NOISE_FLOOR_BYTES,
  reviewableNoiseThreshold,
  isReviewableDeltaStable,
  observedFreeDelta
} = require("../src/renderer/overview-comparison");

const MB = 1024 ** 2;
const GB = 1024 ** 3;

test("usa 50 MB como piso da faixa de ruído", () => {
  assert.equal(REVIEWABLE_NOISE_FLOOR_BYTES, 50 * MB);
  assert.equal(reviewableNoiseThreshold(2 * GB), 50 * MB);
  assert.equal(isReviewableDeltaStable(49 * MB, 2 * GB), true);
  assert.equal(isReviewableDeltaStable(-49 * MB, 2 * GB), true);
  assert.equal(isReviewableDeltaStable(50 * MB, 2 * GB), false);
});

test("deduplica os tamanhos lógicos e só usa medições para a variação de espaço livre", () => {
  const parent = { path: "C:/Cache", riskLevel: "review", kind: "directory", size: 89 * MB };
  const child = { path: "c:/cache/file", riskLevel: "low", kind: "file", size: 89 * MB };
  const protectedItem = { path: "C:/Protected", riskLevel: "protected", kind: "file", size: 10 * MB };
  assert.deepEqual(spaceTotals([parent, child, protectedItem], [parent, child, protectedItem]), {
    occupied: 99 * MB, recoverable: 89 * MB, selected: 89 * MB
  });
  assert.equal(observedFreeDelta({ freeBefore: 2 * GB, freeAfter: 2 * GB, movedToQuarantine: 89 * MB }), 0);
  assert.equal(observedFreeDelta({ permanentlyDeleted: 89 * MB, freeBefore: null, freeAfter: 2 * GB }), null);
  assert.equal(observedFreeDelta({ freeBefore: 2 * GB, freeAfter: 2 * GB - 2 * MB }), -2 * MB);
});

test("usa 0,5% quando o total revisável torna o percentual maior", () => {
  const currentReviewable = 20 * GB;
  assert.equal(reviewableNoiseThreshold(currentReviewable), currentReviewable * 0.005);
  assert.equal(isReviewableDeltaStable(100 * MB, currentReviewable), true);
  assert.equal(isReviewableDeltaStable(103 * MB, currentReviewable), false);
});

test("não vaza declaração lexical que impeça o renderer de carregar", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "overview-comparison.js"), "utf8");
  const context = vm.createContext({ window: {} });
  vm.runInContext(source, context);
  assert.doesNotThrow(() => {
    vm.runInContext("const overviewComparison = window.diskSnoopOverviewComparison;", context);
  });
});
