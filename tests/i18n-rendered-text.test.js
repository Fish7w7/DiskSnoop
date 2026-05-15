const assert = require("node:assert/strict");

global.window = {};
require("../src/renderer/i18n.js");

const i18n = global.window.diskSnoopI18n;

{
  const samples = [
    ["Quarentena", "Quarantine"],
    [
      "0 itens ativos. A lista principal mostra apenas o que ainda pode ser restaurado ou excluído.",
      "0 active items. The main list shows only what can still be restored or deleted."
    ],
    [
      "Registros finalizados e arquivos ausentes ficam separados para não bagunçar sua revisão. Limpar registros encerrados remove apenas o histórico local da quarentena.",
      "Finished records and missing files are kept separate to keep your review clean. Cleaning closed records removes only the local quarantine history."
    ],
    ["Ativos", "Active"],
    ["Ausentes", "Missing"],
    ["Finalizados", "Finished"],
    ["Limpar registros encerrados", "Clean closed records"],
    ["0 ativos", "0 active"],
    ["2 ausentes", "2 missing"],
    ["17 finalizados", "17 finished"],
    ["0 B protegidos", "0 B protected"],
    [
      "Nenhum item ativo na quarentena. Registros antigos ficam em Ausentes ou Finalizados.",
      "No active item in quarantine. Older records stay under Missing or Finished."
    ],
    ["Selecione um item em quarentena.", "Select a quarantined item."]
  ];

  for (const [source, expected] of samples) {
    assert.equal(i18n.translateRenderedText("en-US", source), expected);
  }
}

{
  const samples = [
    [
      "Último scan carregado: 5/14/26, 9:47 PM",
      "Last loaded scan: 5/14/26, 9:47 PM"
    ],
    ["Em quarentena agora: 0 B", "In quarantine now: 0 B"],
    ["Última variação livre registrada: -", "Last recorded free-space change: -"],
    [
      "Possíveis pastas órfãs encontradas em AppData, ProgramData e Program Files. Esta tela é conservadora.",
      "Possible orphan folders found in AppData, ProgramData, and Program Files. This screen is conservative."
    ],
    [
      "Esses achados são pistas, não confirmação de sobra. Só itens marcados como possível sobra ficam disponíveis para quarentena normal; o restante deve ser aberto e revisado manualmente.",
      "These findings are clues, not confirmation of leftovers. Only items marked as possible leftovers are available for normal quarantine; everything else should be opened and reviewed manually."
    ],
    ["analisadas", "analyzed"],
    ["possíveis sobras", "possible leftovers"],
    ["ligadas a apps instalados", "linked to installed apps"],
    ["verificar", "to review"],
    ["Local", "Location"]
  ];

  for (const [source, expected] of samples) {
    assert.equal(i18n.translateRenderedText("en-US", source), expected);
  }
}

{
  const samples = [
    ["Possíveis Duplicados", "Possible Duplicates"],
    ["Candidatos à Limpeza", "Cleanup Candidates"],
    ["Conteúdo principal", "Main contents"],
    ["Itens sensíveis como Windows, System32, drivers e programas ativos continuam fora dos candidatos normais.", "Sensitive items such as Windows, System32, drivers, and active programs remain outside normal candidates."],
    ["Arquivo grande a partir de:", "Large file from:"],
    ["Local atual: C:\\Users\\oloco\\AppData\\Roaming\\DiskSnoop\\Quarantine", "Current location: C:\\Users\\oloco\\AppData\\Roaming\\DiskSnoop\\Quarantine"],
    ["2 scans no histórico", "2 scans in history"],
    ["1 scan carregado nesta sessão", "1 scan loaded in this session"],
    ["sim relatório salvo para abertura rápida", "sim saved report for quick opening"],
    ["3 arquivos encontrados acima de 500 MB. Total visível: 2 GB.", "3 files found above 500 MB. Visible total: 2 GB."],
    ["4 itens visíveis de 9. O filtro padrão mostra achados revisáveis e evita itens que exigem cautela maior.", "4 visible items of 9. The default filter shows reviewable findings and avoids items that require extra caution."]
  ];

  for (const [source, expected] of samples) {
    assert.equal(i18n.translateRenderedText("en-US", source), expected);
  }
}

{
  const samples = [
    ["Achados importantes", "Important findings"],
    ["Ver maiores pastas", "View largest folders"],
    ["Ver arquivos grandes", "View large files"],
    ["Revisar candidatos", "Review candidates"],
    ["Checar sobras de apps", "Check app leftovers"],
    ["Ajustar regras", "Adjust rules"],
    ["Mostrando 12 de 80", "Showing 12 of 80"],
    ["3 selecionado(s)", "3 selected"],
    ["2 seguros", "2 safe"],
    ["4 prováveis removíveis", "4 probably removable"],
    ["5 verificar antes", "5 review first"],
    ["1 bloqueados", "1 blocked"],
    ["Atualização baixada.", "Update downloaded."],
    ["Quarentena voltou para o local padrão.", "Quarantine returned to the default location."],
    ["Relatório de 5/14/26, 9:47 PM carregado.", "Report from 5/14/26, 9:47 PM loaded."],
    ["Digite EXCLUIR exatamente para continuar.", "Type EXCLUIR exactly to continue."]
  ];

  for (const [source, expected] of samples) {
    assert.equal(i18n.translateRenderedText("en-US", source), expected);
  }
}

