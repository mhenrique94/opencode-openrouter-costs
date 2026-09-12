/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createSignal, onCleanup } from "solid-js"
import { readFile } from "fs/promises"
import { homedir } from "os"
import { join } from "path"

type Lang = "en" | "pt"

const LABELS = {
  en: {
    session: "Session",
    balance: "Balance",
    notConfigured: "not configured",
    loading: "…",
  },
  pt: {
    session: "Sessão",
    balance: "Saldo",
    notConfigured: "não configurado",
    loading: "…",
  },
} as const

function t(lang: Lang, key: keyof (typeof LABELS)["en"]): string {
  return LABELS[lang]?.[key] ?? LABELS.en[key]
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const DEFAULT_TTL_MS = 60_000

async function readKey(): Promise<string | null> {
  const envKey = process.env.OPENROUTER_API_KEY
  if (envKey) return envKey

  try {
    const authPath = join(homedir(), ".local", "share", "opencode", "auth.json")
    const raw = await readFile(authPath, "utf-8")
    const auth = JSON.parse(raw)
    return auth?.openrouter?.key ?? null
  } catch {
    return null
  }
}

async function readLang(): Promise<Lang> {
  try {
    const configPath = join(homedir(), ".config", "opencode", "openrouter-cost.json")
    const raw = await readFile(configPath, "utf-8")
    const config = JSON.parse(raw)
    if (config?.lang === "pt") return "pt"
    if (config?.lang === "en") return "en"
    return "en"
  } catch {
    return "en"
  }
}

function View(props: { api: TuiPluginApi; session_id: string; key: string | null; lang: Lang }) {
  const theme = () => props.api.theme.current
  const session = () => props.api.state.session.get(props.session_id)
  const sessionCost = () => session()?.cost ?? 0

  const [balance, setBalance] = createSignal<string | null>(null)
  let lastFetch = 0
  let fetching = false
  let disposed = false

  async function fetchBalance() {
    if (!props.key || disposed || fetching) return
    fetching = true
    try {
      const res = await fetch("https://openrouter.ai/api/v1/credits", {
        headers: { Authorization: `Bearer ${props.key}` },
      })
      if (!res.ok) {
        if (!disposed) setBalance(null)
        return
      }
      const json = await res.json()
      const total = json?.data?.total_credits ?? 0
      const used = json?.data?.total_usage ?? 0
      const remaining = Math.max(0, total - used)
      if (!disposed) {
        setBalance(money.format(remaining))
        lastFetch = Date.now()
      }
    } catch {
      if (!disposed) setBalance(null)
    } finally {
      fetching = false
    }
  }

  function maybeRefresh() {
    if (Date.now() - lastFetch >= DEFAULT_TTL_MS) {
      fetchBalance()
    }
  }

  fetchBalance()

  const unsub = props.api.event.on("message.updated", () => {
    maybeRefresh()
  })

  onCleanup(() => {
    disposed = true
    unsub()
  })

  if (!props.key) {
    return (
      <box>
        <text fg={theme().text}>
          <b>OpenRouter</b>
        </text>
        <text fg={theme().warning}>{t(props.lang, "notConfigured")}</text>
      </box>
    )
  }

  return (
    <box>
      <text fg={theme().text}>
        <b>OpenRouter</b>
      </text>
      <text fg={theme().textMuted}>{t(props.lang, "session")}: {money.format(sessionCost())}</text>
      <text fg={theme().textMuted}>
        {t(props.lang, "balance")}: {balance() ?? t(props.lang, "loading")}
      </text>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  const [key, lang] = await Promise.all([readKey(), readLang()])
  if (!key) {
    console.warn("OpenRouter Cost Plugin: no key found. Configure via /models or set OPENROUTER_API_KEY.")
  }

  api.slots.register({
    order: 150,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} key={key} lang={lang} />
      },
    },
  })
}

export default {
  id: "openrouter-cost",
  tui,
}
