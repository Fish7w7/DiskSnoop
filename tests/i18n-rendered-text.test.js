const assert = require("node:assert/strict");

global.window = {};
require("../src/renderer/i18n.js");

const i18n = global.window.diskSnoopI18n;

{
  const samples = [
    ["Quarentena", "Quarantine"],
    ["Quarentena organizada", "Organized quarantine"],
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
    ["Achados conservadores", "Conservative findings"],
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
    ["3 componentes protegidos", "3 protected components"],
    ["Componente do sistema", "System component"],
    ["Componente protegido do sistema", "Protected system component"],
    ["🔒 Componente protegido", "🔒 Protected component"],
    ["4 verificação indisponível", "4 verification unavailable"],
    ["Descoberta AppX indisponível", "AppX discovery unavailable"],
    ["Proteção adicional do Windows", "Additional Windows protection"],
    ["Criar ponto", "Create restore point"],
    ["Continuar sem ponto", "Continue without restore point"],
    ["Log de auditoria: C:\\Users\\User\\audit-log.jsonl", "Audit log: C:\\Users\\User\\audit-log.jsonl"],
    [
      "Este caminho guarda dados ativos do Windows, da Microsoft Store ou de outro aplicativo integrado. O DiskSnoop permite apenas abrir e inspecionar o local.",
      "This path stores active data from Windows, Microsoft Store, or another integrated application. DiskSnoop only allows opening and inspecting the location."
    ],
    ["Ação bloqueada", "Action blocked"],
    ["verificar", "to review"],
    ["Local", "Location"],
    ["Possível sobra de app", "Possible app leftover"],
    [
      "Encontramos esta pasta em uma área comum de dados de aplicativos, mas ela não apareceu como app instalado. Pode ser cache antigo, configuração esquecida ou dado ainda útil.",
      "We found this folder in a common application data area, but it did not appear as an installed app. It may be old cache, forgotten settings, or still-useful data."
    ],
    ["Antes de mover", "Before moving"],
    [
      "Abra a pasta, confira os maiores itens e veja se o app ainda existe. Se nada parecer importante, use a quarentena para testar com segurança.",
      "Open the folder, check the largest items, and see whether the app still exists. If nothing looks important, use quarantine to test safely."
    ],
    ["App instalado encontrado", "Installed app found"],
    [
      "O nome lembra NVIDIA. Isso geralmente indica que a pasta ainda pertence a um app instalado ou usado recentemente.",
      "The name resembles NVIDIA. This usually means the folder still belongs to an installed or recently used app."
    ]
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
    ["Ganho seguro", "Safe gain"],
    ["Aparência e idioma", "Appearance and language"],
    ["Análise", "Analysis"],
    ["Personalize como o DiskSnoop aparece e se comunica.", "Customize how DiskSnoop looks and communicates."],
    ["Atualização", "Update"],
    ["Versão instalada:", "Installed version:"],
    ["Versão instalada: v1.5.0", "Installed version: v1.5.0"],
    ["Abrir Atualização", "Open Update"],
    ["itens em quarentena", "items in quarantine"],
    ["scan no histórico", "scan in history"],
    ["scans no histórico", "scans in history"],
    ["scan carregado nesta sessão", "scan loaded in this session"],
    ["scans carregados nesta sessão", "scans loaded in this session"],
    ["relatório salvo para abertura rápida", "saved report for quick opening"],
    ["grupos", "groups"],
    ["cópias", "copies"],
    ["estimado", "estimated"],
    ["Todas", "All"],
    ["Disco D:", "Drive D:"],
    [
      "A quarentena está em outro disco. Arquivos podem ser copiados com verificação antes da remoção; pastas entre volumes podem ser bloqueadas por segurança. Para pastas grandes, escolha uma quarentena no mesmo disco.",
      "Quarantine is on another drive. Files can be copied with verification before removal; folders across drives may be blocked for safety. For large folders, choose quarantine on the same drive."
    ],
    ["Plano seguro disponível", "Safe plan available"],
    ["Plano seguro", "Safe plan"],
    ["Simular plano seguro", "Simulate safe plan"],
    ["Desfazer", "Undo"],
    ["3 item(ns) movido(s) para a quarentena.", "3 item(s) moved to quarantine."],
    ["3 item(ns) restaurado(s).", "3 item(s) restored."],
    ["Ver todos os candidatos", "View all candidates"],
    ["Próximos passos", "Next steps"],
    ["Uma ordem simples para revisar o que mais importa.", "A simple order for reviewing what matters most."],
    ["4 item(ns) de baixo risco podem ser revisados sem alterar nada agora.", "4 low-risk item(s) can be reviewed without changing anything yet."],
    ["+2 GB revisáveis · -1 GB no plano seguro · +3 candidatos", "+2 GB reviewable · -1 GB in the safe plan · +3 candidates"],
    ["4 item(ns) adicionados à simulação. Nenhum arquivo foi alterado.", "4 item(s) added to the simulation. No files were changed."],
    ["Assistente de revisão", "Review assistant"],
    ["Comparação com scan anterior", "Compare with previous scan"],
    ["Sem base anterior para este disco", "No previous baseline for this drive"],
    ["Simulacao de limpeza", "Cleanup simulation"],
    ["Selecionar plano seguro", "Select safe plan"],
    ["Limpar selecao", "Clear selection"],
    ["Nada selecionado para simular.", "Nothing selected to simulate."],
    ["Esse item nao existe mais e saiu do relatorio atual.", "This item no longer exists and was removed from the current report."],
    ["Confianca", "Confidence"],
    ["3 item(ns) na simulacao atual.", "3 item(s) in the current simulation."],
    ["4 item(ns) no plano seguro visivel.", "4 item(s) in the visible safe plan."],
    ["Desde ontem", "Since ontem"],
    ["+2 candidato(s)", "+2 candidate(s)"],
    ["2 item(ns) apagado(s) fora do DiskSnoop foram removidos deste relatorio.", "2 item(s) deleted outside DiskSnoop were removed from this report."],
    ["Comece pelo seguro", "Start with safe items"],
    ["Revise duplicados", "Review duplicates"],
    ["Cheque sobras de apps", "Check app leftovers"],
    ["3 item(ns) de baixo risco somam 2 GB.", "3 low-risk item(s) add up to 2 GB."],
    ["1 GB parecem revisáveis, mas exigem escolha manual.", "1 GB look reviewable, but require a manual choice."],
    ["2 pasta(s) parecem sobras possíveis em áreas de apps.", "2 folder(s) look like possible leftovers in app areas."],
    ["Nenhum espaço revisável por duplicados neste scan.", "No reviewable duplicate space in this scan."],
    ["Nenhuma sobra de app apareceu como prioridade.", "No app leftover appeared as a priority."],
    ["Pronto", "Ready"],
    ["Nada agora", "Nothing now"],
    ["Revisar", "Review"],
    ["Limpo", "Clean"],
    ["Gerados por projetos", "Generated by projects"],
    ["node_modules, builds, caches de build e saídas recriáveis encontrados neste scan.", "node_modules, builds, build caches, and recreateable outputs found in this scan."],
    ["Caches detectados", "Detected caches"],
    ["Pastas de cache encontradas pelo scanner para sair dos próximos relatórios.", "Cache folders found by the scanner to leave out of future reports."],
    ["Instaladores, compactados e downloads antigos já sinalizados neste scan.", "Installers, archives, and old downloads already flagged in this scan."],
    ["Nenhuma nova pasta para ignorar neste preset.", "No new folder to ignore in this preset."],
    ["3 pasta(s) adicionada(s) aos ignorados.", "3 folder(s) added to ignored paths."],
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
    ["Relatório antigo", "Old report"],
    ["Revisão protegida", "Protected review"],
    ["Candidatos são sugestões de revisão, não comandos de limpeza. Itens protegidos, sensíveis ou ligados a apps instalados ficam bloqueados para quarentena normal.", "Candidates are review suggestions, not cleanup commands. Protected, sensitive, or installed-app items are blocked from normal quarantine."],
    ["Duplicados com cautela", "Careful duplicate review"],
    ["Duplicados são pré-filtrados por nome e tamanho e confirmados por hash SHA-256 quando o arquivo pode ser lido. Nada é removido automaticamente.", "Duplicates are pre-filtered by name and size and confirmed by SHA-256 hash when the file can be read. Nothing is removed automatically."],
    ["Mover 3 item(ns) para a quarentena?", "Move 3 item(s) to quarantine?"],
    ["Nada será excluído permanentemente.", "Nothing will be permanently deleted."],
    ["Você poderá restaurar o item se algo parecer errado.", "You can restore the item if something looks wrong."],
    ["A quarentena está em outro disco para parte da seleção; pastas entre volumes podem ser bloqueadas por segurança.", "Quarantine is on another drive for part of the selection; folders across volumes may be blocked for safety."],
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
    ["Confiança Alta", "Confidence High"],
    ["Confiança Média", "Confidence Medium"],
    ["Confiança Baixa", "Confidence Low"],
    ["Arquivo acima do limite configurado para arquivos grandes.", "File above the configured large-file limit."],
    ["Arquivos com mesmo nome, mesmo tamanho e mesmo hash SHA-256. Ainda assim, o DiskSnoop não move nada automaticamente.", "Files with the same name, same size, and same SHA-256 hash. Even so, DiskSnoop does not move anything automatically."],
    ["Como revisar", "How to review"],
    ["Resumo seguro", "Safe summary"],
    ["Motivo do achado", "Why it was found"],
    ["Atenção antes de mover", "Before moving"],
    ["O que conferir", "What to check"],
    ["A primeira linha é só a cópia mais recente por data de modificação. Mesmo com hash confirmado, abra os caminhos quando houver dúvida antes de mover qualquer cópia.", "The first row is only the most recent copy by modification date. Even with a confirmed hash, open the paths when in doubt before moving any copy."]
  ];

  for (const [source, expected] of samples) {
    assert.equal(i18n.translateRenderedText("en-US", source), expected);
  }
}

