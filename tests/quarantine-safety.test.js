const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertCanCrossVolumeMove,
  assertNotInternalPath,
  assertTrustedQuarantineRecord,
  isSensitiveWindowsPath,
  quarantineFolderName,
  quarantineRecordRoot,
  sameOrInsidePath
} = require("../src/main/quarantine-safety");

function fakeStat(kind) {
  return {
    isSymbolicLink: () => kind === "link",
    isDirectory: () => kind === "directory",
    isFile: () => kind === "file"
  };
}

test("detecta caminhos sensiveis do Windows", () => {
  assert.equal(isSensitiveWindowsPath("C:\\Windows\\System32\\drivers\\etc\\hosts"), true);
  assert.equal(isSensitiveWindowsPath("C:\\Program Files\\App\\cache"), true);
  assert.equal(isSensitiveWindowsPath("C:\\ProgramData\\Microsoft\\Windows\\Start Menu"), true);
  assert.equal(isSensitiveWindowsPath("C:\\Users\\User\\Downloads\\setup.exe"), false);
});

test("reconhece caminho igual ou filho sem confundir prefixos parecidos", () => {
  assert.equal(sameOrInsidePath("C:\\Users\\User\\AppData\\Local\\DiskSnoop\\Quarantine\\item", "C:\\Users\\User\\AppData\\Local\\DiskSnoop"), true);
  assert.equal(sameOrInsidePath("C:\\Users\\User\\AppData\\Local\\DiskSnoop-Backup\\item", "C:\\Users\\User\\AppData\\Local\\DiskSnoop"), false);
});

test("bloqueia dados internos e a propria quarentena como origem", () => {
  const roots = {
    userData: "C:\\Users\\User\\AppData\\Roaming\\DiskSnoop",
    defaultQuarantine: "C:\\Users\\User\\AppData\\Roaming\\DiskSnoop\\Quarantine",
    quarantineRoot: "D:\\DiskSnoop Quarantine"
  };

  assert.throws(
    () => assertNotInternalPath("C:\\Users\\User\\AppData\\Roaming\\DiskSnoop\\settings.json", roots),
    /dados internos/
  );
  assert.throws(
    () => assertNotInternalPath("D:\\DiskSnoop Quarantine\\123-cache", roots),
    /dados internos/
  );
  assert.doesNotThrow(() => assertNotInternalPath("C:\\Users\\User\\Downloads\\old.iso", roots));
});

test("aceita apenas registros dentro de raizes de quarentena confiaveis", () => {
  assert.doesNotThrow(() => assertTrustedQuarantineRecord(
    { quarantinePath: "D:\\DiskSnoop Quarantine\\123-cache" },
    ["D:\\DiskSnoop Quarantine"]
  ));
  assert.throws(
    () => assertTrustedQuarantineRecord(
      { quarantinePath: "C:\\Users\\User\\Documents\\important.docx" },
      ["D:\\DiskSnoop Quarantine"]
    ),
    /fora de uma raiz reconhecida/
  );
});

test("bloqueia pastas, links e itens especiais entre volumes", () => {
  assert.doesNotThrow(() => assertCanCrossVolumeMove(fakeStat("file")));
  assert.throws(() => assertCanCrossVolumeMove(fakeStat("directory")), /bloqueia isso por seguranca/);
  assert.throws(() => assertCanCrossVolumeMove(fakeStat("link")), /Links simbolicos/);
  assert.throws(() => assertCanCrossVolumeMove(fakeStat("other")), /tipo de item/);
});

test("identifica raiz de registros antigos e nomes de pasta de quarentena", () => {
  assert.equal(quarantineFolderName("D:\\DiskSnoop Quarantine"), true);
  assert.equal(quarantineFolderName("D:\\Quarantine"), true);
  assert.equal(quarantineFolderName("D:\\Downloads"), false);
  assert.equal(
    quarantineRecordRoot({ quarantinePath: "D:\\DiskSnoop Quarantine\\123-cache" }),
    "D:\\DiskSnoop Quarantine"
  );
});
