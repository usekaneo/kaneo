# DigitalOcean App Platform

This deployment runs the bundled Kaneo image on App Platform, PostgreSQL 18 and
Azure Managed Redis in your Azure subscription, and private uploads in Cloudflare R2.
The local command and GitHub Actions use the same provision, deploy and validation
code. No Git commits, pushes or release dispatches are part of the local command.

The default is one 1 GB app instance in NYC, PostgreSQL Burstable B1ms with 64 GB
and seven days of backups, and Redis Balanced B0 without HA in North Central US.
Dedicated egress IPs are a paid App Platform feature. Azure credits do not cover
App Platform or the egress IP charge. This is a small single-instance
deployment; PostgreSQL and Redis are not configured for high availability.

## Local setup

Install Node 24, pnpm, Docker with Buildx, Azure CLI with Bicep (`az bicep install`),
and doctl 2.3.0 or newer. Log in with `az login`, `doctl auth init`, and
`docker login ghcr.io`. The GHCR login needs permission to push the Kaneo image.
No new JavaScript dependencies are needed for the deployment scripts.

Use the same Azure subscription as the neighboring `monorepo`, but separate
Kaneo resources. The CLI always passes the subscription explicitly and never
modifies the monorepo's infrastructure or Terraform state.

Use your existing Wrangler login to create a dedicated R2 bucket (or use an
existing private bucket reserved for this app):

```sh
export CLOUDFLARE_ACCOUNT_ID=de345701e5dc7e14d3c079da3e637448
wrangler r2 bucket create kaneo-production-uploads
```

In Cloudflare R2, create an **Object Read & Write** API token scoped only to that
bucket. App Platform needs its persistent S3 access key and secret; the local
Wrangler OAuth login is not a credential the remote app can use. Save those
values, the account S3 endpoint and bucket in a private environment file based on
[deploy.env.example](deploy.env.example). R2 uses region `auto`.

Configure bucket CORS with [r2-cors.json](r2-cors.json). With Wrangler 4:

```sh
wrangler r2 bucket cors set kaneo-production-uploads --file deploy/digitalocean/r2-cors.json
AZURE_SUBSCRIPTION_ID=88557392-91d3-491f-ab97-234782d07f12 \
  node --env-file=/path/to/private-r2.env scripts/deploy/setup.mjs
```

Setup writes `.cache/deploy/deploy.env` with mode `0600`, generating authentication,
encryption and PostgreSQL passwords once. Existing authentication, encryption
and database secrets are preserved if you run setup again. When changing storage
accounts, supply the new bucket and both new credentials; old provider keys will
not be reused. Keep a secure backup of this ignored file. The setup command does
not create Spaces resources or modify other R2 buckets.

The CORS policy permits browser requests from any origin; objects remain private
and require signed URLs. You can restrict `AllowedOrigins` to the app URL once
App Platform has assigned it. Keep public bucket access disabled.

Build the **current local files** and push a unique tag, then deploy its digest:

```sh
mkdir -p .cache/deploy
image="ghcr.io/playbookmediallc/kaneo:deploy-local-$(date -u +%Y%m%d%H%M%S)"
docker buildx build --platform linux/amd64 --file Dockerfile.kaneo \
  --tag "$image" --metadata-file .cache/deploy/build.json --push .
digest=$(node -p 'JSON.parse(require("node:fs").readFileSync(".cache/deploy/build.json"))["containerimage.digest"]')
KANEO_IMAGE="ghcr.io/playbookmediallc/kaneo@$digest" \
  node --env-file=.cache/deploy/deploy.env scripts/deploy/digitalocean.mjs deploy
```

Public images need no pull credential. For private GHCR images, add
`GHCR_CREDENTIALS=username:read-packages-token` to the private environment file.
App Platform encrypts it on receipt. Do not use a short-lived Actions token for
runtime pulls: replacement instances must be able to pull the image later.

