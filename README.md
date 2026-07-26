# DiskSnoop

> Aplicativo para Windows que mostra o que está ocupando espaço no SSD ou HD e permite revisar os itens antes de qualquer exclusão definitiva.

![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows\&logoColor=white)
![GitHub release](https://img.shields.io/github/v/release/Fish7w7/DiskSnoop)
![GitHub releases](https://img.shields.io/github/downloads/Fish7w7/DiskSnoop/total)

## Download

[**Baixar a versão mais recente**](https://github.com/Fish7w7/DiskSnoop/releases/latest)

Na página da release, escolha:

* **Setup** — instalador recomendado.
* **Portable** — versão que funciona sem instalação.

> ⚠️ O aplicativo não possui assinatura de código. O Windows pode exibir um aviso de aplicativo desconhecido ao abrir o instalador ou a versão portable.

> Requer Windows 10 ou superior em sistema 64 bits.

---

<!-- Adicione um screenshot ou GIF do app aqui. Exemplo:
![DiskSnoop em uso](docs/screenshot.png)
-->

## O que ele faz

O DiskSnoop analisa seus discos, classifica pastas e arquivos por tamanho, explica por que cada item apareceu e move candidatos para a **quarentena** antes da remoção definitiva.

Nenhum arquivo encontrado durante a análise é excluído automaticamente.

## Recursos

### ✨ Interface e aparência

Cinco temas disponíveis: Claro, Escuro, Papel, Grafite e Sistema.

A cor de destaque pode ser escolhida separadamente do tema, entre opções prontas ou uma cor personalizada.

As telas de Pastas Grandes, Arquivos Grandes, Candidatos, Duplicados e Sobras de Apps exibem detalhes em um painel sobreposto, sem tirar o usuário da lista principal.

### 🔍 Análise de disco

O scanner funciona em um processo separado e permite acompanhar o progresso, pausar ou cancelar a análise.

Os resultados incluem:

* ranking das maiores pastas;
* lista de arquivos grandes;
* duração da análise;
* quantidade de itens encontrados;
* arquivos e pastas que não puderam ser acessados.

### 🧹 Limpeza inteligente

O DiskSnoop identifica possíveis candidatos de limpeza, como:

* `node_modules`;
* `.venv`;
* `dist` e `build`;
* caches;
* instaladores antigos;
* downloads antigos;
* logs e arquivos temporários.

Arquivos duplicados são comparados por nome, tamanho e conteúdo.

A busca por sobras de aplicativos analisa pastas comuns do Windows com uma abordagem conservadora.

### 🗂️ Quarentena

Os itens selecionados podem ser movidos para uma quarentena antes da exclusão definitiva.

Enquanto estiverem na quarentena, eles podem ser restaurados para o local original. A exclusão permanente sempre exige confirmação do usuário.

Para pastas grandes, é recomendado manter a quarentena no mesmo disco para evitar cópias demoradas.

### 📋 Histórico e configurações

O histórico registra análises e ações realizadas no aplicativo.

Também é possível carregar resultados anteriores e acompanhar o espaço identificado e liberado ao longo do tempo.

As configurações permitem ajustar:

* aparência;
* limites de tamanho;
* tipos de detecção;
* locais analisados;
* pastas ignoradas;
* localização da quarentena.

### 💬 Ajuda para decidir

Pastas grandes, candidatos, duplicados e sobras de aplicativos permitem copiar um resumo com informações como caminho, tamanho, data, categoria e motivo da detecção.

Isso facilita pesquisar ou pedir ajuda antes de remover um item desconhecido.

Executáveis e bibliotecas compatíveis também podem ter a assinatura digital verificada.

### 🔄 Atualizações

O DiskSnoop verifica novas versões pelo GitHub Releases e exibe o changelog antes da atualização.

No instalador, o download automático pode ser feito pelo próprio aplicativo, mas o reinício sempre exige confirmação.

A versão portable utiliza um processo de atualização assistida.

### 🌐 Idiomas

A interface está disponível em:

* Português do Brasil;
* Inglês.

O idioma pode ser alterado nas configurações.

## Segurança

* Arquivos e pastas sensíveis do Windows podem aparecer no mapa de uso, mas não entram normalmente como candidatos de limpeza.
* Nenhum item detectado pela análise é excluído automaticamente.
* A exclusão permanente sempre exige uma ação explícita do usuário.
* Itens movidos para a quarentena mantêm as informações necessárias para restauração.
* Ações em lote podem oferecer a criação de um ponto de restauração do Windows quando o recurso estiver disponível.
* Atualizações não são aplicadas durante uma análise ou enquanto ações de quarentena estão em andamento.
* Configurações, histórico e quarentena não são removidos durante atualizações normais do aplicativo.

> Quando a origem e a quarentena estão em discos diferentes, pastas muito grandes podem ser bloqueadas para evitar uma cópia incompleta. Arquivos menores podem ser movidos entre discos com verificação antes da remoção da origem.

## Limites conhecidos

* Arquivos bloqueados ou sem permissão podem não ser analisados completamente.
* Algumas pastas em `ProgramData`, `Program Files` ou `Windows` podem exigir permissão de administrador.
* A detecção de sobras de aplicativos é conservadora e pode mostrar pastas que ainda pertencem a programas instalados.
* A versão portable não consegue substituir automaticamente o executável enquanto ele estiver aberto.
* Algumas mensagens de erro do Windows podem aparecer no idioma original do sistema.

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

O instalador NSIS e o portable serão gerados em `release/`.

Para gerar apenas o portable:

```powershell
npm run dist:portable
```

O instalador é colocado em `%LOCALAPPDATA%\Programs\DiskSnoop` para o usuário atual, sem exigir permissão de administrador.

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
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

5. Anexe os seguintes arquivos da pasta `release/`:

   * `DiskSnoop-Setup-X.Y.Z-x64.exe`
   * `DiskSnoop-Setup-X.Y.Z-x64.exe.blockmap`
   * `latest.yml`
   * `DiskSnoop-Portable-X.Y.Z-x64.exe`

> O `electron-updater` pode atualizar diretamente de uma versão antiga para a mais recente, desde que a release inclua o instalador, o `latest.yml` e o `.blockmap` correspondentes.
