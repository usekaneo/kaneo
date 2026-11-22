# Session learnings: running checks on this WSL checkout

Date: 2026-11-22. Scope: modern color palette work, but the resource limits apply to every session.

## Environment

- WSL machine: ~9.7 GB RAM, 6 vCPU, 4 GB swap.
- Node 24.21.0, pnpm 12.18.0.
- A full `apps/web` Vitest run creates jsdom once per test file and can exhaust the machine before it finishes.

## What went wrong

| Action | Observed result |
| --- | --- |
| Full `apps/web` Vitest suite | 37 jsdom environments, ~460 s of environment setup alone; one run took 17 minutes and was killed by the harness |
| `tsc -p tsconfig.app.json` (TypeScript 7 native) | 4.5 GB RSS, ~190% CPU, no output after 17 minutes; had to be killed |
| Test + typecheck in parallel | Both slowed down and the test run reported 12 spurious errors; a clean rerun passed |
| `pnpm test` / repo-wide `pnpm lint` | Pre-existing failures in untouched files (596 files flagged by the formatting check), not caused by the change |
| `git stash` without pathspec | Captures unrelated dirty files; use a scoped pathspec instead |
| Branch based on an old fork `main` | Pulled in unrelated commits and a migration-meta conflict; base new work on `upstream/main` |

## Rules

1. Run only the tests that cover the change, with bounded workers:
   `vp test run --maxWorkers=1 <path>` (use `2` at most).
2. Run one heavy job at a time. Do not run tests, typecheck, or builds concurrently. Check `free -h` first; stop if available memory is below ~1.5 GB.
3. Do not run full `pnpm build`, `pnpm test`, or repo-wide `pnpm lint` for a small change. Format and lint only changed files:
   `pnpm exec vp check $(git diff --name-only)`.
4. Avoid package-wide `tsc -p` here. Prefer focused tests; if typecheck is required, run it alone with a timeout and watch its memory.
5. Only run `pnpm install` when dependencies or the lockfile actually changed, and not while a dev server or tests are running.
6. Keep git operations scoped: `git stash push -u -- <paths>`, explicit `git add <paths>`, and `git diff --stat` before committing.
7. The pre-commit hook runs repo-wide lint. Check changed files first; if the hook fails only on pre-existing files, use `--no-verify` and report why.
8. Base feature branches on `upstream/main` to avoid replaying unrelated local commits and their conflicts.

## Minimal verification recipes

```bash
# unit tests for one area
cd apps/web
NODE_OPTIONS=--no-experimental-webstorage \
  ../../node_modules/.pnpm/vitest@5.1.0_*/node_modules/vitest/vitest.mjs \
  run --config vitest.config.ts --maxWorkers=1 src/lib/color

# format + lint only the changed files
cd /path/to/repo
pnpm exec vp check $(git diff --name-only)

# i18n key sync (cheap)
pnpm i18n:check
```
