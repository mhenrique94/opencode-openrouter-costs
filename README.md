# opencode-openrouter-costs

OpenCode TUI plugin — sidebar widget showing OpenRouter session cost and account balance.

## Install

```sh
# From GitHub (no npm publish needed)
npx github:mhenrique94/opencode-openrouter-costs

# From npm (after publish)
npx opencode-openrouter-costs
```

## What it does

Adds a compact widget to the OpenCode sidebar (above "Servidor MCP"):

```
OpenRouter
Sessão: $0.0523
Saldo: $4.21
```

- **Sessão** — cost of the current session (resets on new session)
- **Saldo** — remaining OpenRouter account credit

## Requirements

- OpenCode >= 1.18.30
- OpenRouter provider configured (via `/models` or `OPENROUTER_API_KEY`)

## Uninstall

```sh
npx github:mhenrique94/opencode-openrouter-costs --remove
```

## License

MIT
