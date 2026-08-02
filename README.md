<h1 align="center">Vaneo</h1>

<p align="center">
  <a href="https://github.com/MiguelVivar/Vaneo">
    <img src="https://assets.kaneo.app/logo-text.png" alt="Vaneo's logo" width="450" />
  </a>
</p>

<div align="center">

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/MiguelVivar/Vaneo/ci.yml?branch=main)](https://github.com/MiguelVivar/Vaneo/actions)

</div>

<div align="center">
  <h3>
    <a href="#getting-started">Quick Start</a>
    <span> | </span>
    <a href="https://github.com/MiguelVivar/Vaneo">Website</a>
  </h3>
</div>


<p align="center">
  <img src="https://assets.kaneo.app/readme.png" alt="Vaneo Dashboard" />
</p>

## Why Vaneo?

Vaneo is an open source project management platform focused on simplicity, speed, and efficiency (forked from Kaneo).

After years of using bloated, overcomplicated project management platforms that distracted from actual work, Vaneo was created to be different.

The problem with most tools isn't that they lack features—it's that they have **too many**. Every notification, every unnecessary button, every complex workflow pulls your team away from what matters: **building great products**.

We believe the best tools are **invisible**. They should amplify your team's natural workflow, not force you to adapt to theirs. Vaneo is built on the principle that **less is more**—every feature exists because it solves a real problem, not because it looks impressive in a demo.

**What makes it different:**
- **Clean interface** that focuses on your work, not the tool
- **Self-hosted** so your data stays yours
- **Actually fast** because we care about performance
- **Open source** with a permissive MIT license

## Getting Started

### Quick Start with Docker Compose

The fastest way to try Vaneo is with Docker Compose. This sets up Vaneo and PostgreSQL:

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
      test: ["CMD-SHELL", "pg_isready -U vaneo -d vaneo"]
      interval: 10s
      timeout: 5s
      retries: 5

  vaneo:
    image: ghcr.io/miguelvivar/vaneo:latest
    ports:
      - "5173:5173"
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
```

Save this as `compose.yml`, copy `.env.sample` to `.env`, uncomment `VANEO_CLIENT_URL=http://localhost:5173`, and set `POSTGRES_PASSWORD=<password>` and `AUTH_SECRET=<output of openssl rand -hex 32>`, run `docker compose up -d`, and open [http://localhost:5173](http://localhost:5173).

In Docker Compose, the bundled Vaneo container reaches PostgreSQL at the service hostname `postgres`.
If you run the API on your host instead of inside Compose, use `localhost` or set `DATABASE_URL` explicitly.

### Development Setup

For development, see our [Environment Setup Guide](ENVIRONMENT_SETUP.md) for detailed instructions on configuring environment variables and troubleshooting common issues like CORS problems.

### Configuration

Vaneo requires several environment variables to be configured. The Docker Compose setup above handles the database automatically, but you'll need to configure environment variables for the API and web services.

## Development

Want to hack on Vaneo? See our [Environment Setup Guide](ENVIRONMENT_SETUP.md) for detailed instructions on configuring environment variables and troubleshooting common issues like CORS problems.

Quick start:
```bash
# Clone and install dependencies
git clone https://github.com/MiguelVivar/Vaneo.git
cd Vaneo
pnpm install

# Create a .env file in the root with required environment variables
# See ENVIRONMENT_SETUP.md for detailed instructions

# Start development servers
pnpm dev
```

For contributing guidelines, code structure, and development best practices, check out our [contributing guide](CONTRIBUTING.md).

## Community

- **[GitHub Issues](https://github.com/MiguelVivar/Vaneo/issues)** - Bug reports and feature requests

## Contributing

We're always looking for help, whether that's:
- Reporting bugs or suggesting features
- Improving documentation
- Contributing code

Check out [CONTRIBUTING.md](CONTRIBUTING.md) for the details on how to get involved.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ by the Vaneo team and <a href="#contributors">contributors</a> (Fork of <a href="https://github.com/usekaneo/kaneo">Kaneo</a>)
</p>
