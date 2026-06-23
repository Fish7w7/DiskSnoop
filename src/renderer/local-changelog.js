window.diskSnoopLocalChangelog = {
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
