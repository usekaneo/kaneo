# RFC: Kaneo plugins

**Status:** Draft
**Discussion:** #1810

## Summary

Kaneo gets a plugin system. A plugin is an npm package that can extend both the API and the web app. Operators declare plugins in a typed `kaneo.config.ts`. Kaneo loads them at boot without rebuilding anything, and each workspace decides whether to use them. Kaneo's own optional features are built on the same contract, starting with the Gantt view.

## Motivation

Kaneo is deliberately simple. That keeps it fast to use and cheap to maintain, but it also means saying no to features some teams genuinely need. #1810 is a good example: dependency types, critical paths, automatic rescheduling, non-working days. Today the only ways to get them are a fork or a large PR that maintainers have to absorb and support forever.

Plugins add a third option: build it, publish it, run it. Core stays small. Maintainers review one plugin API instead of every feature, and teams that need more can have it without waiting for us.

## Goals

- Extend both the backend and the frontend through a small, typed, versioned contract.
- Make installing declarative, typed and reviewable in git. No free-text package boxes, no comma-separated env vars, no zip uploads.
- No build step for operators. Upgrading Kaneo stays "pull the new image and restart".
- Nothing changes for instances without plugins.
- Respect workspace boundaries. Installing a plugin on an instance does not force it on every workspace.
- Build Kaneo's own optional features on the same contract.

## Non-goals for v1

- Sandboxing untrusted code. Plugins are trusted code, like any npm dependency.
- Third-party plugins on Kaneo Cloud.
- Installing plugins from the admin UI.
- Plugin-owned SQL tables, board card badges, MCP tools and plugin realtime events. These can come later.

## Prior art

### Project management tools

