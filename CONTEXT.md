# Context

## Glossary

- **OpenCode plugin** — the installable unit loaded by OpenCode: a `.tsx` file placed in `~/.config/opencode/plugins/` and registered in `tui.json`'s `plugin` array. Here: `openrouter-cost.tsx`.

- **widget** — the UI the plugin renders in the OpenCode sidebar (the "OpenRouter: Session / Balance" block). Plugin ≠ widget: the plugin installs; the widget renders.

- **Installer** (CLI) — the bin `openrouter-costs.mjs`, distributed as `npx opencode-openrouter-costs`. Copies the plugin file into `~/.config/opencode/plugins/`, wires `tui.json`, ensures the SolidJS dependencies in `~/.config/opencode/package.json`, and writes the language config.

- **Uninstaller** — the same CLI invoked with `--remove`. Reverses every step the installer performed.

- **npm package** — the distribution unit published to the registry as `opencode-openrouter-costs@<version>`. Contains `bin/`, `src/plugin/`, READMEs, and LICENSE.

- **publish** — uploading a tagged version to the npm registry.

- **release** — publish + git tag `v<semver>` + GitHub Release page.

- **npm install** — `npx opencode-openrouter-costs` (the primary path).

- **source install** (GitHub) — `npx github:mhenrique94/opencode-openrouter-costs` (fallback for developers installing from the repo directly).

- **smoke test** — pre-publish validation (install the packed tarball into a temporary HOME) and post-publish validation (`npx opencode-openrouter-costs@<version>` from the real registry).

- **installed language** — `en` or `pt`, persisted in `~/.config/opencode/openrouter-cost.json`.

## OpenRouter Auth

The plugin reads the OpenRouter API key from:
1. `OPENROUTER_API_KEY` environment variable (preferred).
2. `~/.local/share/opencode/auth.json` → `openrouter.key` (fallback).

When no key is found, the widget renders "not configured".

## Scope

This repository contains a single OpenCode plugin that adds an OpenRouter cost/balance widget to the sidebar. It is not a general-purpose plugin framework — the scope is narrow and intentionally so.
