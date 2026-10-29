# @kaneo/config

Typed configuration for self-hosted [Kaneo](https://kaneo.app) instances. Use it in `kaneo.config.ts` to declare which plugins your instance runs.

## Set up

Create a small project next to your deployment and install the config package with the plugins you want. `@kaneo/config` is released with Kaneo under the same version, so install the one that matches your image tag, for example `@kaneo/config@<version>`:

```bash
mkdir my-kaneo && cd my-kaneo
npm init -y
npm pkg set type=module
npm install @kaneo/config kaneo-plugin-task-progress
```

Add `kaneo.config.ts`:

```ts
import { defineConfig } from "@kaneo/config";
import taskProgress from "kaneo-plugin-task-progress";

export default defineConfig({
  plugins: [taskProgress({ autoComplete: true })],
});
```

Each plugin's options are typed, so a wrong option is a type error in your editor. Read secrets from the environment, for example `apiToken: process.env.ACME_TOKEN`.

## Deploy

Mount the project at `/kaneo`. Kaneo runs the TypeScript file directly, there is no build step:

```yaml
services:
  kaneo:
    image: ghcr.io/usekaneo/kaneo:latest
    volumes:
      - ./my-kaneo:/kaneo:ro
```

Outside Docker, point `KANEO_CONFIG` at the file instead.

Plugins are off until a workspace admin enables them under **Settings → Plugins**.

Read more in the [plugin docs](https://kaneo.app/docs/core/plugins).

## License

MIT
