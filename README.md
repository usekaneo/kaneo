# ElseTasks

**ElseTasks** is a soft-fork of [Kaneo](https://github.com/usekaneo/kaneo) (MIT) for Brazilian teams that want a lightweight Jira alternative — with **client whitelabel** (logo/colors) and two delivery modes:

| Mode | Where it runs | Billing |
|------|---------------|---------|
| **Local** | Customer machine / their VPS | Software license |
| **Cloud** | Your infra, **1 customer = 1 Docker stack** | License + hosting |

> Attribution: based on Kaneo. Keep the MIT license notice.

## Quick start (Local)

```bash
cp .env.sample .env
# set POSTGRES_PASSWORD and AUTH_SECRET (openssl rand -hex 32)

docker compose -f compose.local.yml up -d --build
open http://localhost:5173/setup
```

Wizard: checks → client brand (name/logo/color) → license → create admin.

## Cloud (isolated stacks)

```bash
chmod +x scripts/provision-customer.sh
ELSETASKS_BASE_DOMAIN=elsetasks.com ./scripts/provision-customer.sh acme
cd deploy/customers/acme && docker compose --env-file .env up -d
```

Requires an external Traefik/`proxy` network (see `compose.hosted.template.yml`).

## License keys (marketplace)

```bash
chmod +x scripts/generate-license-keys.sh
./scripts/generate-license-keys.sh local 5
./scripts/generate-license-keys.sh cloud_monthly 3
```

Prefixes: `ET-LOCAL-*`, `ET-CLOUD-M-*`, `ET-CLOUD-Y-*`, `ET-SUP-*`.

Activate in `/setup` or `POST /api/license/activate`.

See [docs/MARKETPLACE_SKUS.md](docs/MARKETPLACE_SKUS.md) and [docs/INSTALL_PT.md](docs/INSTALL_PT.md).

## Branding

- **Platform defaults:** `APP_NAME`, logos in `apps/web/public`, emails, OpenAPI title.
- **Client runtime:** `GET/PUT /api/branding` + CSS `--brand-primary`.

## Sync upstream

```bash
git remote add upstream https://github.com/usekaneo/kaneo.git   # if missing
git fetch upstream
git merge upstream/main   # resolve ElseTasks branding conflicts carefully
```

## License

MIT — see [LICENSE](LICENSE). Copyright for original Kaneo belongs to its authors; ElseTasks modifications © their authors.
