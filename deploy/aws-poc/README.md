# ElseTasks AWS POC

## Instance
- Region: `us-east-1`
- Type: `t4g.medium` (ARM / aarch64)
- ID: `i-01bfba6ff7572be2f`
- Elastic IP: `18.204.10.255`
- Key: `~/.ssh/elsetasks-poc.pem` (mesma chave usada no secret `EC2_SSH_KEY`)
- SG: `elsetasks-poc-sg` (22 from operator IP; 80/443 public)

## URLs
- App: http://appelsetasks.elsesystems.com
- Health: http://appelsetasks.elsesystems.com/api/health
- Fallback IP: http://18.204.10.255

## SSH
```bash
ssh -i ~/.ssh/elsetasks-poc.pem ec2-user@18.204.10.255
```

## Stack em `/opt/elsetasks`
| Serviço     | Estado padrão | Notas |
|-------------|---------------|-------|
| `elsetasks` | running       | porta **80→5173** |
| `postgres`  | running       | só rede interna |
| `docuseal`  | **stopped**   | `restart: "no"`; porta só `127.0.0.1:3000` |

Cal.com **não** está neste POC.

O host **não** usa `git pull` (sem `.git` em `/opt/elsetasks`). O deploy synca via **rsync** e rebuilda a imagem **na EC2** (ARM nativo).

---

## Deploy automático (GitHub Actions)

Arquivo: `.github/workflows/deploy-ec2.yml`

**Trigger:** `push` em `main` ou `workflow_dispatch` (Actions → Deploy EC2 → Run workflow).

### Repo onde cadastrar os secrets

Deploy e GitHub Actions rodam no fork:

- **https://github.com/OFFsaber/kaneo** (`Settings` → `Secrets and variables` → `Actions`)

Remote local esperado:

```bash
# origin = fork de deploy; upstream = usekaneo/kaneo (opcional)
git remote add origin https://github.com/OFFsaber/kaneo.git
git remote -v
```

### Secrets obrigatórios

| Secret | Valor |
|--------|--------|
| `EC2_HOST` | `18.204.10.255` |
| `EC2_USER` | `ec2-user` |
| `EC2_SSH_KEY` | conteúdo **completo** da private key PEM (`elsetasks-poc.pem`) |

Opcional:

| Secret | Valor |
|--------|--------|
| `EC2_PORT` | `22` (padrão se omitido) |

Cadastro via CLI (não imprime o valor da key; **não** commitar PEM):

```bash
gh secret set EC2_HOST --body "18.204.10.255" --repo OFFsaber/kaneo
gh secret set EC2_USER --body "ec2-user" --repo OFFsaber/kaneo
gh secret set EC2_SSH_KEY < ~/.ssh/elsetasks-poc.pem --repo OFFsaber/kaneo
```

Alternativa UI: `pbcopy < ~/.ssh/elsetasks-poc.pem` e colar em `EC2_SSH_KEY` (inclui BEGIN/END).

A chave pública correspondente **já** está em `~/.ssh/authorized_keys` do `ec2-user` (key pair da POC).

### O que o workflow faz

1. Checkout do `main`
2. `rsync` → `/opt/elsetasks` **excluindo** `.env` / `.env.*` (o `.env` da EC2 **nunca** é sobrescrito pelo CI)
3. Na EC2: copia `deploy/aws-poc/compose.yml` → `compose.yml`
4. `docker build -t elsetasks-app:poc -f Dockerfile.elsetasks .` (ARM nativo; evita buildx antigo do compose)
5. `docker compose up -d postgres elsetasks`
6. Garante DocuSeal **parado** (`docker compose stop docuseal`)
7. Smoke check em `/api/health`

### Como testar

1. Cadastre os 3 secrets no GitHub (`OFFsaber/kaneo`)
2. Faça commit + push do workflow para `origin/main` **ou** rode `workflow_dispatch`
3. Acompanhe em **Actions** → *Deploy EC2 (ElseTasks POC)*
4. Confirme: http://appelsetasks.elsesystems.com/api/health

### Avisos

- **`.env` na EC2 é a fonte da verdade** — edite só via SSH; CI não injeta secrets de app.
- **DocuSeal fica stopped** após cada deploy (economiza RAM). Use wake quando precisar de contratos.
- **Não** commite `*.pem` (já está no `.gitignore`).

---

## Start / stop manual
```bash
cd /opt/elsetasks
docker compose up -d postgres elsetasks   # app + DB
docker compose stop docuseal              # se estiver up
```

## DocuSeal wake / sleep
```bash
/opt/elsetasks/deploy/aws-poc/docuseal-wake.sh   # sobe e espera health em :3000
/opt/elsetasks/deploy/aws-poc/docuseal-sleep.sh  # para para economizar RAM/CPU
```

## Rebuild manual (ARM nativo na EC2)
```bash
cd /opt/elsetasks
./deploy/aws-poc/remote-deploy.sh
# ou:
# docker build -t elsetasks-app:poc -f Dockerfile.elsetasks .
# docker compose up -d postgres elsetasks
```

## Preparar `.env` a partir do local (uma vez)
```bash
./deploy/aws-poc/prepare-env.sh /path/to/local.env /tmp/elsetasks.env \
  http://appelsetasks.elsesystems.com
# scp o arquivo para a EC2 como /opt/elsetasks/.env (chmod 600)
```

## Limitações
- HTTPS / 443: pendente (DNS + Caddy/Certbot ou ACM)
- DocuSeal off por padrão: contratos falham até o wake
- Cal.com: fora deste passo

## Landing page (opcional, depois)
A landing `landingpage.elsetasks` (Hostinger/outro host) pode ganhar um **segundo** workflow separado. Este fluxo cobre só o app ElseTasks na EC2.
