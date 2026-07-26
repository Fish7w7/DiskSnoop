const SCAN_COMPLETE_DESCRIPTION_KEY = "update.scanCompleteBadgeDescription";
const SCAN_COMPLETE_DESCRIPTION_FALLBACK = "Scan concluído";

function createTaskbarBadgeController({ nativeImage, iconPath, translate }) {
  const badgeIcon = nativeImage.createFromPath(iconPath);

  function markScanCompleteIfUnfocused(window, locale) {
    if (!window || window.isDestroyed?.() || window.isFocused?.()) return false;
    if (typeof window.setOverlayIcon !== "function" || badgeIcon.isEmpty?.()) return false;
    const description = translate?.(locale, SCAN_COMPLETE_DESCRIPTION_KEY)
      || SCAN_COMPLETE_DESCRIPTION_FALLBACK;
    window.setOverlayIcon(badgeIcon, description);
    return true;
  }

  function clear(window) {
    if (!window || window.isDestroyed?.() || typeof window.setOverlayIcon !== "function") return false;
    window.setOverlayIcon(null, "");
    return true;
  }

  return { markScanCompleteIfUnfocused, clear };
}

module.exports = {
  SCAN_COMPLETE_DESCRIPTION_KEY,
  SCAN_COMPLETE_DESCRIPTION_FALLBACK,
  createTaskbarBadgeController
};
