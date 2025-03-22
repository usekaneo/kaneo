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

<p align="center">An open source project management platform focused on simplicity and efficiency.</p>

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
    image: ghcr.io/usekaneo/api:latest
    environment:
      JWT_ACCESS: "change_me"
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
      - 5173:80
    restart: unless-stopped

volumes:
  sqlite_data:
```

2. Run `docker compose up -d` to start the services.

3. Open [http://localhost:5173](http://localhost:5173) in your browser.

4. Create your first project and start managing your tasks!

| Variable | Description |
| -------- | ----------- |
| `KANEO_API_URL` | The URL of the API |
| `JWT_ACCESS` | Secret key for generating JWT tokens |
| `DB_PATH` | The path to the database file |

## 📖 Documentation

For detailed instructions and documentation, visit our [Documentation](https://kaneo.app/quick-start).

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 💬 Community

- [Discord](https://discord.gg/rU4tSyhXXU) - Chat with the community
- [GitHub Issues](https://github.com/usekaneo/kaneo/issues) - Report bugs or suggest features
- [Website](https://kaneo.app) - Official website

## ❤️ Contributors & Supporters

### Contributors

Thank you to all the amazing contributors who have helped make Kaneo better!

<a href="https://github.com/usekaneo/kaneo/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=usekaneo/kaneo" alt="Contributors" />
</a>

### Sponsors

<a href="https://github.com/sponsors/usekaneo">
  <img src="https://raw.githubusercontent.com/usekaneo/kaneo/main/.github/sponsors.svg" alt="Sponsors" />
</a>

## 📝 License

This project is licensed under the [MIT License](LICENSE).