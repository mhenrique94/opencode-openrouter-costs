# RELEASING

Manual release playbook for `opencode-openrouter-costs`. Step 1 validated
end-to-end with v0.1.0. CI automation is documented in the "Future: CI"
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
- Plugin file copied (or "Copiaria" in dry-run)
- `tui.json` updated
- Dependencies ensured
- Success message ("Plugin installed!")

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
npm install -g opencode-openrouter-costs@<version> --prefix "$tmpdir"
"$tmpdir/bin/opencode-openrouter-costs" --yes --dry-run
```

Note: `npx` may not resolve the binary correctly right after publish.
Use `npm install -g` + direct invocation instead. The output should be
identical to the tarball smoke test. This is the proof that "From npm"
works as the README promises.

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

**Always rotate after a release.** The token used for publish should be
revoked and replaced. Steps:

1. Go to https://npmjs.com/settings/tokens
2. Revoke the token used for this release
3. Create a new **"Publish"** type token with Read & Write access
4. Update `NPM_TOKEN` in GitHub Actions secrets: `gh secret set NPM_TOKEN --body "<new-token>"`

Do not use "Automation" type tokens — they are staging-only and cannot
publish packages that don't already exist.

---

## Versioning

This project follows semver. The initial release is `0.1.0`. Pre-1.0
versions can break anything without a major bump. When the plugin is
stable enough for general use, bump to `1.0.0`.

---

## Future: CI (to be implemented)

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
| `NPM_TOKEN` | npm token with publish scope on `opencode-openrouter-costs`. Created as a **"Publish"** type token at https://npmjs.com/settings/tokens (bypasses 2FA for publish). Do NOT use "Automation" tokens — they are staging-only. |

### Security constraints

- **2FA**: The npm account `mhenrique94` must have 2FA enabled. Automation
  tokens bypass 2FA for publish but the account itself must be protected.
- **Token scope**: The `NPM_TOKEN` should be created as a **"Publish"**
  type token at https://npmjs.com/settings/tokens with Read & Write
  access. "Automation" tokens are staging-only and will fail with
  `E_STAGE_REQUIRED` on new packages.
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