The deploy command creates a temporary bootstrap service on the first run to
reserve dedicated egress IPs. It provisions a separate Azure resource group,
PostgreSQL, the database and required extensions, allows only those egress IPs
through the PostgreSQL firewall, then replaces the bootstrap service with Kaneo.
Existing apps keep serving their current deployment during resource provisioning.
Both Redis connections use TLS with certificate verification and access-key
authentication. Redis uses its public endpoint; it is not IP-allowlisted.
The database connection uses `sslmode=verify-full`. Azure resource providers
`Microsoft.DBforPostgreSQL` and `Microsoft.Cache` must be registered.

The database has a `CanNotDelete` resource lock. Bicep uses incremental deployments;
removing a resource from the template does not delete it. Keep the same app name,
Azure group and region. If the app's dedicated IPs ever change, remove stale
`app-platform-*` PostgreSQL firewall rules explicitly after a successful rollout.
Never remove `egress.type: DEDICATED_IP` from subsequent app specs.

Public registration, password sign-up, the login form and email-code sign-in are
enabled by default. Email codes require working SMTP. Guest access stays disabled.
The administrator can control registration and require email verification in
Administration > Settings. Set `DISABLE_REGISTRATION=true` or
`DISABLE_PASSWORD_REGISTRATION=true` only when those settings must be locked off
by the deployment. Claim the first administrator account promptly on a new instance.

Set `DO_APP_DOMAIN=quills.playbookmedia.io` to register a primary custom hostname
and use it for auth, email links, the web API URL and deployment verification.
Create its DNS CNAME pointing to the app's `ondigitalocean.app` hostname with DNS
proxying disabled while App Platform issues its certificate. Without this setting,
the app continues using its provider hostname.

Resend works through the existing SMTP transport: use `smtp.resend.com`, username
`resend`, the domain-scoped sending key as `SMTP_PASSWORD`, and a sender on a
verified Resend domain. Port `2465` uses implicit TLS (`SMTP_SECURE=true`) and
avoids the standard SMTP ports that hosting providers may restrict. Validate a
test email from the running app and check its delivery event in Resend.

Amazon SES uses the same SMTP transport. For `us-east-1`, set
`SMTP_HOST=email-smtp.us-east-1.amazonaws.com`, `SMTP_PORT=2465`,
`SMTP_SECURE=true`, and `SMTP_REQUIRE_TLS=true`. Use a dedicated IAM user's
regional SES SMTP username and password; the SMTP password is not the AWS secret
access key. Restrict sending to the instance's sender with `ses:FromAddress`.
WorkOS's native SES email provider needs a separate AWS API access key with
`ses:SendEmail` and the identity-verification read permissions described by WorkOS.

Before replacing an existing production mail provider, verify the sender's DKIM
and custom MAIL FROM DNS records, receive a real test email, and confirm SES
`ProductionAccessEnabled` is `true` in the selected region. A sandbox account can
authenticate to SMTP and deliver to verified test recipients while still being
unable to email new customers. Keep the existing provider active until AWS
approves production access. Configure bounce/complaint suppression and feedback
notifications, and verify them with the SES mailbox simulator.

SES sending rate and rolling 24-hour quotas are separate from its pricing plan.
Request capacity through Service Quotas, and distinguish requested limits from
approved limits. For basic usage pricing, verify the SES console shows
`À la carte`; new accounts may start on the Essentials plan. After approval,
update both the app's encrypted SMTP configuration and WorkOS's email provider,
then confirm delivery from each live path. Update the public privacy policy's
provider list when activating SES.

The deployment forwards SMTP and custom OAuth settings, GitHub OAuth client
credentials, and Google client credentials as encrypted runtime variables. Supply
both client ID and secret for each provider; incomplete pairs fail before provisioning.
Register these exact callback URLs using your chosen public hostname:

| Provider | Callback |
| --- | --- |
| GitHub | `https://quills.playbookmedia.io/api/auth/callback/github` |
| Google | `https://quills.playbookmedia.io/api/auth/callback/google` |
| WorkOS OIDC | `https://quills.playbookmedia.io/api/auth/oauth2/callback/custom` |

