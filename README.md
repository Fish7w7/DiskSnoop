# DiskSnoop

> App desktop para Windows que descobre onde o espaço do SSD/HD está sendo consumido — com quarentena antes de qualquer exclusão definitiva.

![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows&logoColor=white)
![GitHub release](https://img.shields.io/github/v/release/Fish7w7/DiskSnoop)
![GitHub releases](https://img.shields.io/github/downloads/Fish7w7/DiskSnoop/total)

## Download

| Tipo | Link |
|------|------|
| 🖥️ Instalador (recomendado) | [Baixar na versão mais recente](https://github.com/Fish7w7/DiskSnoop/releases/latest) |
| 📦 Portable | [Baixar na versão mais recente](https://github.com/Fish7w7/DiskSnoop/releases/latest) |

> ⚠️ O app não tem assinatura de código. O Windows pode exibir aviso de app desconhecido — isso é esperado.

> Requer Windows 10 ou superior, em sistema 64 bits.

---

<!-- Adicione um screenshot ou GIF do app aqui. Exemplo:
![DiskSnoop em uso](docs/screenshot.png)
-->

## O que ele faz

O DiskSnoop analisa seus discos, classifica pastas e arquivos por tamanho, explica por que cada item apareceu e move candidatos para **quarentena** antes de qualquer remoção. Nada é apagado automaticamente.

## Recursos

**✨ Interface e revisão**
Cinco temas — Claro, Escuro, Papel, Grafite e Sistema — com inicialização já na cor correta. Pastas Grandes, Arquivos Grandes, Candidatos, Duplicados e Sobras de Apps abrem detalhes sob demanda em um painel sobreposto, deixando a lista inteira disponível quando ele está fechado.

**🔍 Análise de disco**
Scanner em processo separado com progresso, pausa e cancelamento. Ranking das maiores pastas, aba de arquivos grandes e relatório com duração, contagens e itens sem acesso.

**🧹 Limpeza inteligente**
Candidatos para `node_modules`, `.venv`, `dist`, `build`, `.cache`, instaladores antigos, downloads antigos, logs e temporários. Duplicados verificados por nome, tamanho e hash SHA-256 configurável. Sobras de apps em AppData, ProgramData e Program Files com abordagem conservadora.

**🗂️ Quarentena**
Itens movidos para quarentena ficam fora do caminho original com metadados para restauração. Você decide quando excluir permanentemente — isso sempre exige confirmação explícita. Quarentena no mesmo disco é recomendada para pastas grandes (evita cópia antes da remoção).

**📋 Histórico e configurações**
Histórico de scans e ações com snapshots carregáveis e gráfico de linhas para comparar espaço revisável e espaço liberado. Configurações de aparência, limites, detectores, escopo, pastas ignoradas e local da quarentena.

**💬 Ajuda para decidir**
Pastas grandes, candidatos, duplicados e sobras de apps permitem copiar uma dúvida pronta com caminho, tamanho, data, categoria, motivo e contexto de segurança. Executáveis e bibliotecas compatíveis também podem ter a assinatura Authenticode verificada sob demanda.

**🔄 Atualização**
Verificação de updates no GitHub Releases com changelog, opção de lembrar depois e ignorar versão. No instalador, o download automático vem ativo por padrão — o reinício sempre exige confirmação. O portable usa fluxo assistido.

**🌐 Idioma**
Interface bilíngue em Português (Brasil) e English, configurável nas preferências.

## Segurança

- Itens sensíveis do Windows aparecem no mapa de uso, mas não entram como candidatos normais de limpeza.
- Se a descoberta de pacotes da Microsoft Store falhar, dados de aplicativos ficam bloqueados por padrão (fail closed).
- O inventário AppX é consultado uma vez por sessão e reutilizado durante a análise.
- Mover para quarentena preserva metadados para restauração completa.
- A exclusão permanente só acontece por ação explícita do usuário.
- Ações em lote podem solicitar a criação de um ponto de restauração do Windows quando o recurso estiver disponível.
- Movimentos, restaurações, exclusões e tentativas bloqueadas são registrados em `audit-log.jsonl` na pasta de dados do app.
- Updates não são aplicados durante scan ativo ou ações de quarentena em andamento.
- Configurações, histórico, snapshots e quarentena ficam na pasta local do usuário e não são apagados por updates ou uninstall.

> Quando origem e quarentena ficam em discos diferentes, pastas grandes podem ser bloqueadas para evitar cópia parcial seguida de remoção. Arquivos ainda podem ser movidos entre discos, mas passam por cópia temporária com verificação de tamanho antes da remoção da origem.

## Limites conhecidos

- O hash de duplicados só é calculado para grupos candidatos; arquivos bloqueados ou sem permissão podem ficar sem verificação.
- Algumas pastas em `ProgramData`, `Program Files` ou `Windows` podem exigir permissão de administrador.
- A tela de sobras de apps é conservadora e pode mostrar pastas que ainda pertencem a apps instalados.
- O auto-update do instalador depende de releases com `latest.yml` e `.blockmap` e da dependência `electron-updater` no build.
- O portable não substitui automaticamente o executável aberto; usa atualização assistida.
- Algumas mensagens de erro do sistema operacional podem aparecer no idioma original do Windows.

---

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

Os testes cobrem regras críticas de quarentena e a camada de tradução renderizada para evitar textos em Português quando a interface está em Inglês.

Também há regressões para proteção AppX, cache do inventário, Authenticode, tema do primeiro frame, overlays responsivos, scroll e textos copiados para tirar dúvidas.

### Build para Windows

```powershell
npm install
npm run dist
```

O instalador NSIS e o portable serão gerados em `release/`. Para gerar apenas o portable:

```powershell
npm run dist:portable
```

O setup instala em `%LOCALAPPDATA%\Programs\DiskSnoop` por usuário atual, sem pedir permissão de administrador.

### Publicar no GitHub Releases

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
   git tag v1.7.0
   git push origin v1.7.0
   ```
5. Anexe estes arquivos de `release/` na release do GitHub:
   - `DiskSnoop-Setup-1.7.0-x64.exe`
   - `DiskSnoop-Setup-1.7.0-x64.exe.blockmap`
   - `latest.yml`
   - `DiskSnoop-Portable-1.7.0-x64.exe`

> Versões intermediárias não precisam ser publicadas retroativamente. O `electron-updater` pode atualizar diretamente da 1.5.0 para a 1.7.0, desde que a release mais recente inclua `latest.yml`, o instalador e o arquivo `.blockmap` correspondentes.
