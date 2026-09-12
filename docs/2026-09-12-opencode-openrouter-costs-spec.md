# Spec — `opencode-openrouter-costs`

**Data:** 2026-09-12
**Autor:** Marcelo (mhenrique94)
**Estado:** PRONTO PARA IMPLEMENTAÇÃO (V1)

---

## 1. Visão geral

Pacote distribuível (GitHub + npm futuro) que instala um **TUI plugin** no OpenCode:
um widget no sidebar da sessão que mostra gasto da sessão e saldo da conta OpenRouter.

O usuario roda `npx github:mhenrique94/opencode-openrouter-costs` (hoje) ou
`npx opencode-openrouter-costs` (pós-publish) e, após consentimento + reinício do
OpenCode, o widget aparece acima de "Servidor MCP".

---

## 2. Decisões fixadas (grilling)

| Item | Decisão |
|---|---|
| **Repo GitHub** | `mhenrique94/opencode-openrouter-costs` (público) |
| **Pacote npm** (futuro) | `opencode-openrouter-costs` (mesmo repo, publish depois) |
| **Bin / instalador** | `opencode-openrouter-costs` → `npx github:mhenrique94/opencode-openrouter-costs` |
| **Id interno do widget** | `openrouter-cost` (aparece no TUI/kv) |
| **`engines.opencode`** | `>=1.18.30` (range suportado; gate só ativa pós-publish) |
| **Config alvo** | `~/.config/opencode/tui.json` → `plugin: ["./plugins/openrouter-cost.tsx"]` |
| **Deps de runtime** | `@opentui/solid` + `solid-js` no `package.json` do config — opencode instala no boot (`Npm.install` em `loadInstanceState`, `packages/opencode/src/config/config.ts`) |
| **Escopo V1** | Widget + instalador (install/uninstall); sem skill de terceiros; sem publish npm |
| **Publico/privado** | Público (pré-requisito para `npx github:...`) |
| **Uninstall** | V1 obrigatório (`--remove`) |

---

## 3. Inicialização do repo

```sh
# caso já não esteja no diretório que o projeto 'opencode-openrouter-costs' será inicializado:
cd /home/marcelo/Github/opencode-openrouter-costs
# caso esteja:
git init
# Seguir os passos de §6-§7 para criar os arquivos
gh repo create mhenrique94/opencode-openrouter-costs --public --source . --push
```

---

## 4. Estrutura do repo

```
opencode-openrouter-costs/
├── package.json              # name, version, bin, engines, files
├── README.md                 # o que é, 2 formas de instalar, requisitos, compat
├── LICENSE                   # MIT
├── .gitignore                # node_modules, dist
├── src/
│   └── plugin/
│       └── openrouter-cost.tsx   # fonte canônica do widget
├── bin/
│   └── openrouter-costs.mjs     # instalador (Node stdlib, zero deps)
└── docs/
    ├── 2026-09-12-openrouter-costs-plugin.md   # spec base (temp, remover no commit)
    └── 2026-09-12-opencode-openrouter-costs-spec.md  # esta spec
```

---

## 5. `package.json`

```json
{
  "name": "opencode-openrouter-costs",
  "version": "0.1.0",
  "description": "OpenCode TUI plugin — sidebar widget showing OpenRouter session cost and account balance",
  "license": "MIT",
  "author": "Marcelo (mhenrique94)",
  "repository": {
    "type": "git",
    "url": "https://github.com/mhenrique94/opencode-openrouter-costs.git"
  },
  "bin": {
    "opencode-openrouter-costs": "./bin/openrouter-costs.mjs"
  },
  "engines": {
    "node": ">=18",
    "opencode": ">=1.18.30"
  },
  "files": [
    "bin/",
    "src/plugin/",
    "README.md",
    "LICENSE"
  ],
  "keywords": [
    "opencode",
    "opencode-plugin",
    "tui",
    "openrouter",
    "cost",
    "balance",
    "widget",
    "sidebar"
  ]
}
```

**Nota:** o `bin` é o único campo que o npx usa. Sem `dependencies` — o
instalador é zero-deps (Node stdlib).

---

## 6. Widget — comportamento (V1)

### 6.1 Layout

Bloco compacto no topo do sidebar da sessão (acima de "Servidor MCP"):

```
OpenRouter            ← cabeçalho
Sessão: $0.0523       ← gasto da sessão atual (até 3 casas)
Saldo: $4.21          ← saldo da conta (exatamente 2 casas)
```

- Nova sessão → `Sessão: $0.00`.
- Saldo carregando: `Saldo: …`; falhou: `Saldo: —`.

### 6.2 Fontes de dados

| Dado | Fonte | Como |
|---|---|---|
| Gasto da sessão | eventos TUI | Soma dos `cost` das `AssistantMessage` via `state.session.messages(sessionID)`, atualizado em tempo real a cada `message.updated` |
| Saldo | `GET https://openrouter.ai/api/v1/credits` | `saldo = total_credits − total_usage`; negativo → `$0.00` |
| Key | `OPENROUTER_API_KEY` ou `~/.local/share/opencode/auth.json` → `openrouter.key` | sem key → `não configurado` |

### 6.3 Cadência

- **Gasto**: atualiza a cada `message.updated`.
- **Saldo**: TTL 60s — não chama API a cada mensagem.

### 6.4 Estados de erro

| Situação | Widget |
|---|---|
| Sem key | `OpenRouter` / `não configurado` |
| Falha rede/403 | `Saldo: —`; gasto continua |
| Sessão sem respostas | `Sessão: $0.00` |

### 6.5 Referência do código

