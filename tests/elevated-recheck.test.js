const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createElevatedRechecker,
  elevatedLaunchScript,
  measurePath,
  normalizeRecheckPaths,
  parseElevatedRecheckArgs,
  quotePowerShell,
  validateHandoffPaths
} = require("../src/main/elevated-recheck");

test("normaliza, deduplica e limita caminhos de rechecagem", () => {
  assert.deepEqual(normalizeRecheckPaths(["C:\\A", "C:\\A", "", null]), ["C:\\A"]);
  assert.equal(normalizeRecheckPaths(Array.from({ length: 600 }, (_, index) => `C:\\${index}`)).length, 500);
});

test("argumentos do modo elevado exigem os dois arquivos de handoff", () => {
  assert.deepEqual(parseElevatedRecheckArgs(["app", "--recheck-elevated", "request.json", "result.json"]), {
    requestFile: "request.json",
    resultFile: "result.json"
  });
  assert.equal(parseElevatedRecheckArgs(["app", "--recheck-elevated"]), null);
});

test("worker elevado só aceita handoff dentro dos dados do app", () => {
  const root = "C:\\Users\\me\\AppData\\Roaming\\DiskSnoop";
  assert.equal(validateHandoffPaths(
    `${root}\\recheck-request-123e4567-e89b-12d3-a456-426614174000.json`,
    `${root}\\recheck-result-123e4567-e89b-12d3-a456-426614174000.json`,
    root
  ), true);
  assert.equal(validateHandoffPaths("C:\\Windows\\request.json", `${root}\\result.json`, root), false);
});

test("comando elevado usa RunAs, espera conclusão e escapa aspas", () => {
  assert.equal(quotePowerShell("a'b"), "'a''b'");
  const script = elevatedLaunchScript("C:\\DiskSnoop.exe", ["--recheck-elevated", "a.json", "b.json"]);
  assert.match(script, /Start-Process/);
  assert.match(script, /-Verb RunAs/);
  assert.match(script, /-Wait/);
  assert.match(script, /-PassThru/);
});

test("medição elevada é somente leitura e retorna falhas graciosamente", async () => {
  const fileResult = await measurePath("C:\\allowed.txt", {
    lstat: async () => ({ isSymbolicLink: () => false, isFile: () => true, isDirectory: () => false, size: 42, mtime: new Date(0) })
  });
  assert.equal(fileResult.accessible, true);
  assert.equal(fileResult.size, 42);

  const denied = await measurePath("C:\\denied", {
    lstat: async () => { const error = new Error("denied"); error.code = "EACCES"; throw error; }
  });
  assert.deepEqual(denied, {
    path: "C:\\denied",
    accessible: false,
    size: 0,
    kind: "unknown",
    modifiedAt: null,
    error: "EACCES"
  });
});

function fakeFileSystem(result = { results: [] }) {
  return {
    mkdir: async () => {},
    writeFile: async () => {},
    rm: async () => {},
    readFile: async () => JSON.stringify(result)
  };
}

test("cancelamento do UAC e timeout retornam sem deixar a interface esperando", async () => {
  const app = { isPackaged: true, getPath: () => "C:\\DiskSnoopData" };
  const cancelled = createElevatedRechecker({
    app,
    fsApi: fakeFileSystem(),
    execFile: (_file, _args, _options, callback) => callback(new Error("The operation was canceled by the user."), "", "")
  });
  assert.equal((await cancelled(["C:\\locked"])).status, "cancelled");

  const timeout = createElevatedRechecker({
    app,
    fsApi: fakeFileSystem(),
    execFile: (_file, _args, _options, callback) => {
      const error = new Error("timed out");
      error.killed = true;
      callback(error, "", "");
    }
  });
  assert.equal((await timeout(["C:\\locked"])).status, "timeout");
});

test("resultado do handoff concluído é devolvido ao renderer", async () => {
  const expected = [{ path: "C:\\allowed", accessible: true, size: 10 }];
  const recheck = createElevatedRechecker({
    app: { isPackaged: true, getPath: () => "C:\\DiskSnoopData" },
    fsApi: fakeFileSystem({ results: expected }),
    execFile: (_file, _args, _options, callback) => callback(null, "", "")
  });
  assert.deepEqual(await recheck(["C:\\allowed"]), { status: "completed", results: expected });
});
