const BOOT_BACKGROUND_BY_THEME = Object.freeze({
  light: "#fbfcfe",
  dark: "#05070a",
  hacker: "#020604",
  neon: "#090814",
  systemDark: "#0e1117"
});

const BOOT_THEME_PREFERENCES = new Set(["light", "dark", "hacker", "neon", "system"]);

function resolveBootThemePreference(themePreference) {
  const theme = String(themePreference || "").toLowerCase();
  return BOOT_THEME_PREFERENCES.has(theme) ? theme : "system";
}

function resolveBootBackground(themePreference, shouldUseDarkColors = false) {
  const theme = resolveBootThemePreference(themePreference);
  if (theme === "system") {
    return shouldUseDarkColors ? BOOT_BACKGROUND_BY_THEME.systemDark : BOOT_BACKGROUND_BY_THEME.light;
  }
  if (BOOT_BACKGROUND_BY_THEME[theme]) return BOOT_BACKGROUND_BY_THEME[theme];
  return shouldUseDarkColors ? BOOT_BACKGROUND_BY_THEME.systemDark : BOOT_BACKGROUND_BY_THEME.light;
}

module.exports = {
  BOOT_BACKGROUND_BY_THEME,
  resolveBootThemePreference,
  resolveBootBackground
};