A fonte canônica é `src/plugin/openrouter-cost.tsx` — copie do plugin atual
que já funciona (`~/.config/opencode/plugins/openrouter-cost.tsx`), preservando:
`order: 150`, `@jsxImportSource @opentui/solid`, `TuiPluginApi`, `createSignal`,
`onCleanup`, `readKey`, `fetchBalance`, `maybeRefresh`.

---

## 7. Instalador (`bin/openrouter-costs.mjs`)

### 7.1 Mecanismo

Node.js, zero deps (stdlib). Usa `readline` para consentimento.
Detecta o config dir (`~/.config/opencode/`) — se não existe, aborta com
mensagem "Execute `opencode` pelo menos uma vez primeiro."

### 7.2 Mutações (com consentimento)

O instalador faz **3 mutações**, todas append-only/idempotentes:

1. **Cópia do plugin**: `src/plugin/openrouter-cost.tsx` → `~/.config/opencode/plugins/openrouter-cost.tsx`
   - Se já existe e é idêntico → skip. Se diferente → "plugin já existe; reescrever? [y/N]"
   - `.tsx` evita double-load pelo server (glob `*.{ts,js}`).

2. **`tui.json` → `plugin[]`**: cria ou edita `~/.config/opencode/tui.json`.
   - Se não existe → cria `{"plugin":["./plugins/openrouter-cost.tsx"]}`
   - Se existe → insere `"./plugins/openrouter-cost.tsx"` no array `plugin` (se não presente)
   - **Append-only**: nunca remove nada do array; só adiciona a entrada se faltar
   - Backup com timestamp antes de qualquer escrita: `tui.json.bak-YYYYMMDDHHMMSS`

3. **`package.json` → deps**: garante `@opentui/solid` + `solid-js` no `~/.config/opencode/package.json`.
   - Se já presentes → skip
   - Se faltam → adiciona ao objeto `dependencies` (não toca em nada mais)
   - Backup com timestamp antes de qualquer escrita
   - **Não roda `npm install`** — o próprio OpenCode instala no boot (`Npm.install` em `loadInstanceState`; verificado em `packages/opencode/src/config/config.ts:453`)

### 7.3 Flags

| Flag | Efeito |
|---|---|
| `--yes` / `-y` | Pula confirmação interativa |
| `--dry-run` | Mostra o que faria sem escrever nada |
| `--no-deps` | Pula a etapa 3 (deps) — para quem gerencia manual |
| `--remove` | **Uninstall** (ver §8) |

### 7.4 Fluxo interativo padrão

```
OpenRouter Cost Plugin — Instalador para OpenCode

O que será feito:
  1. Copiar openrouter-cost.tsx → ~/.config/opencode/plugins/
  2. Adicionar entrada em ~/.config/opencode/tui.json (plugin)
  3. Garantir @opentui/solid + solid-js em ~/.config/opencode/package.json

Requisitos: OpenCode >= 1.18.30 com provider OpenRouter configurado

Instalar? [y/N]
```

### 7.5 Mensagem final

```
Plugin instalado! Reinicie o OpenCode e abra uma sessão.
O widget aparece no sidebar acima de "Servidor MCP".

Se o OpenRouter não estiver configurado, o widget mostra "não configurado".
Configure via /models ou setando OPENROUTER_API_KEY.
```

---

## 8. Uninstall (`--remove`)

Reverte **apenas** o que o instalador criou, sem tocar em nada mais:

1. Remove `~/.config/opencode/plugins/openrouter-cost.tsx`
2. Remove `"./plugins/openrouter-cost.tsx"` do array `plugin` em `tui.json`
   - Se o array ficar vazio → remove o campo `plugin` inteiro
   - Backup com timestamp antes de escrever
3. Remove `@opentui/solid` e `solid-js` do `package.json` (só se foram adicionados pelo instalador — ie. não existiam antes)
   - Backup com timestamp antes de escrever
   - **Não remove `@opencode-ai/plugin`** (opencode adiciona automaticamente)
4. Mensagem: "Plugin removido. Reinicie o OpenCode."

---

## 9. Duas formas de instalar (pós-publish)

| Caminho | Comando | Funciona |
|---|---|---|
| **GitHub** (hoje) | `npx github:mhenrique94/opencode-openrouter-costs` | Sem precisar publicar no npm |
| **npm** (depois) | `npx opencode-openrouter-costs` | Após `npm publish` do mesmo repo |

Ambos rodam o mesmo `bin/openrouter-costs.mjs`. O repo é a única fonte.

---

## 10. Verificação

1. Reiniciar OpenCode e abrir uma **sessão** (widget só aparece na view de sessão).
2. Ver bloco acima de "Servidores MCP":
   - `Sessão: $0.00` que cresce a cada resposta.
   - `Saldo: $X.XX` (se key configurada).
3. Nova sessão → `Sessão: $0.00` (zera).
4. Sem key → `não configurado`; widget não quebra.
5. `--dry-run` mostra mutações sem escrever.
6. `--remove` reverte tudo; reiniciar OpenCode → widget some.
7. `opencode` boot sem mensagens de falha do plugin.

---

## 11. Fora de escopo (próximos passos)

- **Publish npm**: `npm publish` do mesmo repo; atualizar `README.md` com `npx opencode-openrouter-costs`.
- **Skill de terceiros**: o plugin NÃO inclui a skill `.claude/skills/openrouter-cost-controls` (Jeremy Longshore, MIT) — são coisas distintas.
- **Compatibilidade com forks do OpenCode**: `engines.opencode >= 1.18.30` protege; forks que mantiverem a API do TUI plugin funcionam.
