# @kaneo/plugin-sdk

Build plugins that extend [Kaneo](https://kaneo.app)'s API and web app.

A plugin is a normal npm package. Its server entry adds routes, reacts to task events and keeps data in per-workspace storage. Its web entry adds project views, task panels, workspace pages and commands. Operators declare plugins in `kaneo.config.ts` with [`@kaneo/config`](https://www.npmjs.com/package/@kaneo/config), and workspace admins turn them on per workspace.

Full guide: [Writing plugins](https://kaneo.app/docs/core/plugins/writing-plugins).

## What is in the package

| Import | Use it for |
|---|---|
| `@kaneo/plugin-sdk` | `definePlugin()`, the typed factory operators call in `kaneo.config.ts` |
| `@kaneo/plugin-sdk/server` | `defineServer()` and the server context: routes, webhooks, guards, events, storage, settings, scheduled jobs, logger |
| `@kaneo/plugin-sdk/web` | `defineWeb()` and hooks such as `usePluginApi`, `useTasks`, `useT` and `useOpenTask` |
| `@kaneo/plugin-sdk/ui` | Kaneo's own components: `Button`, `Badge`, `Input`, `Switch`, `Spinner` and more |
| `@kaneo/plugin-sdk/theme.css` | Tailwind tokens mapped to Kaneo's CSS variables |
| `kaneo-plugin build` | Bundles the plugin into `dist/` and checks the result |

## Quick start

```bash
npm install --save-dev @kaneo/plugin-sdk vite typescript react @types/react @tanstack/react-query hono zod
```

`package.json`:

```json
{
  "name": "kaneo-plugin-hello",
  "version": "0.1.0",
  "type": "module",
  "engines": { "kaneo": ">=2.29 <3" },
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./server": "./dist/server.js",
    "./web": "./dist/web/index.js"
  },
  "kaneo": { "name": "Hello" },
  "files": ["dist"],
  "scripts": { "build": "kaneo-plugin build" }
}
```

`src/index.ts`, the factory:

```ts
import { definePlugin } from "@kaneo/plugin-sdk";
import { z } from "zod";

export default definePlugin(import.meta.url, {
  options: z.object({ greeting: z.string().default("Hello") }),
});
```

`src/server.ts`, the API entry:

```ts
import { defineServer } from "@kaneo/plugin-sdk/server";
import plugin from "./index.js";

export default defineServer(plugin, {
  setup(kaneo) {
    kaneo.routes.get(
      "/workspaces/:workspaceId/hello",
      kaneo.guard.workspace("workspaceId"),
      (c) => c.json({ message: kaneo.options.greeting }),
    );
  },
});
```

`src/web.tsx`, the web entry:

```tsx
import { defineWeb } from "@kaneo/plugin-sdk/web";
import type { TaskPanelProps } from "@kaneo/plugin-sdk/web";

function HelloPanel({ taskId }: TaskPanelProps) {
  return <p>Hello from task {taskId}</p>;
}

export default defineWeb({
  taskPanels: [{ id: "hello", title: "Hello", component: HelloPanel }],
});
```

Build it:

```bash
npm run build
```

A plugin can ship only `src/server.ts` or only `src/web.tsx`. Remove the matching export from `package.json`.

## What `kaneo-plugin build` does

Run it from the plugin's folder. Add `--watch` to rebuild on changes.

1. Bundles `src/index.ts` and `src/server.ts` for Node 22+ into `dist/index.js` and `dist/server.js`. Every dependency is bundled in, so the package needs no install step on the server. Shared code goes to `dist/chunks/`.
2. Bundles `src/web.tsx` (or `src/web.ts`) into `dist/web/index.js` and `dist/web/index.css`. React, `react-dom`, `react/jsx-runtime` and `@tanstack/react-query` stay as imports, because Kaneo provides its own copies.
3. Writes `dist/index.d.ts` with the plugin's options type, using the plugin's own `typescript`. If the declaration would import packages that are only devDependencies (Zod, the SDK), the options type is written out inline instead, so operators get type checking without installing them.
4. Checks `package.json` and the output: every export points to a file that exists, the server bundle imports only Node built-ins, and the web bundle imports only the modules Kaneo shares.

The build uses Vite 7 or newer from the plugin's own dependencies, and your `vite.config.ts` still applies. For example, add `@tailwindcss/vite` there and import `@kaneo/plugin-sdk/theme.css` from your CSS to use Kaneo's colors.

## Example

[`examples/plugins/task-progress`](https://github.com/usekaneo/kaneo/tree/main/examples/plugins/task-progress) uses every part of the contract: options, settings, guarded routes, storage, events, a task panel, a project view and translations.

## License

MIT
