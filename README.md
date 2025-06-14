<p align="center">
  <a href="https://kaneo.app">
    <img src="https://assets.kaneo.app/logo-mono-rounded.png" alt="Kaneo's logo" width="200" />
  </a>
</p>

<h1 align="center">Kaneo</h1>

<div align="center">

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/usekaneo/kaneo/ci.yml?branch=main)](https://github.com/usekaneo/kaneo/actions)
[![Discord](https://img.shields.io/discord/1326250681530843178?color=7389D8&label=&logo=discord&logoColor=ffffff)](https://discord.gg/rU4tSyhXXU)

</div>

<div align="center">
  <h3>
    <a href="https://kaneo.app/quick-start">Quick Start</a>
    <span> | </span>
    <a href="https://kaneo.app">Website</a>
    <span> | </span>
    <a href="https://demo.kaneo.app">Demo</a>
    <span> | </span>
    <a href="https://discord.gg/rU4tSyhXXU">Discord</a>
  </h3>
</div>

<p align="center">A modern, self-hosted project management platform that gets out of your way.</p>

## Why Kaneo?

We built Kaneo because existing project management tools either feel bloated with features you'll never use, or they're too simple to handle real work. Kaneo finds the sweet spot—powerful enough for complex projects, simple enough that you'll actually want to use it.

**What makes it different:**
- **Clean interface** that focuses on your work, not the tool
- **Self-hosted** so your data stays yours
- **Actually fast** because we care about performance
- **Open source** and free forever

## Getting Started

The fastest way to try Kaneo is with Docker Compose. This sets up both the API and web interface:

```yaml
services:
  backend:
    image: ghcr.io/usekaneo/api:latest
    environment:
      JWT_ACCESS: "your-secret-key-here"
      DB_PATH: "/app/apps/api/data/kaneo.db"
    ports:
      - 1337:1337
    restart: unless-stopped
    volumes:
      - sqlite_data:/app/apps/api/data

  frontend:
    image: ghcr.io/usekaneo/web:latest
    environment:
      KANEO_API_URL: "http://localhost:1337"
    ports:
      - 5173:5173
    restart: unless-stopped

volumes:
  sqlite_data:
```

Save this as `compose.yml`, run `docker compose up -d`, and open [http://localhost:5173](http://localhost:5173).

> **Quick tip:** Change `JWT_ACCESS` to something secure in production. This is used to sign authentication tokens.

### Configuration Options

| Variable | What it does | Default |
| -------- | ------------ | ------- |
| `KANEO_API_URL` | Where the web app finds the API | Required |
| `JWT_ACCESS` | Secret key for user authentication | Required |
| `DB_PATH` | SQLite database location | `/app/apps/api/data/kaneo.db` |
| `DISABLE_REGISTRATION` | Block new user signups | `true` |

## Kubernetes Deployment

If you're running Kubernetes, we have a Helm chart that handles the complexity:

```bash
# Clone the repo
git clone https://github.com/usekaneo/kaneo.git
cd kaneo

# Install with Helm
helm install kaneo ./charts/kaneo --namespace kaneo --create-namespace

# Access locally
kubectl port-forward svc/kaneo-web 5173:5173 -n kaneo
```

Open [http://localhost:5173](http://localhost:5173) and you're good to go.

### Production Setup

For real deployments, you'll want proper ingress:

```bash
helm install kaneo ./charts/kaneo \
  --namespace kaneo \
  --create-namespace \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set "ingress.hosts[0].host=pm.yourcompany.com"
```

Check the [Helm chart docs](./charts/kaneo/README.md) for TLS setup, cert-manager integration, and other production considerations.

## Development

Want to hack on Kaneo? Here's how to get a development environment running:

```bash
# Clone and install dependencies
git clone https://github.com/usekaneo/kaneo.git
cd kaneo
pnpm install

# Start the API
cd apps/api
pnpm run dev

# In another terminal, start the web app
cd apps/web
pnpm run dev
```

The API runs on port 1337, web app on 5173. Both will reload when you make changes.

## Community

- **[Discord](https://discord.gg/rU4tSyhXXU)** - Chat with users and contributors
- **[GitHub Issues](https://github.com/usekaneo/kaneo/issues)** - Bug reports and feature requests
- **[Documentation](https://kaneo.app/quick-start)** - Detailed guides and API docs

## Contributing

We're always looking for help, whether that's:
- Reporting bugs or suggesting features
- Improving documentation
- Contributing code
- Helping other users on Discord

Check out [CONTRIBUTING.md](CONTRIBUTING.md) for the details on how to get involved.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">
  <img src="https://repobeats.axiom.co/api/embed/3e8367ec2b2350e4fc48662df33c81dac657b833.svg" alt="Repobeats analytics image" />
</div>

<p align="center">
  Built with ❤️ by the Kaneo team and <a href="#contributors">contributors</a>
</p>
