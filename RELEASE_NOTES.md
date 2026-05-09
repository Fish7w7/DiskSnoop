# DiskSnoop 0.1.0-beta

Primeira versao beta publica do DiskSnoop para Windows.

## O que testar

- Deteccao de discos locais.
- Scan em processo separado, com pausa e cancelamento.
- Ranking de maiores pastas.
- Candidatos a limpeza: caches, builds, `node_modules`, instaladores antigos, downloads antigos, arquivos grandes, logs e temporarios.
- Possiveis duplicados por mesmo nome e tamanho.
- Sobras de apps em locais comuns como AppData, ProgramData e Program Files.
- Quarentena com restauracao e exclusao permanente confirmada.
- Historico de scans.
- Temas Claro e Escuro.

## Avisos de beta

- O app nao apaga nada automaticamente.
- Itens de sistema, apps ativos e pastas protegidas pelo Windows podem exigir revisao manual.
- A deteccao de duplicados ainda e conservadora: usa nome e tamanho, nao hash de conteudo.
- Recomenda-se revisar cada item antes de mover para quarentena.

## Como rodar localmente

```powershell
npm install
npm run dev
```

## Como gerar build local

```powershell
npm install
npm run dist
```

O artefato sera gerado na pasta `release/`.
