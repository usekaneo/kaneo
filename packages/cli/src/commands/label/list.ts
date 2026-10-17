import { Effect } from "effect";
import { Command } from "effect/cli";
import { listWorkspaceLabels } from "../../api/labels.js";
import { toLabelJson } from "../../labels/label-json.js";
import { labelUsage, workspaceLabels } from "../../labels/match-label.js";
import {
  type LabelListRow,
  renderLabelList,
} from "../../labels/render-label-list.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";

export const runLabelList = Effect.fn("command.label.list")(function* () {
  const workspaceId = yield* resolveWorkspaceId();
  const labels = yield* withSpinner("Loading labels")(
    listWorkspaceLabels(workspaceId),
  );
  const usage = labelUsage(labels);
  const ordered = [...workspaceLabels(labels)].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  const rows: ReadonlyArray<LabelListRow> = ordered.map((label) => ({
    id: label.id,
    name: label.name,
    color: label.color,
    tasks: usage.get(label.name) ?? 0,
    deleting: Boolean(label.deletionStartedAt),
  }));
  yield* emit(ordered.map(toLabelJson), (ui) => renderLabelList(ui, rows));
});

export const labelList = Command.make("list", {}, () => runLabelList()).pipe(
  Command.withDescription("List the labels in your workspace"),
  Command.provide(ApiLayer),
);
