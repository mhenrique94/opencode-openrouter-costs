# Spec — Plugin TUI `openrouter-cost` (widget de status no painel lateral)

**Data:** 2026-09-12
**Ámbito:** Config global do OpenCode (`~/.config/opencode/`) — **fora do repo HelpMed**.
**Estado:** PRONTO PARA IMPLEMENTAÇÃO (V1). Nada além do escopo V1.

---

## 1. Objetivo

O OpenCode TUI mostra, no painel lateral da **sessão** (a mesma coluna onde aparecem
"Servidores MCP" e "LSP"), um bloco de status **OpenRouter** com:

- **Gasto** — quanto a **sessão atual** consumiu (zera ao abrir uma nova aba/sessão).
- **Saldo** — crédito preparado restante da **conta** OpenRouter.

O plugin **não exige key extra**: lê automaticamente a mesma credencial que o usuário já
configura no OpenCode para acessar modelos do OpenRouter.

## 2. Vocabulário

Termos canônicos deste contexto. Não traduzir.

| Termo | Significado |
|---|---|
| **Gasto da sessão** | Soma dos custos das respostas do assistente na sessão ativa. Fonte: eventos `message.updated` (campo `cost`). Reseta ao criar nova sessão. |
| **Saldo** | Crédito pré-pago restante da conta (`total_credits − total_usage` do endpoint `/api/v1/credits` da OpenRouter). |
| **Key** | Chave de API da conta OpenRouter configurada no OpenCode (escopo `openrouter` do `auth.json`). |
| **TTL** | Tempo mínimo entre consultas do saldo à API (default 60s; configurável). |
| **Widget de status** | Bloco renderizado na slot `sidebar` do TUI, mesmo slot usado pelos plugins internos `MCP` e `LSP`. |
| **TUI plugin** | Forma de plugin que exporta `default { id, tui }` e roda no processo do TUI — **não** é um plugin de server. |

## 3. Diagnóstico do plugin atual (por que quebra)

O arquivo `~/.config/opencode/plugins/openrouter-cost.ts` está morto por **três causas independentes**:

1. **API inexistente**: usa `opencode.ui.createStatusItem` / `addStatusItem` com `section: 'mcp-lsp'`.
   Verificado no repo do OpenCode: essa API **não existe** (zero ocorrências). A API que de fato
   renderiza no painel lateral é a de **TUI plugin** (ver §4).
2. **Import errado**: `import { Plugin, StatusItem } from '@opencode/plugin'` — o pacote real é
   **`@opencode-ai/plugin`** (e não existe `StatusItem` lá).
3. **Config aponta para npm**: `opencode.jsonc` tem `"plugin": [..., "openrouter-cost"]`. O nome nu é
   resolvido como pacote npm (não existe `openrouter-cost` no npm), e TUI plugins **não são
   auto-descobertos** por diretório — precisam de entrada explícita no config.

O erro é **silencioso**: o módulo falha no import e o loader de server plugins fila módulos cujo
default export não é shape válido de server → nada é registrado e ninguém nota.

Observação verificada na máquina alvo: binária instalada é **1.18.30**; os tipos instalados
(`@opencode-ai/plugin` 1.14.43) estão **defasados** — alinhar antes de implementar (§7).

## 4. Como o painel lateral realmente funciona

- Os blocos "Servidor MCP" e "LSP" são **TUI plugins internos** do OpenCode
  (`internal:sidebar-mcp`, `internal:sidebar-lsp`), registrados na slot `sidebar_content` com
  `order` 200 e 300 (context=100, todo=400, files=500).
- Um plugin de usuário faz o mesmo: módulo `export default { id, tui }` onde
  `tui(api, options, meta)` usa `api.slots.register({ order, slots: { sidebar_content(_ctx, props) { return JSX } } })`.
  Para ficar **acima de MCP**, usar `order: 150`.
- **Restrições reais**:
  - O painel lateral **só existe na view de sessão** (não na home) — igual ao MCP/LSP.
  - Arquivos TUI **não são carregados automaticamente** do diretório `plugins/`; precisam de
    entrada explícita em `plugin:` do **`tui.json`** (não do `opencode.jsonc`).
  - Um módulo não pode exportar `tui` e `server` juntos — aqui só interessa `tui`.