{
  const samples = [
    ["Relatório antigo ou sem vínculo com o último scan. Para evitar ações em dados possivelmente desatualizados, mover para quarentena fica bloqueado aqui. Faça um novo scan para agir sobre o estado atual do disco.", "Old report or not linked to the last scan. To avoid actions on possibly outdated data, moving to quarantine is blocked here. Run a new scan to act on the current disk state."],
    ["Candidatos são sugestões de revisão, não comandos de limpeza. Itens protegidos, sensíveis ou ligados a apps instalados ficam bloqueados para quarentena normal.", "Candidates are review suggestions, not cleanup commands. Protected, sensitive, or installed-app items are blocked from normal quarantine."],
    ["Duplicados são pré-filtrados por nome e tamanho e confirmados por hash SHA-256 quando o arquivo pode ser lido. Nada é removido automaticamente.", "Duplicates are pre-filtered by name and size and confirmed by SHA-256 hash when the file can be read. Nothing is removed automatically."],
    ["Último scan carregado: nenhum", "Last loaded scan: none"],
    ["Claro", "Light"],
    ["Escuro", "Dark"],
    ["sim", "yes"],
    ["não", "no"],
    ["Esta ação não pode ser desfeita pelo DiskSnoop.", "This action cannot be undone by DiskSnoop."],
    ["Este registro existe no histórico, mas o snapshot detalhado não foi encontrado nos dados locais do DiskSnoop.", "This record exists in history, but the detailed snapshot was not found in DiskSnoop local data."],
    ["Item em uso ou protegido", "Item in use or protected"],
    ["Não foi possível mover", "Could not move"],
    ["Cache não pôde ser movido. Acesso negado.", "Cache could not be moved. Acesso negado."],
    ["Tipo Dev", "Type Dev"],
    ["Selo Seguro", "Badge Seguro"],
    ["Status Em quarentena", "Status Em quarentena"],
    ["Modificado yesterday", "Modified yesterday"]
  ];

  for (const [source, expected] of samples) {
    assert.equal(i18n.translateRenderedText("en-US", source), expected);
  }
}

{
  const samples = [
    ["Projetos dev", "Dev projects"],
    ["Downloads antigos", "Old downloads"],
    ["Instaladores antigos", "Old installers"],
    ["Compactados antigos", "Old archives"],
    ["Logs grandes", "Large logs"],
    ["Temporarios", "Temporary"],
    ["Seguro revisar", "Safe to review"],
    ["Sensivel", "Sensitive"],
    ["Hash confirmado", "Hash confirmed"],
    ["Arquivo acima do limite configurado para arquivos grandes.", "File above the configured large-file limit."],
    ["Arquivos com mesmo nome, mesmo tamanho e mesmo hash SHA-256. Ainda assim, o DiskSnoop não move nada automaticamente.", "Files with the same name, same size, and same SHA-256 hash. Even so, DiskSnoop does not move anything automatically."],
    ["Como revisar", "How to review"],
    ["Resumo seguro", "Safe summary"],
    ["Motivo do achado", "Why it was found"],
    ["Atenção antes de mover", "Before moving"],
    ["A primeira linha é só a cópia mais recente por data de modificação. Mesmo com hash confirmado, abra os caminhos quando houver dúvida antes de mover qualquer cópia.", "The first row is only the most recent copy by modification date. Even with a confirmed hash, open the paths when in doubt before moving any copy."]
  ];

  for (const [source, expected] of samples) {
    assert.equal(i18n.translateRenderedText("en-US", source), expected);
  }
}

{
  assert.equal(i18n.translate("en-US", "boot.loadingApp"), "Preparing DiskSnoop...");
  assert.equal(i18n.translate("en-US", "boot.openingApp"), "Opening app...");
  assert.equal(i18n.translatePlaceholder("en-US", "Buscar arquivo ou caminho..."), "Search file or path...");
  assert.equal(i18n.translatePlaceholder("en-US", "Buscar app ou caminho..."), "Search app or path...");
  assert.equal(i18n.translatePlaceholder("en-US", "Buscar caminho..."), "Search path...");
  assert.equal(i18n.translatePlaceholder("en-US", "Buscar item ou caminho..."), "Search item or path...");
}

console.log("i18n rendered text checks passed");
