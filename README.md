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
    <a href="https://kaneo.app/docs">Quick Start</a>
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

The fastest way to try Kaneo is with Docker Compose. This sets up the API, web interface, and PostgreSQL database:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: kaneo
      POSTGRES_USER: kaneo_user
      POSTGRES_PASSWORD: kaneo_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  backend:
    image: ghcr.io/usekaneo/api:latest
    environment:
      JWT_ACCESS: "your-secret-key-here"
      DATABASE_URL: "postgresql://kaneo_user:kaneo_password@postgres:5432/kaneo"
    ports:
      - 1337:1337
    depends_on:
      - postgres
    restart: unless-stopped

  frontend:
    image: ghcr.io/usekaneo/web:latest
    environment:
      KANEO_API_URL: "http://localhost:1337"
    ports:
      - 5173:5173
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
```

Save this as `compose.yml`, run `docker compose up -d`, and open [http://localhost:5173](http://localhost:5173).

> **Quick tip:** Change `JWT_ACCESS` to something secure in production. This is used to sign authentication tokens.

### Configuration Options

| Variable | What it does | Default |
| -------- | ------------ | ------- |
| `KANEO_API_URL` | Where the web app finds the API | Required |
| `JWT_ACCESS` | Secret key for user authentication | Required |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `DISABLE_REGISTRATION` | Block new user signups | `true` |

### Database Setup

Kaneo uses PostgreSQL for data storage. The Docker Compose setup above handles this automatically, but if you're running Kaneo outside of Docker, you'll need to:

1. **Install PostgreSQL** (version 12 or higher)
2. **Create a database and user:**
   ```sql
   CREATE DATABASE kaneo;
   CREATE USER kaneo_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE kaneo TO kaneo_user;
   ```
3. **Set the DATABASE_URL environment variable:**
   ```bash
   export DATABASE_URL="postgresql://kaneo_user:your_password@localhost:5432/kaneo"
   ```

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

# Start PostgreSQL (using Docker)
docker run --name kaneo-postgres -e POSTGRES_DB=kaneo -e POSTGRES_USER=kaneo_user -e POSTGRES_PASSWORD=kaneo_password -p 5432:5432 -d postgres:16-alpine

# Set up environment variables
cd apps/api
echo "DATABASE_URL=postgresql://kaneo_user:kaneo_password@localhost:5432/kaneo" > .env

# Run database migrations
pnpm run db:migrate

# Start the API
pnpm run dev

# In another terminal, start the web app
cd apps/web
pnpm run dev
```

The API runs on port 1337, web app on 5173. Both will reload when you make changes.

## Migration from SQLite

If you're upgrading from a previous version that used SQLite, you'll need to migrate your data to PostgreSQL. We recommend:

1. **Export your data** from the old SQLite database
2. **Set up PostgreSQL** using the new Docker Compose configuration
3. **Import your data** into the new PostgreSQL database

Contact us on [Discord](https://discord.gg/rU4tSyhXXU) if you need help with the migration process.

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