- **API de slots (conforme `@opencode-ai/plugin` 1.18.30)**:
  - `api.slots.register({ order, slots: { sidebar_content(_ctx, props) } })` — `props` tem `{ session_id: string }`.
  - `api.state.session.get(sessionID)` → `Session | undefined` (campo `cost?: number` no v2).
  - `api.state.session.messages(sessionID)` → `ReadonlyArray<Message>` (union `UserMessage | AssistantMessage`; `AssistantMessage` tem `cost: number`).
  - `api.event.on("message.updated", handler)` → retorna `() => void` (unsub).
  - `api.lifecycle.onDispose(fn)` → registra cleanup no dispose do plugin.
  - JSX usa `<box>`, `<text>`, `<b>` do `@opentui/solid`;theme via `api.theme.current`.

## 5. Comportamento especificado (V1)

### 5.1 Layout

Bloco compacto no topo do sidebar da sessão (acima de "Servidor MCP"), no estilo dos itens internos:

```
OpenRouter            ← cabeçalho, estilo de título de seção
Sessão: $0.0523       ← gasto da sessão atual (até 3 casas decimais)
Saldo: $4.21          ← saldo da conta (exatamente 2 casas decimais)
```

- Nova aba/sessão → `Sessão: $0.00`.
- Saldo ainda carregando: `Saldo: …`; falhou: `Saldo: —` (nunca quebra o bloco, não queima a UI).

### 5.2 Fontes de dados

| Dado | Fonte | Como |
|---|---|---|
| Gasto da sessão | eventos do TUI | Soma dos `cost` dos eventos `message.updated` da sessão ativa. Para robustez com troca de aba, a cada update a re-soma a sessão ativa (via `state.session.messages(sessionID)` somando `cost` das `AssistantMessage` com `time.completed`). |
| Saldo | `GET https://openrouter.ai/api/v1/credits` (Bearer key) | `saldo = total_credits − total_usage`, 2 casas; negativo → `$0.00`. |
| Key | `auth.json` do OpenCode | `~/.local/share/opencode/auth.json` → escopo `openrouter` → `key`. Fallback: env `OPENROUTER_API_KEY`. |

Nota verificada empiricamente (chave **comum**, `is_management_key: false`):

- `/api/v1/credits` respondeu **200** com `{ data: { total_credits: 5.0, total_usage: 0.79 } }`
  (a doc da OpenRouter cita "só management key", mas na prática a chave comum funciona).
- A implementação deve tratar **403 como degradação** (`Saldo: —`), caso uma conta futura recuse.

### 5.3 Cadência

- **Gasto da sessão**: atualiza **na hora** a cada `message.updated`.
- **Saldo**: consulta à API **somente** quando o **TTL** (default 60s) expirou **ou** ao abrir a
  sessão/primeira render. Não chamar a API a cada mensagem (o saldo mudasta devagar; e a chamada tem custo e latência).

### 5.4 Estados de erro (o plugin nunca deixa de carregar)

| Situação | Widget |
|---|---|
| Sem key (OpenRouter não configurado) | bloco `OpenRouter não configurado` (dica: configurar via `/models`); `console.warn`. |
| Falha de rede/403 na leitura do saldo | `Saldo: —`; gasto continuo atualzindo (não depende de rede). |
| Sessão sem respostas ainda | `Sessão: $0.00` |

## 6. Arquivos e mudanças de config

Global (`~/.config/opencode/`), fora do repo.

| Arquivo | Ação |
|---|---|
| `plugins/openrouter-cost.ts` | Deletar (diagnóstico §3). |
| `plugins/openrouter-cost.tsx` | Criar — o TUI plugin (§8.1). |
| `tui.json` | Criar — lista `plugin:` com `"./plugins/openrouter-cost.tsx"` (§8.2). **Não** usar `opencode.jsonc` (server-only). |
| `opencode.jsonc` | Remover qualquer referência a `openrouter-cost` da lista `plugin:`. |
| `package.json` | Ajustar deps e versão de tipos (§7). |

