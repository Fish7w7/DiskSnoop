const path = require("node:path");

const PROTECTED_APP_DATA_PATH_SEGMENTS = Object.freeze([
  "\\appdata\\local\\packages",
  "\\appdata\\local\\microsoft\\windowsapps",
  "\\appdata\\local\\microsoft\\onedrive"
]);

const SENSITIVE_WINDOWS_PATH_SEGMENTS = Object.freeze([
  "\\windows",
  "\\system volume information",
  "\\$recycle.bin",
  "\\program files",
  "\\program files (x86)",
  "\\programdata\\package cache",
  "\\programdata\\microsoft\\windows",
  "\\drivers",
  ...PROTECTED_APP_DATA_PATH_SEGMENTS
]);

function pathKey(targetPath) {
  return path.normalize(path.resolve(String(targetPath || ""))).replace(/[\\/]+$/, "").replaceAll("/", "\\").toLowerCase();
}

function sameOrInsidePath(targetPath, rootPath) {
  if (!targetPath || !rootPath) return false;
  const target = pathKey(targetPath);
  const root = pathKey(rootPath);
  return target === root || target.startsWith(`${root}\\`);
}

function matchesProtectedSegment(itemPath, segments) {
  const normalized = String(itemPath || "").replaceAll("/", "\\").toLowerCase();
  return segments.some((segment) => (
    normalized === segment.slice(1)
      || normalized.endsWith(segment)
      || normalized.includes(`${segment}\\`)
  ));
}

function isProtectedAppDataPath(itemPath) {
  return matchesProtectedSegment(itemPath, PROTECTED_APP_DATA_PATH_SEGMENTS);
}

function isSensitiveWindowsPath(itemPath) {
  return matchesProtectedSegment(itemPath, SENSITIVE_WINDOWS_PATH_SEGMENTS);
}

function pathProtection(itemPath) {
  if (isProtectedAppDataPath(itemPath)) {
    return {
      protected: true,
      code: "protected-app-data",
      label: "Componente protegido",
      reason: "Dados ativos do Windows, da Microsoft Store, do OneDrive ou de outro aplicativo integrado."
    };
  }
  if (isSensitiveWindowsPath(itemPath)) {
    return {
      protected: true,
      code: "protected-windows-path",
      label: "Componente protegido",
      reason: "Área sensível do Windows ou de programas instalados."
    };
  }
  return { protected: false, code: "", label: "", reason: "" };
}

function canMoveToQuarantineByPolicy(item) {
  return Boolean(item?.path)
    && !isSensitiveWindowsPath(item.path)
    && !["Sensivel", "Sensível"].includes(item.security)
    && !["Sensivel", "Sensível"].includes(item.risk);
}

function assertPermanentDeletionAllowed(record) {
  if (record?.originalPath && isSensitiveWindowsPath(record.originalPath)) {
    throw new Error("Este item veio de uma area protegida do Windows ou de um app instalado. O DiskSnoop nao permite a exclusao permanente; restaure ou revise manualmente.");
  }
}

function isElevatedDeletionRisk(record) {
  const normalized = String(record?.originalPath || "").replaceAll("/", "\\").toLowerCase();
  return normalized.includes("\\appdata\\")
    || normalized.includes("\\programdata\\")
    || normalized.includes("\\program files\\")
    || normalized.includes("\\program files (x86)\\");
}

function quarantineFolderName(folderPath) {
  return ["quarantine", "disksnoop quarantine"].includes(path.basename(path.normalize(folderPath || "")).toLowerCase());
}

function quarantineRecordRoot(record) {
  return record?.quarantineRoot || (record?.quarantinePath ? path.dirname(record.quarantinePath) : "");
}

function assertNotInternalPath(sourcePath, roots = {}) {
  const protectedRoots = [roots.userData, roots.defaultQuarantine, roots.quarantineRoot].filter(Boolean);

  for (const protectedRoot of protectedRoots) {
    if (sameOrInsidePath(sourcePath, protectedRoot) || sameOrInsidePath(protectedRoot, sourcePath)) {
      throw new Error("Este item fica dentro dos dados internos ou da quarentena do DiskSnoop. Por seguranca, revise manualmente.");
    }
  }
}

function assertTrustedQuarantineRecord(record, trustedRoots = []) {
  if (!record?.quarantinePath) throw new Error("Registro de quarentena sem caminho interno.");
  const trusted = trustedRoots.filter(Boolean).some((root) => sameOrInsidePath(record.quarantinePath, root));
  if (!trusted) {
    throw new Error("O registro da quarentena aponta para fora de uma raiz reconhecida. Abra a pasta e revise manualmente.");
  }
}

function assertCanCrossVolumeMove(stat) {
  if (stat.isSymbolicLink()) {
    throw new Error("Links simbolicos, junctions e pontos de reparse nao sao movidos para quarentena.");
  }
  if (stat.isDirectory()) {
    throw new Error("Mover pastas entre discos exigiria copiar e remover a origem. Na versao 1.0, o DiskSnoop bloqueia isso por seguranca. Escolha uma quarentena no mesmo disco ou revise manualmente.");
  }
  if (!stat.isFile()) {
    throw new Error("Este tipo de item nao pode ser movido entre discos com seguranca.");
  }
}

module.exports = {
  sameOrInsidePath,
  pathProtection,
  canMoveToQuarantineByPolicy,
  assertPermanentDeletionAllowed,
  isElevatedDeletionRisk,
  isSensitiveWindowsPath,
  quarantineFolderName,
  quarantineRecordRoot,
  assertNotInternalPath,
  assertTrustedQuarantineRecord,
  assertCanCrossVolumeMove,
  isProtectedAppDataPath
};
