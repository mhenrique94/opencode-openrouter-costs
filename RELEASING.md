# RELEASING

Playbook operativo de release para `opencode-openrouter-costs`.

---

## Como funciona

Todo merge de PR para `main` roda os testes no CI. Para fazer um release:

1. Clique em **"Run workflow"** no [Release workflow](https://github.com/mhenrique94/opencode-openrouter-costs/actions/workflows/release.yml).
2. Selecione a branch `main`, escreva a versão semver (ex.: `0.2.0`) e clique no botão verde.

Pronto.

### O que o pipeline faz (release.yml)

1. Roda `npm test` (guardrail).
2. Roda `npm pack --dry-run` (informativo — lista os arquivos do tarball).
3. Escreve a versão no `package.json` via `npm version "<ver>" --no-git-tag-version`.
4. Verifica o registry — aborta se a versão já existir.
5. Verifica tags — aborta se a tag `v<ver>` já existir (run parcial anterior).
6. Commits o bump + cria tag anotada como `github-actions[bot]`.
7. Push de commit + tag para `main`.
8. Publica no npm com `--provenance` (attestação SLSA).
9. Verifica a publicação no registry.
10. Smoke test: instala o pacote do registry real e executa o binário.
11. Cria o GitHub Release com notas geradas automaticamente.

### O que o pipeline NÃO faz

- **Não** bumpa `main` automaticamente a cada merge (o bump só acontece ao clicar "Run workflow").
- **Não** usa auto-bump — a versão é definida manualmente pelo mantenedor.
- **Não** rotaciona o token npm.

---

## Pré-requisitos

- `NPM_TOKEN` configurado nos GitHub Actions secrets (token do tipo "Publish" com acesso Read & Write; bypassa 2FA para publish). NÃO usar tokens "Automation" — são apenas para staging e não publicam pacotes novos.
- `gh` CLI autenticado (para debug local; não é necessário para o pipeline).

---

## Passos do mantenedor

### 1. Merge o PR para `main`

Os testes rodam via `ci.yml`. O merge é irrestrito (sem branch protection).

### 2. Clique em "Run workflow"

Acesse https://github.com/mhenrique94/opencode-openrouter-costs/actions/workflows/release.yml → clique em **"Run workflow"** → selecione `main` → escreva a versão (ex.: `0.2.0`) → clique no botão verde.

### 3. Verificar

- **npm**: `npm view opencode-openrouter-costs@<ver> version` retorna a versão publicada.
- **GitHub Release**: `gh release list` mostra o novo release.
- **Smoke test manual** (opcional — o pipeline já executa o smoke test internamente):
  ```sh
  tmpdir=$(mktemp -d)
  npm install -g opencode-openrouter-costs@<ver> --prefix "$tmpdir"
  "$tmpdir/bin/opencode-openrouter-costs" --yes --dry-run
  ```

---

## Fallback manual

Se o pipeline estiver fora (GitHub Actions indisponível), você pode publicar manualmente:

```sh
npm test
npm pack --dry-run
npm version <ver> --no-git-tag-version
git add package.json
git commit -m "chore: release v<ver>"
git tag -a "v<ver>" -m "Release v<ver>"
git push origin main --follow-tags
npm publish --provenance
gh release create v<ver> --generate-notes
```

O resultado deve ser idêntico ao pipeline: mesmo tag `v<ver>`, mesmo commit em `main`.

---

## Recuperação de falhas

| Falhou em | Estado resultante | Recuperação |
|---|---|---|
| Push (passo 11) rejeitado | Nada publicado, nada pushado | Re-executar o workflow (seguro; o preflight não bloqueia porque não ficou tag). |
| Publish (passo 12) falhou | Commit de bump + tag **já em `main`**, registry sem a versão | **Importante**: re-execução direta **será bloqueada** no preflight da tag (passo 7). Recuperação: (a) deletar o tag remoto `git push origin :refs/tags/v<ver>` e re-executar; ou (b) publish manual: `git pull && npm publish`. |
| Smoke test (passo 14) falhou | Versão publicada, **sem** GitHub Release | Diagnosticar o falha do binário instalado; re-execução **não é viável** (a versão já existe). Criar o GitHub Release manualmente após correção, ou versionar novamente. |
| `gh release create` (passo 15) falhou | Tudo publicado, sem release no GitHub | `gh release create v<ver> --generate-notes` manual. |

---

## Política de versionamento

Semver: patch/minor/major livre via o campo de input do workflow.

- **Bump via pipeline** — a versão é definida pelo mantenedor no campo "Run workflow". Merges a `main` NÃO fazem bump — o bump só ocorre ao disparar o workflow.
- **Tag** — tag anotada no formato `v<semver>` (ex.: `v0.2.0`), consistente com os releases anteriores.
- **Pré-1.0** — versões podem quebrar qualquer coisa sem bump de major. Subir para `1.0.0` quando o plugin estiver estável para uso geral.

---

## Único proprietário de `main`

Ver seção "Carve-out de CI/CD: push para `main`" em `CONTEXT.md` — o
`release.yml` é o único workflow autorizado a pushar em `main`.

---

## CI: testes em pull request (ci.yml)

Todo pull request para `main` roda `npm test` no Node 24. Não há branch
protection configurada — merges são irrestritos — mas o status do CI fica
visível no PR para revisão humana.
