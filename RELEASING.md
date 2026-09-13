# RELEASING

Manual release playbook for `opencode-openrouter-costs`. Step 1 validated this
playbook end-to-end. Step 2 (automated CI) is documented in the "Future: CI"
section at the end of this file.

---

## Prerequisites

- `npm login` completed (username: `mhenrique94`).
- `gh` CLI authenticated.
- Tests pass: `node --test test/**/*.test.mjs`.
- Working tree clean on `main`.

## Step 1 — Pre-flight

```sh
npm pack --dry-run
```

Confirm the tarball includes exactly 6 files:
`bin/openrouter-costs.mjs`, `src/plugin/openrouter-cost.tsx`,
`README.md`, `README.pt-BR.md`, `LICENSE`, `package.json`.

## Step 2 — Smoke test: tarball

```sh
npm pack
# Install into a temporary HOME
tmpdir=$(mktemp -d)
npm install -g ./opencode-openrouter-costs-*.tgz --prefix "$tmpdir"
"$tmpdir/bin/opencode-openrouter-costs" --yes --dry-run
```

Verify the dry-run output shows:
- Plugin file copied
- `tui.json` updated
- Dependencies ensured
- `openrouter-cost.json` written

If any check fails, do not publish. Fix the issue, bump the version, and
repeat from Step 1.

## Step 3 — Publish

```sh
npm publish
```

This uploads `opencode-openrouter-costs@<version>` to the registry.

## Step 4 — Smoke test: registry

```sh
tmpdir=$(mktemp -d)
npx opencode-openrouter-costs@latest --yes --dry-run --prefix "$tmpdir"
```

The output should be identical to the tarball smoke test. This is the
proof that "From npm" works as the README promises.

## Step 5 — Tag and release

```sh
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z" --notes "..."
```

Release notes should include:
- What the plugin does
- `npx opencode-openrouter-costs` command
- Link to npm page: `https://www.npmjs.com/package/opencode-openrouter-costs`

## Step 6 — Rotate credentials

The npm token used for this release should be **revoked and replaced**
if it was ever exposed (e.g. pasted in a chat session, stored in CI
logs, or committed to the repo).

---

## Versioning

This project follows semver. The initial release is `0.1.0`. Pre-1.0
versions can break anything without a major bump. When the plugin is
stable enough for general use, bump to `1.0.0`.

---

## Future: CI (Step 2 — to be implemented after Step 1 is validated)

The goal is a GitHub Actions workflow that:
1. Triggers on `v*` tag push.
2. Checks out `main` at the tag commit.
3. Runs `npm test`.
4. Runs `npm pack --dry-run` (content verification).
5. Publishes to npm with `--provenance` (supply-chain attestation).
6. Creates a GitHub Release with auto-generated notes.

### Secrets required (GitHub repo Settings → Secrets → Actions)

| Secret | Purpose |
|---|---|
| `NPM_TOKEN` | npm token with publish scope on `opencode-openrouter-costs`. Created via `npm token create --type=automation` (does not require 2FA at publish time). |

### Security constraints

- **2FA**: The npm account `mhenrique94` must have 2FA enabled. Automation
  tokens bypass 2FA for publish but the account itself must be protected.
- **Token scope**: The `NPM_TOKEN` should be created as an *automation*
  token (not a legacy token) to avoid 2FA prompts during CI publish.
- **Provenance**: `npm publish --provenance` generates an SLSA provenance
  attestation linking the published package to the exact Git commit and
  build. This is a free supply-chain hardening step.
- **No token in logs**: The workflow must mask the token. GitHub Actions
  does this by default for secrets, but double-check with `::add-mask::`.

### Draft workflow (reference, not executable)

```yaml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write  # for npm --provenance
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: npm test
      - run: npm pack --dry-run
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      - run: gh release create ${{ github.ref_name }} --generate-notes
        env:
          GH_TOKEN: ${{ github.token }}
```
