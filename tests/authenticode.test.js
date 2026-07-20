const test = require("node:test");
const assert = require("node:assert/strict");

const {
  authenticodeScript,
  createAuthenticodeVerifier,
  escapePowerShellSingleQuoted,
  extractSignerName,
  isSignableFilePath
} = require("../src/main/authenticode");

test("extrai CN do subject completo e tolera subject ausente", () => {
  assert.equal(extractSignerName("CN=Microsoft Corporation, O=Microsoft Corporation, C=US"), "Microsoft Corporation");
  assert.equal(extractSignerName('CN="Example, Inc.", O=Example'), "Example, Inc.");
  assert.equal(extractSignerName("O=Example Corporation, C=US"), "");
  assert.equal(extractSignerName(null), "");
});

test("escapa aspas simples antes de montar o script PowerShell", () => {
  const source = "C:\\Users\\O'Brien\\setup.exe";
  assert.equal(escapePowerShellSingleQuoted(source), "'C:\\Users\\O''Brien\\setup.exe'");
  const script = authenticodeScript(source);
  assert.match(script, /-LiteralPath 'C:\\Users\\O''Brien\\setup\.exe'/);
  assert.doesNotMatch(script, /-LiteralPath 'C:\\Users\\O'Brien/);
});

test("limita a verificação às extensões Authenticode previstas", () => {
  assert.equal(isSignableFilePath("C:\\app.exe"), true);
  assert.equal(isSignableFilePath("C:\\driver.SYS"), true);
  assert.equal(isSignableFilePath("C:\\notes.txt"), false);
});

test("normaliza assinatura válida da Microsoft e reutiliza cache", async () => {
  let calls = 0;
  const verifier = createAuthenticodeVerifier({
    platform: "win32",
    runPowerShell: async () => {
      calls += 1;
      return JSON.stringify({ status: "Valid", signerSubject: "CN=Microsoft Corporation, O=Microsoft Corporation" });
    }
  });
  const first = await verifier.verify("C:\\Windows\\System32\\example.dll");
  const cached = await verifier.verify("c:\\windows\\system32\\EXAMPLE.DLL");
  assert.deepEqual(first, { status: "valid", signer: "Microsoft Corporation", isMicrosoft: true });
  assert.equal(cached.status, "valid");
  assert.equal(cached.cached, true);
  assert.equal(calls, 1);
});

test("normaliza assinatura de outro fornecedor, ausente e inválida", async () => {
  const outputs = [
    { status: "Valid", signerSubject: "CN=Example Corp, O=Example Corp" },
    { status: "NotSigned", signerSubject: null },
    { status: "HashMismatch", signerSubject: "CN=Example Corp" }
  ];
  const verifier = createAuthenticodeVerifier({
    platform: "win32",
    runPowerShell: async () => JSON.stringify(outputs.shift())
  });
  assert.deepEqual(await verifier.verify("C:\\one.exe"), { status: "valid", signer: "Example Corp", isMicrosoft: false });
  assert.deepEqual(await verifier.verify("C:\\two.msi"), { status: "unsigned", signer: "", isMicrosoft: false });
  assert.deepEqual(await verifier.verify("C:\\three.cab"), { status: "invalid", signer: "Example Corp", isMicrosoft: false });
});

test("falha da consulta nunca vira assinatura válida", async () => {
  const verifier = createAuthenticodeVerifier({
    platform: "win32",
    runPowerShell: async () => { throw new Error("PowerShell timeout"); }
  });
  assert.deepEqual(await verifier.verify("C:\\broken.exe"), { status: "unknown" });
});

test("retorna estados neutros fora do Windows ou para extensão não aplicável", async () => {
  let calls = 0;
  const runPowerShell = async () => { calls += 1; return "{}"; };
  const linuxVerifier = createAuthenticodeVerifier({ platform: "linux", runPowerShell });
  const windowsVerifier = createAuthenticodeVerifier({ platform: "win32", runPowerShell });
  assert.deepEqual(await linuxVerifier.verify("/tmp/app.exe"), { status: "not-supported" });
  assert.deepEqual(await windowsVerifier.verify("C:\\notes.txt"), { status: "not-applicable" });
  assert.equal(calls, 0);
});
