window.diskSnoopLocalChangelog = {
  "1.14.0": {
    "pt-BR": {
      title: "DiskSnoop v1.14.0 — Smarter & Safer Cleanup",
      sections: [
        {
          title: "Novidades",
          items: [
            "Escolha Português (BR) ou English na tela de boas-vindas ou nas Configurações. Na primeira execução, o DiskSnoop usa um idioma compatível do sistema ou inglês. A preferência é salva e vale para toda a interface.",
            "O painel de candidatos mostra categoria, risco e confiança separadamente. Veja onde cada evidência foi encontrada, o possível impacto da remoção e o que conferir antes de mover."
          ]
        },
        {
          title: "Melhorias",
          items: [
            "O scanner cruza caminhos, estruturas, manifestos e evidências de instalação para identificar caches e possíveis instaladores. O reconhecimento inclui perfis Chromium, Electron, CEF e WebView2. Caches de shaders, downloads de componentes e caches de conteúdo misto continuam sujeitos a revisão.",
            "A simulação distingue tamanho lógico, espaço potencialmente recuperável e seleção para quarentena. O Histórico mostra separadamente a variação medida de espaço livre. Mover no mesmo volume mantém os dados no disco.",
            "O seletor de idioma e os diálogos de confirmação podem ser usados com o teclado, incluindo Escape para fechar ou cancelar."
          ]
        },
        {
          title: "Correções",
          items: [
            "Diretórios internos de dependências instaladas deixam de ser confundidos com builds de projetos. Datas de modificação artificiais deixam de servir como indício de desuso, e possíveis instaladores exigem evidências no nome ou formato.",
            "Caminhos equivalentes e candidatos sobrepostos contam uma vez nos totais. Quando há pastas incluídas no escopo, o scan exige que pelo menos uma pertença ao disco escolhido."
          ]
        },
        {
          title: "Segurança",
          items: [
            "Antes de mover, o DiskSnoop confere o relatório do scan, a identidade do item e as proteções do caminho e de seu conteúdo. Runtimes, extensões, plugins instalados, dependências e componentes de gerenciadores de pacotes ficam protegidos, inclusive contra a movimentação pelo diretório pai. Shared Dictionary fica protegido porque seus metadados e arquivos precisam permanecer juntos.",
            "A restauração verifica se o destino já está ocupado. A exclusão definitiva exige confirmação digitada e confirmação em um diálogo nativo do Windows. Movimentações pendentes e registros de origem incerta ficam disponíveis para revisão.",
            "A referência para avaliações externas por IA associa IDs ao scan. Respostas conflitantes são ignoradas e as recomendações funcionam somente para selecionar itens elegíveis para revisão."
          ]
        },
        {
          title: "Limitações conhecidas",
          items: [
            "A detecção usa heurísticas. Confira a finalidade e a possibilidade de recuperação antes de mover itens, inclusive os de baixo risco. Relatórios antigos continuam consultáveis e exigem um novo scan para movimentar itens.",
            "Alterações concorrentes no sistema de arquivos podem interromper operações. Uma exclusão recursiva interrompida pode ficar parcial. Pastas só podem ser movidas para uma quarentena no mesmo volume."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop v1.14.0 — Smarter & Safer Cleanup",
      sections: [
        {
          title: "Added",
          items: [
            "Choose Português (BR) or English from the welcome screen or Settings. On first launch, DiskSnoop uses a supported system language or defaults to English. Your choice is saved and applies to the entire interface.",
            "Candidate details show category, risk, and confidence separately. See where each piece of evidence was found, what removal may affect, and what to check before moving an item."
          ]
        },
        {
          title: "Improved",
          items: [
            "The scanner combines paths, directory layouts, manifests, and installation evidence to identify caches and possible installers. It recognizes Chromium, Electron, CEF, and WebView2 profiles. Shader caches, component downloads, and mixed caches still warrant review.",
            "The cleanup simulation distinguishes logical size, potentially reclaimable space, and items selected for quarantine. History shows measured free-space changes separately. Moving an item into quarantine on the same volume keeps the data on that drive.",
            "Use the keyboard to operate the language selector and confirmation dialogs, including Escape to dismiss or cancel."
          ]
        },
        {
          title: "Fixed",
          items: [
            "Internal directories of installed dependencies are no longer mistaken for project builds. Artificial modification dates are no longer treated as signs of disuse, and possible installers require evidence in their name or format.",
            "Equivalent paths and overlapping candidates are counted once in totals. When the scan scope includes specific folders, at least one must belong to the selected drive."
          ]
        },
        {
          title: "Security",
          items: [
            "Before moving an item, DiskSnoop verifies the scan report, the item's identity, and protections for its path and contents. Runtimes, extensions, installed plugins, dependencies, and package manager components are protected, including against moves of their parent folders. Shared Dictionary stays protected because its files and metadata belong together.",
            "Restore checks whether the destination is occupied. Permanent deletion requires typed confirmation and confirmation in a native Windows dialog. Pending moves and records with an uncertain origin remain available for review.",
            "External AI reviews use IDs tied to the scan. Conflicting responses are ignored, and recommendations help select eligible items for review."
          ]
        },
        {
          title: "Known limitations",
          items: [
            "Detection uses heuristics. Check what an item is for and whether you can recover it before moving it, including items marked low risk. Older reports remain readable and require a fresh scan before items can be moved.",
            "Concurrent file system changes can interrupt operations. An interrupted recursive deletion may be partial. Folders can only be moved into quarantine on the same volume."
          ]
        }
      ]
    }
  },
  "1.13.0": {
    "pt-BR": {
      title: "DiskSnoop 1.13.0",
      sections: [
        {
          title: "Interface",
          items: [
            "O lembrete de confirmação antes de reiniciar voltou a aparecer ao lado da opção de baixar atualizações automaticamente."
          ]
        },
        {
          title: "Scan e produtividade",
          items: [
            "O progresso do scan agora estima o tempo restante usando a velocidade observada nos últimos segundos.",
            "Painéis de detalhes agora permitem copiar somente o caminho do item com um clique.",
            "Atalhos de teclado permitem iniciar outro scan, focar a busca, fechar detalhes, navegar pelas listas e copiar o caminho selecionado."
          ]
        },
        {
          title: "Diagnóstico do disco",
          items: [
            "A Visão Geral agora mostra a saúde informada pelo disco físico e mantém o estado como indisponível quando o hardware não fornece dados.",
            "Itens sem acesso agora exibem caminho e motivo e podem ser medidos novamente, em lote, por um processo elevado somente leitura."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.13.0",
      sections: [
        {
          title: "Interface",
          items: [
            "The restart confirmation reminder is displayed beside the automatic update download option again."
          ]
        },
        {
          title: "Scanning and productivity",
          items: [
            "Scan progress now estimates remaining time from the speed observed during the latest seconds.",
            "Detail panels can now copy only the item's path with one click.",
            "Keyboard shortcuts can start another scan, focus search, close details, navigate lists, and copy the selected path."
          ]
        },
        {
          title: "Drive diagnostics",
          items: [
            "Overview now shows the health reported by the physical drive and keeps the state unavailable when hardware data is missing.",
            "Inaccessible items now show their path and reason and can be measured again in batch by a read-only elevated process."
          ]
        }
      ]
    }
  }
};
