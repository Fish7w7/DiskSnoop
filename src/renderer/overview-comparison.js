(function initializeOverviewComparison(root) {
  const REVIEWABLE_NOISE_FLOOR_BYTES = 50 * 1024 * 1024;
  const REVIEWABLE_NOISE_RATIO = 0.005;

  function reviewableNoiseThreshold(currentReviewableBytes) {
    const current = Math.max(0, Number(currentReviewableBytes) || 0);
    return Math.max(REVIEWABLE_NOISE_FLOOR_BYTES, current * REVIEWABLE_NOISE_RATIO);
  }

  function isReviewableDeltaStable(deltaBytes, currentReviewableBytes) {
    return Math.abs(Number(deltaBytes) || 0) < reviewableNoiseThreshold(currentReviewableBytes);
  }

  function observedFreeDelta({ freeBefore, freeAfter } = {}) {
    if (!Number.isFinite(freeBefore) || !Number.isFinite(freeAfter) || freeBefore < 0 || freeAfter < 0) return null;
    return freeAfter - freeBefore;
  }

  const api = {
    REVIEWABLE_NOISE_FLOOR_BYTES,
    REVIEWABLE_NOISE_RATIO,
    reviewableNoiseThreshold,
    isReviewableDeltaStable,
    observedFreeDelta
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.diskSnoopOverviewComparison = api;
  }
})(typeof window !== "undefined" ? window : null);