## 7. Pré-requisitos: alinhar tipos e dependências de runtime

```sh
opencode --version                          # esperado ≥ 1.18.30
cat ~/.config/opencode/package.json         # versão atual de @opencode-ai/plugin
```

### 7.1 Pacotes obrigatórios em `~/.config/opencode/package.json`

Um plugin `.tsx` que usa JSX Solid **não funciona** sem as dependências de runtime. O loader
faz `import()` dinâmico — se `solid-js` ou `@opentui/solid` não estão no `node_modules` do
config dir, o import falha silenciosamente e o plugin simplesmente não aparece (sem erro
visível no boot).

```jsonc
{
  "dependencies": {
    "@opencode-ai/plugin": "<versão-da-binária>",
    "@opentui/solid": "<versão-da-binária>",
    "solid-js": "1.9.12"
  }
}
```

| Pacote | Papel | De onde tirar a versão |
|---|---|---|
| `@opencode-ai/plugin` | Tipos `TuiPlugin`, `TuiPluginApi`, slots, event bus. **Importar de `@opencode-ai/plugin/tui`** (subpath), não de `@opencode-ai/plugin`. | Mesma versão da binária (`opencode --version`) |
| `@opentui/solid` | Runtime JSX (`@jsxImportSource`) — biblioteca que o SolidJS usa para renderizar no terminal | `peerDependencies` do `@opentui/solid` no npm; versão alinhada com a binária |
| `solid-js` | Framework reativo (SolidJS) — `createSignal`, `onCleanup`, etc. | `peerDependencies` de `@opentui/solid` (atualmente `1.9.12`) |

**Por que é obrigatório:** os plugins internos usam `solid-js` embutido na binária. Plugins
externos resolvidos via `file://` são importados pelo Bun embutido da binária, mas as
dependências são resolvidas no `node_modules` do diretório de config — não no da binária.
Logo, `solid-js` e `@opentui/solid` precisam estar instalados ali.

### 7.2 Como alinhar

```sh
cd ~/.config/opencode
# Atualizar @opencode-ai/plugin para a versão da binária
# e instalar solid-js + @opentui/solid (peer deps)
npm install @opencode-ai/plugin@<versão> @opentui/solid@<versão> solid-js@1.9.12
```

> **Cuidado:** `@opentui/core` (dependência de `@opentui/solid`) exige Bun ≥ 1.3 ou
> Node ≥ 26. O Bun embutido da binária satisfaz isso; o `npm install` gera warnings
> de engine que podem ser ignorados.

## 8. Implementação

### 8.1 Arquivo `plugins/openrouter-cost.tsx`

- Extensão `.tsx`, não `.ts`: o loader de server **auto-descoberto** de `plugins/` só varre
  `.ts`/`.js`; o `.tsx` evita loading duplicado pelo server (o TUI carrega via config explícita).

