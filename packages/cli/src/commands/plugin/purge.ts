import { PLUGIN_ID_PATTERN } from "@kaneo/plugin-sdk";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { purgePluginData } from "../../api/plugins.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { renderPluginPurge } from "../../plugins/render-plugin-purge.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import { ApiLayer } from "../api-layer.js";

export const runPluginPurge = Effect.fn("command.plugin.purge")(
  function* (options: { readonly pluginId: string; readonly yes: boolean }) {
    const { pluginId } = options;
    if (!PLUGIN_ID_PATTERN.test(pluginId)) {
      return yield* new InvalidArgument({
        message: `"${pluginId}" is not a plugin ID.`,
        hint: "Plugin IDs use lowercase letters, digits and dashes, like kaneo-plugin-task-progress. Run kaneo plugin list to see them.",
      });
    }
    yield* confirmDestructive({
      yes: options.yes,
      action: `Purging the data of ${pluginId}`,
      question: `Delete everything ${pluginId} stored, and its settings in every workspace? This cannot be undone.`,
    });
    const deleted = yield* withSpinner(`Purging ${pluginId}`)(
      purgePluginData(pluginId),
    ).pipe(
      Effect.catchTag("PermissionDenied", (error) =>
        Effect.fail(
          new InvalidArgument({
            message: error.message,
            hint: "Purging plugin data needs an instance admin. Run kaneo login with an instance admin account.",
          }),
        ),
      ),
    );
    yield* emit(
      {
        pluginId,
        storage: deleted.storage,
        workspaces: deleted.workspaces,
      },
      renderPluginPurge,
    );
  },
);

export const pluginPurge = Command.make(
  "purge",
  {
    pluginId: Argument.String("id").pipe(
      Argument.withDescription(
        "ID of a plugin that is no longer installed, for example kaneo-plugin-task-progress",
      ),
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Delete without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runPluginPurge(options),
).pipe(
  Command.withDescription(
    "Delete the data and settings a removed plugin stored, in every workspace",
  ),
  Command.provide(ApiLayer),
);
