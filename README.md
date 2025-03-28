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
| `ALLOW_REGISTRATION` | Enable/disable new user registration (default: true) |

## 🚢 Kubernetes Deployment

Kaneo can also be deployed on Kubernetes using our Helm chart:

1. Clone this repository:

```bash
git clone https://github.com/usekaneo/kaneo.git
cd kaneo
```

2. Install the Helm chart:

```bash
helm install kaneo ./charts/kaneo --namespace kaneo --create-namespace
```

3. Access Kaneo:

```bash
# Port forward to access both services
kubectl port-forward svc/kaneo-web 5173:80 -n kaneo &
kubectl port-forward svc/kaneo-api 1337:1337 -n kaneo &

# Access the application at http://localhost:5173
# The web frontend will communicate with the API at http://localhost:1337
```

### Production Deployments

For production environments, we recommend using Ingress to expose Kaneo:

```bash
# Basic installation with ingress
helm install kaneo ./charts/kaneo \
  --namespace kaneo \
  --create-namespace \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set "ingress.hosts[0].host=kaneo.example.com"
```

For detailed production deployment examples, including:

- TLS configuration
- Cert-manager integration
- Path rewriting with regex capture groups
- Gateway API usage
- Resource configuration

Please refer to the [Helm chart documentation](./charts/kaneo/README.md).

### Local Deployments with Minikube

For local deployments with Minikube:

1. Start Minikube:

```bash
minikube start
```

2. Install the Helm chart with Ingress enabled:

```bash
helm install kaneo ./charts/kaneo \
  --namespace kaneo \
  --create-namespace \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set "ingress.hosts[0].host=kaneo.local"
```

3. Enable the Ingress addon if not already enabled:

```bash
minikube addons enable ingress
```

4. Access Kaneo based on your OS:

#### macOS

For macOS, you need to use `minikube tunnel` to access the Ingress:

```bash
# Start minikube tunnel in a separate terminal
minikube tunnel
```

Update your /etc/hosts file:

```bash
# Add to /etc/hosts
127.0.0.1 kaneo.local
```

Access Kaneo at http://kaneo.local

#### Linux/Windows

Get the Minikube IP:

```bash
minikube ip
```

Update your hosts file with the Minikube IP:

```bash
# Add to /etc/hosts (Linux) or C:\Windows\System32\drivers\etc\hosts (Windows)
192.168.49.2 kaneo.local  # Replace with the actual Minikube IP
```

Access Kaneo at http://kaneo.local

## 📖 Documentation

For detailed instructions and documentation, visit our [Documentation](https://kaneo.app/quick-start).

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 💬 Community

- [Discord](https://discord.gg/rU4tSyhXXU) - Chat with the community
- [GitHub Issues](https://github.com/usekaneo/kaneo/issues) - Report bugs or suggest features
- [Website](https://kaneo.app) - Official website

## ❤️ Sponsors

<!-- sponsors --><!-- sponsors -->

## 👥 Contributors

<p align="center">
  <img src="CONTRIBUTORS.svg" alt="Contributors" />
</p>

## 📝 License

This project is licensed under the [MIT License](LICENSE).
