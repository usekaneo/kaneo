# Task progress

An example Kaneo plugin that tracks a percent value (0 to 100) on every task. It is small on purpose and touches every part of the plugin contract, so you can copy it as a starting point.

## What it shows

| File | What it demonstrates |
|---|---|
| `src/index.ts` | The typed factory. Operators call `taskProgress({ autoComplete: true })` in `kaneo.config.ts`, and the Zod schema validates the options at boot. |
| `src/server.ts` | `defineServer()` with a workspace setting (`doneStatus`), guarded routes, per-workspace storage and event handlers. |
| `src/server/` | The routes and events, split into small modules. |
| `src/web.tsx` | `defineWeb()` with a project view, a task panel and en-US translations. |
| `src/web/` | React components and TanStack Query hooks that call the plugin's routes through `usePluginApi()`. |
| `src/web.css` | Plain CSS that uses Kaneo's CSS variables, so the plugin follows light and dark mode. Class names start with `ktp-`. |

### Server

Routes live under `/api/plugins/kaneo-plugin-task-progress`. The id comes from the package name.

| Route | Guard | Response |
|---|---|---|
| `GET /projects/:projectId/progress` | `task: ["read"]` on the project | `{ progress: { [taskId]: number } }` |
| `GET /projects/:projectId/tasks/:taskId/progress` | `task: ["read"]` on the task | `{ value: number }` |
| `PUT /projects/:projectId/tasks/:taskId/progress` | `task: ["update"]` on the task | `{ value: number }`, or `400` unless the body is `{ value }` with a whole number from 0 to 100 |

Values are stored under `progress:<projectId>:<taskId>`. The plugin also reacts to events:

- `task.status_changed`: sets the task to 100 when the `autoComplete` option is on and the new status matches the workspace's `doneStatus` setting.
- `task.moved`: moves the stored value to the new project.
- `task.deleted`: removes the stored value.
- `project.moved`: moves the project's values from the old workspace's storage to the new one, keeping any value already set there.

### Web

- **Task panel:** the current percent, quick buttons for 0, 25, 50, 75 and 100, and a slider. Changes are saved optimistically.
- **Project view:** the average progress of the project and one row per task. Clicking a row opens the task.

## Build

`kaneo-plugin build` (from `@kaneo/plugin-sdk`) writes:

```
dist/index.js        typed factory, imported by kaneo.config.ts
dist/index.d.ts      options type for kaneo.config.ts, with no dependency imports
dist/server.js       server entry, with every dependency bundled in
dist/chunks/         code shared by index.js and server.js
dist/web/index.js    browser ES module, React and TanStack Query come from Kaneo
dist/web/index.css   styles for the web entry
```

## Run it locally

From the repository root:

```bash
pnpm install
pnpm --filter @kaneo/plugin-sdk --filter @kaneo/config build
pnpm --filter kaneo-plugin-task-progress build
KANEO_CONFIG="$PWD/examples/instance/kaneo.config.ts" pnpm dev
```

If `kaneo-plugin` is not found on a fresh clone, run `pnpm install` once more after building the SDK so pnpm links its binary.

Then, in Kaneo:

1. Open **Settings → Plugins** and enable **Task progress** for your workspace.
2. Open a task to see the **Progress** panel.
3. Open a project and pick the **Progress** view.

Rebuild on every change with:

```bash
pnpm --filter kaneo-plugin-task-progress exec kaneo-plugin build --watch
```

Restart the API after a server change. The web entry is picked up on the next page load.

Read more in the [plugin docs](https://kaneo.app/docs/core/plugins/writing-plugins).
