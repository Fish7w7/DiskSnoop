const test = require("node:test");
const assert = require("node:assert/strict");

const {
  hexToRgb,
  rgbToCss,
  mixRgb,
  relativeLuminance,
  contrastRatio,
  rgbDistance
} = require("../src/renderer/color-utils");

test("converte hexadecimal curto e longo para RGB", () => {
  assert.deepEqual(hexToRgb("#fff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(hexToRgb("#2f80ff"), { r: 47, g: 128, b: 255 });
  assert.equal(rgbToCss({ r: 47, g: 128, b: 255 }), "rgb(47, 128, 255)");
  assert.equal(rgbToCss({ r: 47, g: 128, b: 255 }, 0.5), "rgba(47, 128, 255, 0.5)");
});

test("mistura cores RGB usando a proporção informada", () => {
  assert.deepEqual(mixRgb({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, 0.5), { r: 128, g: 128, b: 128 });
});

test("calcula luminância, contraste e distância RGB", () => {
  assert.equal(relativeLuminance({ r: 0, g: 0, b: 0 }), 0);
  assert.equal(relativeLuminance({ r: 255, g: 255, b: 255 }), 1);
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(rgbDistance("#000000", "#ffffff"), Math.sqrt(3 * 255 ** 2));
});
