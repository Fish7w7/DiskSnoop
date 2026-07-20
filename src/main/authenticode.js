const path = require("node:path");

const SIGNABLE_EXTENSIONS = new Set([".exe", ".dll", ".msi", ".sys", ".cab", ".ocx"]);

function escapePowerShellSingleQuoted(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function extractSignerName(subject) {
  if (typeof subject !== "string" || !subject.trim()) return "";
  const match = subject.match(/(?:^|,\s*)CN=(?:"((?:[^"]|"")*)"|([^,]+))/i);
  return String(match?.[1] || match?.[2] || "").replace(/""/g, '"').trim();
}

function isSignableFilePath(filePath) {
  return SIGNABLE_EXTENSIONS.has(path.extname(String(filePath || "")).toLowerCase());
}

function authenticodeScript(filePath) {
  return `
$ErrorActionPreference = "Stop"
$sig = Get-AuthenticodeSignature -LiteralPath ${escapePowerShellSingleQuoted(filePath)}
[PSCustomObject]@{
  status = $sig.Status.ToString()
  statusMessage = $sig.StatusMessage
  signerSubject = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { $null }
} | ConvertTo-Json -Depth 3 -Compress
`;
}

function createAuthenticodeVerifier({ runPowerShell, platform = process.platform } = {}) {
  const cache = new Map();

  async function verify(filePath) {
    const normalizedPath = String(filePath || "");
    if (platform !== "win32") return { status: "not-supported" };
    if (!isSignableFilePath(normalizedPath)) return { status: "not-applicable" };

    const cacheKey = normalizedPath.toLowerCase();
    if (cache.has(cacheKey)) return { ...cache.get(cacheKey), cached: true };
    if (typeof runPowerShell !== "function") return { status: "unknown" };

    try {
      const output = await runPowerShell(authenticodeScript(normalizedPath));
      if (!output) throw new Error("Sem resposta do PowerShell.");
      const parsed = JSON.parse(output);
      const rawStatus = String(parsed?.status || "").toLowerCase();
      const signerSubject = String(parsed?.signerSubject || "");
      const result = {
        status: rawStatus === "valid" ? "valid" : rawStatus === "notsigned" ? "unsigned" : "invalid",
        signer: extractSignerName(signerSubject),
        isMicrosoft: /Microsoft Corporation/i.test(signerSubject)
      };
      cache.set(cacheKey, result);
      return result;
    } catch {
      return { status: "unknown" };
    }
  }

  return { verify, cache };
}

module.exports = {
  SIGNABLE_EXTENSIONS,
  authenticodeScript,
  createAuthenticodeVerifier,
  escapePowerShellSingleQuoted,
  extractSignerName,
  isSignableFilePath
};
