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
