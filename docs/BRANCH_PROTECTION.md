# Branch protection (main)

O merge em `main` deve exigir checks do workflow **CI** (`.github/workflows/ci.yml`).

## Checks exigidos (mínimo)

- `lint`
- `typecheck`
- `unit`

Deploy EC2 **não** roda em PR — só em push/`workflow_dispatch` em `main`.

## Config via CLI

```bash
gh api -X PUT repos/OFFsaber/elsetasks/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["lint", "typecheck", "unit"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

> Contas free em repo **público** costumam aceitar; em repo **privado** branch protection avançada pode exigir plano Team/Pro. Se a API falhar com 403/402, use o caminho manual abaixo.

## Manual (GitHub UI)

1. Abra https://github.com/OFFsaber/elsetasks/settings/branches
2. **Add rule** / **Add classic branch protection rule** para `main`
3. Marque:
   - Require a pull request before merging
   - Require status checks to pass before merging
   - Require branches to be up to date before merging
4. Em status checks, selecione `lint`, `typecheck`, `unit` (aparecem após o primeiro run do workflow CI)
5. Salve

## Fluxo do time

```bash
git fetch origin && git checkout main && git pull
git checkout -b feat/minha-feature
# ... commits conventional ...
git push -u origin HEAD
gh pr create --base main
# Aguarde CI verde → merge
```
