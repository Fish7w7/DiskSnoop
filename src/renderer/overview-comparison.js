const REVIEWABLE_NOISE_FLOOR_BYTES = 50 * 1024 * 1024;
const REVIEWABLE_NOISE_RATIO = 0.005;

function reviewableNoiseThreshold(currentReviewableBytes) {
  const current = Math.max(0, Number(currentReviewableBytes) || 0);
  return Math.max(REVIEWABLE_NOISE_FLOOR_BYTES, current * REVIEWABLE_NOISE_RATIO);
}

function isReviewableDeltaStable(deltaBytes, currentReviewableBytes) {
  return Math.abs(Number(deltaBytes) || 0) < reviewableNoiseThreshold(currentReviewableBytes);
}

const overviewComparison = {
  REVIEWABLE_NOISE_FLOOR_BYTES,
  REVIEWABLE_NOISE_RATIO,
  reviewableNoiseThreshold,
  isReviewableDeltaStable
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = overviewComparison;
}

if (typeof window !== "undefined") {
  window.diskSnoopOverviewComparison = overviewComparison;
}
