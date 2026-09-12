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

const DEPS = {
  "@opentui/solid": "0.5.11",
  "solid-js": "1.9.12",
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

async function install(opts) {
  if (!existsSync(CONFIG_DIR)) {
    console.error("Execute `opencode` pelo menos uma vez primeiro.")
    process.exit(1)
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  console.log("OpenRouter Cost Plugin — Instalador para OpenCode\n")
  console.log("O que será feito:")
  console.log(`  1. Copiar ${PLUGIN_NAME} → ${PLUGINS_DIR}/`)
  console.log(`  2. Adicionar entrada em ${TUI_JSON} (plugin)`)
  console.log(`  3. Garantir @opentui/solid + solid-js em ${PKG_JSON}`)
  console.log("\nRequisitos: OpenCode >= 1.18.30 com provider OpenRouter configurado\n")

  if (!opts.yes) {
    const ok = await confirm(rl, "Instalar? [y/N] ")
    if (!ok) {
      console.log("Cancelado.")
      rl.close()
      return
    }
  }

  // Step 1: Copy plugin
  console.log(`\n1. Copiando plugin...`)
  if (!opts.dryRun) {
    if (!existsSync(PLUGINS_DIR)) {
      mkdirSync(PLUGINS_DIR, { recursive: true })
    }
    if (existsSync(PLUGIN_DEST)) {
      const existing = readFileSync(PLUGIN_DEST, "utf-8")
      const source = readFileSync(PLUGIN_SRC, "utf-8")
      if (existing === source) {
        console.log("   Plugin já existe e é idêntico — skip.")
      } else {
        if (!opts.yes) {
          const overwrite = await confirm(rl, "   Plugin já existe; reescrever? [y/N] ")
          if (!overwrite) {
            console.log("   Skip.")
          } else {
            backup(PLUGIN_DEST)
            copyFileSync(PLUGIN_SRC, PLUGIN_DEST)
            console.log("   Reescrito.")
          }
        } else {
          backup(PLUGIN_DEST)
          copyFileSync(PLUGIN_SRC, PLUGIN_DEST)
          console.log("   Reescrito.")
        }
      }
    } else {
      copyFileSync(PLUGIN_SRC, PLUGIN_DEST)
      console.log("   Copiado.")
    }
  } else {
    console.log(`   [dry-run] Copiaria ${PLUGIN_SRC} → ${PLUGIN_DEST}`)
  }

  // Step 2: Update tui.json
  console.log(`\n2. Atualizando tui.json...`)
  const tuiData = readJson(TUI_JSON) || {}
  const plugins = Array.isArray(tuiData.plugin) ? tuiData.plugin : []
  if (!plugins.includes(PLUGIN_REL)) {
    if (!opts.dryRun) {
      plugins.push(PLUGIN_REL)
      tuiData.plugin = plugins
      writeJson(TUI_JSON, tuiData)
      console.log(`   Adicionado ${PLUGIN_REL} ao plugin array.`)
    } else {
      console.log(`   [dry-run] Adicionaria ${PLUGIN_REL} ao plugin array.`)
    }
  } else {
    console.log(`   Entrada já existe — skip.`)
  }

  // Step 3: Add deps to package.json
  if (!opts.noDeps) {
    console.log(`\n3. Garantindo dependências em package.json...`)
    const pkgData = readJson(PKG_JSON) || {}
    if (!pkgData.dependencies) pkgData.dependencies = {}
    let added = false
    for (const [name, version] of Object.entries(DEPS)) {
      if (!pkgData.dependencies[name]) {
        if (!opts.dryRun) {
          pkgData.dependencies[name] = version
          added = true
        } else {
          console.log(`   [dry-run] Adicionaria ${name}@${version}`)
        }
      }
    }
    if (!opts.dryRun) {
      if (added) {
        writeJson(PKG_JSON, pkgData)
        console.log(`   Dependências adicionadas.`)
      } else {
        console.log(`   Dependências já presentes — skip.`)
      }
    }
  } else {
    console.log(`\n3. Pulando dependências (--no-deps).`)
  }

  rl.close()

  console.log(`
Plugin instalado! Reinicie o OpenCode e abra uma sessão.
O widget aparece no sidebar acima de "Servidor MCP".

Se o OpenRouter não estiver configurado, o widget mostra "não configurado".
Configure via /models ou setando OPENROUTER_API_KEY.`)
}

async function uninstall(opts) {
  if (!existsSync(CONFIG_DIR)) {
    console.error("Execute `opencode` pelo menos uma vez primeiro.")
    process.exit(1)
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  console.log("OpenRouter Cost Plugin — Desinstalador\n")

  if (!opts.yes) {
    const ok = await confirm(rl, "Remover plugin? [y/N] ")
    if (!ok) {
      console.log("Cancelado.")
      rl.close()
      return
    }
  }

  // Step 1: Remove plugin file
  console.log(`\n1. Removendo plugin...`)
  if (existsSync(PLUGIN_DEST)) {
    if (!opts.dryRun) {
      unlinkSync(PLUGIN_DEST)
      console.log("   Removido.")
    } else {
      console.log(`   [dry-run] Removeria ${PLUGIN_DEST}`)
    }
  } else {
    console.log("   Plugin não encontrado — skip.")
  }

  // Step 2: Remove from tui.json
  console.log(`\n2. Removendo de tui.json...`)
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
        console.log("   Removido.")
      } else {
        console.log(`   [dry-run] Removeria ${PLUGIN_REL} do plugin array.`)
      }
    } else {
      console.log("   Entrada não encontrada — skip.")
    }
  } else {
    console.log("   tui.json não encontrado ou sem plugin array — skip.")
  }

  // Step 3: Remove deps from package.json
  console.log(`\n3. Removendo dependências...`)
  const pkgData = readJson(PKG_JSON)
  if (pkgData && pkgData.dependencies) {
    let removed = false
    for (const name of Object.keys(DEPS)) {
      if (pkgData.dependencies[name]) {
        if (!opts.dryRun) {
          delete pkgData.dependencies[name]
          removed = true
        } else {
          console.log(`   [dry-run] Removeria ${name}`)
        }
      }
    }
    if (!opts.dryRun && removed) {
      writeJson(PKG_JSON, pkgData)
      console.log("   Dependências removidas.")
    } else if (!removed) {
      console.log("   Dependências não encontradas — skip.")
    }
  } else {
    console.log("   package.json não encontrado — skip.")
  }

  rl.close()

  console.log("\nPlugin removido. Reinicie o OpenCode.")
}

// --- CLI ---
const args = process.argv.slice(2)
const flags = {
  yes: args.includes("--yes") || args.includes("-y"),
  dryRun: args.includes("--dry-run"),
  noDeps: args.includes("--no-deps"),
  remove: args.includes("--remove"),
}

if (flags.remove) {
  uninstall(flags).catch((err) => {
    console.error(err)
    process.exit(1)
  })
} else {
  install(flags).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
