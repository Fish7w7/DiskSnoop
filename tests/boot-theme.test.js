const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  BOOT_BACKGROUND_BY_THEME,
  LEGACY_THEME_MAP,
  resolveBootThemePreference,
  resolveBootBackground
} = require("../src/main/boot-theme");

test("espelha exatamente as cores de fundo definidas nos temas do CSS", () => {
  assert.deepEqual(BOOT_BACKGROUND_BY_THEME, {
    light: "#fbfcfe",
    dark: "#05070a",
    paper: "#f4ecdc",
    graphite: "#17181a",
    systemDark: "#0e1117"
  });

  const css = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "styles.css"), "utf8");
  assert.match(css, /:root\s*\{[\s\S]*?--background:\s*#fbfcfe;/);
  assert.match(css, /:root\[data-theme="dark"\]\s*\{[\s\S]*?--background:\s*#05070a;/);
  assert.match(css, /:root\[data-theme="paper"\]\s*\{[\s\S]*?--background:\s*#f4ecdc;/);
  assert.match(css, /:root\[data-theme="graphite"\]\s*\{[\s\S]*?--background:\s*#17181a;/);
  assert.match(css, /:root\[data-theme="system"\]\s*\{[\s\S]*?--background:\s*#0e1117;/);
});

test("resolve temas explícitos sem depender do tema do sistema", () => {
  assert.equal(resolveBootBackground("light", true), "#fbfcfe");
  assert.equal(resolveBootBackground("dark", false), "#05070a");
  assert.equal(resolveBootBackground("paper", true), "#f4ecdc");
  assert.equal(resolveBootBackground("graphite", false), "#17181a");
});

test("normaliza a preferência enviada ao primeiro HTML", () => {
  assert.deepEqual(LEGACY_THEME_MAP, { black: "dark", hacker: "graphite", neon: "graphite" });
  assert.equal(resolveBootThemePreference("paper"), "paper");
  assert.equal(resolveBootThemePreference("GRAPHITE"), "graphite");
  assert.equal(resolveBootThemePreference("neon"), "graphite");
  assert.equal(resolveBootThemePreference("HACKER"), "graphite");
  assert.equal(resolveBootThemePreference("unknown"), "dark");
  assert.equal(resolveBootThemePreference(undefined), "dark");
});

test("usa o tema do sistema quando explícito e dark como fallback seguro", () => {
  assert.equal(resolveBootBackground("system", true), "#0e1117");
  assert.equal(resolveBootBackground("system", false), "#fbfcfe");
  assert.equal(resolveBootBackground("unknown", true), "#05070a");
  assert.equal(resolveBootBackground(undefined, false), "#05070a");

  const html = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "index.html"), "utf8");
  assert.match(html, /new URLSearchParams\(location\.search\)\.get\("bootTheme"\)/);
  assert.match(html, /legacyThemes = \{ hacker: "graphite", neon: "graphite" \}/);
  assert.match(html, /supportedThemes = \["light", "dark", "paper", "graphite", "system"\]/);
  assert.match(html, /localStorage\.setItem\("disksnoop-theme", normalizedSavedTheme\)/);

  const main = fs.readFileSync(path.join(__dirname, "..", "src", "main", "main.js"), "utf8");
  assert.match(main, /loadFile\(paths\.renderer,\s*\{\s*query:\s*\{\s*bootTheme\s*\}\s*\}\)/);
  assert.match(main, /theme: resolveBootThemePreference\(saved\.theme \?\? defaultSettings\.theme\)/);
  assert.match(main, /if \(saved\.theme && saved\.theme !== settings\.theme\) await writeJson\("settings\.json", settings\);/);
  assert.match(main, /theme: resolveBootThemePreference\(nextSettings\?\.theme \?\? current\.theme\)/);
});