| Tool | Plugins | How a Docker operator adds one |
|---|---|---|
| Plane | No. OAuth apps and webhooks only | Not possible on Community Edition ([docs](https://developers.plane.so/dev-tools/mcp-server-self-host)) |
| Linear | No. API, webhooks and agents | n/a |
| OpenProject | Ruby gems | Build a custom image ("the docker image itself does not support plugins") |
| Taiga | Django apps and frontend bundles | Build a custom backend image and edit `conf.json` |
| Redmine, Kanboard, Leantime, Vikunja | In-process code | Drop it into a `plugins/` folder and restart. Kanboard and Leantime also install from the UI; Kanboard now ships that off by default, and Leantime had a bug that let any logged-in user install plugins |
| YouTrack, Jira Cloud | Apps | Sandboxed iframes at fixed extension points |
| Mattermost | Web bundle plus server subprocess | Signed marketplace. The web bundle loads at runtime and shares the host's React |

### Other self-hosted apps

- **n8n:** plugins are declared as a JSON list with pinned versions and reconciled on every boot. n8n refuses to start if an unverified package has no checksum ([docs](https://docs.n8n.io/integrations/community-nodes/installation-and-management/environment-variable-installation)).
- **Backstage / Red Hat Developer Hub:** `dynamic-plugins.yaml` lists packages with integrity hashes and config, an init step installs them, and the frontend loads at runtime. The newer admin UI edits that same file ([docs](https://github.com/redhat-developer/rhdh/blob/main/docs/dynamic-plugins/installing-plugins.md)).
- **Grafana:** UI catalog, signed plugins, and frontend plugins loaded at runtime with an import map of shared dependencies. Grafana's move to React 19 forced every plugin to rebuild.
- **Directus:** a mounted folder or the marketplace. App extensions are bundled when the server starts, and a sandboxed mode exists for API extensions.
- **Payload, Strapi, Astro:** typed TypeScript config, but every operator builds their own image.
- **Discourse:** plugins are added with `git clone` and a container rebuild. That was painful enough that around 30 popular plugins were moved into core.

### opencode

[opencode](https://opencode.ai/docs/plugins/) is a coding agent, not a self-hosted server, but its plugin system is the closest match to this design:

- **Declaring:** plugins are listed in `opencode.json` as strings or `[spec, options]` pairs, such as `"pkg@1.2.3"` or `["pkg", { "foo": true }]`.
- **Entries:** a plugin's entries are standard npm `exports` (`./server` and `./tui`). Its supported host versions are a semver range in `engines.opencode`.
- **Loading:** each plugin goes through resolve, find the entry, check compatibility, import, start, and a failure skips that one plugin.
- **Hooks:** they receive `(input, output)` and adjust `output`, for example `tool.execute.before`. They run in a fixed order.
- **UI plugins:** they get typed named slots, routes, keymaps and dialogs, with a cleanup scope per plugin.
- **Its own features are plugins:** model providers, sidebar sections and the plugin manager are built on the same contract and can be switched off. In its next version even the external plugin loader is a plugin.

Its open issues come from the untyped string declarations and from installing at startup:
- A name without a version means `@latest`, cached forever.
- Startup hangs when the registry times out.
- Load errors are dropped silently.
- Options are never validated.

### What we take from this

1. No self-hosted project management tool has a good plugin story. Plane's free edition cannot even register apps.
2. Loading frontend code at runtime and sharing the host's React works (Grafana, Mattermost). The shared surface has to stay small, because a React major upgrade breaks every plugin.
3. Installed per instance, enabled per project or workspace (Redmine, OpenProject, YouTrack) matches how teams actually share instances.
4. Every mature system declares a host version range and checks it. Grafana skipped the check for a few releases and regretted it.
5. Installing from the UI keeps state out of version control and has caused security incidents. Declared config, reconciled on boot, holds up better in Docker and Kubernetes.
6. A typed config is the best authoring experience, but nobody offers one without making operators build an image. That gap is our opportunity.
7. Building the host's own features as plugins works and keeps the contract honest (opencode).
8. Standard npm fields (`exports`, `engines`) are enough to describe a plugin. A custom manifest format is not needed.

## Design

The design has four layers. Each answers one question.

| Layer | Question | Who |
|---|---|---|
| Contract | What can a plugin do? | Plugin authors, Kaneo itself |
| Declaration | Which plugins does this instance run? | Operators |
| Catalog | Which plugins exist, and can I trust them? | Everyone |
| Adoption | Which plugins does this workspace use? | Workspace admins |

### 1. Contract: `@kaneo/plugin-sdk`

#### Package anatomy

A plugin is a normal npm package described only with standard fields:

```json
{
  "name": "kaneo-plugin-progress",
  "version": "1.2.0",
  "type": "module",
  "keywords": ["kaneo-plugin"],
  "engines": { "kaneo": ">=2.31 <3" },
  "exports": {
    ".": "./dist/index.js",
    "./server": "./dist/server.js",
    "./web": "./dist/web/index.js"
  },
  "kaneo": { "name": "Task progress" }
}
```

- **`exports`:** `.` is the typed factory used in `kaneo.config.ts`, `./server` is the API entry and `./web` is the web entry. A plugin can ship only one of `./server` and `./web`.
- **`engines.kaneo`:** the Kaneo versions the plugin supports, as a semver range. npm's registry returns it for every published version, so Kaneo can pick a compatible version without downloading anything.
- **`kaneo`:** optional. It holds a display name and, if needed, an `id` override. By default the id is derived from the package name (`@acme/kaneo-reports` becomes `acme-kaneo-reports`). The id namespaces the plugin's routes and storage, so it has to stay stable.

`kaneo-plugin build` produces self-contained bundles. Every dependency is bundled in, there are no install scripts and no native modules. That lets the same `node_modules` work on a laptop, in a container and on any CPU architecture.

The package's default export is a typed factory:

```ts
// src/index.ts
import { definePlugin } from "@kaneo/plugin-sdk";
import { z } from "zod";

export default definePlugin(import.meta.url, {
  options: z.object({
    autoComplete: z.boolean().default(true),
  }),
});
```

#### Options and settings

A plugin has two kinds of configuration:

- **Options** are set by the operator in `kaneo.config.ts`. They are typed by a Standard Schema validator (Zod, Valibot and so on) and validated at boot. Secrets come from the environment.
- **Settings** are set by workspace admins in the UI. They are declared as fields (`text`, `secret`, `number`, `boolean`, `select`, `multiselect`) so Kaneo can render the form and validate input. Secret fields are write-only.

#### Server API

```ts
// src/server.ts
import { defineServer } from "@kaneo/plugin-sdk/server";

export default defineServer({
  settings: {
    doneStatus: { type: "text", label: "Status that counts as done", default: "done" },
  },
  setup(kaneo) {
    kaneo.routes.put(
      "/tasks/:taskId/progress",
      kaneo.guard.task("taskId", { task: ["update"] }),
      async (c) => {
        const { value } = await c.req.json();
        await kaneo.storage(c.get("workspaceId")).set(`task:${c.req.param("taskId")}`, value);
        return c.json({ value });
      },
    );

    kaneo.on("task.status_changed", async (event) => {
      const { doneStatus } = await kaneo.settings(event.workspaceId);
      if (!kaneo.options.autoComplete || event.to !== doneStatus) return;
      await kaneo.storage(event.workspaceId).set(`task:${event.taskId}`, 100);
    });
  },
});
```

What the server side gets in v1:

- **Routes** under `/api/plugins/<id>/*`, behind normal session or API key authentication. Guards (`guard.workspace`, `guard.project`, `guard.task`) reuse Kaneo's workspace access and permission checks, and also check that the plugin is enabled in that workspace.
- **Webhooks** under `/api/plugins/<id>/webhooks/*`, without authentication, for inbound integrations.
- **Typed events**, a curated and stable catalog: `task.created`, `task.status_changed`, `task.priority_changed`, `task.title_changed`, `task.description_changed`, `task.due_date_changed`, `task.assignee_changed`, `task.moved`, `task.deleted` and `comment.created`. Every event carries `workspaceId`, `projectId`, `taskId` and `actorId`, and is delivered only to workspaces that have the plugin enabled. Events are mapped from Kaneo's internal events, so internals can change without breaking plugins.
- **Storage**: JSON key/value per plugin and workspace, deleted together with the workspace.
- **Settings**, typed per workspace, and **options**, typed per instance.
- **Scheduled jobs** that run once across replicas, using Kaneo's existing job lease.
- **A logger** that prefixes every line with the plugin id.

Plugins talk to Kaneo through this context, never through Kaneo's database tables. Workspace permissions stay enforced, and Kaneo's schema can keep changing.

#### Events now, hooks later

Events report what already happened, and a plugin reacts to them. Some plugins will need to shape what happens instead: fill in a default when a task is created, or reject a status change that breaks a rule. For that, a later version adds hooks in the opencode style:

```ts
kaneo.hook("task.create.before", async (input, output) => {
  output.priority ??= "medium";
});
```

- A hook receives the input and an `output` it may change.
- Hooks run in the order plugins are declared, so the result is predictable.
- A hook that throws rejects the operation with the plugin's error message.

v1 ships events only. The context keeps the `hook` name and shape reserved, so adding hooks later does not break any plugin.

#### Web API

```tsx
// src/web.tsx
import { defineWeb } from "@kaneo/plugin-sdk/web";
import { ProgressPanel } from "./progress-panel";
import { ProgressView } from "./progress-view";

export default defineWeb({
  taskPanels: [{ id: "progress", title: "Progress", component: ProgressPanel }],
  projectViews: [{ id: "progress", title: "Progress", component: ProgressView }],
});
```

Extension points in v1:

- **Project views:** extra tabs next to Board, Backlog, Calendar and Gantt.
- **Task panels:** sections in the task detail sheet and on the full task page.
- **Workspace pages:** a sidebar entry and a page.
- **Commands:** items in the command palette.
- **Settings panel:** custom UI under the generated settings form.

Hooks give plugins their workspace settings, a fetch client for their own routes, task and project data, the current user, translations and navigation. `@kaneo/plugin-sdk/ui` exposes a few host components (Button, Badge, Input, Switch and so on), and `@kaneo/plugin-sdk/theme.css` maps Tailwind tokens to Kaneo's CSS variables, so plugins look native in light and dark mode.

### 2. Declaration: `kaneo.config.ts`

An instance with plugins has a small project:

```
my-kaneo/
├── package.json
├── package-lock.json
└── kaneo.config.ts
```

```ts
// kaneo.config.ts
import { defineConfig } from "@kaneo/config";
import progress from "kaneo-plugin-progress";
import reports from "@acme/kaneo-reports";

export default defineConfig({
  official: { gantt: false },
  plugins: [
    progress({ autoComplete: true }),
    reports({ apiToken: process.env.ACME_REPORTS_TOKEN }),
  ],
});
```

- **Typed:** a wrong plugin name is an unresolved import, and a wrong option is a type error, all in the editor before anything is deployed.
- **Versioned by npm:** the version is pinned in the lockfile. Operators never type version numbers.
- **Compatible by default:** `kaneo add kaneo-plugin-progress` reads `engines.kaneo` from the registry and installs the newest version that supports the Kaneo you run. A plain `npm i` also works, and `kaneo check` and boot catch a version that does not fit.
- **No build:** Node 24, which Kaneo's image already uses, runs TypeScript config files directly. Plugins are self-contained JavaScript, so the project's `node_modules` works inside the container as is.

#### Deploying

Docker Compose mounts the project:

```yaml
services:
  kaneo:
    image: ghcr.io/usekaneo/kaneo:2.31
    volumes:
      - ./my-kaneo:/kaneo:ro
```

Kubernetes and platforms like Coolify or Railway bake it into a thin image. That only copies files and runs `npm ci`; nothing is compiled:

```Dockerfile
FROM ghcr.io/usekaneo/kaneo:2.31
COPY --chown=appuser:appuser . /kaneo
RUN npm ci --prefix /kaneo --omit=dev
```

Operators without Node can use the CLI shipped in the image:

```bash
docker run --rm -v "$PWD:/kaneo" ghcr.io/usekaneo/kaneo kaneo add kaneo-plugin-progress
```

#### Boot validation

At boot, and in a `kaneo check` dry run, every plugin goes through the same stages:

| Stage | Checks |
|---|---|
| resolve | The package is installed in the project |
| entry | Its `exports` point to files that exist inside the package |
| compatibility | `engines.kaneo` includes the running Kaneo version |
| options | The options pass the plugin's schema |
| import | The server entry loads |
| start | `setup` finishes without throwing, and the id is not already taken |

A failure stops the boot, the same way a broken compose file would. The message names the plugin, the stage and the fix:

```
Plugin "kaneo-plugin-progress" failed at compatibility:
1.2.0 supports Kaneo >=2.31 <3, this is Kaneo 3.0.0.
Run `kaneo add kaneo-plugin-progress` to pick a compatible version, or remove it from kaneo.config.ts.
``` Kubernetes rolling updates then keep the old pods serving. Errors at runtime (an exception in an event handler, a failing route) are isolated, logged against the plugin and shown in the admin area. They never take Kaneo down.

### 3. Catalog

A `usekaneo/plugins` repository holds an index of listed plugins: npm name, source repository, maintainers and supported Kaneo versions. Authors open a pull request to be listed. Automated checks verify that the package builds, the manifest is valid, a compatibility range is declared, there are no install scripts, and the package is published with [npm provenance](https://docs.npmjs.com/generating-provenance-statements). The index powers a plugins page on kaneo.app.

`kaneo add` warns before adding an unlisted package, and the admin area marks installed plugins as listed or unlisted. Listing is a light review, not a security audit, and the docs say so plainly.

### 4. Adoption: per workspace

The declaration decides what the instance offers. Workspace admins with `workspace:manage_settings` decide what their workspace uses: Settings → Plugins lists the installed plugins with an enable toggle and the generated settings form. Plugins are off until a workspace turns them on.

### Official plugins

Kaneo's own optional features use the same contract and ship inside the image, on by default. The first one is the Gantt view, extracted into `@kaneo/gantt`. That proves the contract on a real feature and gives #1810 a concrete path: fork `@kaneo/gantt`, add dependency types and critical paths, publish it as a new package, and operators swap one line in their config.

Other features can move over time, for example the Calendar view and the built-in integrations (GitHub, Slack, Discord and the rest).

## Runtime architecture

**API**
- Loads each plugin's server entry in-process at boot, after migrations.
- Routes `/api/plugins/<id>/*` to the plugin and serves plugin web assets from the installed package.
- Bridges internal events to the typed catalog, resolving the workspace and filtering by enablement.
- Adds two tables: `workspace_plugin` (enabled flag and settings) and `plugin_storage`.
- Adds two core routes to the OpenAPI spec: `GET /api/plugins` and `PUT /api/plugins/{id}/workspace/{workspaceId}`.

**Web**
- The build emits an import map so plugin bundles share Kaneo's `react`, `react-dom`, `react/jsx-runtime` and `@tanstack/react-query`: one React instance and one query cache.
- After sign-in, the app loads the bundles of plugins enabled in the current workspace and renders each contribution inside an error boundary and suspense, so a failing plugin only breaks its own slot.
- This works the same for the bundled image and for separately hosted API and web.

## Compatibility and upgrades

- `@kaneo/plugin-sdk` follows semver. The stable surface is the SDK API, the event catalog, the slot props and the shared dependency versions.
- Breaking changes to that surface only happen in Kaneo major versions, with a deprecation period. A React major upgrade is an SDK major.
- To upgrade Kaneo, bump the image tag and `@kaneo/config` together (Renovate can group them), then run `kaneo check`, then deploy. A plugin that does not support the new version fails the check, not production.

## Trust and security

Plugins run in-process with the same access as Kaneo itself, like any npm dependency or Vite plugin. The design keeps that trust deliberate:

- Only operators add plugins, through a reviewed file. There is no install box in the UI.
- Versions are exact through the lockfile and verified by npm integrity hashes.
- No install scripts and no native code, because plugins are self-contained bundles.
- The catalog and npm provenance give a trust signal before adding a plugin.
- Each workspace opts in. Plugin routes go through Kaneo's authentication and permission guards, and plugin data is scoped to its workspace.
- `DISABLE_PLUGINS=true` turns the whole system off, matching the existing `DISABLE_*` flags.

## Data lifecycle

- Disabling a plugin in a workspace keeps its data.
- Removing a plugin from the config keeps its data. The admin area shows it as orphaned.
- `kaneo plugin purge <id>` deletes a plugin's data explicitly.
- Deleting a workspace deletes its plugin data.

## Rollout

1. **Foundation:** the SDK, the API and web hosts, `@kaneo/config`, the first five web extension points, an example third-party plugin (task progress), and documentation for operators and plugin authors.
2. **Proof:** extract the Gantt view into `@kaneo/gantt`.
3. **Ecosystem:** the `usekaneo/plugins` catalog, the kaneo.app plugins page, and the `kaneo add`, `kaneo check` and `kaneo plugin purge` commands.
4. **Later:** hooks that shape operations (`task.create.before` and similar), more official plugins, board card badges, MCP tools, plugin realtime events, and an admin UI that edits the same declaration.

## Alternatives considered

- **A list of packages in an env var or JSON config** (n8n, opencode): fine for machines, but untyped. Operators guess names, versions and option shapes, and only find out at boot. opencode's open issues show where that leads: `@latest` versions that never refresh, and options nobody validates.
- **Installing from npm in the admin UI** (Grafana, Kanboard): easy to start, but a free-text box invites typos and lookalike packages, the state lives outside version control, and it has caused real security incidents elsewhere.
- **Uploading archives:** unreviewable, and npm already solves distribution.
- **Build-time composition** (Payload, Strapi, Astro): typed, but every operator builds Kaneo, and every upgrade becomes a build pipeline.
- **Out-of-process apps only** (Plane, Linear): safe, but they cannot add views or panels in the app. Kaneo already has the API, webhooks and MCP for that style of integration.

## Open questions

1. **Bad declaration at boot.** Proposed: refuse to start, with `kaneo check` to catch problems first. Alternative: start without the broken plugin and show the error in the admin area.
2. **Unlisted plugins.** Proposed: allowed, with a warning from `kaneo add` and an "unlisted" badge, since private plugins need them. Alternative: catalog-only unless the operator opts out.
3. **First official plugin.** Proposed: Gantt, because it is the #1810 story. Alternative: Calendar, which is smaller.
4. **Version of `@kaneo/config`.** It only provides types, since plugin compatibility comes from `engines.kaneo`. Proposed: publish it with every Kaneo release, and have `kaneo check` warn when it differs from the running image. Alternative: one version per Kaneo major.
5. **Kaneo Cloud.** Proposed: no third-party plugins in v1, official plugins only. Is there a future where listed plugins run there?
