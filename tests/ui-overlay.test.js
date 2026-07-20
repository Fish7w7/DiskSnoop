const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "styles.css"), "utf8");

test("backdrop preserva transparência em hover, foco e clique", () => {
  assert.match(css, /:root \.detail-overlay button\.detail-overlay-backdrop:is\(:hover, :focus, :active\)\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--background\) 54%, transparent\);/);
});

test("overlay pausa o scroll de fundo e mantém scroll somente no conteúdo", () => {
  assert.match(css, /\.content:has\(\.detail-overlay\)\s*\{\s*overflow:\s*hidden;/);
  assert.match(css, /\.detail-overlay-body\s*\{[\s\S]*?overflow-y:\s*auto;/);
});
