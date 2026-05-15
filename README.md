# DiskSnoop

DiskSnoop é um app desktop para Windows que ajuda a descobrir onde o espaço do SSD/HD está sendo consumido. Ele analisa discos, classifica pastas e arquivos relevantes, explica por que cada item apareceu e usa quarentena antes de qualquer exclusão definitiva.

> Versão 1.1: o DiskSnoop continua conservador por padrão. Nada é apagado automaticamente.

## Princípios

- Nada é apagado automaticamente.
- Itens sensíveis do Windows não entram como candidatos normais de limpeza.
- Toda remoção passa por revisão do usuário.
- A quarentena permite restaurar itens antes de uma exclusão permanente.
- Para pastas grandes, prefira uma quarentena no mesmo disco do item analisado.

## Segurança

O scanner mostra itens sensíveis no mapa de uso quando aparecem como pastas grandes, mas não os coloca como candidatos normais de limpeza. Mover para quarentena remove o item do local original e guarda metadados para restauração. Excluir permanentemente só acontece por ação explícita do usuário.

A quarentena mais segura é no mesmo disco do item analisado, porque o Windows consegue mover a entrada sem copiar tudo antes. Quando a origem e a quarentena ficam em discos diferentes, o DiskSnoop pode bloquear pastas por segurança para evitar cópia parcial seguida de remoção. Arquivos ainda podem ser movidos entre discos, mas passam por cópia temporária e verificação de tamanho antes de remover a origem.

## Recursos principais

**Análise de disco**
Scanner em processo separado com progresso, pausa e cancelamento. Ranking de maiores pastas, aba de arquivos grandes e relatório com duração, contagens e itens sem acesso.

**Limpeza**
Candidatos para `node_modules`, `.venv`, `dist`, `build`, `.cache`, instaladores antigos, downloads antigos, logs e temporários. Duplicados pré-filtrados por nome e tamanho, confirmados por hash SHA-256 configurável. Sobras de apps em AppData, ProgramData e Program Files com abordagem conservadora.

**Quarentena**
Restauração, exclusão permanente confirmada e status para arquivos ausentes. Quarentena no mesmo disco recomendada para pastas grandes.

**Histórico e configurações**
Histórico de scans e ações com snapshots carregáveis. Configurações de limites, detectores, escopo, pastas ignoradas e local da quarentena.

**Atualização e idioma**
Verificação no GitHub Releases com changelog, lembrar depois e ignorar versão. No canal instalado, o download automático vem ativo por padrão e o reinício continua dependendo de confirmação do usuário. O portable segue com fluxo assistido. A versão 1.1 traz interface bilíngue em Português e Inglês nos fluxos principais de entrada, scan, visão geral, atualização e configurações.

## Limites conhecidos

- O app não tem assinatura de código. O Windows pode mostrar aviso de app desconhecido ao abrir o instalador ou portable.
- O hash de duplicados só é calculado para grupos candidatos; arquivos bloqueados ou sem permissão podem ficar sem verificação.
- Algumas pastas em `ProgramData`, `Program Files`, `Windows` ou caches de instaladores podem exigir permissão de administrador.
- A tela de sobras de apps é conservadora e pode mostrar pastas que ainda pertencem a apps instalados.
- O build portable usa update assistido: o DiskSnoop pode verificar e baixar a nova versão, mas não substitui o executável aberto automaticamente.
- O auto-update real depende do build instalado com `electron-updater` presente em `node_modules`.
- Pastas entre discos diferentes podem ser bloqueadas pela quarentena. Arquivos entre discos usam cópia temporária com verificação antes da remoção da origem.

## Desenvolvimento

### Rodar localmente

```powershell
npm install
npm run dev
```

### Validar

```powershell
npm run check
npm test
```

Os testes cobrem regras críticas de quarentena e a camada de tradução renderizada usada para evitar textos em Português quando a interface está em inglês.

## Build para Windows

```powershell
npm install
npm run dist
```

O instalador NSIS e o portable serão gerados em `release/`. Para gerar apenas o portable:

```powershell
npm run dist:portable
```

## Publicar no GitHub Releases

1. Confirme a versão em `package.json`.
2. Rode as validações:

```powershell
npm run check
npm test
```

3. Gere os artefatos:

```powershell
npm run dist
```

4. Crie e envie a tag:

```powershell
git tag v1.1.0
git push origin v1.1.0
```

5. Anexe estes arquivos de `release/` na release do GitHub:

- `DiskSnoop-Setup-1.1.0-x64.exe`
- `DiskSnoop-Setup-1.1.0-x64.exe.blockmap`
- `latest.yml`
- `DiskSnoop-Portable-1.1.0-x64.exe`

O instalador usa `latest.yml` e o `.blockmap` para o auto-update. O portable usa a aba Atualização como fluxo assistido.

## Atualização

A aba Atualização consulta as releases publicadas em `Fish7w7/DiskSnoop`, ignora drafts, respeita o canal Estável/Beta e compara versões usando semver. No build portable, o fluxo é assistido: o usuário revisa o changelog, baixa o artefato e decide quando executar a nova versão.

No canal instalado, o DiskSnoop usa `electron-updater`. Ele verifica update, baixa automaticamente pelo instalador quando o usuário mantém essa preferência ativa, mostra progresso e só chama reinício depois de confirmação explícita. Quem preferir pode ativar o modo manual nas preferências.

O DiskSnoop não reinicia sozinho, não atualiza durante scan ativo e bloqueia download enquanto uma ação de quarentena está em andamento. Configurações, histórico, snapshots e quarentena ficam na pasta local do usuário e não são apagados pelo update.
