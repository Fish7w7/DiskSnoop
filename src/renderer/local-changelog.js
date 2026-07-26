window.diskSnoopLocalChangelog = {
  "1.10.0": {
    "pt-BR": {
      title: "DiskSnoop 1.10.0",
      sections: [
        {
          title: "Manutenção interna",
          items: [
            "O pacote agora mantém somente os idiomas internos en-US e pt-BR do Chromium, reduzindo 7,96 MiB tanto no instalador quanto na versão portable.",
            "A auditoria do pacote removeu os assets órfãos snoopy-source.png e snoop-transparent.png, além de source maps das dependências de produção.",
            "A fonte Inter agora inclui somente a variação normal, com subsets Latin e Latin Extended, usada pela interface nos pesos 400, 500, 600, 650, 700 e 800.",
            "Exports e traduções sem uso foram removidos depois de revisão manual e validação automatizada, sem mudanças na interface ou no comportamento."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.10.0",
      sections: [
        {
          title: "Internal maintenance",
          items: [
            "The package now keeps only Chromium's internal en-US and pt-BR languages, reducing both the installer and portable build by 7.96 MiB.",
            "The package audit removed the orphaned snoopy-source.png and snoop-transparent.png assets, along with production dependency source maps.",
            "The bundled Inter font now includes only its normal variation with Latin and Latin Extended subsets, used by the interface at weights 400, 500, 600, 650, 700, and 800.",
            "Unused exports and translations were removed after manual review and automated validation, with no interface or behavior changes."
          ]
        }
      ]
    }
  },
  "1.9.0": {
    "pt-BR": {
      title: "DiskSnoop 1.9.0",
      sections: [
        {
          title: "Notificações e interface",
          items: [
            "Scans concluídos em segundo plano agora exibem um badge no ícone da barra de tarefas até o DiskSnoop voltar ao foco.",
            "A tela de Atualização foi reorganizada para destacar o estado e os dados da versão, mantendo os diagnósticos técnicos recolhidos por padrão.",
            "As métricas da Visão Geral agora aparecem imediatamente, sem animação de contagem.",
            "Pequenas oscilações de espaço revisável entre scans agora são identificadas como estáveis em vez de sugerirem ganho ou perda relevante."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.9.0",
      sections: [
        {
          title: "Notifications and interface",
          items: [
            "Scans completed in the background now show a badge on the taskbar icon until DiskSnoop regains focus.",
            "The Update screen was reorganized to highlight status and version information, with technical diagnostics collapsed by default.",
            "Overview metrics now appear immediately, without a count-up animation.",
            "Small fluctuations in reviewable space between scans are now identified as stable instead of suggesting a meaningful gain or loss."
          ]
        }
      ]
    }
  },
  "1.8.0": {
    "pt-BR": {
      title: "DiskSnoop 1.8.0",
      sections: [
        {
          title: "Novo visual",
          items: [
            "Estados vazios agora usam ilustrações simples que acompanham a cor de cada tema.",
            "Tabelas exibem linhas skeleton durante refiltros, mantendo o cabeçalho e o contexto visíveis.",
            "Aparência ganhou cards com preview das cores para escolher entre Claro, Escuro, Papel, Grafite e Sistema.",
            "Trocas de aba e tema receberam transições sutis, desativadas quando o sistema pede movimento reduzido.",
            "Os principais números da Visão Geral agora contam suavemente até o novo valor sem reiniciar em renderizações que não alteram a métrica.",
            "A cor de destaque agora pode ser escolhida separadamente do tema, usando opções prontas ou uma cor personalizada.",
            "A nova cor continua ativa ao trocar de tema e fica salva para as próximas aberturas do app.",
            "Avisos informam quando a cor pode ter pouco contraste ou se confundir com as cores de perigo, aviso e sucesso.",
            "É possível restaurar a cor padrão do tema ou desfazer rapidamente uma troca pelo toast.",
            "Os temas Hacker e Neon foram substituídos por Papel e Grafite."
          ]
        },
        {
          title: "Polimento e acessibilidade",
          items: [
            "A barra de progresso do scan ganhou um brilho sutil, desativado quando o sistema pede movimento reduzido.",
            "Os avisos informativos de Candidatos e Quarentena agora usam a mesma moldura legível das demais telas."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.8.0",
      sections: [
        {
          title: "New look",
          items: [
            "Empty states now use simple illustrations that follow each theme's accent color.",
            "Tables display skeleton rows while filters refresh, keeping headers and context visible.",
            "Appearance now offers color-preview cards for choosing Light, Dark, Paper, Graphite, or System.",
            "Tab and theme changes received subtle transitions, disabled when the system requests reduced motion.",
            "The main Overview numbers now count smoothly toward new values without restarting on renders that do not change the metric.",
            "The accent color can now be chosen independently from the theme, using curated options or a custom color.",
            "The chosen color remains active when switching themes and is saved for future app sessions.",
            "Warnings indicate when a color may have low contrast or be confused with danger, warning, and success colors.",
            "You can restore the theme's default color or quickly undo a change from the toast.",
            "The Hacker and Neon themes were replaced by Paper and Graphite."
          ]
        },
        {
          title: "Polish and accessibility",
          items: [
            "The scan progress bar now has a subtle shimmer, disabled when the system requests reduced motion.",
            "Informational notices in Candidates and Quarantine now use the same readable frame as the other screens."
          ]
        }
      ]
    }
  },
  "1.8.0-beta.1": {
    "pt-BR": {
      title: "DiskSnoop 1.8.0-beta.1",
      sections: [
        {
          title: "Polimento visual em teste",
          items: [
            "Estados vazios agora usam ilustrações simples que acompanham a cor de cada tema.",
            "Tabelas exibem linhas skeleton durante refiltros, mantendo o cabeçalho e o contexto visíveis.",
            "Aparência ganhou cards com preview das cores para escolher entre Claro, Escuro, Papel, Grafite e Sistema.",
            "Trocas de aba e tema receberam transições sutis, desativadas quando o sistema pede movimento reduzido.",
            "Os principais números da Visão Geral agora contam suavemente até o novo valor sem reiniciar em renderizações que não alteram a métrica."
          ]
        }
      ]
    },
    "en-US": {
      title: "DiskSnoop 1.8.0-beta.1",
      sections: [
        {
          title: "Visual polish under evaluation",
          items: [
            "Empty states now use simple illustrations that follow each theme's accent color.",
            "Tables display skeleton rows while filters refresh, keeping headers and context visible.",
            "Appearance now offers color-preview cards for choosing Light, Dark, Paper, Graphite, or System.",
            "Tab and theme changes received subtle transitions, disabled when the system requests reduced motion.",
            "The main Overview numbers now count smoothly toward new values without restarting on renders that do not change the metric."
          ]
        }
      ]
    }
  }
};
