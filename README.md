<p align="center">
  <a href="https://kaneo.app">
    <img src="https://assets.kaneo.app/logo-text.png" alt="Kaneo's logo" width="300" />
  </a>
</p>

<div align="center">

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/usekaneo/kaneo/ci.yml?branch=main)](https://github.com/usekaneo/kaneo/actions)
[![Discord](https://img.shields.io/discord/1326250681530843178?color=7389D8&label=&logo=discord&logoColor=ffffff)](https://discord.gg/rU4tSyhXXU)
[![Sponsors](https://img.shields.io/github/sponsors/andrejsshell)](https://github.com/sponsors/andrejsshell)

</div>

<div align="center">
  <h3>
    <a href="https://kaneo.app/docs/core">Quick Start</a>
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

Learn more about Kaneo's features and capabilities in our [documentation](https://kaneo.app/docs/core).

## Sponsors

Kaneo is open source and free forever. If you find it useful, consider [sponsoring the project](https://github.com/sponsors/andrejsshell) to help support ongoing development.

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
```

Save this as `compose.yml`, create a `.env` file with your configuration (see the [documentation](https://kaneo.app/docs/core) for all required environment variables), run `docker compose up -d`, and open [http://localhost:5173](http://localhost:5173).

> **Important:** See our [full documentation](https://kaneo.app/docs/core) for detailed setup instructions, environment variable configuration, and troubleshooting guides.

### Development Setup

For development, see our [Environment Setup Guide](ENVIRONMENT_SETUP.md) for detailed instructions on configuring environment variables and troubleshooting common issues like CORS problems.

### Configuration

Kaneo requires several environment variables to be configured. The Docker Compose setup above handles the database automatically, but you'll need to configure environment variables for the API and web services.

For complete configuration instructions, including all required environment variables, database setup for non-Docker deployments, and advanced settings, see the [documentation](https://kaneo.app/docs/core).

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

# Create a .env file in the root with required environment variables
# See ENVIRONMENT_SETUP.md for detailed instructions

# Start development servers
pnpm dev
```

For contributing guidelines, code structure, and development best practices, check out our [contributing guide](CONTRIBUTING.md) and [documentation](https://kaneo.app/docs/core).

## Community

- **[Discord](https://discord.gg/rU4tSyhXXU)** - Chat with users and contributors
- **[GitHub Issues](https://github.com/usekaneo/kaneo/issues)** - Bug reports and feature requests
- **[Documentation](https://kaneo.app/docs/core)** - Detailed guides, API docs, and tutorials

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
