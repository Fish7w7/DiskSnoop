const BOOT_BACKGROUND_BY_THEME = Object.freeze({
  light: "#fbfcfe",
  dark: "#05070a",
  paper: "#f4ecdc",
  graphite: "#17181a",
  systemDark: "#0e1117"
});

const LEGACY_THEME_MAP = Object.freeze({
  black: "dark",
  hacker: "graphite",
  neon: "graphite"
});
const BOOT_THEME_PREFERENCES = new Set(["light", "dark", "paper", "graphite", "system"]);

function resolveBootThemePreference(themePreference) {
  const theme = String(themePreference || "").toLowerCase();
  if (BOOT_THEME_PREFERENCES.has(theme)) return theme;
  return LEGACY_THEME_MAP[theme] || "dark";
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
  LEGACY_THEME_MAP,
  resolveBootThemePreference,
  resolveBootBackground
};
