# Contexto

## Glossário

- **Plugin do OpenCode** — a unidade instalável carregada pelo OpenCode: um arquivo `.tsx` colocado em `~/.config/opencode/plugins/` e registrado no array `plugin` do `tui.json`. Aqui: `openrouter-cost.tsx`.

- **Widget** — a UI que o plugin renderiza na barra lateral do OpenCode (o bloco "OpenRouter: Session / Balance"). Plugin ≠ widget: o plugin instala; o widget renderiza.

- **Instalador** (CLI) — o bin `openrouter-costs.mjs`, distribuído como `npx opencode-openrouter-costs`. Copia o arquivo do plugin para `~/.config/opencode/plugins/`, configura o `tui.json`, garante as dependências SolidJS no `~/.config/opencode/package.json` e escreve a configuração de idioma.

- **Desinstalador** — a mesma CLI invocada com `--remove`. Reverte cada etapa que o instalador realizou.

- **Pacote npm** — a unidade de distribuição publicada no registry como `opencode-openrouter-costs@<versão>`. Contém `bin/`, `src/plugin/`, READMEs e LICENSE.

- **publish** — upload de uma versão para o registry npm. Ocorre via `release.yml` (workflow_dispatch) ou manualmente como fallback.

- **release** — o ciclo completo: bump de versão → tag → publish no npm → criação da página do GitHub Release. Disparado ao clicar em "Run workflow" no `release.yml`.

- **ci.yml** — workflow do GitHub Actions que roda `npm test` em todo PR para `main`. Node 24.

- **release.yml** — workflow do GitHub Actions disparado manualmente (botão "Run workflow"). Recebe a versão semver como campo de input, aplica o bump no `package.json`, cria tag anotada, publica no npm com `--provenance` e cria o GitHub Release com notas geradas automaticamente. Identidade: `github-actions[bot]`. Serializado via concurrency group (`release`).

- **NPM_TOKEN** — segredo do GitHub Actions. Token npm do tipo "Publish" (acesso Read & Write, bypassa 2FA para publish). NÃO usar tokens "Automation" — são apenas para staging (`E_STAGE_REQUIRED`).

- **npm install** — `npx opencode-openrouter-costs` (caminho principal).

- **source install** (GitHub) — `npx github:mhenrique94/opencode-openrouter-costs` (fallback para desenvolvedores instalando diretamente do repositório).

- **smoke test** — (1) dentro do pipeline: instala o pacote do registry real e executa o binário com `--yes --dry-run` em um HOME/prefixo temporal; se falhar, o GitHub Release não é criado. (2) manual post-release: `npm install -g opencode-openrouter-costs@<versão> && <tmpdir>/bin/opencode-openrouter-costs --yes --dry-run`, para verificar manualmente que o registry funciona.

- **idioma instalado** — `en` ou `pt`, persistido em `~/.config/opencode/openrouter-cost.json`.

## Autenticação OpenRouter

O plugin lê a chave da API do OpenRouter de:
1. Variável de ambiente `OPENROUTER_API_KEY` (preferencial).
2. `~/.local/share/opencode/auth.json` → `openrouter.key` (fallback).

Quando nenhuma chave é encontrada, o widget renderiza "not configured".

## Escopo

Este repositório contém um único plugin do OpenCode que adiciona um widget de custo/saldo do OpenRouter à barra lateral. Não é um framework de plugins genérico — o escopo é intencionalmente restrito.

## Carve-out de CI/CD: push para `main`

A regra do projeto "NUNCA commite ou pushe diretamente em `main`" se aplica a
agentes humanos e autônomos. **Exceção**: o workflow `release.yml` — e apenas
esse workflow — pusha o commit de bump e a tag em `main` como parte do
processo de release. Este é o único push automatizado para `main` no projeto.
O commit é criado por `github-actions[bot]` e sempre contém apenas uma
alteração de versão no `package.json`.
