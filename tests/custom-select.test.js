const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateMenuPosition, needsMenuScroll, nextEnabledIndex } = require("../src/renderer/custom-select");

test("abre abaixo quando existe espaço e respeita as bordas laterais", () => {
  assert.deepEqual(calculateMenuPosition(
    { left: 940, top: 100, right: 1040, bottom: 146, width: 100 },
    { height: 180 },
    { width: 1024, height: 768 }
  ), { left: 856, top: 152, width: 160, maxHeight: 180, opensUp: false });
});

test("abre acima quando está próximo da borda inferior", () => {
  assert.deepEqual(calculateMenuPosition(
    { left: 100, top: 680, right: 340, bottom: 726, width: 240 },
    { height: 240 },
    { width: 1024, height: 768 }
  ), { left: 100, top: 434, width: 240, maxHeight: 240, opensUp: true });
});

test("navegação por teclado ignora opções desabilitadas e circula", () => {
  const options = [{ disabled: false }, { disabled: true }, { disabled: false }];
  assert.equal(nextEnabledIndex(options, 0, 1), 2);
  assert.equal(nextEnabledIndex(options, 2, 1), 0);
  assert.equal(nextEnabledIndex(options, 0, -1), 2);
});

test("só mostra a barra quando existe rolagem útil", () => {
  assert.equal(needsMenuScroll(88, 88), false);
  assert.equal(needsMenuScroll(321, 320), true);
});