```tsx
/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createSignal, onCleanup } from "solid-js"
import { readFile } from "fs/promises"
import { homedir } from "os"
import { join } from "path"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const DEFAULT_TTL_MS = 60_000

async function readKey(): Promise<string | null> {
  const envKey = process.env.OPENROUTER_API_KEY
  if (envKey) return envKey
  try {
    const authPath = join(homedir(), ".local", "share", "opencode", "auth.json")
    const raw = await readFile(authPath, "utf-8")
    const auth = JSON.parse(raw)
    return auth?.openrouter?.key ?? null
  } catch { return null }
}

function View(props: { api: TuiPluginApi; session_id: string; key: string | null }) {
  const theme = () => props.api.theme.current
  const session = () => props.api.state.session.get(props.session_id)
  const sessionCost = () => session()?.cost ?? 0

  const [balance, setBalance] = createSignal<string | null>(null)
  let lastFetch = 0, fetching = false, disposed = false

  async function fetchBalance() {
    if (!props.key || disposed || fetching) return
    fetching = true
    try {
      const res = await fetch("https://openrouter.ai/api/v1/credits", {
        headers: { Authorization: `Bearer ${props.key}` },
      })
      if (!res.ok) { if (!disposed) setBalance(null); return }
      const json = await res.json()
      const remaining = Math.max(0, (json?.data?.total_credits ?? 0) - (json?.data?.total_usage ?? 0))
      if (!disposed) { setBalance(money.format(remaining)); lastFetch = Date.now() }
    } catch { if (!disposed) setBalance(null) }
    finally { fetching = false }
  }

  function maybeRefresh() { if (Date.now() - lastFetch >= DEFAULT_TTL_MS) fetchBalance() }

  fetchBalance()
  const unsub = props.api.event.on("message.updated", () => maybeRefresh())
  onCleanup(() => { disposed = true; unsub() })

  if (!props.key) {
    return (<box>
      <text fg={theme().text}><b>OpenRouter</b></text>
      <text fg={theme().warning}>não configurado</text>
    </box>)
  }

  return (<box>
    <text fg={theme().text}><b>OpenRouter</b></text>
    <text fg={theme().textMuted}>Sessão: {money.format(sessionCost())}</text>
    <text fg={theme().textMuted}>Saldo: {balance() ?? "…"}</text>
  </box>)
}

const tui: TuiPlugin = async (api) => {
  const key = await readKey()
  if (!key) console.warn("OpenRouter Cost Plugin: no key found. Configure via /models or set OPENROUTER_API_KEY.")
  api.slots.register({
    order: 150,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} key={key} />
      },
    },
  })
}

export default { id: "openrouter-cost", tui }
```

Fato importante: endpoint e shapes validados; toda falha no saldo cai em `Saldo: —`.

### 8.2 Config

**TUI plugins** vão em `~/.config/opencode/tui.json` (ou `tui.jsonc`), **não** em `opencode.jsonc`.
O `plugin:` do `opencode.jsonc` é exclusivamente para server plugins — lá o loader valida
`export default { server() }` e rejeita módulos TUI.

`~/.config/opencode/tui.json`:

```json
{
  "plugin": [
    "./plugins/openrouter-cost.tsx"
  ]
}
```

`~/.config/opencode/opencode.jsonc` — **não** adicionar o plugin aqui:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "openslimedit@latest"
    // openrouter-cost.tsx NÃO entra aqui — é server-only
  ],
  // demais chaves intocadas
}
```

## 9. Verificação

O implementador entrega, e o humano deve **fechar e reabrir** o OpenCode (config/plugins carrega
apenas no boot; não há hot-reload).

1. Reiniciar e abrir uma **sessão** (widget só aparece na view de sessão).
2. Ver bloco **acima de MCP Servers**:
   - `Sessão: $0.00` que cresce a cada resposta.
   - `Saldo: $4.21` (com a key do usuário em `auth.json`; sem TTL violado).
3. Abrir nova aba (nova sessão) → `Sessão: $0.00` (zera).
4. Remover key / apontar env inválida → `Saldo: —`; widget não quebra.
5. `opencode` boot sem mensagens de falha do plugin (`DEPRECATED`/`Failed to load plugin`
   relacionados ao `openrouter-cost`).

## 10. Riscos

- **API de TUI plugin é a própria**, mas tipada em `@opencode-ai/plugin`; muda entre versões
  (a doc pública só documenta server plugins). Mitigação: alinhar tipos com a binária (§7) e manter
  o widget simples.
- **Dependências de runtime invisíveis:** `solid-js` e `@opentui/solid` são peer deps que não
  vêm no `package.json` do config por default. Sem elas o `import()` falha silenciosamente e o
  plugin some sem erro. Mitigação: §7.1 documenta os três pacotes obrigatórios.
- `/credits` pode passar a restritor keys regulares futuramente → degradação `—` cobre.
- `plugin:` exige arquivo local — quem clona a config global do usuário precisa saber o caminho.

## 11. Assinatura final

- Após a implementação: fechar/abrir o OpenCode e conferir. Nenhuma chave em env; nenhum arquivo
  do repo HelpMed tocado (tudo ocorre em `~/.config/opencode/`). O único artefato no repo é esta spec.