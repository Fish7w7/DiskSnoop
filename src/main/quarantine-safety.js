const path = require("node:path");

function pathKey(targetPath) {
  return path.normalize(path.resolve(String(targetPath || ""))).replace(/[\\/]+$/, "").replaceAll("/", "\\").toLowerCase();
}

function sameOrInsidePath(targetPath, rootPath) {
  if (!targetPath || !rootPath) return false;
  const target = pathKey(targetPath);
  const root = pathKey(rootPath);
  return target === root || target.startsWith(`${root}\\`);
}

function isSensitiveWindowsPath(itemPath) {
  const normalized = String(itemPath || "").replaceAll("/", "\\").toLowerCase();
  return normalized.includes("\\windows\\")
    || normalized.endsWith("\\windows")
    || normalized.includes("\\system volume information\\")
    || normalized.includes("\\$recycle.bin\\")
    || normalized.includes("\\program files\\")
    || normalized.includes("\\program files (x86)\\")
    || normalized.includes("\\programdata\\package cache\\")
    || normalized.includes("\\programdata\\microsoft\\windows\\")
    || normalized.includes("\\drivers\\");
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
  pathKey,
  sameOrInsidePath,
  isSensitiveWindowsPath,
  quarantineFolderName,
  quarantineRecordRoot,
  assertNotInternalPath,
  assertTrustedQuarantineRecord,
  assertCanCrossVolumeMove
};
