const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

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

function decodeRgbaPng(png) {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      const value = filter === 0 ? row[x]
        : filter === 1 ? row[x] + left
          : filter === 2 ? row[x] + up
            : filter === 3 ? row[x] + Math.floor((left + up) / 2)
              : row[x] + paeth(left, up, upperLeft);
      pixels[y * stride + x] = value & 255;
    }
  }
  return { width, height, pixels };
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

test("badge preenche o source para o Windows reduzi-lo ao overlay e possui contorno branco", () => {
  const badgePath = path.join(__dirname, "..", "src", "assets", "badge-scan-complete.png");
  const { width, height, pixels } = decodeRgbaPng(fs.readFileSync(badgePath));
  const visible = [];
  let whitePixels = 0;
  let greenPixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [red, green, blue, alpha] = pixels.subarray(offset, offset + 4);
      if (alpha >= 128) visible.push([x, y]);
      if (alpha >= 200 && red >= 235 && green >= 235 && blue >= 235) whitePixels += 1;
      if (alpha >= 200 && green > red + 35 && green > blue + 20) greenPixels += 1;
    }
  }
  const xs = visible.map(([x]) => x);
  const ys = visible.map(([, y]) => y);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [2, 29, 2, 29]);
  assert.ok(whitePixels >= 20);
  assert.ok(greenPixels >= 20);
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
