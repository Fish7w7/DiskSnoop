# DiskSnoop v1.1.0

Versão com interface bilíngue, update automático mais natural no instalador e refinamentos de experiência para Windows.

## Destaques

- Interface em Português (Brasil) e English, com preferência de idioma nas configurações.
- Tela de boot traduzida e simplificada, com indicador de carregamento indeterminado.
- Aba Atualização com changelog local da versão instalada quando a release publicada ainda não trouxer notas.
- No canal instalado, o download automático de updates vem ativo por padrão.
- A opção de update manual continua disponível para quem prefere atualizar sem fluxo automático.
- A aba Atualização mostra informações simples do app em builds instalados/portable e mantém diagnóstico técnico apenas em desenvolvimento.
- Textos de revisão em candidatos, arquivos grandes, pastas grandes e duplicados foram reorganizados em avisos visuais mais claros.
- Teste automático para cobrir textos renderizados da tradução em inglês.

## Segurança

- Nada é apagado automaticamente.
- Aplicar update continua exigindo confirmação explícita antes de reiniciar.
- Download automático continua bloqueado durante scan ativo e ações protegidas de quarentena.
- O build portable usa atualização assistida e não tenta substituir o executável aberto.
- A quarentena continua conservadora e passa pelas validações server-side adicionadas na 1.0.
- A aba de update diferencia build instalado, portable e desenvolvimento para evitar aplicar o fluxo errado.

## Como instalar

Baixe um dos artefatos da release:

- **`DiskSnoop-Setup-1.1.0-x64.exe`** — instalador recomendado.
- **`DiskSnoop-Portable-1.1.0-x64.exe`** — versão portable para testar sem instalar.

Para o auto-update do instalador funcionar corretamente, a release também precisa incluir:

- **`DiskSnoop-Setup-1.1.0-x64.exe.blockmap`**
- **`latest.yml`**

## Limites conhecidos

- O app não tem assinatura de código. O Windows pode exibir aviso de app desconhecido ao abrir o instalador ou portable.
- A tradução em inglês cobre os fluxos principais e aplica uma camada de tradução renderizada para textos legados das abas de revisão. Textos vindos de caminhos, nomes de arquivos, nomes de apps e dados do scan são preservados.
- Algumas mensagens técnicas do sistema operacional, permissões negadas ou erros de arquivos bloqueados podem aparecer no idioma original do Windows.
- O auto-update do instalador depende de releases com metadados do electron-builder (`latest.yml` e `.blockmap`) e da dependência `electron-updater` no build.
- O portable não substitui automaticamente o executável aberto; ele usa atualização assistida.

---