For WorkOS Connect, set `CUSTOM_OAUTH_NAME=WorkOS`, its client ID and secret,
`CUSTOM_OAUTH_DISCOVERY_URL`, and `CUSTOM_OAUTH_SCOPES=openid,profile,email`.
Keep automatic OIDC login disabled so users can choose the other sign-in methods.
Use production provider applications for public onboarding; a testing-only OAuth
consent screen or a client restricted to test users is not a public sign-in setup.

Quills publishes its public policies at `/privacy/` and `/terms/`, with links on
the sign-in and registration pages. Google branding uses these public HTTPS URLs.
The bundled policies describe Playbook Media's Quills service and its providers;
another operator must replace that copy before using this fork for its own service.
Verify that both URLs serve the policy HTML and `/legal.css` serves CSS after a
deployment, since the SPA fallback can also return HTTP 200 for a missing file.

## GitHub Actions

The `Deploy DigitalOcean` workflow is manual and only runs from `main`. It builds
the bundled `linux/amd64` image from the selected commit and deploys that exact
digest. It does not run on pushes or pull requests.

Create the GitHub environment `digitalocean-production` with these secrets:

| Secret | Value |
| --- | --- |
| `DIGITALOCEAN_ACCESS_TOKEN` | Token with Apps read/create/update access |
| `KANEO_DEPLOY_ENV` | Contents of the private `deploy.env` file |

For private images, include a stable `GHCR_CREDENTIALS=username:read-packages-token`
in `KANEO_DEPLOY_ENV`. The repository can use its existing `GH_PACKAGE_TOKEN` for image publication,
or the workflow's `GITHUB_TOKEN` if it has write access to the existing package.

Use Azure OIDC, with environment variables `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`.
Create an Entra application/service principal with a federated credential:

```json
{
  "name": "kaneo-github",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:PlaybookMediaLLC/kaneo:environment:digitalocean-production",
  "audiences": ["api://AzureADTokenExchange"]
}
```

Provision the resource group once locally, then scope the identity's `Contributor`
role to that group. Because the template manages a database deletion lock, it also
needs `Microsoft.Authorization/locks/write` on that group (for example, the
`Locks Contributor` role). It does not need subscription-wide resource access.
Register Azure providers once with an operator account before the first run.
Keep the subscription ID in `KANEO_DEPLOY_ENV` consistent with the role scope.

## Deployment proof and retry

Success requires the requested deployment to be `ACTIVE`, its exact image digest
to match, and the **execution** of the `verify-dependencies` post-deploy job to
have succeeded. A successful image build alone is insufficient. The job checks:

- PostgreSQL connectivity, applied migrations and the user table.
- Redis TLS connections and delivery between a publisher and subscriber.
- A unique private storage object: write, read, compare and delete.

The CLI then checks public HTTPS API health, anonymous authentication, HTML and
the JavaScript asset with runtime configuration. It checks the active deployment
ID again afterward and writes `.cache/deploy/result.json` only when all checks
pass. GitHub Actions records those results in its run summary.

To check the same deployment after an observation timeout, use its IDs printed
by the deploy command, not a different successful deployment:

```sh
DO_APP_ID=<app-id> DO_DEPLOYMENT_ID=<requested-deployment-id> \
  KANEO_IMAGE_DIGEST=sha256:<expected-digest> \
  node scripts/deploy/digitalocean.mjs validate
```

A failed post-deploy job does not roll back the app automatically. The CLI exits
nonzero and keeps its success report unwritten. Inspect the exact deployment and
`verify-dependencies` logs in App Platform. Re-run `deploy` after correcting the
cause. App rollback must use a compatible image: startup migrations can change
the database, so restoring an older image alone may not be sufficient.

On first custom-domain activation, App Platform may supersede the requested
deployment with a rollout whose cause is `domain <hostname> ready`. The CLI
correctly rejects the superseded ID. Confirm that the replacement's complete app
spec matches the requested spec, then validate that specific replacement ID and
the expected image digest. Do not treat an unrelated active deployment as success.

Run deployment checks locally with:

```sh
node --test scripts/deploy/*.test.mjs
az bicep build --file deploy/digitalocean/azure.bicep --outfile /tmp/kaneo-azure.json
actionlint .github/workflows/deploy-digitalocean.yml
```
