const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  SCAN_COMPLETE_DESCRIPTION_KEY,
  createTaskbarBadgeController
} = require("../src/main/taskbar-badge");

function createHarness({ focused = false } = {}) {
  const calls = [];
  const icon = { isEmpty: () => false };
  const controller = createTaskbarBadgeController({
    nativeImage: { createFromPath: () => icon },
    iconPath: "badge.png",
    translate: (locale, key) => `${locale}:${key}`
  });
  const window = {
    isDestroyed: () => false,
    isFocused: () => focused,
    setOverlayIcon: (...args) => calls.push(args)
  };
  return { calls, controller, icon, window };
}

test("marca scan concluído somente quando a janela está sem foco", () => {
  const background = createHarness({ focused: false });
  assert.equal(background.controller.markScanCompleteIfUnfocused(background.window, "pt-BR"), true);
  assert.deepEqual(background.calls, [[
    background.icon,
    `pt-BR:${SCAN_COMPLETE_DESCRIPTION_KEY}`
  ]]);

  const foreground = createHarness({ focused: true });
  assert.equal(foreground.controller.markScanCompleteIfUnfocused(foreground.window, "pt-BR"), false);
  assert.deepEqual(foreground.calls, []);
});

test("limpa o badge quando a janela recupera foco", () => {
  const harness = createHarness();
  assert.equal(harness.controller.clear(harness.window), true);
  assert.deepEqual(harness.calls, [[null, ""]]);
});

test("bypass de teste força o badge mesmo com a janela em foco", () => {
  const harness = createHarness({ focused: true });
  assert.equal(harness.controller.showForTesting(harness.window, "pt-BR"), true);
  assert.deepEqual(harness.calls, [[
    harness.icon,
    `pt-BR:${SCAN_COMPLETE_DESCRIPTION_KEY}`
  ]]);
});

test("asset do badge é um PNG RGBA de 32 por 32 pixels", () => {
  const badgePath = path.join(__dirname, "..", "src", "assets", "badge-scan-complete.png");
  const png = fs.readFileSync(badgePath);
  assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 32);
  assert.equal(png.readUInt32BE(20), 32);
  assert.equal(png[25], 6);
});

test("botão de desenvolvimento força o badge e minimiza para inspeção real", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "src", "main", "main.js"), "utf8");
  const preload = fs.readFileSync(path.join(__dirname, "..", "src", "main", "preload.js"), "utf8");
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "renderer.js"), "utf8");
  assert.match(preload, /testTaskbarBadge:\s*\(\) => ipcRenderer\.invoke\("taskbar:testBadge"\)/);
  assert.match(main, /ipcMain\.handle\("taskbar:testBadge"[\s\S]*?if \(app\.isPackaged[\s\S]*?showForTesting\(mainWindow, settings\.language\)[\s\S]*?mainWindow\.minimize\(\)/);
  assert.match(renderer, /state\.isPackaged \? "" : `[\s\S]*?data-action="test-taskbar-badge"/);
  assert.match(renderer, /if \(action === "test-taskbar-badge"\) \{[\s\S]*?api\.testTaskbarBadge\(\)/);
});
