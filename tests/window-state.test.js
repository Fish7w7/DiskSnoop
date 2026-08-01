const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  resolveWindowState
} = require("../src/main/window-state");

const primary = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
const secondary = { workArea: { x: 1920, y: 0, width: 2560, height: 1400 } };

test("primeira abertura usa o novo tamanho padrão centralizado", () => {
  assert.deepEqual(resolveWindowState({}, [primary]), {
    x: 192,
    y: 18,
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    maximized: false
  });
});

test("restaura tamanho, posição e estado maximizado", () => {
  assert.deepEqual(resolveWindowState({ x: 2100, y: 100, width: 1400, height: 900, maximized: true }, [primary, secondary]), {
    x: 2100,
    y: 100,
    width: 1400,
    height: 900,
    maximized: true
  });
});

test("traz janela de monitor desconectado para a tela principal", () => {
  assert.deepEqual(resolveWindowState({ x: 4000, y: 2000, width: 1300, height: 800 }, [primary]), {
    x: 310,
    y: 120,
    width: 1300,
    height: 800,
    maximized: false
  });
});

test("limita dimensões à área útil do monitor", () => {
  const small = { workArea: { x: 0, y: 0, width: 1280, height: 720 } };
  assert.deepEqual(resolveWindowState({ width: 3000, height: 2000 }, [small]), {
    x: 0,
    y: 0,
    width: 1280,
    height: 720,
    maximized: false
  });
});
