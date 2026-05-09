# DiskSnoop

DiskSnoop e um app desktop para Windows que ajuda a descobrir onde o espaco do SSD/HD esta sendo consumido. Ele analisa discos, classifica pastas e arquivos relevantes, explica por que cada item apareceu e usa quarentena antes de qualquer exclusao definitiva.

> Beta: o DiskSnoop ainda esta em fase de testes. Revise os itens antes de mover para quarentena ou excluir permanentemente.

Versao em desenvolvimento: `0.2.0-beta.1`.

## Principios

- Nada e apagado automaticamente.
- Itens sensiveis do Windows nao entram como candidatos normais de limpeza.
- Toda remocao passa por revisao do usuario.
- A quarentena permite restaurar itens antes de uma exclusao permanente.

## Recursos do beta

- Tela de apresentacao objetiva.
- Escolha de disco com total, usado, livre, barra de uso e status.
- Deteccao real de discos locais no Windows.
- Scanner em processo separado, com progresso, pausa e cancelamento.
- Relatorio do scan com duracao, arquivos, pastas e itens sem acesso.
- Ranking de maiores pastas.
- Aba de arquivos grandes.
- Candidatos a limpeza para `node_modules`, `.venv`, `dist`, `build`, `.cache`, instaladores antigos, arquivos grandes, downloads antigos, logs e temporarios.
- Possiveis duplicados por mesmo nome e tamanho, com revisao conservadora.
- Sobras de apps em AppData, ProgramData e Program Files.
- Quarentena com restauracao, exclusao permanente confirmada e status para arquivos ausentes.
- Historico de scans e acoes.
- Configuracoes de limites, detectores, escopo, ignorados e local da quarentena.
- Aba Atualizacao reservada para o fluxo futuro de updates, ainda sem download ou instalacao automatica.
- Temas Claro e Escuro.

## Limites conhecidos

- A deteccao de duplicados ainda nao usa hash de conteudo.
- Alguns itens em `ProgramData`, `Program Files`, `Windows` ou caches de instaladores podem exigir permissao de administrador.
- A tela de sobras de apps e conservadora e pode mostrar pastas que ainda pertencem a apps instalados.
- O app ainda nao tem instalador assinado.

## Rodar em desenvolvimento

```powershell
npm install
npm run dev
```

## Validar sintaxe

```powershell
npm run check
```

## Gerar build beta para Windows

```powershell
npm install
npm run dist
```

O build portatil sera gerado em `release/`.

## Publicar beta no GitHub Releases

1. Atualize a versao em `package.json`, se necessario.
2. Rode `npm run check`.
3. Crie uma tag:

```powershell
git tag v0.2.0-beta.1
git push origin v0.2.0-beta.1
```

4. O GitHub Actions vai gerar um draft de release marcado como pre-release.
5. Revise o texto de `RELEASE_NOTES.md` e publique manualmente.

## Seguranca

O scanner mostra itens sensiveis no mapa de uso quando aparecem como pastas grandes, mas nao os coloca como candidatos normais de limpeza. Mover para quarentena remove o item do local original e guarda metadados para restauracao. Excluir permanentemente so acontece por acao explicita do usuario.

## Roadmap curto

- `0.2.0-beta`: polimento de UX, mensagens, candidatos mais confiaveis e acoes mais seguras.
- `0.3.0-beta`: revisao final antes da linha estavel, empacotamento e preparacao do sistema de update.
- `1.x`: primeira linha estavel depois das betas publicas.
