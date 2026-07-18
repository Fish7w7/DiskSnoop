const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertPermanentDeletionAllowed,
  canMoveToQuarantineByPolicy,
  pathProtection
} = require("../src/main/quarantine-safety");
const {
  createInstalledAppsInventory,
  parseInstalledAppsOutput
} = require("../src/main/installed-apps");
const { buildLargeFolderItem } = require("../src/scanner/scanner");

const STORE_PATH = "C:\\Users\\User\\AppData\\Local\\Packages\\Microsoft.WindowsStore_8wekyb3d8bbwe";

test("fluxo completo bloqueia pacote Store do scan ate a exclusao", () => {
  const scannedItem = buildLargeFolderItem({
    name: "Microsoft.WindowsStore_8wekyb3d8bbwe",
    path: STORE_PATH,
    size: 8 * 1024 * 1024 * 1024,
    files: 120,
    risk: "Verificar antes",
    children: []
  });

  assert.equal(scannedItem.security, "Sensivel");
  assert.equal(pathProtection(scannedItem.path).protected, true);
  assert.equal(canMoveToQuarantineByPolicy(scannedItem), false);
  assert.throws(
    () => assertPermanentDeletionAllowed({ originalPath: scannedItem.path }),
    /nao permite a exclusao permanente/
  );
});

test("falha ou resposta vazia do AppX fecha a protecao por padrao", () => {
  assert.equal(parseInstalledAppsOutput("").appxReliable, false);
  assert.equal(parseInstalledAppsOutput("invalid-json").appxReliable, false);
  const parsed = parseInstalledAppsOutput(JSON.stringify({ apps: [], appxReliable: false, appxError: "denied" }));
  assert.equal(parsed.appxReliable, false);
  assert.match(parsed.appxError, /denied/);
});

test("inventario AppX executa uma vez e reutiliza cache da sessao", async () => {
  let calls = 0;
  const inventory = createInstalledAppsInventory({
    platform: "win32",
    runPowerShell: async () => {
      calls += 1;
      return JSON.stringify({
        apps: [{ name: "Microsoft.WindowsStore", kind: "appx", packageFamilyName: "Microsoft.WindowsStore_8wekyb3d8bbwe" }],
        appxReliable: true,
        appxError: ""
      });
    }
  });

  const [first, concurrent] = await Promise.all([inventory.load(), inventory.load()]);
  const cached = await inventory.load();
  assert.equal(calls, 1);
  assert.equal(first.appxReliable, true);
  assert.equal(concurrent.apps.length, 1);
  assert.equal(cached.cached, true);
});

test("erro do PowerShell nunca vira inventario confiavel", async () => {
  const inventory = createInstalledAppsInventory({
    platform: "win32",
    runPowerShell: async () => {
      throw new Error("PowerShell timeout");
    }
  });
  const result = await inventory.load();
  assert.equal(result.appxReliable, false);
  assert.match(result.appxError, /timeout/);
});
