const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "styles.css"), "utf8");
const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "renderer.js"), "utf8");

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
