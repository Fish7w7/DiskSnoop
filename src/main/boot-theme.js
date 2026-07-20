const BOOT_BACKGROUND_BY_THEME = Object.freeze({
  light: "#fbfcfe",
  dark: "#05070a",
  hacker: "#020604",
  neon: "#090814",
  systemDark: "#0e1117"
});

function resolveBootBackground(themePreference, shouldUseDarkColors = false) {
  const theme = String(themePreference || "").toLowerCase();
  if (theme === "system") {
    return shouldUseDarkColors ? BOOT_BACKGROUND_BY_THEME.systemDark : BOOT_BACKGROUND_BY_THEME.light;
  }
  if (BOOT_BACKGROUND_BY_THEME[theme]) return BOOT_BACKGROUND_BY_THEME[theme];
  return shouldUseDarkColors ? BOOT_BACKGROUND_BY_THEME.systemDark : BOOT_BACKGROUND_BY_THEME.light;
}

module.exports = {
  BOOT_BACKGROUND_BY_THEME,
  resolveBootBackground
};
