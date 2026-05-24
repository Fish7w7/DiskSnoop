(() => {
  const fallbackLocale = "pt-BR";
  const supportedLocales = ["pt-BR", "en-US"];

  function loadLocaleJson(locale) {
    const relativePath = "./i18n/" + locale + ".json";

    if (window.diskSnoopLocaleData?.[locale]) return window.diskSnoopLocaleData[locale];

    if (typeof XMLHttpRequest !== "undefined") {
      try {
        const request = new XMLHttpRequest();
        request.open("GET", relativePath, false);
        request.overrideMimeType?.("application/json");
        request.send(null);
        if ((request.status >= 200 && request.status < 300) || request.status === 0) {
          return JSON.parse(request.responseText);
        }
      } catch {}
    }

    if (typeof require === "function") {
      try {
        const fs = require("node:fs");
        const path = require("node:path");
        return JSON.parse(fs.readFileSync(path.join(__dirname, "i18n", locale + ".json"), "utf8"));
      } catch {}
    }

    return { messages: {} };
  }

  const locales = Object.fromEntries(supportedLocales.map((locale) => [locale, loadLocaleJson(locale)]));

  window.diskSnoopI18n = {
    locales,
    renderedText: {
  "en-US": {
    "exact": {
      "Nenhum achado importante por enquanto.": "No important findings yet.",
      "Ações rápidas": "Quick actions",
      "Pastas Grandes": "Large Folders",
      "Arquivos Grandes": "Large Files",
      "Candidatos": "Candidates",
      "Duplicados": "Duplicates",
      "Sobras de Apps": "App Leftovers",
      "Quarentena": "Quarantine",
      "Histórico": "History",
      "Ações": "Actions",
      "Revisão segura": "Safe review",
      "Revisão do grupo": "Group review",
      "Relatório antigo": "Old report",
      "Revisão protegida": "Protected review",
      "Duplicados com cautela": "Careful duplicate review",
      "Achados conservadores": "Conservative findings",
      "Quarentena organizada": "Organized quarantine",
      "Por que apareceu aqui?": "Why did this appear?",
      "Relatório do scan": "Scan report",
      "Uso por categoria": "Usage by category",
      "Ganho seguro": "Safe gain",
      "Assistente de revisão": "Review assistant",
      "Comece pelo seguro": "Start with safe items",
      "Revise duplicados": "Review duplicates",
      "Cheque sobras de apps": "Check app leftovers",
      "Pronto": "Ready",
      "Nada agora": "Nothing now",
      "Revisar": "Review",
      "Limpo": "Clean",
      "Nenhuma pasta com os filtros atuais.": "No folder matches the current filters.",
      "Nenhum arquivo grande com os filtros atuais.": "No large file matches the current filters.",
      "Nenhum candidato com os filtros atuais.": "No candidate matches the current filters.",
      "Nenhum possível duplicado neste scan.": "No possible duplicate in this scan.",
      "Nenhum grupo selecionado.": "No group selected.",
      "Nenhuma possível sobra de app encontrada neste scan.": "No possible app leftover found in this scan.",
      "Nenhuma ação registrada ainda.": "No action recorded yet.",
      "Selecione uma pasta para ver detalhes.": "Select a folder to see details.",
      "Selecione um arquivo para ver detalhes.": "Select a file to see details.",
      "Selecione um candidato para ver a explicação.": "Select a candidate to see the explanation.",
      "Selecione uma pasta para revisar.": "Select a folder to review.",
      "Selecione um item em quarentena.": "Select a quarantined item.",
      "Nenhum item ativo na quarentena. Registros antigos ficam em Ausentes ou Finalizados.": "No active item in quarantine. Older records stay under Missing or Finished.",
      "Nenhum item neste filtro.": "No item in this filter.",
      "Registros finalizados e arquivos ausentes ficam separados para não bagunçar sua revisão. Limpar registros encerrados remove apenas o histórico local da quarentena.": "Finished records and missing files are kept separate to keep your review clean. Cleaning closed records removes only the local quarantine history.",
      "Limpar registros encerrados": "Clean closed records",
      "Ativos": "Active",
      "Ausentes": "Missing",
      "Finalizados": "Finished",
      "Todos": "All",
      "ativos": "active",
      "ausentes": "missing",
      "finalizados": "finished",
      "protegidos": "protected",
      "candidatos": "candidates",
      "duplicados": "duplicates",
      "sem acesso": "no access",
      "revisável": "reviewable",
      "quarentena": "quarantine",
      "restaurado": "restored",
      "excluído": "deleted",
      "Item": "Item",
      "Origem": "Origin",
      "Tamanho": "Size",
      "Data": "Date",
      "Status": "Status",
      "Abrir na quarentena": "Open in quarantine",
      "Restaurar": "Restore",
      "Excluir permanentemente": "Delete permanently",
      "Remover registro ausente": "Remove missing record",
      "Origem não registrada": "Origin not recorded",
      "Em quarentena": "In quarantine",
      "Arquivo ausente": "Missing file",
      "Restaurado": "Restored",
      "Excluído permanentemente": "Permanently deleted",
      "Excluido permanentemente": "Permanently deleted",
      "Scans anteriores e ações registradas pelo DiskSnoop.": "Previous scans and actions recorded by DiskSnoop.",
      "Movido para quarentena": "Moved to quarantine",
      "Excluído permanente": "Permanently deleted",
      "Relatórios indisponíveis": "Unavailable reports",
      "Snapshot ausente": "Missing snapshot",
      "Relatório carregável": "Loadable report",
      "Indisponível": "Unavailable",
      "Carregar": "Load",
      "Nenhum scan registrado ainda": "No scan recorded yet",
      "Quando você concluir um scan, ele aparecerá aqui com métricas e link para carregar o relatório salvo.": "When you finish a scan, it will appear here with metrics and a link to load the saved report.",
      "Resumo atual": "Current summary",
      "Último scan carregado:": "Last loaded scan:",
      "Em quarentena agora:": "In quarantine now:",
      "Última variação livre registrada:": "Last recorded free-space change:",
      "Possíveis pastas órfãs encontradas em AppData, ProgramData e Program Files. Esta tela é conservadora.": "Possible orphan folders found in AppData, ProgramData, and Program Files. This screen is conservative.",
      "Esses achados são pistas, não confirmação de sobra. Só itens marcados como possível sobra ficam disponíveis para quarentena normal; o restante deve ser aberto e revisado manualmente.": "These findings are clues, not confirmation of leftovers. Only items marked as possible leftovers are available for normal quarantine; everything else should be opened and reviewed manually.",
      "analisadas": "analyzed",
      "possíveis sobras": "possible leftovers",
      "ligadas a apps instalados": "linked to installed apps",
      "verificar": "to review",
      "Local": "Location",
      "Pasta": "Folder",
      "Arquivo": "File",
      "Tipo": "Type",
      "Modificado": "Modified",
      "Arquivos": "Files",
      "Pastas": "Folders",
      "Sem acesso": "No access",
      "Finalizado": "Finished",
      "Duração": "Duration",
      "Raízes analisadas": "Scanned roots",
      "Revisáveis": "Reviewable",
      "Encontrados": "Found",
      "Sobras": "Leftovers",
      "Nome": "Name",
      "Caminho": "Path",
      "Categoria": "Category",
      "Motivo": "Reason",
      "Segurança": "Safety",
      "Confiança": "Confidence",
      "Cópias": "Copies",
      "Revisável": "Reviewable",
      "Estimativa": "Estimate",
      "Verificação": "Verification",
      "Tamanho cada": "Size each",
      "Referência mais recente": "Most recent reference",
      "Abrir": "Open",
      "Abrir pasta": "Open folder",
      "Ver conteúdo": "View contents",
      "Ignorar": "Ignore",
      "Mover para quarentena": "Move to quarantine",
      "Mostrar mais": "Show more",
      "Qualquer tamanho": "Any size",
      "Possível": "Possible",
      "Possível sobra": "Possible leftover",
      "App não encontrado?": "App not found?",
      "Verificar manualmente": "Review manually",
      "App instalado": "Installed app",
      "Nome parecido": "Similar name",
      "Seguro revisar": "Safe to review",
      "Provável removível": "Probably removable",
      "Verificar antes": "Review first",
      "Prioridade": "Priority",
      "Maiores": "Largest",
      "Mais antigos": "Oldest",
      "Dev": "Dev",
      "Instalador": "Installer",
      "Cache": "Cache",
      "Logs": "Logs",
      "Arquivo grande": "Large file",
      "Download": "Download",
      "Compactado": "Archive",
      "Temporario": "Temporary",
      "Pasta vazia ou inacessível.": "Empty or inaccessible folder.",
      "Conteúdo": "Contents",
      "Fechar": "Close",
      "Cancelar": "Cancel",
      "Confirmar": "Confirm",
      "Limpar incluídas": "Clear included folders",
      "Ver ignorados": "Show ignored",
      "Resetar ignorados": "Reset ignored",
      "Limpar último scan local": "Clear last local scan",
      "Limpar histórico": "Clear history",
      "Restaurar configurações": "Restore settings",
      "Conteúdo principal": "Main contents",
      "Abrir local": "Open location",
      "Gerados por projetos": "Generated by projects",
      "node_modules, builds, caches de build e saídas recriáveis encontrados neste scan.": "node_modules, builds, build caches, and recreateable outputs found in this scan.",
      "Caches detectados": "Detected caches",
      "Pastas de cache encontradas pelo scanner para sair dos próximos relatórios.": "Cache folders found by the scanner to leave out of future reports.",
      "Downloads antigos": "Old downloads",
      "Instaladores, compactados e downloads antigos já sinalizados neste scan.": "Installers, archives, and old downloads already flagged in this scan.",
      "Nenhuma nova pasta para ignorar neste preset.": "No new folder to ignore in this preset.",
      "Selo": "Badge",
      "Risco": "Risk",
      "Alto": "High",
      "Alta": "High",
      "Médio": "Medium",
      "Média": "Medium",
      "Baixo": "Low",
      "Baixa": "Low",
      "Prov.": "Likely",
      "Crítico": "Critical",
      "Atenção": "Attention",
      "Saudável": "Healthy",
      "Candidatos à Limpeza": "Cleanup Candidates",
      "prováveis removíveis": "probably removable",
      "bloqueados": "blocked",
      "selecionados": "selected",
      "Possíveis Duplicados": "Possible Duplicates",
      "Hash": "Hash",
      "desativado": "disabled",
      "Confiança Alta": "Confidence High",
      "Confiança Média": "Confidence Medium",
      "Confiança Baixa": "Confidence Low",
      "Nome e tamanho": "Name and size",
      "Possíveis duplicados por nome e tamanho.": "Possible duplicates by name and size.",
      "A primeira linha é apenas a cópia mais recente pelo horário de modificação, não uma decisão de qual arquivo manter. Mesmo com hash confirmado, abra os caminhos quando houver dúvida antes de mover qualquer cópia por outra aba.": "The first row is only the most recent copy by modification time, not a decision about which file to keep. Even with a confirmed hash, open the paths when in doubt before moving any copy from another tab.",
      "Como revisar": "How to review",
      "Resumo seguro": "Safe summary",
      "Motivo do achado": "Why it was found",
      "Atenção antes de mover": "Before moving",
      "Antes de mover": "Before moving",
      "O que conferir": "What to check",
      "App instalado encontrado": "Installed app found",
      "Possível sobra de app": "Possible app leftover",
      "A primeira linha é só a cópia mais recente por data de modificação. Mesmo com hash confirmado, abra os caminhos quando houver dúvida antes de mover qualquer cópia.": "The first row is only the most recent copy by modification date. Even with a confirmed hash, open the paths when in doubt before moving any copy.",
      "Nome parecido com app instalado:": "Name similar to installed app:",
      "O DiskSnoop encontrou esta pasta em uma área comum de dados de aplicativos. Isso não significa que ela pode ser removida automaticamente; abra a pasta e confirme se o app ainda existe ou se os dados são importantes.": "DiskSnoop found this folder in a common application data area. This does not mean it can be removed automatically; open the folder and confirm whether the app still exists or the data matters.",
      "Este item não bateu com a lista de apps instalados e fica em uma área comum de cache/dados locais. Ainda assim, revise o conteúdo antes de mover para quarentena.": "This item did not match the installed apps list and is in a common local cache/data area. Still review its contents before moving it to quarantine.",
      "Por segurança, este status não é tratado como remoção normal. Use a ação de abrir pasta e revise manualmente.": "For safety, this status is not handled as normal removal. Use the open-folder action and review it manually.",
      "Encontramos esta pasta em uma área comum de dados de aplicativos, mas ela não apareceu como app instalado. Pode ser cache antigo, configuração esquecida ou dado ainda útil.": "We found this folder in a common application data area, but it did not appear as an installed app. It may be old cache, forgotten settings, or still-useful data.",
      "Abra a pasta, confira os maiores itens e veja se o app ainda existe. Se nada parecer importante, use a quarentena para testar com segurança.": "Open the folder, check the largest items, and see whether the app still exists. If nothing looks important, use quarantine to test safely.",
      "Abra a pasta e confira se os arquivos ainda parecem ligados ao app. Se estiver em dúvida, mantenha o item fora da quarentena.": "Open the folder and check whether the files still seem tied to the app. If in doubt, keep the item out of quarantine.",
      "Esta pasta fica em uma área onde apps costumam guardar dados compartilhados ou sensíveis. O DiskSnoop mostra o espaço, mas deixa a decisão para revisão manual.": "This folder is in an area where apps often keep shared or sensitive data. DiskSnoop shows the space, but leaves the decision to manual review.",
      "Abra o local e revise manualmente. Este status não entra no fluxo normal de quarentena para evitar mexer em dados de apps ativos.": "Open the location and review it manually. This status does not enter the normal quarantine flow to avoid touching active app data.",
      "Abra o local para confirmar o conteúdo antes de qualquer ação manual.": "Open the location to confirm the contents before any manual action.",
      "Os demais itens continuam disponíveis para revisão e quarentena.": "The remaining items stay available for review and quarantine.",
      "Nada será excluído permanentemente.": "Nothing will be permanently deleted.",
      "Você poderá restaurar o item se algo parecer errado.": "You can restore the item if something looks wrong.",
      "A quarentena está em outro disco para parte da seleção; pastas entre volumes podem ser bloqueadas por segurança.": "Quarantine is on another drive for part of the selection; folders across volumes may be blocked for safety.",
      "Nenhum espaço revisável por duplicados neste scan.": "No reviewable duplicate space in this scan.",
      "Nenhuma sobra de app apareceu como prioridade.": "No app leftover appeared as a priority.",
      "AppData costuma misturar cache, configurações e dados importantes de apps. Abra a pasta e use a lista de conteúdo para entender o que realmente pesa.": "AppData often mixes cache, settings, and important app data. Open the folder and use the contents list to understand what is really heavy.",
      "Procure instaladores antigos, cópias repetidas e arquivos que você reconhece. Pastas pessoais merecem revisão manual antes de qualquer limpeza.": "Look for old installers, repeated copies, and files you recognize. Personal folders deserve manual review before any cleanup.",
      "Veja os maiores itens dentro da pasta e confirme se ela ainda faz parte de um projeto, app ou backup ativo antes de ignorar ou limpar.": "Check the largest items inside the folder and confirm whether it still belongs to an active project, app, or backup before ignoring or cleaning it.",
      "Se for instalador antigo, confirme se o programa já está instalado ou se existe uma versão mais nova. Quando estiver em dúvida, mova para quarentena em vez de excluir.": "If it is an old installer, confirm whether the program is already installed or whether a newer version exists. When in doubt, move it to quarantine instead of deleting.",
      "Arquivos pessoais podem ser únicos. Abra o local, confira o nome e a data, e só mova para quarentena quando tiver certeza de que não precisa mais deles.": "Personal files may be unique. Open the location, check the name and date, and only move them to quarantine when you are sure you no longer need them.",
      "Abra o local para confirmar se o arquivo ainda é usado. A quarentena ajuda a testar a remoção sem apagar permanentemente.": "Open the location to confirm whether the file is still used. Quarantine helps test removal without permanent deletion.",
      "Confirme se o projeto ainda está em uso. Dependências e builds geralmente podem ser recriados, mas código-fonte e arquivos locais não devem ser movidos.": "Confirm whether the project is still in use. Dependencies and builds can usually be recreated, but source code and local files should not be moved.",
      "Caches, logs e temporários costumam ser recriados pelos apps. Mesmo assim, abra o conteúdo se o caminho pertencer a um app importante.": "Caches, logs, and temporary files are usually recreated by apps. Even so, open the contents if the path belongs to an important app.",
      "Confira se existe uma cópia mais nova ou se o arquivo já cumpriu sua função. Itens antigos em Downloads são bons candidatos para quarentena.": "Check whether a newer copy exists or whether the file has already served its purpose. Old items in Downloads are good quarantine candidates.",
      "Arquivos grandes podem ser pessoais ou difíceis de recuperar. Abra o local e confirme o conteúdo antes de mover.": "Large files may be personal or hard to recover. Open the location and confirm the contents before moving.",
      "Use o conteúdo e o caminho como pistas. Se o item parecer ligado a algo ativo, mantenha fora da quarentena.": "Use the contents and path as clues. If the item seems tied to something active, keep it out of quarantine.",
      "As cópias lidas têm o mesmo conteúdo SHA-256. Ainda assim, escolha manualmente qual caminho manter antes de agir fora desta tela.": "The readable copies have the same SHA-256 content. Still, manually choose which path to keep before acting outside this screen.",
      "Possível duplicado": "Possible duplicate",
      "Este grupo foi montado por nome e tamanho. Abra os caminhos antes de decidir, porque arquivos diferentes podem parecer iguais por fora.": "This group was built by name and size. Open the paths before deciding, because different files can look identical from the outside.",
      "Aparência": "Appearance",
      "Idioma": "Language",
      "Limites do scan": "Scan limits",
      "Detectores": "Detectors",
      "Escopo do scan": "Scan scope",
      "Ignorados": "Ignored",
      "Manutenção": "Maintenance",
      "Arquivo grande a partir de:": "Large file from:",
      "Pasta grande a partir de:": "Large folder from:",
      "Possível duplicado a partir de:": "Possible duplicate from:",
      "Considerar arquivo antigo após:": "Consider file old after:",
      "Detectar node_modules": "Detect node_modules",
      "Detectar builds e caches": "Detect builds and caches",
      "Detectar instaladores antigos": "Detect old installers",
      "Detectar downloads antigos": "Detect old downloads",
      "Detectar compactados antigos": "Detect old archives",
      "Detectar logs grandes e temporários": "Detect large logs and temporary files",
      "Confirmar duplicados com hash SHA-256": "Confirm duplicates with SHA-256 hash",
      "Itens sensíveis como Windows, System32, drivers e programas ativos continuam fora dos candidatos normais.": "Sensitive items such as Windows, System32, drivers, and active programs remain outside normal candidates.",
      "Local atual:": "Current location:",
      "Alterar pasta": "Change folder",
      "Abrir quarentena": "Open quarantine",
      "Usar padrão": "Use default",
      "Para mover pastas grandes, prefira uma quarentena no mesmo disco do item. O DiskSnoop pode bloquear pastas entre discos para evitar cópia parcial seguida de remoção.": "For large folders, prefer quarantine on the same drive as the item. DiskSnoop may block folders across drives to avoid partial copy followed by removal.",
      "Pastas incluídas:": "Included folders:",
      "Quando houver inclusões, o scan varre somente essas pastas dentro do disco escolhido.": "When inclusions exist, the scan only checks those folders inside the selected drive.",
      "Adicionar pasta": "Add folder",
      "Pastas ignoradas:": "Ignored folders:",
      "Itens ignorados não entram nos próximos scans nem nas sugestões.": "Ignored items do not appear in future scans or suggestions.",
      "Dados do app:": "App data:",
      "Abrir dados do app": "Open app data",
      "Essas ações limpam apenas dados do DiskSnoop. Elas não apagam arquivos analisados nem itens fora da quarentena.": "These actions only clean DiskSnoop data. They do not delete scanned files or items outside quarantine.",
      "Nenhuma pasta incluída.": "No included folder.",
      "Nenhuma pasta ignorada.": "No ignored folder.",
      "Não foi possível iniciar": "Could not start",
      "Revisão manual necessária": "Manual review required",
      "Alguns itens exigem revisão manual": "Some items require manual review",
      "Mover": "Move",
      "Limpar registros": "Clean records",
      "Excluir": "Delete",
      "Relatório indisponível": "Report unavailable",
      "Arquivo grande detectado no scan. Revise antes de mover, especialmente se for documento, vídeo ou arquivo pessoal.": "Large file detected in the scan. Review before moving it, especially if it is a document, video, or personal file.",
      "Este item parece ocupar espaço relevante e merece revisão.": "This item appears to use relevant space and deserves review.",
      "Pasta grande detectada no scan.": "Large folder detected in the scan.",
      "Revisável: 100 MB+": "Reviewable: 100 MB+",
      "Revisável: 500 MB+": "Reviewable: 500 MB+",
      "Revisável: 1 GB+": "Reviewable: 1 GB+",
      "Relevantes: 10 MB+": "Relevant: 10 MB+",
      "30 dias": "30 days",
      "90 dias": "90 days",
      "180 dias": "180 days",
      "365 dias": "365 days",
      "Projetos dev": "Dev projects",
      "Instaladores antigos": "Old installers",
      "Instaladores": "Installers",
      "Compactados antigos": "Old archives",
      "Logs grandes": "Large logs",
      "Temporarios": "Temporary",
      "Temporários": "Temporary",
      "Arquivos grandes": "Large files",
      "Caches": "Caches",
      "Seguro": "Safe",
      "Sensivel": "Sensitive",
      "Sensível": "Sensitive",
      "Provavel removivel": "Probably removable",
      "Hash confirmado": "Hash confirmed",
      "Dependencias Node podem ser recriadas com npm install quando o projeto ainda existe.": "Node dependencies can be recreated with npm install when the project still exists.",
      "Ambiente Python local geralmente pode ser recriado a partir das dependencias do projeto.": "A local Python environment can usually be recreated from the project dependencies.",
      "Pasta de build/cache de projeto; costuma ser recriavel pelo processo de desenvolvimento.": "Project build/cache folder; it is usually recreated by the development process.",
      "Cache local detectado. Revise antes, mas normalmente e um dado recriavel.": "Local cache detected. Review first, but it is usually recreatable data.",
      "Conteudo na pasta Downloads com idade acima do limite configurado.": "Content in the Downloads folder older than the configured limit.",
      "Arquivo acima do limite configurado para arquivos grandes.": "File above the configured large-file limit.",
      "Instalador antigo detectado. Pode estar esquecido apos a instalacao do aplicativo.": "Old installer detected. It may have been forgotten after the app installation.",
      "Arquivo compactado antigo. Revise o conteudo antes de mover para quarentena.": "Old archive file. Review its contents before moving it to quarantine.",
      "Log antigo e grande detectado.": "Old large log detected.",
      "Arquivo temporario detectado.": "Temporary file detected.",
      "Arquivo antigo dentro de Downloads.": "Old file inside Downloads.",
      "Pasta acima do limite configurado para pastas grandes.": "Folder above the configured large-folder limit.",
      "Arquivos com mesmo nome, mesmo tamanho e mesmo hash SHA-256. Ainda assim, o DiskSnoop não move nada automaticamente.": "Files with the same name, same size, and same SHA-256 hash. Even so, DiskSnoop does not move anything automatically.",
      "Arquivos com mesmo nome e tamanho encontrados em caminhos diferentes. Ative a verificação por hash ou compare o conteúdo antes de mover qualquer cópia.": "Files with the same name and size found in different paths. Enable hash verification or compare the contents before moving any copy.",
      "Esta pasta pode ser recriada com npm install quando o projeto esta parado.": "This folder can be recreated with npm install when the project is not running.",
      "Pasta de build recriavel pelo processo de desenvolvimento.": "Build folder recreatable by the development process.",
      "Instalador antigo detectado em Downloads.": "Old installer detected in Downloads.",
      "Logs antigos e grandes detectados.": "Old large logs detected.",
      "Arquivo grande detectado.": "Large file detected.",
      "Contem muitos instaladores, zips e videos.": "Contains many installers, zip files, and videos.",
      "Projetos de desenvolvimento ocupando espaco relevante.": "Development projects using relevant space.",
      "Dependencias Node recriaveis.": "Recreatable Node dependencies.",
      "Area de dados de aplicativos. Revise com cuidado.": "Application data area. Review carefully.",
      "Achados importantes": "Important findings",
      "Ver maiores pastas": "View largest folders",
      "Ver arquivos grandes": "View large files",
      "Revisar candidatos": "Review candidates",
      "Ver duplicados": "View duplicates",
      "Checar sobras de apps": "Check app leftovers",
      "Ajustar regras": "Adjust rules",
      "Detalhes": "Details",
      "Ordenar: tam.": "Sort: size",
      "Ordenar: data": "Sort: date",
      "Ordenar: risco": "Sort: risk",
      "Ordenar: selo": "Sort: badge",
      "Min: 1 GB": "Min: 1 GB",
      "Min: 5 GB": "Min: 5 GB",
      "Min: 10 GB": "Min: 10 GB",
      "Min: 250 MB": "Min: 250 MB",
      "Min: 500 MB": "Min: 500 MB",
      "seguros": "safe",
      "verificar antes": "review first",
      "sem hash": "without hash",
      "Reiniciar para atualizar": "Restart to update",
      "Reiniciar": "Restart",
      "Versão ignorada.": "Version ignored.",
      "Vou lembrar de novo amanhã.": "I'll remind you again tomorrow.",
      "Atualização baixada.": "Update downloaded.",
      "Download interrompido.": "Download interrupted.",
      "Caminho ausente.": "Missing path.",
      "Item ignorado nos próximos scans.": "Item ignored in future scans.",
      "Item(ns) movido(s) para quarentena.": "Item(s) moved to quarantine.",
      "Bypass de teste carregado.": "Test bypass loaded.",
      "Item restaurado.": "Item restored.",
      "Item excluído permanentemente.": "Item permanently deleted.",
      "Registro ausente removido.": "Missing record removed.",
      "Quarentena voltou para o local padrão.": "Quarantine returned to the default location.",
      "Pastas incluídas limpas.": "Included folders cleared.",
      "Ignorados resetados.": "Ignored items reset.",
      "Último scan local limpo.": "Last local scan cleared.",
      "Histórico limpo.": "History cleared.",
      "Configurações restauradas.": "Settings restored.",
      "Último scan salvo não está mais disponível.": "The saved last scan is no longer available.",
      "Relatório local carregado em modo revisão.": "Local report loaded in review mode.",
      "Último scan local carregado.": "Last local scan loaded.",
      "Entendi": "Got it",
      "Itens ignorados": "Ignored items",
      "Nenhum item ignorado.": "No ignored item.",
      "Remover registro": "Remove record",
      "Limpar": "Clear",
      "EXCLUIR": "DELETE",
      "Remover": "Remove",
      "Minimizar": "Minimize",
      "Maximizar": "Maximize",
      "Claro": "Light",
      "Escuro": "Dark",
      "nenhum": "none",
      "sim": "yes",
      "não": "no",
      "Pasta de dados do DiskSnoop": "DiskSnoop data folder",
      "Tentar novamente": "Try again",
      "Erro ao carregar dados iniciais.": "Error loading initial data.",
      "Relatório antigo ou sem vínculo com o último scan. Para evitar ações em dados possivelmente desatualizados, mover para quarentena fica bloqueado aqui. Faça um novo scan para agir sobre o estado atual do disco.": "Old report or not linked to the last scan. To avoid actions on possibly outdated data, moving to quarantine is blocked here. Run a new scan to act on the current disk state.",
      "Candidatos são sugestões de revisão, não comandos de limpeza. Itens protegidos, sensíveis ou ligados a apps instalados ficam bloqueados para quarentena normal.": "Candidates are review suggestions, not cleanup commands. Protected, sensitive, or installed-app items are blocked from normal quarantine.",
      "Duplicados são pré-filtrados por nome e tamanho e confirmados por hash SHA-256 quando o arquivo pode ser lido. Nada é removido automaticamente.": "Duplicates are pre-filtered by name and size and confirmed by SHA-256 hash when the file can be read. Nothing is removed automatically.",
      "Hash de duplicados está desativado nas configurações. Os grupos abaixo são apenas suspeitas por nome e tamanho.": "Duplicate hashing is disabled in settings. The groups below are only name-and-size suspicions.",
      "Este item vem de um relatório histórico. Faça um novo scan antes de mover para quarentena, para garantir que o caminho e o tamanho ainda estão atuais.": "This item comes from a historical report. Run a new scan before moving it to quarantine to make sure the path and size are still current.",
      "Este item fica em área sensível ou protegida do Windows. O DiskSnoop mostra o espaço, mas não coloca isso como ação normal de quarentena.": "This item is in a sensitive or protected Windows area. DiskSnoop shows the space, but does not offer it as a normal quarantine action.",
      "Este item precisa de revisão manual antes de qualquer ação. Abra a pasta e confirme se ela não pertence a um app instalado.": "This item needs manual review before any action. Open the folder and confirm it does not belong to an installed app.",
      "Este item parece protegido, sensível ou ligado a um app instalado. O DiskSnoop pode abrir o local para você revisar, mas não vai mover isso para quarentena como candidato normal.": "This item appears protected, sensitive, or linked to an installed app. DiskSnoop can open the location for review, but will not move it to quarantine as a normal candidate.",
      "O DiskSnoop será fechado e reaberto pelo instalador para aplicar a atualização baixada. Faça isso apenas quando nenhum scan ou ação de quarentena estiver em andamento.": "DiskSnoop will be closed and reopened by the installer to apply the downloaded update. Do this only when no scan or quarantine action is running.",
      "Registros já excluídos, restaurados ou ausentes sairão da lista. Isso não apaga nenhum item que ainda esteja em quarentena.": "Records that were deleted, restored, or missing will leave the list. This does not delete any item still in quarantine.",
      "Esta ação não pode ser desfeita pelo DiskSnoop.": "This action cannot be undone by DiskSnoop.",
      "Esse arquivo não existe mais na quarentena. Apenas o registro do DiskSnoop será removido; nenhum arquivo será apagado.": "This file no longer exists in quarantine. Only the DiskSnoop record will be removed; no file will be deleted.",
      "Remove apenas o relatório salvo para abertura rápida. O histórico e os arquivos analisados não serão apagados.": "Removes only the report saved for quick opening. History and scanned files will not be deleted.",
      "Limpar histórico de scans e snapshots salvos?": "Clear scan history and saved snapshots?",
      "Ignorados, incluídos e local de quarentena serão resetados. Arquivos analisados não serão apagados.": "Ignored paths, included paths, and quarantine location will be reset. Scanned files will not be deleted.",
      "Este registro existe no histórico, mas o snapshot detalhado não foi encontrado nos dados locais do DiskSnoop.": "This record exists in history, but the detailed snapshot was not found in DiskSnoop local data.",
      "Este item foi encontrado na pasta de quarentena, mas o registro original não estava no histórico do DiskSnoop. Você pode abrir ou excluir permanentemente, mas a restauração automática fica indisponível sem o caminho original.": "This item was found in the quarantine folder, but the original record was not in DiskSnoop history. You can open or permanently delete it, but automatic restore is unavailable without the original path.",
      "Item em uso ou protegido": "Item in use or protected",
      "Não foi possível mover": "Could not move",
      "Item selecionado:": "Selected item:",
      "Restauração automática": "Automatic restore",
      "Hash desativado": "Hash disabled",
      "Área sensível": "Sensitive area",
      "Erro durante o scan.": "Error during scan.",
      "Usar atualização manual mesmo no instalador": "Use manual update even in the installer"
    },
    "placeholders": {
      "Buscar arquivo ou caminho...": "Search file or path...",
      "Buscar app ou caminho...": "Search app or path...",
      "Buscar pasta...": "Search folder...",
      "Buscar arquivo...": "Search file...",
      "Buscar caminho...": "Search path...",
      "Buscar item ou caminho...": "Search item or path..."
    },
    "patterns": [
      [
        "^(\\d+) itens ativos\\. A lista principal mostra apenas o que ainda pode ser restaurado ou excluído\\.$",
        "$1 active items. The main list shows only what can still be restored or deleted."
      ],
      [
        "^(\\d+) ativos$",
        "$1 active"
      ],
      [
        "^(\\d+) ausentes$",
        "$1 missing"
      ],
      [
        "^(\\d+) finalizados$",
        "$1 finished"
      ],
      [
        "^(.+) protegidos$",
        "$1 protected"
      ],
      [
        "^Item selecionado: (.+)$",
        "Selected item: $1"
      ],
      [
        "^Origem: (.+)$",
        "Origin: $1"
      ],
      [
        "^Quarentena: (.+)$",
        "Quarantine: $1"
      ],
      [
        "^Status: (.+)$",
        "Status: $1"
      ],
      [
        "^Último scan carregado: nenhum$",
        "Last loaded scan: none"
      ],
      [
        "^Último scan carregado: (.+)$",
        "Last loaded scan: $1"
      ],
      [
        "^Em quarentena agora: (.+)$",
        "In quarantine now: $1"
      ],
      [
        "^Última variação livre registrada: (.+)$",
        "Last recorded free-space change: $1"
      ],
      [
        "^(.+) usados de (.+)$",
        "$1 used of $2"
      ],
      [
        "^(\\d+) arquivos encontrados acima de (.+)\\. Total visível: (.+)\\.$",
        "$1 files found above $2. Visible total: $3."
      ],
      [
        "^(\\d+) itens visíveis de (\\d+)\\. O filtro padrão mostra achados revisáveis e evita itens que exigem cautela maior\\.$",
        "$1 visible items of $2. The default filter shows reviewable findings and avoids items that require extra caution."
      ],
      [
        "^(\\d+) grupos visíveis\\. Espaço revisável estimado: (.+)\\.$",
        "$1 visible groups. Estimated reviewable space: $2."
      ],
      [
        "^(.+) scans no histórico$",
        "$1 scans in history"
      ],
      [
        "^(.+) scan carregado nesta sessão$",
        "$1 scan loaded in this session"
      ],
      [
        "^(.+) relatório salvo para abertura rápida$",
        "$1 saved report for quick opening"
      ],
      [
        "^Local atual: (.+)$",
        "Current location: $1"
      ],
      [
        "^Pastas incluídas: (.+)$",
        "Included folders: $1"
      ],
      [
        "^Pastas ignoradas: (.+)$",
        "Ignored folders: $1"
      ],
      [
        "^Dados do app: (.+)$",
        "App data: $1"
      ],
      [
        "^Nome parecido com app instalado: (.+)\\.$",
        "Name similar to installed app: $1."
      ],
      [
        "^Digite (.+) para confirmar$",
        "Type $1 to confirm"
      ],
      [
        "^(.+) item\\(ns\\) movido\\(s\\)\\. O restante ficou para revisão manual\\.$",
        "$1 item(s) moved. The rest stayed for manual review."
      ],
      [
        "^(.+) não pôde ser movido agora\\. Algum app, driver ou serviço do Windows ainda está usando ou alterando essa pasta\\. Feche o aplicativo relacionado ou reinicie o PC antes de tentar de novo\\. O DiskSnoop não mantém cópias parciais quando a operação falha\\.$",
        "$1 could not be moved right now. An app, driver, or Windows service is still using or changing this folder. Close the related app or restart the PC before trying again. DiskSnoop does not keep partial copies when the operation fails."
      ],
      [
        "^(.+) não pôde ser movido\\. (.+)$",
        "$1 could not be moved. $2"
      ],
      [
        "^Item selecionado: (.+)$",
        "Selected item: $1"
      ],
      [
        "^Tipo (.+)$",
        "Type $1"
      ],
      [
        "^Selo (.+)$",
        "Badge $1"
      ],
      [
        "^Confiança (.+)$",
        "Confidence $1"
      ],
      [
        "^Status (.+)$",
        "Status $1"
      ],
      [
        "^Local (.+)$",
        "Location $1"
      ],
      [
        "^Tamanho (.+)$",
        "Size $1"
      ],
      [
        "^Modificado (.+)$",
        "Modified $1"
      ],
      [
        "^Cópias (.+)$",
        "Copies $1"
      ],
      [
        "^Tamanho cada (.+)$",
        "Size each $1"
      ],
      [
        "^Estimativa (.+)$",
        "Estimate $1"
      ],
      [
        "^Verificação (.+)$",
        "Verification $1"
      ],
      [
        "^(.+) usados de (.+)$",
        "$1 used of $2"
      ],
      [
        "^(\\d+) apps\\?$",
        "$1 apps?"
      ],
      [
        "^node_modules em projetos antigos$",
        "node_modules in old projects"
      ],
      [
        "^Instaladores antigos em Downloads$",
        "Old installers in Downloads"
      ],
      [
        "^Caches grandes de apps$",
        "Large app caches"
      ],
      [
        "^Arquivos grandes sem uso recente$",
        "Large files without recent use"
      ],
      [
        "^Mostrando (\\d+) de (\\d+)$",
        "Showing $1 of $2"
      ],
      [
        "^(\\d+) selecionado\\(s\\)$",
        "$1 selected"
      ],
      [
        "^(\\d+) seguros$",
        "$1 safe"
      ],
      [
        "^(\\d+) prováveis removíveis$",
        "$1 probably removable"
      ],
      [
        "^(\\d+) verificar antes$",
        "$1 review first"
      ],
      [
        "^(\\d+) bloqueados$",
        "$1 blocked"
      ],
      [
        "^(\\d+) sem hash$",
        "$1 without hash"
      ],
      [
        "^Não foi possível iniciar o scan: (.+)$",
        "Could not start scan: $1"
      ],
      [
        "^Não foi possível abrir: (.+)$",
        "Could not open: $1"
      ],
      [
        "^Não foi possível abrir no Explorer: (.+)$",
        "Could not open in Explorer: $1"
      ],
      [
        "^Não foi possível ignorar: (.+)$",
        "Could not ignore: $1"
      ],
      [
        "^Não foi possível salvar: (.+)$",
        "Could not save: $1"
      ],
      [
        "^Não foi possível listar o conteúdo: (.+)$",
        "Could not list contents: $1"
      ],
      [
        "^(\\d+) registro\\(s\\) removido\\(s\\)\\.$",
        "$1 record(s) removed."
      ],
      [
        "^Quarentena criada em (.+)\\.$",
        "Quarantine created at $1."
      ],
      [
        "^Pastas ignoradas neste perfil: (.+)$",
        "Ignored folders in this profile: $1"
      ],
      [
        "^Relatório de (.+) carregado\\.$",
        "Report from $1 loaded."
      ],
      [
        "^Não foi possível carregar o relatório: (.+)$",
        "Could not load report: $1"
      ],
      [
        "^Digite (.+) exatamente para continuar\\.$",
        "Type $1 exactly to continue."
      ],
      [
        "^Mover (\\d+) item\\(ns\\) para a quarentena\\?$",
        "Move $1 item(s) to quarantine?"
      ],
      [
        "^Mover (\\d+) item\\(ns\\) para a quarentena\\? Nada será excluído permanentemente\\.$",
        "Move $1 item(s) to quarantine? Nothing will be permanently deleted."
      ],
      [
        "^Mover (\\d+) item\\(ns\\) para a quarentena\\? Nada será excluído permanentemente\\. A quarentena está em outro disco para parte da seleção; pastas entre volumes podem ser bloqueadas por segurança\\. Para pastas grandes, escolha uma quarentena no mesmo disco\\.$",
        "Move $1 item(s) to quarantine? Nothing will be permanently deleted. Quarantine is on another drive for part of the selection; folders across volumes may be blocked for safety. For large folders, choose quarantine on the same drive."
      ],
      [
        "^(\\d+) item\\(ns\\) ficaram de fora porque parecem protegidos, sensíveis ou ligados a apps instalados\\. O DiskSnoop não move esse tipo de item para quarentena automaticamente\\.$",
        "$1 item(s) were left out because they seem protected, sensitive, or linked to installed apps. DiskSnoop does not move this type of item to quarantine automatically."
      ],
      [
        "^(\\d+) item\\(ns\\) de baixo risco somam (.+)\\.$",
        "$1 low-risk item(s) add up to $2."
      ],
      [
        "^(.+) parecem revisáveis, mas exigem escolha manual\\.$",
        "$1 look reviewable, but require a manual choice."
      ],
      [
        "^(\\d+) pasta\\(s\\) parecem sobras possíveis em áreas de apps\\.$",
        "$1 folder(s) look like possible leftovers in app areas."
      ],
      [
        "^(\\d+) pasta\\(s\\) adicionada\\(s\\) aos ignorados\\.$",
        "$1 folder(s) added to ignored paths."
      ],
      [
        "^(\\d+) candidatos encontrados em (.+)$",
        "$1 candidates found in $2"
      ],
      [
        "^(.+): (\\d+) candidatos encontrados em (.+)$",
        "$1: $2 candidates found in $3"
      ],
      [
        "^Disco (.+?) · (.+?) · livre (.+?) → (.+)$",
        "Drive $1 · $2 · free $3 → $4"
      ],
      [
        "^(\\d+) candidatos$",
        "$1 candidates"
      ],
      [
        "^(\\d+) duplicados$",
        "$1 duplicates"
      ],
      [
        "^(\\d+) sem acesso$",
        "$1 no access"
      ],
      [
        "^(.+) revisável$",
        "$1 reviewable"
      ],
      [
        "^(.+) quarentena$",
        "$1 quarantine"
      ],
      [
        "^(.+) restaurado$",
        "$1 restored"
      ],
      [
        "^(.+) excluído$",
        "$1 deleted"
      ],
      [
        "^O nome lembra (.+)\\. Isso geralmente indica que a pasta ainda pertence a um app instalado ou usado recentemente\\.$",
        "The name resembles $1. This usually means the folder still belongs to an installed or recently used app."
      ],
      [
        "^(\\d+) grupos$",
        "$1 groups"
      ],
      [
        "^(\\d+) cópias$",
        "$1 copies"
      ],
      [
        "^(.+) estimado$",
        "$1 estimated"
      ],
      [
        "^(\\d+) sem hash$",
        "$1 without hash"
      ],
      [
        "^Cópia suspeita (\\d+)$",
        "Suspect copy $1"
      ],
      [
        "^Mostrar mais (\\d+)$",
        "Show $1 more"
      ],
      [
        "^(\\d+) analisadas$",
        "$1 analyzed"
      ],
      [
        "^(\\d+) possíveis sobras$",
        "$1 possible leftovers"
      ],
      [
        "^(\\d+) ligadas a apps instalados$",
        "$1 linked to installed apps"
      ],
      [
        "^(\\d+) verificar$",
        "$1 to review"
      ]
    ]
  }
},
    get messages() {
      return Object.fromEntries(Object.entries(this.locales).map(([locale, data]) => [locale, data?.messages || {}]));
    },
    translate(locale, key, values = {}) {
      const messages = this.locales?.[locale]?.messages || {};
      const fallback = this.locales?.[fallbackLocale]?.messages || {};
      const template = messages[key] || fallback[key] || key;
      return String(template).replace(/\{(\w+)\}/g, (_match, name) => values[name] ?? "");
    },
    translateRenderedText(locale, value) {
      const pack = this.renderedText?.[locale];
      const text = String(value ?? "").trim();
      if (!pack || !text) return null;
      if (pack.exact[text]) return pack.exact[text];
      for (const [pattern, replacement] of pack.patterns || []) {
        const regex = new RegExp(pattern);
        if (regex.test(text)) return text.replace(regex, replacement);
      }
      return null;
    },
    translatePlaceholder(locale, value) {
      const pack = this.renderedText?.[locale];
      return pack?.placeholders?.[String(value || "").trim()] || null;
    }
  };
})();
