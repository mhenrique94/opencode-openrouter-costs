import { describe, it, before, after, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { execFile } from "child_process"
import { promisify } from "util"

const exec = promisify(execFile)
const BIN = join(import.meta.dirname, "..", "bin", "openrouter-costs.mjs")

async function runInstaller(args = [], env = {}) {
  const result = await exec(process.execPath, [BIN, ...args], {
    env: { ...process.env, HOME: env.HOME || tmpdir(), ...env },
    timeout: 10_000,
  })
  return result
}

describe("openrouter-costs installer", () => {
  let tempHome

  before(() => {
    tempHome = mkdtempSync(join(tmpdir(), "oc-test-"))
  })

  after(() => {
    rmSync(tempHome, { recursive: true, force: true })
  })

  describe("install", () => {
    let configDir

    beforeEach(() => {
      configDir = join(tempHome, ".config", "opencode")
      rmSync(configDir, { recursive: true, force: true })
      mkdirSync(configDir, { recursive: true })
    })

    it("creates plugin file", async () => {
      await runInstaller(["--yes"], { HOME: tempHome })
      const pluginDest = join(configDir, "plugins", "openrouter-cost.tsx")
      assert.ok(existsSync(pluginDest), "plugin file should exist")
      const content = readFileSync(pluginDest, "utf-8")
      assert.ok(content.includes("openrouter-cost"), "plugin should contain id")
    })

    it("creates tui.json with plugin entry", async () => {
      await runInstaller(["--yes"], { HOME: tempHome })
      const tuiPath = join(configDir, "tui.json")
      assert.ok(existsSync(tuiPath), "tui.json should exist")
      const tui = JSON.parse(readFileSync(tuiPath, "utf-8"))
      assert.ok(Array.isArray(tui.plugin), "plugin should be array")
      assert.ok(tui.plugin.includes("./plugins/openrouter-cost.tsx"), "plugin entry should exist")
    })

    it("adds deps to package.json", async () => {
      await runInstaller(["--yes"], { HOME: tempHome })
      const pkgPath = join(configDir, "package.json")
      assert.ok(existsSync(pkgPath), "package.json should exist")
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
      assert.ok(pkg.dependencies["@opentui/solid"], "@opentui/solid should be in deps")
      assert.ok(pkg.dependencies["solid-js"], "solid-js should be in deps")
    })

    it("is idempotent — running twice does not duplicate", async () => {
      await runInstaller(["--yes"], { HOME: tempHome })
      await runInstaller(["--yes"], { HOME: tempHome })
      const tui = JSON.parse(readFileSync(join(configDir, "tui.json"), "utf-8"))
      const count = tui.plugin.filter((p) => p === "./plugins/openrouter-cost.tsx").length
      assert.equal(count, 1, "should have exactly one plugin entry")
    })

    it("--dry-run does not write files", async () => {
      await runInstaller(["--yes", "--dry-run"], { HOME: tempHome })
      assert.ok(!existsSync(join(configDir, "plugins", "openrouter-cost.tsx")), "plugin should not exist")
      assert.ok(!existsSync(join(configDir, "tui.json")), "tui.json should not exist")
    })

    it("--no-deps skips dependency step", async () => {
      await runInstaller(["--yes", "--no-deps"], { HOME: tempHome })
      assert.ok(!existsSync(join(configDir, "package.json")), "package.json should not exist")
      assert.ok(existsSync(join(configDir, "plugins", "openrouter-cost.tsx")), "plugin should exist")
    })
  })

  describe("uninstall", () => {
    let configDir

    beforeEach(async () => {
      configDir = join(tempHome, ".config", "opencode")
      mkdirSync(configDir, { recursive: true })
      await runInstaller(["--yes"], { HOME: tempHome })
    })

    it("removes plugin file", async () => {
      await runInstaller(["--remove", "--yes"], { HOME: tempHome })
      assert.ok(!existsSync(join(configDir, "plugins", "openrouter-cost.tsx")), "plugin should be removed")
    })

    it("removes plugin entry from tui.json", async () => {
      await runInstaller(["--remove", "--yes"], { HOME: tempHome })
      const tui = JSON.parse(readFileSync(join(configDir, "tui.json"), "utf-8"))
      assert.ok(!tui.plugin?.includes("./plugins/openrouter-cost.tsx"), "plugin entry should be removed")
    })

    it("removes deps from package.json", async () => {
      await runInstaller(["--remove", "--yes"], { HOME: tempHome })
      const pkg = JSON.parse(readFileSync(join(configDir, "package.json"), "utf-8"))
      assert.ok(!pkg.dependencies?.["@opentui/solid"], "@opentui/solid should be removed")
      assert.ok(!pkg.dependencies?.["solid-js"], "solid-js should be removed")
    })

    it("--dry-run does not modify files", async () => {
      await runInstaller(["--remove", "--yes", "--dry-run"], { HOME: tempHome })
      assert.ok(existsSync(join(configDir, "plugins", "openrouter-cost.tsx")), "plugin should still exist")
      const tui = JSON.parse(readFileSync(join(configDir, "tui.json"), "utf-8"))
      assert.ok(tui.plugin.includes("./plugins/openrouter-cost.tsx"), "plugin entry should still exist")
    })
  })

  describe("error handling", () => {
    it("exits with error if config dir does not exist", async () => {
      const emptyHome = mkdtempSync(join(tmpdir(), "oc-empty-"))
      try {
        await assert.rejects(() => runInstaller(["--yes"], { HOME: emptyHome }))
      } finally {
        rmSync(emptyHome, { recursive: true, force: true })
      }
    })
  })
})
