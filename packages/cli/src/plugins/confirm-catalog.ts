import { Effect } from "effect";
import { withSpinner } from "../output/spinner.js";
import { confirmDestructive } from "../prompts/confirm-destructive.js";
import { PluginCatalog } from "../services/plugin-catalog.js";
import { catalogWarning } from "./catalog-warning.js";
import { humanNote } from "./human-note.js";

export const confirmCatalog = Effect.fnUntraced(function* (
  packageName: string,
  yes: boolean,
) {
  const catalog = yield* PluginCatalog;
  const lookup = yield* withSpinner("Checking the Kaneo plugin catalog")(
    catalog.lookup(packageName),
  );
  if (lookup.status === "listed") {
    yield* humanNote((ui) => [
      `  ${ui.theme.success(ui.glyphs.tick)} ${packageName} is listed in the Kaneo plugin catalog.`,
    ]);
    return lookup.status;
  }
  yield* humanNote((ui) => [
    `  ${ui.theme.warning(ui.glyphs.warning)} ${catalogWarning(packageName, lookup)}`,
  ]);
  yield* confirmDestructive({
    yes,
    action:
      lookup.status === "unlisted"
        ? `Adding ${packageName}, which is not in the Kaneo plugin catalog,`
        : `Adding ${packageName} without checking the Kaneo plugin catalog`,
    question: `Add ${packageName} anyway?`,
  });
  return lookup.status;
});
