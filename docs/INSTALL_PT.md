# Instalação ElseTasks Local (PT-BR)

## Requisitos

- Docker Desktop (Mac/Windows) ou Docker Engine + Compose (Linux)
- Portas livres: `5173` (app) e `5432` (Postgres), ou altere no `.env`

## Passo a passo

1. Baixe o pacote ElseTasks Local e entre na pasta.
2. Copie o ambiente:

```bash
cp .env.sample .env
```

3. Defina segredos:

```bash
# macOS / Linux
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env
echo "AUTH_SECRET=$(openssl rand -hex 32)" >> .env
```

Edite também `APP_URL` se não for `http://localhost:5173`.

4. Suba:

```bash
docker compose -f compose.local.yml up -d --build
```

5. Abra o onboarding:

[http://localhost:5173/setup](http://localhost:5173/setup)

- Verifique se a API está ok
- Defina **nome, cor e logo** da sua empresa
- Cole a chave `ET-LOCAL-…` (Mercado Livre / portal)
- Crie a conta admin

## SMTP (e-mails)

No `.env`, configure `SMTP_*` e `SMTP_FROM` (ex.: `ElseTasks <noreply@seudominio.com>`).

## Parar / backup

```bash
docker compose -f compose.local.yml down
# volume Postgres: elsetasks_postgres_data
```

## Suporte

`APP_SUPPORT_EMAIL` / suporte@elsetasks.com
