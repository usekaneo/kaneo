# Kaneo Mintlify Docs

This directory contains Kaneo documentation powered by Mintlify.

## Monorepo setup

- Repository: `kaneo`
- Docs root for Mintlify: `/apps/docs`
- Main config: `apps/docs/docs.json`
- OpenAPI source file: `apps/docs/openapi.json`

## Local preview

1. Install Mintlify CLI:

```bash
npm i -g mint
```

2. Run from this directory:

```bash
mint dev
```

3. Open `http://localhost:3000`.

## Content structure

- `index.mdx`: docs landing page
- `core/**`: product and deployment guides
- `api-reference/**`: overview/auth pages
- API endpoints are generated from the local OpenAPI file in `docs.json`
