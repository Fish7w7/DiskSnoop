const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  BOOT_BACKGROUND_BY_THEME,
  resolveBootThemePreference,
  resolveBootBackground
} = require("../src/main/boot-theme");

test("espelha exatamente as cores de fundo definidas nos temas do CSS", () => {
  assert.deepEqual(BOOT_BACKGROUND_BY_THEME, {
    light: "#fbfcfe",
    dark: "#05070a",
    hacker: "#020604",
    neon: "#090814",
    systemDark: "#0e1117"
  });

  const css = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "styles.css"), "utf8");
  assert.match(css, /:root\s*\{[\s\S]*?--background:\s*#fbfcfe;/);
  assert.match(css, /:root\[data-theme="dark"\]\s*\{[\s\S]*?--background:\s*#05070a;/);
  assert.match(css, /:root\[data-theme="hacker"\]\s*\{[\s\S]*?--background:\s*#020604;/);
  assert.match(css, /:root\[data-theme="neon"\]\s*\{[\s\S]*?--background:\s*#090814;/);
  assert.match(css, /:root\[data-theme="system"\]\s*\{[\s\S]*?--background:\s*#0e1117;/);
});

test("resolve temas explícitos sem depender do tema do sistema", () => {
  assert.equal(resolveBootBackground("light", true), "#fbfcfe");
  assert.equal(resolveBootBackground("dark", false), "#05070a");
  assert.equal(resolveBootBackground("hacker", false), "#020604");
  assert.equal(resolveBootBackground("neon", false), "#090814");
});

test("normaliza a preferência enviada ao primeiro HTML", () => {
  assert.equal(resolveBootThemePreference("neon"), "neon");
  assert.equal(resolveBootThemePreference("HACKER"), "hacker");
  assert.equal(resolveBootThemePreference("unknown"), "system");
  assert.equal(resolveBootThemePreference(undefined), "system");
});

test("usa o tema do sistema para system, valor ausente ou desconhecido", () => {
  assert.equal(resolveBootBackground("system", true), "#0e1117");
  assert.equal(resolveBootBackground("system", false), "#fbfcfe");
  assert.equal(resolveBootBackground("unknown", true), "#0e1117");
  assert.equal(resolveBootBackground(undefined, false), "#fbfcfe");

  const html = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "index.html"), "utf8");
  assert.match(html, /new URLSearchParams\(location\.search\)\.get\("bootTheme"\)/);
  assert.match(html, /supportedThemes\.includes\(bootTheme\)/);

  const main = fs.readFileSync(path.join(__dirname, "..", "src", "main", "main.js"), "utf8");
  assert.match(main, /loadFile\(paths\.renderer,\s*\{\s*query:\s*\{\s*bootTheme\s*\}\s*\}\)/);
});
