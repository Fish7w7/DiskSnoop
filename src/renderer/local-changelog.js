window.diskSnoopLocalChangelog = {
  "1.7.0": {
    "pt-BR": {
      title: "DiskSnoop 1.7.0",
      sections: [
        {
          title: "Interface mais estável",
          items: [
            "Pastas Grandes, Arquivos Grandes, Candidatos, Duplicados e Sobras de Apps agora abrem os detalhes sob demanda em um painel sobreposto e dispensável, devolvendo todo o espaço à lista quando ele está fechado.",
            "Os temas Hacker, Neon e Sistema agora aparecem nas Configurações junto de Claro e Escuro, com cores e superfícies ajustadas.",
            "A inicialização passa a exibir o primeiro quadro já com a cor do tema escolhido, eliminando flashes de cores incorretas antes da tela de carregamento.",
            "O card de progresso do scan permanece centralizado mesmo quando o caminho exibido muda de tamanho."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.7.0",
      sections: [
        {
          title: "A more stable interface",
          items: [
            "Large Folders, Large Files, Candidates, Duplicates, and App Leftovers now open details on demand in a dismissible overlay, returning all available space to the list when closed.",
            "Hacker, Neon, and System themes now appear in Settings alongside Light and Dark, with adjusted colors and surfaces.",
            "Startup now displays its first frame using the selected theme color, eliminating incorrect color flashes before the loading screen.",
            "The scan progress card remains centered even when the displayed path changes length."
          ]
        }
      ]
    }
  },
  "1.6.0": {
    "pt-BR": {
      title: "DiskSnoop 1.6.0",
      sections: [
        {
          title: "Decisões com mais contexto",
          items: [
            "Os detalhes de candidatos, duplicados e sobras de apps agora permitem copiar uma dúvida pronta, com caminho, tamanho, data, categoria, motivo e assinatura já consultada.",
            "Arquivos executáveis e bibliotecas compatíveis podem ter a assinatura digital Authenticode verificada sob demanda, sem alterar as regras de segurança ou liberar ações bloqueadas.",
            "O Histórico ganhou um gráfico de linhas que compara espaço revisável e espaço realmente liberado em cada scan, mantendo acesso aos relatórios disponíveis."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.6.0",
      sections: [
        {
          title: "Decisions with more context",
          items: [
            "Candidate, duplicate, and app-leftover details can now copy a ready-to-use question with path, size, date, category, reason, and any signature result already checked.",
            "Compatible executables and libraries can have their Authenticode digital signature checked on demand without changing safety rules or unlocking blocked actions.",
            "History now includes a line chart comparing reviewable space with space actually freed by each scan, while keeping access to available reports."
          ]
        }
      ]
    }
  },
  "1.5.0": {
    "pt-BR": {
      title: "DiskSnoop 1.5.0",
      sections: [
        {
          title: "Manutenção",
          items: [
            "Atualização de manutenção: Electron, electron-builder e electron-updater foram atualizados, corrigindo vulnerabilidades apontadas na auditoria de dependências. Nenhuma mudança visual ou de comportamento nesta versão."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.5.0",
      sections: [
        {
          title: "Maintenance",
          items: [
            "Maintenance update: Electron, electron-builder, and electron-updater were updated, addressing vulnerabilities reported by the dependency audit. This version includes no visual or behavioral changes."
          ]
        }
      ]
    }
  },
  "1.4.0": {
    "pt-BR": {
      title: "DiskSnoop 1.4.0",
      sections: [
        {
          title: "Novo visual",
          items: [
            "Interface redesenhada com um novo sistema visual: tipografia e espaçamento padronizados, usando a fonte Inter.",
            "Overview: o espaço do plano seguro agora é o destaque principal, com a simulação de limpeza acessível diretamente por ali.",
            "Overview: comparação com o scan anterior virou texto simples, mais fácil de ler rapidamente.",
            "Badges em geral foram simplificados: ponto colorido + texto, em vez de pill colorido cheio.",
            "Sidebar: navegação mais leve, estado ativo único e rodapé reduzido a uma linha.",
            "Candidatos: cada linha agora mostra um único status principal; segurança e confiança completas continuam disponíveis nos detalhes.",
            "Quarentena: mover itens virou uma ação leve com Desfazer por alguns segundos, enquanto exclusões permanentes mantêm a confirmação reforçada.",
            "Configurações: preferências reorganizadas em categorias laterais, mostrando somente o grupo selecionado."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.4.0",
      sections: [
        {
          title: "New look",
          items: [
            "Redesigned interface with a new visual system: standardized typography and spacing, using the Inter typeface.",
            "Overview: safe plan space is now the main highlight, with the cleanup simulation accessible right there.",
            "Overview: comparison with the previous scan is now plain text, easier to scan at a glance.",
            "Badges in general were simplified: a colored dot plus text, instead of a filled colored pill.",
            "Sidebar: lighter navigation, a single active state, and a one-line footer.",
            "Candidates: each row now shows one primary status; complete safety and confidence details remain available on selection.",
            "Quarantine: moving items is now a lightweight action with Undo for a few seconds, while permanent deletion keeps its reinforced confirmation.",
            "Settings: preferences are reorganized into side categories that show only the selected group."
          ]
        }
      ]
    }
  },
  "1.3.1": {
    "pt-BR": {
      title: "DiskSnoop 1.3.1",
      sections: [
        {
          title: "Defesa em profundidade",
          items: [
            "Falhas ou timeouts no Get-AppxPackage agora bloqueiam dados de aplicativos por padrão, sem transformar incerteza em permissão de limpeza.",
            "O inventário de pacotes é consultado uma vez por sessão e reutilizado para evitar lentidão em listas grandes.",
            "AppData\\Local\\Packages, WindowsApps e dados ativos do OneDrive agora são protegidos em todas as camadas do aplicativo.",
            "As regras de proteção vêm de uma única fonte compartilhada pelo scanner, pela interface e pelo processo principal.",
            "Pastas protegidas recebem selo e explicação visível nas telas de análise.",
            "Ações em lote podem solicitar ao Windows um ponto de restauração antes de mover itens para quarentena."
          ]
        },
        {
          title: "Rastreabilidade e confirmação",
          items: [
            "Movimentos, restaurações, exclusões e bloqueios são registrados no log local de auditoria.",
            "Exclusões vindas de AppData, ProgramData ou áreas de programas exigem a confirmação reforçada APAGAR.",
            "Um teste integrado cobre o caminho completo do scanner até o bloqueio de exclusão permanente."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.3.1",
      sections: [
        {
          title: "Defense in depth",
          items: [
            "Get-AppxPackage failures or timeouts now block application data by default instead of turning uncertainty into cleanup permission.",
            "The package inventory is queried once per session and reused to avoid slowing down large lists.",
            "AppData\\Local\\Packages, WindowsApps, and active OneDrive data are now protected across every application layer.",
            "Protection rules come from one source shared by the scanner, interface, and main process.",
            "Protected folders now display a visible badge and explanation in analysis views.",
            "Batch actions can ask Windows to create a restore point before moving items to quarantine."
          ]
        },
        {
          title: "Traceability and confirmation",
          items: [
            "Moves, restores, deletions, and blocked attempts are written to a local audit log.",
            "Deletions originating from AppData, ProgramData, or program areas require the stronger APAGAR confirmation.",
            "An integration test covers the complete path from scanner detection to permanent-deletion blocking."
          ]
        }
      ]
    }
  },
  "1.3.0": {
    "pt-BR": {
      title: "DiskSnoop 1.3.0",
      sections: [
        {
          title: "Destaques",
          items: [
            "Visao Geral ganhou comparacao com o scan anterior do mesmo disco, incluindo variacao de ganho seguro, revisavel, duplicados e categorias.",
            "Candidatos ganhou simulacao de limpeza para estimar o impacto da selecao antes de mover qualquer item para quarentena.",
            "Novo filtro de confianca separa achados de Alta, Media e Baixa confianca.",
            "A tabela de candidatos agora mostra a confianca ao lado do selo de seguranca.",
            "Relatorios carregados removem automaticamente itens que ja foram apagados fora do DiskSnoop."
          ]
        },
        {
          title: "Revisao segura",
          items: [
            "Botao Selecionar plano seguro marca apenas itens visiveis, moviveis e com alta confianca.",
            "Limpar selecao permite recomecar a simulacao sem alterar arquivos.",
            "Comparacao historica ajuda a entender o que cresceu desde o scan anterior."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.3.0",
      sections: [
        {
          title: "Highlights",
          items: [
            "Overview now compares against the previous scan for the same drive, including safe gain, reviewable space, duplicates, and category deltas.",
            "Cleanup Candidates now includes a cleanup simulation to estimate the current selection before moving anything to quarantine.",
            "A new confidence filter separates High, Medium, and Low confidence findings.",
            "The candidates table now shows confidence next to the safety badge.",
            "Loaded reports automatically remove items that were already deleted outside DiskSnoop."
          ]
        },
        {
          title: "Safe review",
          items: [
            "Select safe plan marks only visible, movable, high-confidence items.",
            "Clear selection lets you restart the simulation without changing files.",
            "Historical comparison helps explain what grew since the previous scan."
          ]
        }
      ]
    }
  },
  "1.2.0": {
    "pt-BR": {
      title: "DiskSnoop 1.2.0",
      sections: [
        {
          title: "Destaques",
          items: [
            "Visão geral ganhou Assistente de revisão, ganho seguro e etapas para priorizar candidatos, duplicados e sobras de apps.",
            "Cards de revisão foram reescritos com mensagens mais claras sobre motivo do achado, o que conferir e quando mover para quarentena.",
            "Configurações ganhou sugestões de ignorados para itens gerados por projetos, caches detectados e downloads antigos.",
            "A área de Ignorados foi redesenhada com cards mais simples, sem ícones decorativos problemáticos."
          ]
        },
        {
          title: "Polimento",
          items: [
            "Tabelas e detalhes foram ajustados para funcionar melhor em janelas menores.",
            "Badges de confiança foram adicionadas em candidatos, arquivos grandes, duplicados e sobras de apps.",
            "Seleção acidental de textos da interface foi desativada, mantendo campos editáveis selecionáveis.",
            "Mensagens longas em Português e Inglês foram revisadas para caber melhor nos cards."
          ]
        },
        {
          title: "Internacionalização",
          items: [
            "Textos principais foram migrados para JSONs de idioma com chaves estáveis.",
            "O motor de i18n continua compatível com a camada antiga de tradução de textos já renderizados.",
            "Carregamento de idiomas no Electron foi movido para um fluxo seguro via processo principal para evitar travamento na tela inicial."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.2.0",
      sections: [
        {
          title: "Highlights",
          items: [
            "Overview now includes a review assistant, safe gain, and steps to prioritize candidates, duplicates, and app leftovers.",
            "Review cards were rewritten with clearer messages about why an item was found, what to check, and when to move it to quarantine.",
            "Settings now includes ignored-path suggestions for project-generated items, detected caches, and old downloads.",
            "The Ignored area was redesigned with simpler cards and without problematic decorative icons."
          ]
        },
        {
          title: "Polish",
          items: [
            "Tables and detail panels were adjusted to work better in smaller windows.",
            "Confidence badges were added to candidates, large files, duplicates, and app leftovers.",
            "Accidental selection of interface text is disabled while editable fields remain selectable.",
            "Long Portuguese and English messages were reviewed to fit better inside cards."
          ]
        },
        {
          title: "Internationalization",
          items: [
            "Main UI strings were moved into language JSON files with stable keys.",
            "The i18n engine remains compatible with the legacy already-rendered text translation layer.",
            "Electron language loading now goes through the main process to avoid startup freezes on the boot screen."
          ]
        }
      ]
    }
  },
  "1.1.0": {
    "pt-BR": {
      title: "DiskSnoop 1.1.0",
      sections: [
        {
          title: "Destaques",
          items: [
            "Preferência de idioma com base inicial para Português e Inglês.",
            "Aba Atualização preparada para mostrar changelog local ou notas vindas do GitHub Releases.",
            "No build instalado, o download automático de atualizações vem ativo por padrão.",
            "A opção manual continua disponível para quem prefere baixar e aplicar updates por conta própria."
          ]
        },
        {
          title: "Segurança",
          items: [
            "O app continua sem reiniciar automaticamente: aplicar update ainda exige confirmação.",
            "Downloads automáticos são bloqueados durante scan e ações protegidas de quarentena.",
            "Quarentena segue conservadora: nada é excluído automaticamente."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.1.0",
      sections: [
        {
          title: "Highlights",
          items: [
            "Language preference with the initial Portuguese and English foundation.",
            "Updates tab can show local changelog notes or release notes from GitHub Releases.",
            "On installed builds, automatic update downloads are enabled by default.",
            "Manual update remains available for users who prefer to download and apply updates themselves."
          ]
        },
        {
          title: "Safety",
          items: [
            "The app still never restarts automatically: applying an update requires confirmation.",
            "Automatic downloads are blocked during scans and protected quarantine actions.",
            "Quarantine remains conservative: nothing is deleted automatically."
          ]
        }
      ]
    }
  },
  "1.0.0": {
    "pt-BR": {
      title: "DiskSnoop 1.0.0",
      sections: [
        {
          title: "Destaques",
          items: [
            "Scanner em processo separado com progresso, pausa e cancelamento.",
            "Quarentena com revisão, restauração e exclusão permanente confirmada.",
            "Atualização com canal instalado automático e canal portable assistido.",
            "Relatórios de arquivos grandes, pastas grandes, duplicados, candidatos e sobras de apps."
          ]
        },
        {
          title: "Segurança",
          items: [
            "Nada é excluído automaticamente.",
            "Itens sensíveis do Windows ficam fora dos candidatos normais.",
            "Mover pastas entre discos pode ser bloqueado para evitar cópia parcial seguida de remoção.",
            "Atualizações não reiniciam o app sem confirmação do usuário."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.0.0",
      sections: [
        {
          title: "Highlights",
          items: [
            "Scanner runs in a separate process with progress, pause, and cancellation.",
            "Quarantine supports review, restore, and confirmed permanent deletion.",
            "Updates support automatic installed builds and assisted portable builds.",
            "Reports cover large files, large folders, duplicates, cleanup candidates, and app leftovers."
          ]
        },
        {
          title: "Safety",
          items: [
            "Nothing is deleted automatically.",
            "Sensitive Windows items stay out of normal candidates.",
            "Moving folders between drives can be blocked to avoid partial copy followed by removal.",
            "Updates never restart the app without user confirmation."
          ]
        }
      ]
    }
  }
};
