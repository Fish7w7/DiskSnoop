const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const MAX_RECHECK_PATHS = 500;

function normalizeRecheckPaths(paths) {
  const seen = new Set();
  const normalized = [];
  for (const value of Array.isArray(paths) ? paths : []) {
    const itemPath = String(value || "").trim();
    if (!itemPath || itemPath.includes("\0")) continue;
    const key = process.platform === "win32" ? itemPath.toLowerCase() : itemPath;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(itemPath);
    if (normalized.length >= MAX_RECHECK_PATHS) break;
  }
  return normalized;
}

function errorReason(error) {
  return String(error?.code || error?.message || "UNKNOWN");
}

async function measurePath(itemPath, fsApi = fs) {
  async function measure(currentPath) {
    const stat = await fsApi.lstat(currentPath);
    if (stat.isSymbolicLink()) return 0;
    if (stat.isFile()) return Number(stat.size || 0);
    if (!stat.isDirectory()) return Number(stat.size || 0);
    const entries = await fsApi.readdir(currentPath, { withFileTypes: true });
    let size = 0;
    for (const entry of entries) {
      size += await measure(path.join(currentPath, entry.name));
    }
    return size;
  }

  try {
    const stat = await fsApi.lstat(itemPath);
    const size = await measure(itemPath);
    return {
      path: itemPath,
      accessible: true,
      size,
      kind: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other",
      modifiedAt: stat.mtime?.toISOString?.() || null,
      error: null
    };
  } catch (error) {
    return { path: itemPath, accessible: false, size: 0, kind: "unknown", modifiedAt: null, error: errorReason(error) };
  }
}

async function runElevatedWorker(requestFile, resultFile, fsApi = fs) {
  const raw = await fsApi.readFile(requestFile, "utf8");
  const request = JSON.parse(raw);
  const paths = normalizeRecheckPaths(request?.paths);
  const results = [];
  for (const itemPath of paths) results.push(await measurePath(itemPath, fsApi));
  await fsApi.writeFile(resultFile, JSON.stringify({ results }), "utf8");
  return results;
}

function parseElevatedRecheckArgs(argv = process.argv) {
  const index = argv.indexOf("--recheck-elevated");
  if (index < 0 || !argv[index + 1] || !argv[index + 2]) return null;
  return { requestFile: argv[index + 1], resultFile: argv[index + 2] };
}

function validateHandoffPaths(requestFile, resultFile, userDataPath) {
  const root = path.resolve(String(userDataPath || ""));
  const request = path.resolve(String(requestFile || ""));
  const result = path.resolve(String(resultFile || ""));
  if (!root || path.dirname(request) !== root || path.dirname(result) !== root) return false;
  return /^recheck-request-[0-9a-f-]+\.json$/i.test(path.basename(request))
    && /^recheck-result-[0-9a-f-]+\.json$/i.test(path.basename(result));
}

function quotePowerShell(value) {
  return `'${String(value || "").replaceAll("'", "''")}'`;
}

function elevatedLaunchScript(executable, args) {
  const argumentList = args.map(quotePowerShell).join(", ");
  return `$process = Start-Process -FilePath ${quotePowerShell(executable)} -ArgumentList @(${argumentList}) -Verb RunAs -Wait -PassThru\nif ($process.ExitCode -ne 0) { exit $process.ExitCode }`;
}

function runExecFile(execFile, file, args, options) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

function createElevatedRechecker({
  app,
  execFile,
  fsApi = fs,
  executable = process.execPath,
  appEntry = process.argv[1],
  timeoutMs = 60000
} = {}) {
  if (!app || typeof execFile !== "function") throw new Error("Dependências de rechecagem elevadas ausentes.");

  return async function recheck(paths) {
    const normalized = normalizeRecheckPaths(paths);
    if (!normalized.length) return { status: "completed", results: [] };

    const token = crypto.randomUUID();
    const requestFile = path.join(app.getPath("userData"), `recheck-request-${token}.json`);
    const resultFile = path.join(app.getPath("userData"), `recheck-result-${token}.json`);
    const elevatedArgs = [
      ...(app.isPackaged ? [] : [path.resolve(appEntry || ".")]),
      "--recheck-elevated",
      requestFile,
      resultFile
    ];

    await fsApi.mkdir(app.getPath("userData"), { recursive: true });
    await fsApi.writeFile(requestFile, JSON.stringify({ paths: normalized }), "utf8");
    await fsApi.rm(resultFile, { force: true });

    try {
      const script = elevatedLaunchScript(executable, elevatedArgs);
      await runExecFile(execFile, "powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024
      });
      const raw = await fsApi.readFile(resultFile, "utf8").catch(() => "");
      if (!raw) return { status: "cancelled", results: [] };
      const parsed = JSON.parse(raw);
      return { status: "completed", results: Array.isArray(parsed?.results) ? parsed.results : [] };
    } catch (error) {
      if (error?.killed || error?.code === "ETIMEDOUT") return { status: "timeout", results: [] };
      const message = `${error?.message || ""} ${error?.stderr || ""}`.toLowerCase();
      if (message.includes("cancel") || message.includes("canceled") || message.includes("cancelado")) {
        return { status: "cancelled", results: [] };
      }
      return { status: "error", results: [], error: errorReason(error) };
    } finally {
      await Promise.all([
        fsApi.rm(requestFile, { force: true }).catch(() => {}),
        fsApi.rm(resultFile, { force: true }).catch(() => {})
      ]);
    }
  };
}

module.exports = {
  createElevatedRechecker,
  elevatedLaunchScript,
  measurePath,
  normalizeRecheckPaths,
  parseElevatedRecheckArgs,
  quotePowerShell,
  runElevatedWorker,
  validateHandoffPaths
};
