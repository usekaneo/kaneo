# Kaneo documentation

The docs are authored in MDX and rendered by Mintlify. `docs.json` owns navigation; `openapi.json` supplies the generated API reference.

## Preview and validate

From `apps/docs`:

```bash
pnpm dlx mint dev
pnpm dlx mint validate
pnpm dlx mint broken-links
```

The preview runs at `http://localhost:3000`. Use `--port 3107` if that port is busy. Search in the local preview may require a Mintlify login.

## Organization

- **Using Kaneo:** first project, task views, team management, account settings.
- **Self-hosting:** installation, configuration, sign-in, backups, upgrades, troubleshooting.
- **Integrations:** repositories, team channels, webhooks, and MCP.
- **Developers:** first API request, authentication, protocol details, endpoint reference.

Existing `core/` page paths are retained so external links keep working. Put a page in the navigation where readers expect to find it rather than moving its URL for cosmetic consistency.

See [CONTRIBUTING.md](CONTRIBUTING.md) for writing and image guidelines. Product captures and regeneration instructions live in [images/product/README.md](images/product/README.md).
