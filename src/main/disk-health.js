function normalizeDriveLetter(value) {
  const match = String(value || "").trim().toUpperCase().match(/^([A-Z]):?$/);
  return match ? match[1] : "";
}

function diskHealthScript(driveLetter) {
  const letter = normalizeDriveLetter(driveLetter);
  if (!letter) throw new Error("Letra de disco inválida.");
  return `
$partition = Get-Partition -DriveLetter ${letter} -ErrorAction SilentlyContinue
if (-not $partition) { '{}'; exit }
$disk = Get-Disk -Number $partition.DiskNumber -ErrorAction SilentlyContinue
if (-not $disk) { '{}'; exit }
$physicalDisk = Get-PhysicalDisk | Where-Object { [string]$_.DeviceId -eq [string]$disk.Number } | Select-Object -First 1
if (-not $physicalDisk) { '{}'; exit }
$reliability = $physicalDisk | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue
[PSCustomObject]@{
  healthStatus = $physicalDisk.HealthStatus.ToString()
  operationalStatus = $physicalDisk.OperationalStatus -join ', '
  temperature = $reliability.Temperature
  powerOnHours = $reliability.PowerOnHours
  wear = $reliability.Wear
} | ConvertTo-Json -Depth 3
`;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseDiskHealth(output) {
  if (!output || String(output).trim() === "{}") return { status: "unavailable" };
  try {
    const parsed = JSON.parse(output);
    if (!parsed?.healthStatus) return { status: "unavailable" };
    return {
      status: parsed.healthStatus === "Healthy" ? "healthy" : "attention",
      operationalStatus: String(parsed.operationalStatus || ""),
      temperature: optionalNumber(parsed.temperature),
      powerOnHours: optionalNumber(parsed.powerOnHours),
      wear: optionalNumber(parsed.wear)
    };
  } catch {
    return { status: "unavailable" };
  }
}

function createDiskHealthService({ runPowerShell, platform = process.platform } = {}) {
  const cache = new Map();

  function get(driveLetter) {
    const letter = normalizeDriveLetter(driveLetter);
    if (!letter || platform !== "win32" || typeof runPowerShell !== "function") {
      return Promise.resolve({ status: "unavailable" });
    }
    if (!cache.has(letter)) {
      const request = Promise.resolve()
        .then(() => runPowerShell(diskHealthScript(letter), { timeout: 20000 }))
        .then(parseDiskHealth)
        .catch(() => ({ status: "unavailable" }));
      cache.set(letter, request);
    }
    return cache.get(letter);
  }

  return { get, cache };
}

module.exports = {
  createDiskHealthService,
  diskHealthScript,
  normalizeDriveLetter,
  parseDiskHealth
};
