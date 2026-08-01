const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "styles.css"), "utf8");
const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "renderer.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "index.html"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const ptBR = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "i18n", "pt-BR.json"), "utf8"));
const enUS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "i18n", "en-US.json"), "utf8"));

test("fallbacks visuais acompanham a versão do pacote", () => {
  const escapedVersion = packageJson.version.replaceAll(".", "\\.");
  assert.match(indexHtml, new RegExp(`<span class="boot-version">v${escapedVersion}</span>`));
  assert.match(renderer, new RegExp(`let APP_VERSION_LABEL = "${escapedVersion}";`));
  assert.equal(ptBR.version, packageJson.version);
  assert.equal(enUS.version, packageJson.version);
});

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

test("callouts informativos mantêm a mesma moldura em todas as telas", () => {
  for (const title of [
    "Revisão protegida",
    "Duplicados com cautela",
    "Achados conservadores",
    "Quarentena organizada"
  ]) {
    assert.match(renderer, new RegExp(`safetyNote\\("${title}`));
  }
  assert.match(css, /\.safety-note\s*\{[\s\S]*?border:\s*1px solid[\s\S]*?background:\s*color-mix\(/);
  assert.doesNotMatch(css, /\.(?:candidates-view|quarantine-view) \.safety-note[\s\S]*?border:\s*0;/);
  assert.doesNotMatch(css, /\.(?:candidates-view|quarantine-view) \.safety-note[\s\S]*?background:\s*transparent;/);
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

test("boas-vindas usa duas colunas, jornada conectada e blobs sem alterar o mascote", () => {
  assert.match(renderer, /class="welcome-bg-blobs"/);
  assert.match(renderer, /class="welcome-inner welcome-inner-split"[\s\S]*?class="welcome-hero welcome-hero-left"/);
  assert.match(renderer, /\$\{appLogo\("big"\)\}/);
  assert.equal((renderer.match(/class="welcome-journey-step"/g) || []).length, 3);
  assert.match(renderer, /class="welcome-journey-line"/);
  assert.doesNotMatch(renderer, /welcome-bg-grid|welcome-features|welcome-feature-card/);

  assert.match(css, /\.welcome-inner-split\s*\{[\s\S]*?grid-template-columns:\s*minmax\(320px,\s*1fr\)\s+minmax\(300px,\s*380px\);[\s\S]*?gap:\s*48px;/);
  assert.match(css, /\.welcome-journey-line\s*\{[\s\S]*?left:\s*23px;[\s\S]*?width:\s*2px;[\s\S]*?background:\s*var\(--border\);/);
  assert.match(css, /\.welcome-bg-blobs::before,[\s\S]*?filter:\s*blur\(60px\);[\s\S]*?var\(--accent\)\s*18%/);
  assert.match(css, /@media \(max-width:\s*900px\)\s*\{[\s\S]*?\.welcome-inner-split\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.doesNotMatch(css, /welcome-bg-grid|welcome-features|welcome-feature-card(?:\:hover)?/);

  assert.equal(ptBR.messages["welcome.stepOne"], "Passo 1");
  assert.equal(ptBR.messages["welcome.stepTwo"], "Passo 2");
  assert.equal(ptBR.messages["welcome.stepThree"], "Passo 3");
  assert.equal(enUS.messages["welcome.stepOne"], "Step 1");
  assert.equal(enUS.messages["welcome.stepTwo"], "Step 2");
  assert.equal(enUS.messages["welcome.stepThree"], "Step 3");
});

test("accent customizado aplica em tempo real e persiste separado do tema", () => {
  assert.match(renderer, /const ACCENT_PRESETS = \[[\s\S]*?"#2f80ff"[\s\S]*?"#38b000"[\s\S]*?\];/);
  assert.match(renderer, /function applyCustomAccent\(hex\)[\s\S]*?setProperty\("--accent", hex\)[\s\S]*?mixRgb\(hexToRgb\(hex\), hexToRgb\(surfaceHex \|\| "#ffffff"\), 0\.82\)/);
  assert.match(renderer, /function updateAccentState\(hex\)[\s\S]*?customAccent: normalizedHex[\s\S]*?applyCustomAccent\(normalizedHex\)/);
  assert.match(renderer, /function selectAccent\(hex, options = \{\}\)[\s\S]*?updateAccentState\(hex\)[\s\S]*?persistSettingsSoon\(\)/);
  assert.match(renderer, /function applyTheme\(\)[\s\S]*?dataset\.theme = theme;[\s\S]*?applyCustomAccent\(state\.settings\?\.appearance\?\.customAccent \|\| null\);/);
  assert.equal(ptBR.messages["settings.accentCustom"], "Personalizada");
  assert.equal(enUS.messages["settings.accentCustom"], "Custom");
});

test("restaurar accent remove apenas a cor customizada e preserva o tema", () => {
  assert.match(renderer, /currentAccent \? `[\s\S]*?data-action="reset-accent"[\s\S]*?` : ""/);
  assert.match(renderer, /if \(action === "reset-accent"\) \{[\s\S]*?const accentBeingReset = state\.settings\.appearance\?\.customAccent \|\| null;[\s\S]*?customAccent: null[\s\S]*?applyCustomAccent\(null\);[\s\S]*?persistSettingsSoon\(\);/);
  assert.doesNotMatch(
    renderer.match(/if \(action === "reset-accent"\) \{[\s\S]*?\n  \}/)?.[0] || "",
    /settings\.theme\s*=/
  );
  assert.equal(ptBR.messages["settings.resetAccent"], "Restaurar aparência padrão");
  assert.equal(enUS.messages["settings.resetAccent"], "Restore default appearance");
});

test("restaurar accent substitui o toast e pode desfazer para a cor personalizada", () => {
  const resetHandler = renderer.match(/if \(action === "reset-accent"\) \{[\s\S]*?\n  \}/)?.[0] || "";
  assert.match(resetHandler, /const accentBeingReset = state\.settings\.appearance\?\.customAccent \|\| null;/);
  assert.match(resetHandler, /previousAccent = undoAlreadyConsumed \? null : accentBeingReset;/);
  assert.match(resetHandler, /message: t\("settings\.accentResetToast"\)/);
  assert.match(resetHandler, /action: "undo-accent"/);
  assert.match(resetHandler, /actionLabel: t\("common\.undo"\)/);
  assert.match(resetHandler, /accentAction: "reset"/);
  assert.equal(ptBR.messages["settings.accentResetToast"], "Aparência padrão restaurada.");
  assert.equal(enUS.messages["settings.accentResetToast"], "Default appearance restored.");
});

test("desfazer restauração é consumido uma vez e não cria pingue-pongue infinito", () => {
  assert.match(renderer, /let accentResetUndoConsumedFor = null;/);
  assert.match(renderer, /if \(action === "undo-accent"\) \{[\s\S]*?const undoWasReset = state\.toast\?\.accentAction === "reset";[\s\S]*?accentResetUndoConsumedFor = undoWasReset \? accentToRestore : null;/);
  const resetHandler = renderer.match(/if \(action === "reset-accent"\) \{[\s\S]*?\n  \}/)?.[0] || "";
  assert.match(resetHandler, /const undoAlreadyConsumed = accentResetUndoConsumedFor === accentBeingReset;/);
  assert.match(resetHandler, /setToast\(undoAlreadyConsumed[\s\S]*?\? \{ message: t\("settings\.accentResetToast"\) \}[\s\S]*?: \{[\s\S]*?action: "undo-accent"/);
  assert.match(renderer, /function selectAccent\(hex, options = \{\}\)[\s\S]*?accentResetUndoConsumedFor = null;/);
});

test("accent avisa contraste de interface abaixo de 3:1 sem bloquear a aplicação", () => {
  assert.match(renderer, /function checkAccentWarnings\(hex, tokens\) \{[\s\S]*?contrastRatio\(hex, tokens\.background\) < 3[\s\S]*?type: "contrast"/);
  assert.match(renderer, /function accentWarnings\(currentAccent\)[\s\S]*?const tokens = currentThemeColorTokens\(\);[\s\S]*?checkAccentWarnings\(currentAccent, tokens\)/);
  assert.match(renderer, /data-accent-warnings>\$\{accentWarnings\(currentAccent\)\}/);
  assert.match(css, /\.accent-warning\s*\{[\s\S]*?color:\s*var\(--textMuted\);/);
  assert.equal(ptBR.messages["settings.accentWarningContrast"], "Essa cor pode ficar difícil de enxergar no tema atual.");
  assert.equal(enUS.messages["settings.accentWarningContrast"], "This color may be hard to see in the current theme.");
});

test("accent avisa colisões com os tokens de status do tema ativo", () => {
  assert.match(renderer, /const STATUS_COLLISION_THRESHOLD = 60;/);
  assert.match(renderer, /function checkStatusCollision\(hex, tokens\)[\s\S]*?danger: tokens\.danger[\s\S]*?warning: tokens\.warning[\s\S]*?success: tokens\.success/);
  assert.match(renderer, /rgbDistance\(hex, statusHex\) < STATUS_COLLISION_THRESHOLD/);
  assert.match(renderer, /checkStatusCollision\(currentAccent, tokens\)[\s\S]*?t\(`status\.\$\{status\}`\)/);
  assert.equal(ptBR.messages["status.danger"], "perigo");
  assert.equal(ptBR.messages["status.warning"], "aviso");
  assert.equal(ptBR.messages["status.success"], "sucesso");
  assert.equal(
    enUS.messages["settings.accentWarningStatus"],
    "This color is similar to the app's {status} color, which may cause confusion."
  );
});

test("troca de accent oferece desfazer exato sem empilhar toasts", () => {
  assert.match(renderer, /let previousAccent = null;/);
  assert.match(renderer, /function selectAccent\(hex, options = \{\}\)[\s\S]*?previousAccent = accentBeforeChange;[\s\S]*?action: "undo-accent"[\s\S]*?actionLabel: t\("common\.undo"\)/);
  assert.match(renderer, /if \(action === "undo-accent"\) \{[\s\S]*?const accentToRestore = previousAccent;[\s\S]*?customAccent: accentToRestore[\s\S]*?applyCustomAccent\(accentToRestore\);[\s\S]*?state\.toast = "";/);
  assert.match(renderer, /state\.toast = toast\.message \? toast : "";/);
  assert.equal(ptBR.messages["common.undo"], "Desfazer");
  assert.equal(enUS.messages["common.undo"], "Undo");
  assert.equal(ptBR.messages["settings.accentChangedToast"], "Cor de destaque alterada.");
  assert.equal(enUS.messages["settings.accentChangedToast"], "Accent color changed.");
});

test("arrastar no seletor nativo pré-visualiza sem renderizar até confirmar", () => {
  assert.match(renderer, /let customAccentStartValue;/);
  assert.match(renderer, /function previewCustomAccent\(hex\)[\s\S]*?updateAccentState\(hex\)[\s\S]*?warnings\.innerHTML = accentWarnings\(normalizedHex\)/);
  const inputHandler = renderer.match(/document\.addEventListener\("input",[\s\S]*?\n\}\);/)?.[0] || "";
  assert.match(inputHandler, /select-accent-custom"\) \{[\s\S]*?previewCustomAccent\(event\.target\.value\);/);
  assert.doesNotMatch(inputHandler, /select-accent-custom"\) \{[\s\S]*?selectAccent\(event\.target\.value\);/);
  assert.match(renderer, /document\.addEventListener\("change",[\s\S]*?select-accent-custom"\) \{[\s\S]*?selectAccent\(event\.target\.value, \{ previousAccent: accentBeforeChange \}\);/);
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

test("métricas da Overview aparecem diretamente sem count-up", () => {
  assert.doesNotMatch(renderer, /animateMetricValue|animateOverviewMetrics|animatedMetricValues|animatedMetricTargets|metricAnimationFrames/);
  for (const id of ["metric-safe-space", "metric-reviewable-space", "metric-candidates", "metric-leftovers", "metric-files"]) {
    assert.match(renderer, new RegExp(`id="${id}"`));
  }
  assert.match(renderer, /id="metric-safe-space">\$\{compactBytes\(safeRecoverable\)\}<\/strong>/);
  assert.match(renderer, /id="metric-reviewable-space">\$\{compactBytes\(reviewable\)\}<\/strong>/);
  assert.match(renderer, /id="metric-candidates">\$\{formatCount\(visibleCandidates\(\)\.length\)\}<\/strong>/);
});

test("comparação da Overview usa faixa de ruído apenas no espaço revisável", () => {
  assert.match(renderer, /const reviewableDelta = now\.reviewableBytes - before\.reviewableBytes;/);
  assert.match(renderer, /reviewableStable:\s*overviewComparison\.isReviewableDeltaStable\(reviewableDelta, now\.reviewableBytes\)/);
  assert.match(renderer, /comparison\.reviewableStable[\s\S]*?t\("overview\.reviewableStable"\)/);
  assert.match(renderer, /t\("overview\.candidateDelta", \{ value: signedCount\(comparison\.candidateDelta\) \}\)/);
  assert.equal(ptBR.messages["overview.reviewableStable"], "≈ estável desde o último scan");
  assert.equal(enUS.messages["overview.reviewableStable"], "≈ stable since the previous scan");
});

test("barra de scan aplica shimmer somente no preenchimento e respeita movimento reduzido", () => {
  assert.match(renderer, /function progressBar\(percent\)[\s\S]*?class="progress-fill"/);
  assert.match(css, /\.scan-card \.progress-fill::after\s*\{[\s\S]*?animation:\s*progress-shimmer 1\.6s ease-in-out infinite;/);
  assert.match(css, /@keyframes progress-shimmer\s*\{[\s\S]*?background-position:\s*200% 0;[\s\S]*?background-position:\s*-200% 0;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.scan-card \.progress-fill::after\s*\{[\s\S]*?animation:\s*none;/);
  assert.equal((css.match(/\.scan-card \.progress-fill::after/g) || []).length, 2);
});

test("aba Atualização separa versão e detalhes técnicos sem perder informações", () => {
  assert.match(renderer, /class="settings-card vertical update-card update-version-details"/);
  for (const key of [
    "updates.installedVersion",
    "updates.latestVersion",
    "updates.lastCheck",
    "updates.channel",
    "updates.mode",
    "updates.artifact"
  ]) {
    assert.match(renderer, new RegExp(`t\\("${key.replace(".", "\\.")}"\\)`));
  }
  assert.doesNotMatch(renderer, /class="update-status-grid"/);
  assert.match(renderer, /<details class="settings-card update-card update-technical-details">/);
  assert.match(renderer, /<summary>\$\{escapeHtml\(t\("updates\.technicalDetails"\)\)\}<\/summary>/);
  assert.doesNotMatch(renderer, /<details class="settings-card update-card update-technical-details" open>/);
  for (const key of ["updates.appMode", "updates.engine", "updates.expectedRelease", "updates.localData"]) {
    assert.match(renderer, new RegExp(`t\\("${key.replace(".", "\\.")}"\\)`));
  }
  assert.match(renderer, /data-action="open-data-folder"/);
  assert.match(css, /details\.settings-card summary\s*\{[\s\S]*?cursor:\s*pointer;/);
  assert.equal(ptBR.messages["updates.versionDetails"], "Detalhes da versão");
  assert.equal(enUS.messages["updates.versionDetails"], "Version details");
  assert.equal(ptBR.messages["updates.technicalDetails"], "Detalhes técnicos");
  assert.equal(enUS.messages["updates.technicalDetails"], "Technical details");
});

test("aba Atualização mantém notas e caminhos legíveis no layout estreito", () => {
  const actionsIndex = renderer.indexOf('class="detail-actions update-actions"');
  const noteIndex = renderer.indexOf('class="update-action-note"');
  assert.ok(actionsIndex >= 0 && noteIndex > actionsIndex);
  assert.match(renderer, /class="update-local-data"[\s\S]*?\$\{escapeHtml\(dataLocation\)\}/);
  assert.match(css, /\.update-local-data\s*\{[\s\S]*?overflow-wrap:\s*break-word;[\s\S]*?white-space:\s*normal;/);
  assert.equal((renderer.match(/class="preference-item"/g) || []).length, 4);
  assert.equal((renderer.match(/class="preference-label-text"/g) || []).length, 4);
  assert.match(renderer, /class="preference-item"[\s\S]*?class="preference-line"[\s\S]*?data-update-pref="autoDownload"[\s\S]*?class="preference-texts"[\s\S]*?prefAutoDownload[\s\S]*?class="preference-note"[\s\S]*?prefAutoDownloadHelp/);
  assert.doesNotMatch(renderer, /update-preference-with-help|update-preference-control|update-preference-help/);
  assert.match(css, /\.update-preferences\s*\{[\s\S]*?gap:\s*var\(--space-3\);/);
  assert.match(css, /\.preference-item\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*var\(--space-1\);/);
  assert.match(css, /\.preference-line\s*\{[^}]*min-width:\s*0;/);
  assert.match(css, /\.preference-line label\s*\{[^}]*width:\s*100%;/);
  assert.match(css, /\.settings-card \.preference-texts\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?margin:\s*0;[\s\S]*?align-items:\s*center;[\s\S]*?gap:\s*var\(--space-2\);[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?font:\s*inherit;/);
  assert.match(css, /\.settings-card \.preference-texts\s*>\s*span\s*\{[^}]*margin:\s*0;[^}]*white-space:\s*nowrap;/);
  assert.match(css, /\.settings-card \.preference-label-text\s*\{[^}]*display:\s*inline;[^}]*margin:\s*0;[^}]*color:\s*var\(--textPrimary\);[^}]*font:\s*inherit;[^}]*line-height:\s*inherit;/);
  assert.match(css, /\.settings-card \.preference-note\s*\{[\s\S]*?margin:\s*0;[\s\S]*?color:\s*var\(--textMuted\);[\s\S]*?font-size:\s*var\(--text-xs\);/);
  assert.doesNotMatch(css, /\.preference-note\s*\{[^}]*padding-left:/);
  assert.match(css, /\.update-action-note\s*\{[\s\S]*?font-size:\s*var\(--text-xs\);/);
});

test("tempo restante usa amostras recentes e nunca renderiza valores inválidos", () => {
  assert.match(renderer, /const SAMPLE_WINDOW_MS = 10000;/);
  assert.match(renderer, /function recordProgressSample\(mappedBytes, timestamp = Date\.now\(\)\)/);
  assert.match(renderer, /elapsedSinceStart < 3000 \|\| progressSamples\.length < 2/);
  assert.match(renderer, /deltaBytes <= 0 \|\| deltaTime <= 0/);
  assert.match(renderer, /Number\.isFinite\(remainingMs\) && remainingMs > 0 \? remainingMs : null/);
  assert.match(renderer, /t\("scan\.estimating"\)/);
  assert.match(renderer, /t\("scan\.timeRemaining", \{ time: durationLabel\(remainingMs\) \}\)/);
  assert.equal(ptBR.messages["scan.estimating"], "Calculando tempo restante...");
  assert.equal(enUS.messages["scan.timeRemaining"], "~{time} remaining");
});

test("painéis de detalhe oferecem cópia de caminho puro", () => {
  assert.match(renderer, /function copyPathButton\(item\)/);
  assert.match(renderer, /data-action="copy-path" data-id=/);
  assert.match(renderer, /await api\.copyText\(item\.path\)/);
  assert.match(renderer, /t\("common\.pathCopiedToast"\)/);
  assert.ok((renderer.match(/\$\{copyPathButton\(item\)\}/g) || []).length >= 5);
  assert.match(css, /\.icon-button\.copy-path-button\s*\{[^}]*color:\s*var\(--textMuted\);/);
  assert.equal(ptBR.messages["common.copyPath"], "Copiar caminho");
  assert.equal(enUS.messages["common.pathCopiedToast"], "Path copied.");
});

test("atalhos globais respeitam contexto de digitação e reutilizam ações existentes", () => {
  assert.equal((renderer.match(/document\.addEventListener\("keydown"/g) || []).length, 1);
  assert.match(renderer, /event\.ctrlKey && event\.key\.toLowerCase\(\) === "n"[\s\S]*?void triggerNewScan\(\)/);
  assert.match(renderer, /if \(isTypingContext\(\)\)[\s\S]*?document\.activeElement\.blur\(\)/);
  assert.match(renderer, /event\.key === "\/"[\s\S]*?focusCurrentSearchInput\(\)/);
  assert.match(renderer, /event\.key === "ArrowUp" \|\| event\.key === "ArrowDown"/);
  assert.match(renderer, /event\.key\.toLowerCase\(\) === "c"[\s\S]*?copyItemPath\(item\)/);
  assert.match(renderer, /scrollIntoView\(\{ block: "nearest", behavior \}\)/);
  assert.match(renderer, /LIST_KEY_REPEAT_INTERVAL_MS = 110/);
  assert.match(renderer, /repeated && now - lastListNavigationAt < LIST_KEY_REPEAT_INTERVAL_MS/);
  assert.match(renderer, /render\(\{ suppressDetailAnimation: true \}\)/);
  assert.match(renderer, /repeated \? "auto" : "smooth"/);
  assert.match(css, /\.detail-overlay\.no-entry-animation \.detail-overlay-backdrop,[\s\S]*?animation:\s*none;/);
  assert.doesNotMatch(renderer, /items\.find\(\(item\) => item\.id === state\.selectedItem\?\.id\) \|\| items\[0\]/);
  assert.match(renderer, /currentIndex < 0[\s\S]*?direction > 0 \? 0 : items\.length - 1/);
});

test("Configurações apresenta todos os atalhos existentes dentro do aplicativo", () => {
  assert.match(renderer, /\["shortcuts", t\("settings\.shortcutsCategory"\), "list"\]/);
  assert.match(renderer, /function shortcutSettingRow\(keys, title, description, separator = "\+"\)/);
  assert.match(renderer, /shortcutSettingRow\(\["Ctrl", "N"\]/);
  assert.match(renderer, /shortcutSettingRow\(\["\/"\]/);
  assert.match(renderer, /shortcutSettingRow\(\["Esc"\]/);
  assert.match(renderer, /shortcutSettingRow\(\["↑", "↓"\]/);
  assert.match(renderer, /shortcutSettingRow\(\["C"\]/);
  assert.match(renderer, /<kbd>\$\{escapeHtml\(key\)\}<\/kbd>/);
  assert.match(css, /\.shortcut-setting-row\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(css, /\.shortcut-keys kbd\s*\{[\s\S]*?box-shadow:/);
  assert.equal(ptBR.messages["settings.shortcutsCategory"], "Atalhos");
  assert.equal(enUS.messages["settings.shortcutsTitle"], "Keyboard shortcuts");
});

test("Overview mostra saúde fail-safe e revisão em lote dos caminhos sem acesso", () => {
  assert.match(renderer, /function diskHealthBadge\(driveLetter\)/);
  assert.match(renderer, /health\?\.status === "healthy"/);
  assert.match(renderer, /t\("disk\.healthUnavailable"\)/);
  assert.match(renderer, /function inaccessibleItemsPanel\(\)/);
  assert.match(renderer, /data-action="retry-inaccessible"/);
  assert.match(renderer, /api\.recheckPathsElevated\(paths\)/);
  assert.match(renderer, /state\.scanResult\.skippedPaths = remaining/);
  assert.match(renderer, /state\.scanResult\.skipped = remaining\.length/);
  assert.equal(ptBR.messages["access.retryElevated"], "Tentar novamente como administrador");
  assert.equal(enUS.messages["disk.healthUnavailable"], "Health data unavailable");
  assert.match(css, /\.inaccessible-section\s*\{/);
  assert.match(css, /\.disk-health-badge\.healthy\s*\{/);
});

test("dropdowns usam componente próprio e as abas compartilham a mesma escala", () => {
  const index = indexHtml;
  const customSelect = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "custom-select.js"), "utf8");
  assert.match(index, /<script src="\.\/custom-select\.js"><\/script>/);
  assert.match(renderer, /DiskSnoopCustomSelect\?\.enhance\(app\)/);
  assert.match(customSelect, /role="option"/);
  assert.match(customSelect, /event\.key === "ArrowDown" \|\| event\.key === "ArrowUp"/);
  assert.match(customSelect, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(customSelect, /event\.key === "Escape"/);
  assert.match(customSelect, /doc\.addEventListener\("pointerdown"/);
  assert.match(customSelect, /calculateMenuPosition/);
  assert.match(css, /\.custom-select-menu\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*1000;/);
  assert.match(css, /\.content > section\s*\{[\s\S]*?var\(--page-content-max\)/);
  assert.match(css, /--control-height:\s*46px/);
  assert.match(css, /--table-row-height:\s*58px/);
});
