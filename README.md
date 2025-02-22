<p align="center">
  <a href="https://kaneo.app">
    <img src="https://github.com/kaneo-app/.github/blob/main/profile/assets/logo-mono-rounded.png?raw=true" alt="Kaneo's logo" width="200" />
  </a>
</p>

<h1 align="center">Kaneo</h1>

<div align="center">

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/kaneo-app/app/ci.yml?branch=main)](https://github.com/kaneo-app/app/actions)
[![Discord](https://img.shields.io/discord/1326250681530843178?color=7389D8&label=&logo=discord&logoColor=ffffff)](https://discord.gg/vTKsVnqY)

</div>

<p align="center">An open source project management platform focused on simplicity and efficiency.</p>

<div align="center">
  <h3>
    <a href="https://kaneo.app/quick-start">Quick Start</a>
    <span> | </span>
    <a href="https://kaneo.app">Website</a>
    <span> | </span>
    <a href="https://demo.kaneo.app">Demo</a>
    <span> | </span>
    <a href="https://discord.gg/vTKsVnqY">Discord</a>
  </h3>
</div>

## ✨ Features

- 🚀 **Simple & Fast**: Minimalist interface with powerful features
- 🔒 **Self-hosted**: Full control over your data
- 🎨 **Customizable**: Make it yours with extensive customization options
- 🤝 **Open Source**: MIT licensed, free forever

## 🚀 Quick Start

1. Create a `compose.yml` file with the following content:

```yaml
services:
  backend:
    image: ghcr.io/kaneo-app/api:latest
    environment:
      JWT_ACCESS: "change_me"
      DB_PATH: "/app/apps/api/data/kaneo.db"
      RABBITMQ_URL: "amqp://guest:guest@rabbitmq:5672"
    ports:
      - 1337:1337
    restart: unless-stopped
    volumes:
      - sqlite_data:/app/apps/api/data
    depends_on:
      rabbitmq:
        condition: service_healthy

  frontend:
    image: ghcr.io/kaneo-app/web:latest
    environment:
      KANEO_API_URL: "http://localhost:1337"
    ports:
      - 5173:80
    depends_on:
      - backend
    restart: unless-stopped

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=guest
      - RABBITMQ_DEFAULT_PASS=guest
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  sqlite_data:
  rabbitmq_data:
```

2. Run `docker compose up -d` to start the services.

3. Open [http://localhost:5173](http://localhost:5173) in your browser.

4. Create your first project and start managing your tasks!

## 📖 Documentation

For detailed instructions and documentation, visit our [Documentation](https://kaneo.app/quick-start).

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 💬 Community

- [Discord](https://discord.gg/vTKsVnqY) - Chat with the community
- [GitHub Issues](https://github.com/kaneo-app/app/issues) - Report bugs or suggest features
- [Website](https://kaneo.app) - Official website

## 📝 License

This project is licensed under the [MIT License](LICENSE).