# Context

## Glossary

- **OpenCode plugin** — the installable unit loaded by OpenCode: a `.tsx` file placed in `~/.config/opencode/plugins/` and registered in `tui.json`'s `plugin` array. Here: `openrouter-cost.tsx`.

- **widget** — the UI the plugin renders in the OpenCode sidebar (the "OpenRouter: Session / Balance" block). Plugin ≠ widget: the plugin installs; the widget renders.

- **Installer** (CLI) — the bin `openrouter-costs.mjs`, distributed as `npx opencode-openrouter-costs`. Copies the plugin file into `~/.config/opencode/plugins/`, wires `tui.json`, ensures the SolidJS dependencies in `~/.config/opencode/package.json`, and writes the language config.

- **Uninstaller** — the same CLI invoked with `--remove`. Reverses every step the installer performed.

- **npm package** — the distribution unit published to the registry as `opencode-openrouter-costs@<version>`. Contains `bin/`, `src/plugin/`, READMEs, and LICENSE.

- **publish** — uploading a version to the npm registry. Happens via `release.yml` (workflow_dispatch) or manually as a fallback.

- **release** — the full cycle: bump version → tag → publish to npm → create GitHub Release page. Triggered by clicking "Run workflow" on `release.yml`.

- **ci.yml** — GitHub Actions workflow that runs `npm test` on every PR to `main`. Node 24.

- **release.yml** — GitHub Actions workflow triggered manually ("Run workflow" button). Bumps patch version (0.0.1), creates annotated tag, publishes to npm with `--provenance`, creates GitHub Release with auto-generated notes. Identity: `github-actions[bot]`. Serialized via concurrency group (`release`).

- **auto-bump (on release)** — version increment happens only when you click "Run workflow" on `release.yml`. Merges to `main` do NOT bump the version. Patch-only (0.0.1).

- **NPM_TOKEN** — GitHub Actions secret. npm token with "Publish" type (Read & Write access, bypasses 2FA for publish). Do NOT use "Automation" tokens — they are staging-only (`E_STAGE_REQUIRED`).

- **npm install** — `npx opencode-openrouter-costs` (the primary path).

- **source install** (GitHub) — `npx github:mhenrique94/opencode-openrouter-costs` (fallback for developers installing from the repo directly).

- **smoke test** — (1) pre-publish: `npm pack --dry-run` verifying 6 files, run by `release.yml` automatically. (2) post-publish: `npm install -g opencode-openrouter-costs@<version> && <tmpdir>/bin/opencode-openrouter-costs --yes --dry-run`, run manually to verify the registry works.

- **installed language** — `en` or `pt`, persisted in `~/.config/opencode/openrouter-cost.json`.

## OpenRouter Auth

The plugin reads the OpenRouter API key from:
1. `OPENROUTER_API_KEY` environment variable (preferred).
2. `~/.local/share/opencode/auth.json` → `openrouter.key` (fallback).

When no key is found, the widget renders "not configured".

## Scope

This repository contains a single OpenCode plugin that adds an OpenRouter cost/balance widget to the sidebar. It is not a general-purpose plugin framework — the scope is narrow and intentionally so.

## CI/CD carve-out: push to `main`

The project rule "NEVER commit or push directly to `main`" applies to
human agents and autonomous agents. **Exception**: the `release.yml`
workflow — and only that workflow — pushes a version-bump commit and
tag to `main` as part of the release process. This is the only
automated push to `main` in the project. The commit is authored by
`github-actions[bot]` and always contains only a `package.json` version
change.
