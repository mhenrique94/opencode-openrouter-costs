#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, unlinkSync } from "fs"
import { join, dirname } from "path"
import { homedir } from "os"
import { createInterface } from "readline"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const CONFIG_DIR = join(homedir(), ".config", "opencode")
const PLUGINS_DIR = join(CONFIG_DIR, "plugins")
const PLUGIN_NAME = "openrouter-cost.tsx"
const PLUGIN_DEST = join(PLUGINS_DIR, PLUGIN_NAME)
const PLUGIN_REL = `./plugins/${PLUGIN_NAME}`
const TUI_JSON = join(CONFIG_DIR, "tui.json")
const PKG_JSON = join(CONFIG_DIR, "package.json")
const PLUGIN_SRC = join(__dirname, "..", "src", "plugin", PLUGIN_NAME)
const LANG_JSON = join(CONFIG_DIR, "openrouter-cost.json")

const DEPS = {
  "@opentui/solid": "0.5.11",
  "solid-js": "1.9.12",
}

const MESSAGES = {
  en: {
    banner: "OpenRouter Cost Plugin — installer for OpenCode\n",
    steps: (plugin, pluginsDir, tuiJson, pkgJson) =>
      [
        "What will happen:",
        `  1. Copy ${plugin} → ${pluginsDir}/`,
        `  2. Add entry to ${tuiJson} (plugin)`,
        `  3. Ensure @opentui/solid + solid-js in ${pkgJson}`,
      ].join("\n"),
    requirements: "Requirements: OpenCode >= 1.18.30 with OpenRouter provider configured\n",
    confirm: "Install? [y/N] ",
    copying: "1. Copying plugin...",
    copied: "Copied.",
    identical: "Plugin already exists and is identical — skip.",
    existsPrompt: "   Plugin already exists; overwrite? [y/N] ",
    existsYes: "Overwritten.",
    existsSkip: "Skip.",
    updatingTui: "2. Updating tui.json...",
    addedTui: (plugin) => `Added ${plugin} to plugin array.`,
    tuiExists: "Entry already exists — skip.",
    addingDeps: "3. Ensuring dependencies in package.json...",
    depsAdded: "Dependencies added.",
    depsExists: "Dependencies already present — skip.",
    skippedDeps: "Skipping dependencies (--no-deps).",
    success: [
      "",
      "Plugin installed! Restart OpenCode and open a session.",
      'The widget appears in the sidebar above "MCP Servers".',
      "",
      'If OpenRouter is not configured, the widget shows "not configured".',
      "Configure via /models or set OPENROUTER_API_KEY.",
    ].join("\n"),
    dryRun: (from, to) => `[dry-run] Would copy ${from} → ${to}`,
    bannerRemove: "OpenRouter Cost Plugin — Uninstaller\n",
    confirmRemove: "Remove plugin? [y/N] ",
    removingPlugin: "1. Removing plugin...",
    removedPlugin: "Removed.",
    pluginNotFound: "Plugin not found — skip.",
    removingTui: "2. Removing from tui.json...",
    removedTui: "Removed.",
    tuiNotFound: "tui.json not found or no plugin array — skip.",
    removingDeps: "3. Removing dependencies...",
    removedDeps: "Dependencies removed.",
    depsNotFound: "Dependencies not found — skip.",
    successRemove: "Plugin removed. Restart OpenCode.",
    cancelled: "Cancelled.",
  },
  pt: {
    banner: "OpenRouter Cost Plugin — instalador para OpenCode\n",
    steps: (plugin, pluginsDir, tuiJson, pkgJson) =>
      [
        "O que será feito:",
        `  1. Copiar ${plugin} → ${pluginsDir}/`,
        `  2. Adicionar entrada em ${tuiJson} (plugin)`,
        `  3. Garantir @opentui/solid + solid-js em ${pkgJson}`,
      ].join("\n"),
    requirements: "Requisitos: OpenCode >= 1.18.30 com provider OpenRouter configurado\n",
    confirm: "Instalar? [y/N] ",
    copying: "1. Copiando plugin...",
    copied: "Copiado.",
    identical: "Plugin já existe e é idêntico — skip.",
    existsPrompt: "   Plugin já existe; reescrever? [y/N] ",
    existsYes: "Reescrito.",
    existsSkip: "Skip.",
    updatingTui: "2. Atualizando tui.json...",
    addedTui: (plugin) => `Adicionado ${plugin} ao plugin array.`,
    tuiExists: "Entrada já existe — skip.",
    addingDeps: "3. Garantindo dependências em package.json...",
    depsAdded: "Dependências adicionadas.",
    depsExists: "Dependências já presentes — skip.",
    skippedDeps: "Pulando dependências (--no-deps).",
    success: [
      "",
      "Plugin instalado! Reinicie o OpenCode e abra uma sessão.",
      'O widget aparece no sidebar acima de "Servidor MCP".',
      "",
      'Se o OpenRouter não estiver configurado, o widget mostra "não configurado".',
      "Configure via /models ou setando OPENROUTER_API_KEY.",
    ].join("\n"),
    dryRun: (from, to) => `[dry-run] Copiaria ${from} → ${to}`,
    bannerRemove: "OpenRouter Cost Plugin — Desinstalador\n",
    confirmRemove: "Remover plugin? [y/N] ",
    removingPlugin: "1. Removendo plugin...",
    removedPlugin: "Removido.",
    pluginNotFound: "Plugin não encontrado — skip.",
    removingTui: "2. Removendo de tui.json...",
    removedTui: "Removido.",
    tuiNotFound: "tui.json não encontrado ou sem plugin array — skip.",
    removingDeps: "3. Removendo dependências...",
    removedDeps: "Dependências removidas.",
    depsNotFound: "Dependências não encontradas — skip.",
    successRemove: "Plugin removido. Reinicie o OpenCode.",
    cancelled: "Cancelado.",
  },
}

function timestamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function backup(filePath) {
  if (!existsSync(filePath)) return
  const bak = `${filePath}.bak-${timestamp()}`
  copyFileSync(filePath, bak)
}

function readJson(filePath) {
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"))
  } catch {
    return null
  }
}

function writeJson(filePath, data) {
  backup(filePath)
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8")
}

function confirm(rl, message) {
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      resolve(/^(y|yes)$/i.test(answer.trim()))
    })
  })
}

function readLangFromConfig() {
  const data = readJson(LANG_JSON)
  if (data?.lang === "pt") return "pt"
  if (data?.lang === "en") return "en"
  return null
}

function writeLangConfig(lang) {
  const data = { lang }
  if (existsSync(LANG_JSON)) {
    backup(LANG_JSON)
  }
  writeFileSync(LANG_JSON, JSON.stringify(data, null, 2) + "\n", "utf-8")
}

function deleteLangConfig() {
  if (existsSync(LANG_JSON)) {
    unlinkSync(LANG_JSON)
  }
}

async function promptLang(rl) {
  console.log("OpenRouter Cost Plugin\n")
  console.log("Choose your language / Escolha o idioma:\n")
  console.log("  [1] English   ← Enter = default")
  console.log("  [2] Português (BR)\n")
  const answer = await new Promise((resolve) => {
    rl.question("> ", (a) => resolve(a.trim()))
  })
  if (answer === "2") return "pt"
  if (answer === "1" || answer === "") return "en"
  console.log("Invalid choice — defaulting to English.\n")
  return "en"
}

