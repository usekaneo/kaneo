import { Effect } from "effect";
import {
  attachLabelToTask,
  detachLabelFromTask,
  listTaskLabels,
} from "../api/labels.js";
import { planTaskLabels, type TaskLabelPlan } from "./plan-task-labels.js";
import { resolveLabels } from "./resolve-labels.js";

const emptyPlan: TaskLabelPlan = { add: [], remove: [] };

export const prepareTaskLabelEdits = Effect.fn("labels.prepareTaskEdits")(
  function* (options: {
    readonly workspaceId: string;
    readonly taskId: string;
    readonly taskRef: string;
    readonly add: ReadonlyArray<string>;
    readonly remove: ReadonlyArray<string>;
  }) {
    if (options.add.length === 0 && options.remove.length === 0) {
      return emptyPlan;
    }
    const [add, taskLabels] = yield* Effect.all(
      [
        resolveLabels(options.workspaceId, options.add),
        listTaskLabels(options.taskId),
      ],
      { concurrency: 2 },
    );
    return yield* Effect.fromResult(
      planTaskLabels({
        taskRef: options.taskRef,
        taskLabels,
        add,
        removeNames: options.remove,
      }),
    );
  },
);

export const applyTaskLabelEdits = Effect.fn("labels.applyTaskEdits")(
  function* (taskId: string, plan: TaskLabelPlan) {
    for (const label of plan.remove) yield* detachLabelFromTask(label.id);
    for (const label of plan.add) yield* attachLabelToTask(label.id, taskId);
  },
);
