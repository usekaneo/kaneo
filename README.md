<p align="center">
  <a href="https://kaneo.app">
    <img src="https://assets.kaneo.app/logo-text.png" alt="Kaneo's logo" width="300" />
  </a>
</p>

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
    <a href="https://cloud.kaneo.app">Cloud (free)</a>
    <span> | </span>
    <a href="https://discord.gg/rU4tSyhXXU">Discord</a>
  </h3>
</div>

<h1 align="center">All you need. Nothing you don't.</h1>

<p align="center">Project management that gets out of your way so you can focus on building great products.</p>

## Why Kaneo?

After years of using bloated, overcomplicated project management platforms that distracted from actual work, we built Kaneo to be different.

The problem with most tools isn't that they lack features—it's that they have **too many**. Every notification, every unnecessary button, every complex workflow pulls your team away from what matters: **building great products**.

We believe the best tools are **invisible**. They should amplify your team's natural workflow, not force you to adapt to theirs. Kaneo is built on the principle that **less is more**—every feature exists because it solves a real problem, not because it looks impressive in a demo.

**What makes it different:**
- **Clean interface** that focuses on your work, not the tool
- **Self-hosted** so your data stays yours
- **Actually fast** because we care about performance
- **Open source** and free forever

Learn more about Kaneo's features and capabilities in our [documentation](https://kaneo.app/docs).

## Getting Started

### Quick Start with Docker Compose

The fastest way to try Kaneo is with Docker Compose. This sets up the API, web interface, and PostgreSQL database:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env_file:
      - .env
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kaneo -d kaneo"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    image: ghcr.io/usekaneo/api:latest
    ports:
      - "1337:1337"
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  web:
    image: ghcr.io/usekaneo/web:latest
    ports:
      - "5173:5173"
    env_file:
      - .env
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
    name: kaneo_postgres_data
```

Save this as `compose.yml`, create a `.env` file with your configuration (see [Configuration Options](#configuration-options) below), run `docker compose up -d`, and open [http://localhost:5173](http://localhost:5173).

> **Important:** See our [full documentation](https://kaneo.app/docs) for detailed setup instructions, environment variable configuration, and troubleshooting guides.

### Development Setup

For development, see our [Environment Setup Guide](ENVIRONMENT_SETUP.md) for detailed instructions on configuring environment variables and troubleshooting common issues like CORS problems.

### Configuration Options

Here are the essential environment variables you'll need in your `.env` file:

| Variable | What it does | Default |
| -------- | ------------ | ------- |
| `KANEO_API_URL` | Where the web app finds the API | Required |
| `JWT_ACCESS` | Secret key for user authentication | Required |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `POSTGRES_DB` | PostgreSQL database name | `kaneo` |
| `POSTGRES_USER` | PostgreSQL username | Required |
| `POSTGRES_PASSWORD` | PostgreSQL password | Required |
| `DISABLE_REGISTRATION` | Block new user signups | `true` |

For a complete list of configuration options and advanced settings, see the [full documentation](https://kaneo.app/docs).

### Database Setup

Kaneo uses PostgreSQL for data storage. The Docker Compose setup above handles this automatically, but if you're running Kaneo outside of Docker, or if you are using an external postgres database, you'll need to:

1. **Install PostgreSQL** (version 12 or higher)
2. **Create a database and user:**
   ```sql
   CREATE DATABASE kaneo;
   CREATE USER kaneo_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE kaneo TO kaneo_user;

   \c kaneo;
   GRANT USAGE ON SCHEMA public TO kaneo_user;
   GRANT CREATE ON SCHEMA public TO kaneo_user;
   ALTER SCHEMA public OWNER TO kaneo_user;
   ```
3. **Set the DATABASE_URL environment variable:**
   ```bash
   export DATABASE_URL="postgresql://kaneo_user:your_password@localhost:5432/kaneo"
   ```

For more database configuration options and troubleshooting, visit the [documentation](https://kaneo.app/docs).

## Kubernetes Deployment

If you're running Kubernetes, we provide a comprehensive Helm chart. Check out the [Helm chart documentation](./charts/kaneo/README.md) for detailed installation instructions, production configuration examples, TLS setup, and more.

## Development

Want to hack on Kaneo? See our [Environment Setup Guide](ENVIRONMENT_SETUP.md) for detailed instructions on configuring environment variables and troubleshooting common issues like CORS problems.

Quick start:
```bash
# Clone and install dependencies
git clone https://github.com/usekaneo/kaneo.git
cd kaneo
pnpm install

# Copy environment files
cp apps/api/.env.sample apps/api/.env
cp apps/web/.env.sample apps/web/.env

# Update environment variables as needed
# See ENVIRONMENT_SETUP.md for detailed instructions

# Start development servers
pnpm dev
```

For contributing guidelines, code structure, and development best practices, check out our [contributing guide](CONTRIBUTING.md) and [documentation](https://kaneo.app/docs).

## Community

- **[Discord](https://discord.gg/rU4tSyhXXU)** - Chat with users and contributors
- **[GitHub Issues](https://github.com/usekaneo/kaneo/issues)** - Bug reports and feature requests
- **[Documentation](https://kaneo.app/docs)** - Detailed guides, API docs, and tutorials

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
