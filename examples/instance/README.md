# Example instance

This folder is what an operator keeps next to their Kaneo deployment: a small npm project whose `kaneo.config.ts` declares the plugins the instance runs.

```
instance/
├── package.json
├── kaneo.config.ts
└── tsconfig.json
```

```ts
import { defineConfig } from "@kaneo/config";
import taskProgress from "kaneo-plugin-task-progress";

export default defineConfig({
  plugins: [taskProgress({ autoComplete: true })],
});
```

Kaneo loads this file with Node's built-in TypeScript support, so there is nothing to compile.

## Check the config

The plugin ships typed options, so a typo or a wrong value is a type error before anything is deployed. From the repository root:

```bash
pnpm exec tsc -p examples/instance
```

`taskProgress({ autoComplete: "yes" })` fails with `Type 'string' is not assignable to type 'boolean | undefined'`.

## Run Kaneo with it

Build the plugin first (see [the plugin's README](../plugins/task-progress/README.md)), then start Kaneo from the repository root:

```bash
KANEO_CONFIG="$PWD/examples/instance/kaneo.config.ts" pnpm dev
```

Without `KANEO_CONFIG`, the API looks for `/kaneo/kaneo.config.ts`.

## Deploy with Docker Compose

In a real deployment, install the plugins with npm so `node_modules` is self-contained:

```bash
mkdir my-kaneo && cd my-kaneo
npm init -y
npm pkg set type=module
npm install @kaneo/config kaneo-plugin-task-progress
```

Write `kaneo.config.ts` as above and mount the folder at `/kaneo`:

```yaml
services:
  kaneo:
    image: ghcr.io/usekaneo/kaneo:latest
    volumes:
      - ./my-kaneo:/kaneo:ro
```

This folder's own `node_modules` uses pnpm links into the monorepo, so it only works for local development, not inside a container.

To bake the plugins into an image instead:

```Dockerfile
FROM ghcr.io/usekaneo/kaneo:latest
COPY . /kaneo
RUN npm ci --prefix /kaneo --omit=dev
```

Read more in the [plugin docs](https://kaneo.app/docs/core/plugins).
