# Contributing to Kaneo

Thanks for wanting to contribute to Kaneo! Whether you're fixing bugs, adding features, or improving docs, we appreciate your help.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Making Your First Contribution](#making-your-first-contribution)
  - [Finding Something to Work On](#finding-something-to-work-on)
  - [The Process](#the-process)
- [Development Guidelines](#development-guidelines)
  - [Code Style](#code-style)
  - [Commit Messages](#commit-messages)
  - [Localization (i18n)](#localization-i18n)
  - [Project Structure](#project-structure)
- [Using AI](#using-ai)
- [Need Help?](#need-help)

## Code of Conduct

We want everyone to feel welcome here. Please be respectful and follow our [Code of Conduct](https://www.contributor-covenant.org/version/2/0/code_of_conduct/).

## Getting Started

Fork and clone the repository:

```bash
git clone https://github.com/yourusername/kaneo.git
cd kaneo
```

Follow the [local development setup guide](ENVIRONMENT_SETUP.md) for prerequisites, database and environment configuration, installation, startup, and troubleshooting.

## Making Your First Contribution

### Finding Something to Work On

- **Browse [open issues](https://github.com/usekaneo/kaneo/issues)** - look for "good first issue" labels
- **Check our [Discord](https://discord.gg/rU4tSyhXXU)** - we often discuss features and bugs there
- **Found a bug?** Feel free to fix it and open a PR

### The Process

1. **Create a branch** for your work:
```bash
git checkout -b fix/whatever-youre-fixing
# or
git checkout -b feat/cool-new-feature
```

2. **Make your changes** and test them locally (`pnpm test` for unit tests; `pnpm test:integration` for API integration tests with PostgreSQL)

3. **Commit using conventional commits**:
```bash
git commit -m "fix: resolve calendar date selection bug"
git commit -m "feat: add bulk task operations"
git commit -m "docs: update deployment guide"
```

4. **Push and create a PR**:
```bash
git push origin your-branch-name
```

Then open a pull request on GitHub with a clear description of what you changed and why.

## Development Guidelines

### Code Style

We use **Vite+** for development, workspace tasks, testing, formatting, and linting.
It is pinned in `pnpm-workspace.yaml`; a global `vp` installation is optional.
Before you commit:

```bash
pnpm run lint
pnpm run typecheck
```

`pnpm lint` checks formatting and lint rules without changing files. Use
`pnpm format` to format the repository or `pnpm exec vp check --fix` to also apply
safe lint fixes. Install the recommended Vite Plus extension pack for editor support.

The existing `pnpm build`, `pnpm dev`, `pnpm test`, and `pnpm test:integration`
commands use the Vite+ task runner. Package tasks in `vite.config.ts` build their
workspace dependencies before compiling, testing, or checking types. Build and
typecheck results are cached; tests and development servers always run. Web builds
always run too, so a cached build cannot skip a Sentry source-map upload.

Use `pnpm --filter @kaneo/web dev` to start just the web app, or
`pnpm exec vp run --filter @kaneo/api test` to run API unit tests with dependency
builds. `pnpm exec vp test run` runs the unit-test projects directly; PostgreSQL
integration tests remain behind `pnpm test:integration`.

Vite+ built-ins and package scripts are distinct: `vp build` builds a Vite app,
while `vp run build` runs the package's build script. The API still uses esbuild,
the site uses Next.js, and libraries use TypeScript to preserve their output.
Typechecking remains an explicit package task so both web tsconfigs are covered.
The root lint configuration preserves the previous policy where equivalents exist;
additional React Compiler and accessibility rules are left for a separate review.

### Commit Messages

We use [conventional commits](https://www.conventionalcommits.org/) to keep our history clean:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code changes that don't add features or fix bugs
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Localization (i18n)

Kaneo uses [i18next](https://www.i18next.com/) with [react-i18next](https://react.i18next.com/) in the web app. We want user-facing copy to stay consistent, translatable, and easy to maintain.

#### Approach

- Use translation keys for all user-facing strings instead of hardcoded copy
- In React components, call `t("namespace:key.path")` from `useTranslation()`
- Translation files live in [`i18n/`](./i18n) and use locale-style filenames such as `en-US.json` and `de-DE.json`
- [`i18n/en-US.json`](./i18n/en-US.json) is the source of truth for translation keys
- Locale selection comes from the signed-in user's saved preference when available, otherwise from the browser locale

#### i18n commands

The root `package.json` includes scripts to keep locale files in sync:

| Command | Description |
| ------- | ----------- |
| `pnpm i18n:check [locale]` | Compares `en-US.json` with the other locale files and reports missing or extra keys. You can filter by locale, for example `pnpm i18n:check de-DE`. |
| `pnpm i18n:check:fix [locale]` | Adds missing keys to other locale files using the English source text from `en-US.json`. |
| `pnpm i18n:report` | Scans `.ts` and `.tsx` files in the React app and reports missing keys, unused locale keys, and dynamic translation calls that static analysis cannot verify. |
| `pnpm i18n:report:fix` | Removes unused keys from `en-US.json` and the other locale files. |
| `pnpm i18n:schema` | Generates [`i18n/schema.json`](./i18n/schema.json) from `en-US.json` for editor and tooling validation. |

#### Adding a new locale

1. Create a new file in [`i18n/`](./i18n) using a locale code filename such as `fr-FR.json`.
2. Copy [`i18n/en-US.json`](./i18n/en-US.json) and translate the values.
3. Register the locale in [`i18n/resources.ts`](./i18n/resources.ts) by updating `supportedLocales` and `resources`.
4. If the locale should be selectable in the UI, add it to the language picker in [`apps/web/src/routes/_layout/_authenticated/dashboard/settings/account/preferences.tsx`](./apps/web/src/routes/_layout/_authenticated/dashboard/settings/account/preferences.tsx).
5. Run `pnpm i18n:check`, `pnpm i18n:report`, and `pnpm i18n:schema` before opening your PR.

#### Adding translations

1. Add the new key to [`i18n/en-US.json`](./i18n/en-US.json) first.
2. Use it in code with a static key:

```tsx
const { t } = useTranslation();

return <p>{t("common:actions.close")}</p>;
```

3. Use interpolation for dynamic values instead of concatenating translated strings:

```tsx
t("projects:greeting", { name: userName });
```

4. Keep translation keys static. Calls like `t(someVariable)` or ``t(`tasks:${key}`)`` cannot be validated by the i18n report and will be flagged.

#### Translation key conventions

- Use namespaces at the top level such as `common`, `settings`, and `tasks`
- Use dot notation inside each namespace, for example `settings.preferencesPage.title`
- Keep keys descriptive and stable
- Put widely shared labels in `common`
- Group feature-specific keys under the feature or component they belong to

#### Contribution notes

- If you change UI copy, update the locale files in the same PR
- If you remove or rename translation keys, run `pnpm i18n:report:fix` to keep locale files clean
- If a locale is not fully translated yet, leaving the English source text as a placeholder is fine

### Project Structure

```
kaneo/
├── apps/
│   ├── api/          # Backend API (Node.js/Hono)
│   ├── docs/         # Product and API documentation content
│   ├── site/         # Public website and documentation host (Next.js)
│   └── web/          # Frontend app (React/Vite)
├── packages/
│   ├── email/        # Shared email utilities and templates
│   ├── libs/         # Typed API client and shared runtime helpers
│   ├── mcp/          # Published stdio MCP package
│   ├── permissions/  # Shared permission vocabulary and built-in roles
│   └── ...            # Import tooling and shared TypeScript configuration
├── tests/            # API unit and integration tests
└── charts/           # Kubernetes Helm chart
```

## Using AI

Please read and follow our [AI Contribution Policy](AI_POLICY.md), which adopts the [Human Voice policy](https://ai-policy.dev/policies/human-voice/).

## Need Help?

- **Discord**: Join our [Discord server](https://discord.gg/rU4tSyhXXU) for real-time help
- **Issues**: Open a [GitHub issue](https://github.com/usekaneo/kaneo/issues) for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions about contributing

## Types of Contributions We Love

- **Bug fixes** - Found something broken? Fix it!
- **New features** - Have an idea? Let's discuss it first
- **Documentation** - Help others understand how to use Kaneo
- **Performance improvements** - Make things faster
- **Accessibility** - Help make Kaneo usable for everyone

Thanks for contributing to Kaneo! 🚀