async function install(opts) {
  if (!existsSync(CONFIG_DIR)) {
    console.error("Execute `opencode` pelo menos uma vez primeiro.")
    process.exit(1)
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  // 1. Define language
  let lang
  if (opts.lang) {
    if (opts.lang !== "en" && opts.lang !== "pt") {
      console.warn(`Invalid --lang "${opts.lang}". Defaulting to English.\n`)
      lang = "en"
    } else {
      lang = opts.lang
    }
  } else if (opts.yes) {
    lang = readLangFromConfig() || "en"
  } else {
    lang = await promptLang(rl)
  }

  const msg = MESSAGES[lang]

  // 2. Verify config dir
  if (!existsSync(CONFIG_DIR)) {
    console.error("Execute `opencode` pelo menos uma vez primeiro.")
    process.exit(1)
  }

  // 3. Banner
  console.log(msg.banner)
  console.log(msg.steps(PLUGIN_NAME, PLUGINS_DIR, TUI_JSON, PKG_JSON) + "\n")
  console.log(msg.requirements)

  if (!opts.yes) {
    const ok = await confirm(rl, msg.confirm)
    if (!ok) {
      console.log(msg.cancelled)
      rl.close()
      return
    }
  }

  // Step 1: Copy plugin
  console.log(`\n${msg.copying}`)
  if (!opts.dryRun) {
    if (!existsSync(PLUGINS_DIR)) {
      mkdirSync(PLUGINS_DIR, { recursive: true })
    }
    if (existsSync(PLUGIN_DEST)) {
      const existing = readFileSync(PLUGIN_DEST, "utf-8")
      const source = readFileSync(PLUGIN_SRC, "utf-8")
      if (existing === source) {
        console.log(msg.identical)
      } else {
        if (!opts.yes) {
          const overwrite = await confirm(rl, msg.existsPrompt)
          if (!overwrite) {
            console.log(msg.existsSkip)
          } else {
            backup(PLUGIN_DEST)
            copyFileSync(PLUGIN_SRC, PLUGIN_DEST)
            console.log(msg.existsYes)
          }
        } else {
          backup(PLUGIN_DEST)
          copyFileSync(PLUGIN_SRC, PLUGIN_DEST)
          console.log(msg.existsYes)
        }
      }
    } else {
      copyFileSync(PLUGIN_SRC, PLUGIN_DEST)
      console.log(msg.copied)
    }
  } else {
    console.log(msg.dryRun(PLUGIN_SRC, PLUGIN_DEST))
  }

  // Step 2: Update tui.json
  console.log(`\n${msg.updatingTui}`)
  const tuiData = readJson(TUI_JSON) || {}
  const plugins = Array.isArray(tuiData.plugin) ? tuiData.plugin : []
  if (!plugins.includes(PLUGIN_REL)) {
    if (!opts.dryRun) {
      plugins.push(PLUGIN_REL)
      tuiData.plugin = plugins
      writeJson(TUI_JSON, tuiData)
      console.log(`   ${msg.addedTui(PLUGIN_REL)}`)
    } else {
      console.log(`   ${msg.dryRun(PLUGIN_REL, TUI_JSON)}`)
    }
  } else {
    console.log(`   ${msg.tuiExists}`)
  }

  // Step 3: Add deps to package.json
  if (!opts.noDeps) {
    console.log(`\n${msg.addingDeps}`)
    const pkgData = readJson(PKG_JSON) || {}
    if (!pkgData.dependencies) pkgData.dependencies = {}
    let added = false
    for (const [name, version] of Object.entries(DEPS)) {
      if (!pkgData.dependencies[name]) {
        if (!opts.dryRun) {
          pkgData.dependencies[name] = version
          added = true
        } else {
          console.log(`   [dry-run] Would add ${name}@${version}`)
        }
      }
    }
    if (!opts.dryRun) {
      if (added) {
        writeJson(PKG_JSON, pkgData)
        console.log(`   ${msg.depsAdded}`)
      } else {
        console.log(`   ${msg.depsExists}`)
      }
    }
  } else {
    console.log(`\n${msg.skippedDeps}`)
  }

  // Step 4: Write lang config
  if (!opts.dryRun) {
    writeLangConfig(lang)
  }

  rl.close()

  console.log(msg.success)
}

async function uninstall(opts) {
  if (!existsSync(CONFIG_DIR)) {
    console.error("Execute `opencode` pelo menos uma vez primeiro.")
    process.exit(1)
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  // 1. Read language from config; default en
  const lang = readLangFromConfig() || "en"
  const msg = MESSAGES[lang]

  console.log(msg.bannerRemove)

  if (!opts.yes) {
    const ok = await confirm(rl, msg.confirmRemove)
    if (!ok) {
      console.log(msg.cancelled)
      rl.close()
      return
    }
  }

  // Step 1: Remove plugin file
  console.log(`\n${msg.removingPlugin}`)
  if (existsSync(PLUGIN_DEST)) {
    if (!opts.dryRun) {
      unlinkSync(PLUGIN_DEST)
      console.log(`   ${msg.removedPlugin}`)
    } else {
      console.log(`   [dry-run] Would remove ${PLUGIN_DEST}`)
    }
  } else {
    console.log(`   ${msg.pluginNotFound}`)
  }

  // Step 2: Remove from tui.json
  console.log(`\n${msg.removingTui}`)
  const tuiData = readJson(TUI_JSON)
  if (tuiData && Array.isArray(tuiData.plugin)) {
    const idx = tuiData.plugin.indexOf(PLUGIN_REL)
    if (idx !== -1) {
      if (!opts.dryRun) {
        backup(TUI_JSON)
        tuiData.plugin.splice(idx, 1)
        if (tuiData.plugin.length === 0) {
          delete tuiData.plugin
        }
        writeJson(TUI_JSON, tuiData)
        console.log(`   ${msg.removedTui}`)
      } else {
        console.log(`   [dry-run] Would remove ${PLUGIN_REL} from plugin array.`)
      }
    } else {
      console.log(`   ${msg.tuiNotFound}`)
    }
  } else {
    console.log(`   ${msg.tuiNotFound}`)
  }

  // Step 3: Remove deps from package.json
  console.log(`\n${msg.removingDeps}`)
  const pkgData = readJson(PKG_JSON)
  if (pkgData && pkgData.dependencies) {
    let removed = false
    for (const name of Object.keys(DEPS)) {
      if (pkgData.dependencies[name]) {
        if (!opts.dryRun) {
          delete pkgData.dependencies[name]
          removed = true
        } else {
          console.log(`   [dry-run] Would remove ${name}`)
        }
      }
    }
    if (!opts.dryRun && removed) {
      writeJson(PKG_JSON, pkgData)
      console.log(`   ${msg.removedDeps}`)
    } else if (!removed) {
      console.log(`   ${msg.depsNotFound}`)
    }
  } else {
    console.log(`   ${msg.depsNotFound}`)
  }

  // Step 4: Remove lang config
  if (!opts.dryRun) {
    deleteLangConfig()
  }

  rl.close()

  console.log(`\n${msg.successRemove}`)
}

// --- CLI ---
const args = process.argv.slice(2)
const flags = {
  yes: args.includes("--yes") || args.includes("-y"),
  dryRun: args.includes("--dry-run"),
  noDeps: args.includes("--no-deps"),
  remove: args.includes("--remove"),
}

// Parse --lang en|pt
let langFlag = null
const langIdx = args.indexOf("--lang")
if (langIdx !== -1 && args[langIdx + 1]) {
  langFlag = args[langIdx + 1]
}

if (flags.remove) {
  uninstall(flags).catch((err) => {
    console.error(err)
    process.exit(1)
  })
} else {
  install({ ...flags, lang: langFlag }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