{
  const samples = [
    [
      "AppData costuma misturar cache, configurações e dados importantes de apps. Abra a pasta e use a lista de conteúdo para entender o que realmente pesa.",
      "AppData often mixes cache, settings, and important app data. Open the folder and use the contents list to understand what is really heavy."
    ],
    [
      "Arquivos pessoais podem ser únicos. Abra o local, confira o nome e a data, e só mova para quarentena quando tiver certeza de que não precisa mais deles.",
      "Personal files may be unique. Open the location, check the name and date, and only move them to quarantine when you are sure you no longer need them."
    ],
    [
      "Confirme se o projeto ainda está em uso. Dependências e builds geralmente podem ser recriados, mas código-fonte e arquivos locais não devem ser movidos.",
      "Confirm whether the project is still in use. Dependencies and builds can usually be recreated, but source code and local files should not be moved."
    ],
    [
      "As cópias lidas têm o mesmo conteúdo SHA-256. Ainda assim, escolha manualmente qual caminho manter antes de agir fora desta tela.",
      "The readable copies have the same SHA-256 content. Still, manually choose which path to keep before acting outside this screen."
    ],
    ["Possível duplicado", "Possible duplicate"],
    [
      "Este grupo foi montado por nome e tamanho. Abra os caminhos antes de decidir, porque arquivos diferentes podem parecer iguais por fora.",
      "This group was built by name and size. Open the paths before deciding, because different files can look identical from the outside."
    ]
  ];

  for (const [source, expected] of samples) {
    assert.equal(i18n.translateRenderedText("en-US", source), expected);
  }
}

{
  assert.equal(i18n.translate("en-US", "boot.loadingApp"), "Preparing DiskSnoop...");
  assert.equal(i18n.translate("en-US", "boot.openingApp"), "Opening app...");
  assert.equal(i18n.translate("pt-BR", "settings.title"), "Configurações");
  assert.equal(i18n.translate("en-US", "settings.title"), "Settings");
  assert.equal(i18n.translate("pt-BR", "sidebar.version", { version: "1.3.0" }), "Versão v1.3.0");
  assert.equal(i18n.translate("en-US", "sidebar.version", { version: "1.3.0" }), "Version v1.3.0");
  assert.equal(i18n.translate("en-US", "missing.translation.key"), "missing.translation.key");
  assert.equal(i18n.translatePlaceholder("en-US", "Buscar arquivo ou caminho..."), "Search file or path...");
  assert.equal(i18n.translatePlaceholder("en-US", "Buscar app ou caminho..."), "Search app or path...");
  assert.equal(i18n.translatePlaceholder("en-US", "Buscar caminho..."), "Search path...");
  assert.equal(i18n.translatePlaceholder("en-US", "Buscar item ou caminho..."), "Search item or path...");
}

console.log("i18n rendered text checks passed");
