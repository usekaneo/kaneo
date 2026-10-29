import { Effect } from "effect";
import { Command } from "effect/cli";
import { listPlugins } from "../../api/plugins.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { toPluginJson } from "../../plugins/plugin-json.js";
import { renderPluginList } from "../../plugins/render-plugin-list.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";

export const runPluginList = Effect.fn("command.plugin.list")(function* () {
  const workspaceId = yield* resolveWorkspaceId();
  const plugins = yield* withSpinner("Loading plugins")(
    listPlugins(workspaceId),
  );
  yield* emit(plugins.map(toPluginJson), renderPluginList);
});

export const pluginList = Command.make("list", {}, () => runPluginList()).pipe(
  Command.withDescription(
    "List the plugins installed on the server and whether your workspace uses them",
  ),
  Command.provide(ApiLayer),
);
