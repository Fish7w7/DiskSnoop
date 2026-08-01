const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scannerPath = path.join(__dirname, "..", "src", "scanner", "scanner.js");
const scannerSource = fs.readFileSync(scannerPath, "utf8");
const { skippedReason } = require(scannerPath);

test("scanner preserva código de erro dos caminhos sem acesso", () => {
  assert.equal(skippedReason({ code: "EACCES", message: "denied" }), "EACCES");
  assert.equal(skippedReason({ message: "access denied" }), "access denied");
  assert.equal(skippedReason(null), "UNKNOWN");
});

test("resultado final inclui caminhos sem acesso individualmente", () => {
  assert.match(scannerSource, /skippedPaths:\s*new Map\(\)/);
  assert.match(scannerSource, /recordSkippedPath\(dirPath, error\)/);
  assert.match(scannerSource, /recordSkippedPath\(fullPath, error\)/);
  assert.match(scannerSource, /skippedPaths:\s*\[\.\.\.state\.skippedPaths\.values\(\)\]/);
});
