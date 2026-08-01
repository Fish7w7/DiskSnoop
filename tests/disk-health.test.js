const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDiskHealthService,
  diskHealthScript,
  normalizeDriveLetter,
  parseDiskHealth
} = require("../src/main/disk-health");

test("normaliza somente letras de disco válidas", () => {
  assert.equal(normalizeDriveLetter("c:"), "C");
  assert.equal(normalizeDriveLetter(" D "), "D");
  assert.equal(normalizeDriveLetter("C:\\Windows"), "");
});

test("script usa cmdlets Storage sem interpolação arbitrária", () => {
  const script = diskHealthScript("c:");
  assert.match(script, /Get-Partition -DriveLetter C/);
  assert.match(script, /Get-PhysicalDisk/);
  assert.match(script, /Get-StorageReliabilityCounter/);
  assert.throws(() => diskHealthScript("C; Remove-Item"));
});

test("parser é fail-safe quando não há dado", () => {
  assert.deepEqual(parseDiskHealth("{}"), { status: "unavailable" });
  assert.deepEqual(parseDiskHealth("invalid"), { status: "unavailable" });
  assert.deepEqual(parseDiskHealth(JSON.stringify({
    healthStatus: "Healthy",
    operationalStatus: "OK",
    temperature: 36,
    powerOnHours: 1200,
    wear: null
  })), {
    status: "healthy",
    operationalStatus: "OK",
    temperature: 36,
    powerOnHours: 1200,
    wear: null
  });
});

test("consulta é cacheada uma vez por disco durante a sessão", async () => {
  let calls = 0;
  const service = createDiskHealthService({
    platform: "win32",
    runPowerShell: async () => {
      calls += 1;
      return JSON.stringify({ healthStatus: "Healthy", operationalStatus: "OK" });
    }
  });
  const [first, second] = await Promise.all([service.get("C:"), service.get("c")]);
  assert.equal(first.status, "healthy");
  assert.equal(second.status, "healthy");
  assert.equal(calls, 1);
});

test("falha da consulta nunca é tratada como saudável", async () => {
  const service = createDiskHealthService({
    platform: "win32",
    runPowerShell: async () => { throw new Error("unsupported"); }
  });
  assert.deepEqual(await service.get("C:"), { status: "unavailable" });
});
