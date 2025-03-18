# Contributing to Kaneo

Thank you for your interest in contributing to Kaneo! All kinds of contributions are valuable to us. This guide will help you get started with the contribution process.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Requirements](#requirements)
  - [Local Development Setup](#local-development-setup)
- [Making Contributions](#making-contributions)
  - [Finding Issues to Work On](#finding-issues-to-work-on)
  - [Creating Pull Requests](#creating-pull-requests)
- [Development Guidelines](#development-guidelines)
  - [Code Style](#code-style)
  - [Conventional Commits](#conventional-commits)
  - [Project Structure](#project-structure)
- [Need Help?](#need-help)

## Code of Conduct

We are a community-driven project and we expect all contributors to follow our Code of Conduct. Please read it before participating. [Code of Conduct](https://www.contributor-covenant.org/version/2/0/code_of_conduct/)

## Getting Started

### Requirements

- Docker
- Docker Compose
- Git

### Local Development Setup

1. Fork and clone the repository:

```bash
git clone https://github.com/usekaneo/kaneo.git
```

2. Install the dependencies:

```bash
bun install
```

3. Add JWT_ACCESS environment variable:

```bash
echo "JWT_ACCESS=<token>" > apps/api/.env
```

4. Start the development server:

```bash
bun run dev
```

This will start the frontend and backend servers on [http://localhost:5173](http://localhost:5173) and [http://localhost:1337](http://localhost:1337) respectively.

## Making Contributions

### Finding Issues to Work On

- Check the [issues](https://github.com/usekaneo/kaneo/issues) page for open issues.
- Check the [Discord server](https://discord.gg/rU4tSyhXXU) for help with issues.

### Creating Pull Requests

- Create a new branch for your changes.
- Make your changes and commit them using conventional commits:

```bash
git commit -m "feat: add new feature"
```

- Push your changes to your fork.

```bash
git push origin my-branch
```

- Create a pull request.

## Development Guidelines

### Code Style

- Use `biome` for code style and linting.
- The project is configured with Biome's recommended rules.
- Run `bun x biome ci .` before committing to ensure your code follows the style guide.

### Conventional Commits

- Use [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages.
- Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Project Structure

- `apps/api/`: The backend API server.
- `apps/web/`: The frontend web application.
- `packages/`: Shared packages and configurations.

## Need Help?

- Check the [Discord server](https://discord.gg/rU4tSyhXXU) for help.
- Open an [issue](https://github.com/usekaneo/kaneo/issues) if you need help.

Thank you for your contribution to Kaneo! 🎉
