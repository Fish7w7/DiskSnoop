const test = require("node:test");
const assert = require("node:assert/strict");

const {
  REVIEWABLE_NOISE_FLOOR_BYTES,
  reviewableNoiseThreshold,
  isReviewableDeltaStable
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

test("usa 0,5% quando o total revisável torna o percentual maior", () => {
  const currentReviewable = 20 * GB;
  assert.equal(reviewableNoiseThreshold(currentReviewable), currentReviewable * 0.005);
  assert.equal(isReviewableDeltaStable(100 * MB, currentReviewable), true);
  assert.equal(isReviewableDeltaStable(103 * MB, currentReviewable), false);
});
