# RELEASING

Automated release playbook for `opencode-openrouter-costs`.

---

## How it works

Every PR merge to `main` runs tests in CI. To ship a release:

1. Click **"Run workflow"** on the [Release workflow](https://github.com/mhenrique94/opencode-openrouter-costs/actions/workflows/release.yml).
2. The pipeline: bumps patch version → creates tag → publishes to npm → creates GitHub Release.

That's it.

### What the pipeline does (release.yml)

1. Runs `npm test` (guardrail).
2. Runs `npm pack --dry-run` (guardrail: 6 files).
3. Bumps `package.json` to the next patch version (0.0.1 increment).
4. Checks the registry — aborts if the version already exists.
5. Commits the bump + creates annotated tag as `github-actions[bot]`.
6. Pushes commit + tag to `main`.
7. Publishes to npm with `--provenance` (SLSA attestation).
8. Creates GitHub Release with auto-generated notes.

### What the pipeline does NOT do

- Does **not** bump `main` automatically on every merge (version bump happens only at the button click).
- Does **not** support minor/major bumps via the pipeline. For minor/major: run `npm version minor` / `npm version major` locally, then push the tag (`git push origin vX.Y.Z`). The tag push triggers `release.yml` only if tag-triggered — but with the current `workflow_dispatch` trigger, you would dispatch manually after pushing the tag. In practice: this project is patch-only; minor/major are extremely unlikely.
- Does **not** rotate the npm token.

---

## Prerequisites

- `NPM_TOKEN` set in GitHub Actions secrets (current token: created via npmjs.com "Publish" type, bypasses 2FA).
- `gh` CLI authenticated (for local debugging only; not needed for the pipeline).

---

## Steps

### 1. Merge your PR to main

Tests run via `ci.yml`. Merge is unrestricted (no branch protection).

### 2. Click "Run workflow"

Go to https://github.com/mhenrique94/opencode-openrouter-costs/actions/workflows/release.yml → click **"Run workflow"** → select `main` → click the green button.

### 3. Verify

- **npm**: `npm view opencode-openrouter-costs version` returns the new version.
- **GitHub Release**: `gh release list` shows the new release.
- **Registry smoke test**: `tmpdir=$(mktemp -d) && npm install -g opencode-openrouter-costs@<version> --prefix "$tmpdir" && "$tmpdir/bin/opencode-openrouter-costs" --yes --dry-run`

---

## Manual fallback

If the pipeline is down (GitHub Actions outage), you can release manually:

```sh
npm test
npm pack --dry-run
npm version patch
git push origin main --follow-tags
npm publish
gh release create vX.Y.Z --generate-notes
```

---

## Rotate credentials

**Always rotate after a release.** Steps:

1. Go to https://npmjs.com/settings/tokens
2. Revoke the token used for this release
3. Create a new **"Publish"** type token with Read & Write access
4. Update `NPM_TOKEN` in GitHub Actions secrets: `gh secret set NPM_TOKEN --body "<new-token>"`

Do not use "Automation" type tokens — they are staging-only and cannot
publish packages that don't already exist.

---

## Versioning

Semver (see CONTEXT.md glossary). Bump policy:

- **Patch only via pipeline** — `release.yml` runs `npm version patch --no-git-tag-version`
  (0.0.1 increment, e.g. 0.1.0 → 0.1.1). This is the only bump the pipeline supports.
  Merges to `main` do NOT bump the version — auto-bump happens only when you click
  "Run workflow".
- **Minor/major** — manual only (`npm version minor|major` locally, then push).
  Not supported by release.yml.
- **Tag** — annotated tag in the format `v<semver>` (e.g. `v0.1.1`), consistent with
  the existing `v0.1.0`.
- **Pre-1.0** — versions may break anything without a major bump. Bump to `1.0.0` when
  the plugin is stable for general use.

---

## CI: pull request testing (ci.yml)

Every pull request to `main` runs `npm test` on Node 24. No branch
protection is enforced — merges are unrestricted — but CI status is
visible on the PR for human review.
