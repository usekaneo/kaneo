# AGENTS.md — ElseTasks

Guia curto para agentes (Cursor/Claude) neste repositório.

## O que é

**ElseTasks** é soft-fork MIT do Kaneo para times BR (whitelabel, Local/Cloud). Repo: `OFFsaber/elsetasks`.

Packages internos podem permanecer `@kaneo/*`. Preferir branding **ElseTasks** em docs/UI.

## Comandos

```bash
pnpm install
pnpm dev          # api + web
pnpm lint         # Biome
pnpm typecheck
pnpm test         # unit (Turbo)
```

## Regras Cursor

Ver `.cursor/rules/` — em especial `elsetasks-guidelines.mdc`, `git-workflow.mdc`, `security.mdc` (always-on).

## Fluxo de contribuição

1. Branch `feat/*` ou `fix/*` a partir de `main`
2. PR para `main` — CI (`lint`, `typecheck`, `unit`) deve passar
3. Deploy EC2 só após merge em `main` (Actions `Deploy EC2`)

## Não fazer

- Commitar `.env` / PEM / secrets
- Renomear massivamente `@kaneo/*`
- `docker compose down -v` em POC sem pedido explícito
- Deploy EC2 a partir de PR
