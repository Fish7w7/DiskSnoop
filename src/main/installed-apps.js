"use strict";

const INSTALLED_APPS_SCRIPT = String.raw`
$ErrorActionPreference = "Stop"
$paths = @(
  "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
  "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
  "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
)
$win32 = @($paths | ForEach-Object {
  Get-ItemProperty $_ -ErrorAction SilentlyContinue
} | Where-Object { $_.DisplayName } | ForEach-Object {
  [PSCustomObject]@{
    name = $_.DisplayName
    version = $_.DisplayVersion
    publisher = $_.Publisher
    installLocation = $_.InstallLocation
    kind = "win32"
    packageFamilyName = ""
    packageFullName = ""
  }
})
$appxReliable = $false
$appxError = ""
$appx = @()
try {
  $appx = @(Get-AppxPackage -ErrorAction Stop | ForEach-Object {
    [PSCustomObject]@{
      name = $_.Name
      version = $_.Version.ToString()
      publisher = $_.Publisher
      installLocation = $_.InstallLocation
      kind = "appx"
      packageFamilyName = $_.PackageFamilyName
      packageFullName = $_.PackageFullName
    }
  })
  $appxReliable = $true
} catch {
  $appxError = $_.Exception.Message
}
[PSCustomObject]@{
  apps = @($win32) + @($appx)
  appxReliable = $appxReliable
  appxError = $appxError
} | ConvertTo-Json -Depth 4 -Compress
`;

function normalizeApp(appInfo = {}) {
  return {
    name: appInfo.name || "",
    version: appInfo.version || "",
    publisher: appInfo.publisher || "",
    installLocation: appInfo.installLocation || "",
    kind: appInfo.kind || "win32",
    packageFamilyName: appInfo.packageFamilyName || "",
    packageFullName: appInfo.packageFullName || ""
  };
}

function failClosedInventory(error = "") {
  return {
    apps: [],
    appxReliable: false,
    appxError: String(error || "A descoberta de pacotes AppX não pôde ser confirmada."),
    cached: false
  };
}

function parseInstalledAppsOutput(output) {
  if (!output) return failClosedInventory("O PowerShell não retornou o inventário de aplicativos.");
  try {
    const parsed = JSON.parse(output);
    return {
      apps: (Array.isArray(parsed?.apps) ? parsed.apps : parsed?.apps ? [parsed.apps] : []).map(normalizeApp),
      appxReliable: parsed?.appxReliable === true,
      appxError: parsed?.appxReliable === true ? "" : String(parsed?.appxError || "A consulta Get-AppxPackage falhou."),
      cached: false
    };
  } catch (error) {
    return failClosedInventory(`Resposta inválida do PowerShell: ${error.message}`);
  }
}

function createInstalledAppsInventory({ runPowerShell, platform = process.platform } = {}) {
  let cachedInventory = null;
  let pendingInventory = null;

  async function load() {
    if (cachedInventory) return { ...cachedInventory, cached: true };
    if (pendingInventory) return pendingInventory;
    if (platform !== "win32" || typeof runPowerShell !== "function") {
      cachedInventory = failClosedInventory("A descoberta AppX está disponível apenas no Windows.");
      return cachedInventory;
    }
    pendingInventory = Promise.resolve()
      .then(() => runPowerShell(INSTALLED_APPS_SCRIPT))
      .then(parseInstalledAppsOutput)
      .catch((error) => failClosedInventory(error?.message || error))
      .then((inventory) => {
        cachedInventory = inventory;
        pendingInventory = null;
        return inventory;
      });
    return pendingInventory;
  }

  return {
    load,
    clear() {
      cachedInventory = null;
      pendingInventory = null;
    }
  };
}

module.exports = {
  createInstalledAppsInventory,
  parseInstalledAppsOutput
};
