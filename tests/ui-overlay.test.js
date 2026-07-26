const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "styles.css"), "utf8");
const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "renderer.js"), "utf8");
const ptBR = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "i18n", "pt-BR.json"), "utf8"));
const enUS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "i18n", "en-US.json"), "utf8"));

test("backdrop preserva transparência em hover, foco e clique", () => {
  assert.match(css, /:root \.detail-overlay button\.detail-overlay-backdrop:is\(:hover, :focus, :active\)\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--background\) 54%, transparent\);/);
});

test("overlay pausa o scroll de fundo e mantém scroll somente no conteúdo", () => {
  assert.match(css, /\.content:has\(\.detail-overlay\)\s*\{\s*overflow:\s*hidden;/);
  assert.match(css, /\.detail-overlay-body\s*\{[\s\S]*?overflow-y:\s*auto;/);
});

test("todas as cinco telas de revisão abrem o mesmo overlay", () => {
  for (const action of ["select-folder", "select-file", "select-candidate", "select-duplicate", "select-leftover"]) {
    assert.match(renderer, new RegExp(`if \\(action === "${action}"\\) \\{[\\s\\S]*?state\\.detailOverlayOpen = true;`));
  }
  assert.doesNotMatch(renderer, /<h2>Detalhes<\/h2>/);
});

test("Pastas Grandes oferece texto de dúvida com contexto de segurança", () => {
  assert.match(renderer, /copyDoubtButton\(item, "folder"\)/);
  assert.match(renderer, /if \(context === "folder"\)[\s\S]*?safety:[\s\S]*?guidance:/);
  assert.match(renderer, /if \(context === "folder"\) return findFolder\(id\) \|\| state\.selectedItem;/);
});

test("estados vazios reutilizam ilustrações que herdam a cor do tema", () => {
  for (const kind of ["folder", "search", "history"]) {
    assert.match(renderer, new RegExp(`${kind}: .*stroke="currentColor"`));
  }
  assert.match(renderer, /function emptyPanel\(kind, title, text = ""\)/);
  assert.match(css, /\.empty-illustration\s*\{[\s\S]*?color:\s*var\(--accent\);/);
  assert.equal((renderer.match(/emptyPanel\("(?:folder|search|history)"/g) || []).length, 7);
});

test("refiltros mostram skeleton sem misturar placeholders e dados", () => {
  assert.match(renderer, /function skeletonRows\(count = 6\)/);
  assert.match(renderer, /tbody\.innerHTML = skeletonRows\(\);[\s\S]*?setTimeout\(\(\) => \{[\s\S]*?render\(\);[\s\S]*?\}, 32\);/);
  assert.match(renderer, /if \(isTableFilterField\(event\.target\.dataset\.field\)\) renderTableRefresh\(event\.target\);/);
  assert.match(css, /\.skeleton-block\s*\{[\s\S]*?background:\s*var\(--surfaceHover\);[\s\S]*?animation:\s*skeleton-pulse 1\.2s ease-in-out infinite;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.skeleton-block\s*\{[\s\S]*?animation:\s*none;[\s\S]*?opacity:\s*0\.6;/);
});

test("seletor de tema usa cards com previews fixos dos cinco temas", () => {
  assert.match(renderer, /function themeCardPicker\(currentTheme\)/);
  assert.doesNotMatch(renderer, /selectControl\("theme"/);
  for (const theme of ["light", "dark", "paper", "graphite", "system"]) {
    assert.match(css, new RegExp(`\\[data-theme-preview="${theme}"\\] \\.swatch-bg`));
  }
  assert.deepEqual(
    ["theme.light", "theme.dark", "theme.paper", "theme.graphite", "theme.system"].map((key) => ptBR.messages[key]),
    ["Claro", "Escuro", "Papel", "Grafite", "Sistema"]
  );
  assert.deepEqual(
    ["theme.light", "theme.dark", "theme.paper", "theme.graphite", "theme.system"].map((key) => enUS.messages[key]),
    ["Light", "Dark", "Paper", "Graphite", "System"]
  );
  assert.match(renderer, /if \(action === "select-theme"\)[\s\S]*?state\.settings\.theme = theme;[\s\S]*?render\(\);[\s\S]*?persistSettingsSoon\(\);/);
  assert.match(css, /\.theme-picker\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fill, minmax\(120px, 1fr\)\);/);
  assert.doesNotMatch(css, /data-theme="(?:hacker|neon)"|data-theme-preview="(?:hacker|neon)"/);
  assert.doesNotMatch(JSON.stringify(ptBR.messages) + JSON.stringify(enUS.messages), /Hacker|Neon/);
});

test("accent customizado aplica em tempo real e persiste separado do tema", () => {
  assert.match(renderer, /const ACCENT_PRESETS = \[[\s\S]*?"#2f80ff"[\s\S]*?"#38b000"[\s\S]*?\];/);
  assert.match(renderer, /function applyCustomAccent\(hex\)[\s\S]*?setProperty\("--accent", hex\)[\s\S]*?mixRgb\(hexToRgb\(hex\), hexToRgb\(surfaceHex \|\| "#ffffff"\), 0\.82\)/);
  assert.match(renderer, /function selectAccent\(hex\)[\s\S]*?customAccent: String\(hex\)\.toLowerCase\(\)[\s\S]*?persistSettingsSoon\(\)/);
  assert.match(renderer, /function applyTheme\(\)[\s\S]*?dataset\.theme = theme;[\s\S]*?applyCustomAccent\(state\.settings\?\.appearance\?\.customAccent \|\| null\);/);
  assert.equal(ptBR.messages["settings.accentCustom"], "Personalizada");
  assert.equal(enUS.messages["settings.accentCustom"], "Custom");
});

test("restaurar accent remove apenas a cor customizada e preserva o tema", () => {
  assert.match(renderer, /currentAccent \? `[\s\S]*?data-action="reset-accent"[\s\S]*?` : ""/);
  assert.match(renderer, /if \(action === "reset-accent"\) \{[\s\S]*?customAccent: null[\s\S]*?applyCustomAccent\(null\);[\s\S]*?persistSettingsSoon\(\);/);
  assert.doesNotMatch(
    renderer.match(/if \(action === "reset-accent"\) \{[\s\S]*?\n  \}/)?.[0] || "",
    /settings\.theme\s*=/
  );
  assert.equal(ptBR.messages["settings.resetAccent"], "Restaurar aparência padrão");
  assert.equal(enUS.messages["settings.resetAccent"], "Restore default appearance");
});

test("accent avisa contraste de interface abaixo de 3:1 sem bloquear a aplicação", () => {
  assert.match(renderer, /function checkAccentWarnings\(hex, tokens\) \{[\s\S]*?contrastRatio\(hex, tokens\.background\) < 3[\s\S]*?type: "contrast"/);
  assert.match(renderer, /function accentWarnings\(currentAccent\)[\s\S]*?checkAccentWarnings\(currentAccent, currentThemeColorTokens\(\)\)/);
  assert.match(renderer, /data-accent-warnings>\$\{accentWarnings\(currentAccent\)\}/);
  assert.match(css, /\.accent-warning\s*\{[\s\S]*?color:\s*var\(--textMuted\);/);
  assert.equal(ptBR.messages["settings.accentWarningContrast"], "Essa cor pode ficar difícil de enxergar no tema atual.");
  assert.equal(enUS.messages["settings.accentWarningContrast"], "This color may be hard to see in the current theme.");
});

test("Grafite recebe a camada de profundidade escura sem afetar Papel", () => {
  const finishStart = css.indexOf(':root[data-theme="dark"] .app-header');
  const finishEnd = css.indexOf("@media (max-width: 1100px)", finishStart);
  const darkFinish = css.slice(finishStart, finishEnd);
  assert.ok(finishStart >= 0 && finishEnd > finishStart);
  assert.doesNotMatch(darkFinish, /data-theme="paper"/);
  for (const selector of [
    ".app-header", ".sidebar", ".content", ".panel", "input", "option",
    "button.secondary", "tbody tr:hover", ".app-modal footer", ".path-row",
    ".window-controls button:hover", ".window-controls button.btn-close:hover"
  ]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(darkFinish, new RegExp(`:root\\[data-theme="graphite"\\] ${escaped}`));
  }
});

test("transição de aba só dispara quando a aba realmente muda", () => {
  assert.match(renderer, /const shouldAnimateTab = state\.screen === "app" && lastRenderedTab !== null && lastRenderedTab !== state\.tab;/);
  assert.match(renderer, /if \(shouldAnimateTab\) \{[\s\S]*?classList\.add\("tab-enter"\);/);
  assert.match(renderer, /lastRenderedTab = state\.screen === "app" \? state\.tab : null;/);
  assert.match(css, /\.tab-enter\s*\{\s*animation:\s*tab-fade-in 180ms ease-out;/);
});

test("transições de aba e tema respeitam movimento reduzido", () => {
  assert.match(css, /body,[\s\S]*?\.settings-card\s*\{\s*transition:\s*background-color 180ms ease, border-color 180ms ease, color 180ms ease;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.settings-card\s*\{\s*transition:\s*none;[\s\S]*?\.tab-enter\s*\{\s*animation:\s*none;/);
});

test("count-up da Overview persiste valores fora do state e não reinicia no mesmo alvo", () => {
  assert.match(renderer, /const animatedMetricValues = new Map\(\);/);
  assert.match(renderer, /const animatedMetricTargets = new Map\(\);/);
  assert.match(renderer, /previousTarget === target/);
  assert.match(renderer, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(renderer, /const duration = 600;/);
  for (const id of ["metric-safe-space", "metric-reviewable-space", "metric-candidates", "metric-leftovers", "metric-files"]) {
    assert.match(renderer, new RegExp(`id="${id}"`));
    assert.match(renderer, new RegExp(`animateMetricValue\\("${id}"`));
  }
  assert.match(renderer, /animateOverviewMetrics\(\);[\s\S]*?const detailPanel/);
});
