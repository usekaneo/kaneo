import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { type BulkOperation, bulkUpdateTasks } from "../../api/bulk.js";
import { listColumns } from "../../api/endpoints.js";
import { listWorkspaceLabels } from "../../api/labels.js";
import type { Priority } from "../../api/task-mutations.js";
import { type BulkChange, parseBulkChange } from "../../bulk/bulk-change.js";
import { resolveBulkStatus } from "../../bulk/bulk-status.js";
import { labelForRemoval } from "../../bulk/label-for-removal.js";
import {
  type AppliedChange,
  renderBulkResult,
} from "../../bulk/render-bulk-result.js";
import {
  type BulkTask,
  resolveBulkTasks,
} from "../../bulk/resolve-bulk-tasks.js";
import { InvalidArgument } from "../../errors/errors.js";
import { resolveLabels } from "../../labels/resolve-labels.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import { resolveAssignee } from "../../tasks/resolve-assignee.js";
import { ApiLayer } from "../api-layer.js";

const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"] as const;

type Plan = {
  readonly operation: BulkOperation;
  readonly value?: string | null;
  readonly applied: AppliedChange;
};

function preview(tasks: ReadonlyArray<BulkTask>): string {
  const labels = tasks.map((task) => task.label);
  return labels.length > 5
    ? `${labels.slice(0, 5).join(", ")} and ${labels.length - 5} more`
    : labels.join(", ");
}

const planChange = Effect.fnUntraced(function* (
  change: BulkChange,
  workspaceId: string,
  tasks: ReadonlyArray<BulkTask>,
) {
  switch (change.kind) {
    case "status": {
      const projects = [
        ...new Map(
          tasks.map((task) => [task.project.id, task.project]),
        ).values(),
      ];
      const columns = yield* Effect.forEach(
        projects,
        (project) =>
          Effect.map(listColumns(project.id), (list) => ({
            name: project.name,
            columns: list,
          })),
        { concurrency: 4 },
      );
      const column = yield* Effect.fromResult(
        resolveBulkStatus(columns, change.reference),
      );
      return {
        operation: "updateStatus",
        value: column.slug,
        applied: { kind: "status", columnName: column.name },
      } satisfies Plan;
    }
    case "priority":
      return {
        operation: "updatePriority",
        value: change.priority,
        applied: { kind: "priority", priority: change.priority },
      } satisfies Plan;
    case "assignee": {
      const assignee = yield* resolveAssignee(workspaceId, change.reference);
      return {
        operation: "updateAssignee",
        value: assignee.id,
        applied: { kind: "assignee", name: assignee.name },
      } satisfies Plan;
    }
    case "unassign":
      return {
        operation: "updateAssignee",
        value: null,
        applied: { kind: "unassign" },
      } satisfies Plan;
    case "due":
      return {
        operation: "updateDueDate",
        value: change.dueDate,
        applied: { kind: "due", dueDate: change.dueDate },
      } satisfies Plan;
    case "addLabel": {
      const [label] = yield* resolveLabels(workspaceId, [change.name]);
      if (!label) {
        return yield* new InvalidArgument({
          message: `No label named "${change.name}" in this workspace.`,
        });
      }
      return {
        operation: "addLabel",
        value: label.id,
        applied: { kind: "addLabel", labelName: label.name },
      } satisfies Plan;
    }
    case "removeLabel": {
      const labels = yield* listWorkspaceLabels(workspaceId);
      const label = yield* Effect.fromResult(
        labelForRemoval(labels, change.name),
      );
      return {
        operation: "removeLabel",
        value: label.id,
        applied: { kind: "removeLabel", labelName: label.name },
      } satisfies Plan;
    }
    case "delete":
      return {
        operation: "delete",
        applied: { kind: "delete" },
      } satisfies Plan;
  }
});

export const runTaskBulk = Effect.fn("command.task.bulk")(function* (options: {
  readonly tasks: ReadonlyArray<string>;
  readonly status: Option.Option<string>;
  readonly priority: Option.Option<Priority>;
  readonly assignee: Option.Option<string>;
  readonly unassign: boolean;
  readonly due: Option.Option<string>;
  readonly addLabel: Option.Option<string>;
  readonly removeLabel: Option.Option<string>;
  readonly delete: boolean;
  readonly yes: boolean;
}) {
  const change = yield* Effect.fromResult(parseBulkChange(options, new Date()));
  const count =
    options.tasks.length === 1 ? "1 task" : `${options.tasks.length} tasks`;
  const { workspaceId, tasks } = yield* withSpinner(`Checking ${count}`)(
    resolveBulkTasks(options.tasks),
  );
  const plan: Plan = yield* withSpinner("Checking the change")(
    planChange(change, workspaceId, tasks),
  );
  if (plan.operation === "delete") {
    const total = tasks.length === 1 ? "1 task" : `${tasks.length} tasks`;
    yield* confirmDestructive({
      yes: options.yes,
      action: `Deleting ${total}`,
      question: `Delete ${total} (${preview(tasks)}) with their comments and time entries? This cannot be undone.`,
    });
  }
  const result = yield* withSpinner(`Updating ${count}`)(
    bulkUpdateTasks({
      taskIds: tasks.map((task) => task.id),
      operation: plan.operation,
      ...(plan.value === undefined ? {} : { value: plan.value }),
    }),
  );

  yield* emit(
    {
      updated: result.updatedCount,
      tasks: tasks.map((task) => task.ticketId ?? task.id),
    },
    (ui) =>
      renderBulkResult(ui, {
        change: plan.applied,
        updated: result.updatedCount,
        tasks,
      }),
  );
});

export const taskBulk = Command.make(
  "bulk",
  {
    tasks: Argument.String("task").pipe(
      Argument.withDescription("Ticket ids such as KAN-12, or task ids"),
      Argument.atLeast(1),
    ),
    status: Flag.String("status").pipe(
      Flag.withAlias("s"),
      Flag.withDescription("Move every task to this column, for example done"),
      Flag.optional,
    ),
    priority: Flag.Literals("priority", PRIORITIES).pipe(
      Flag.withDescription("Set this priority on every task"),
      Flag.optional,
    ),
    assignee: Flag.String("assignee").pipe(
      Flag.withAlias("a"),
      Flag.withDescription(
        'Assign every task to "me", or a member by email, name or id',
      ),
      Flag.optional,
    ),
    unassign: Flag.Boolean("unassign").pipe(
      Flag.withDescription("Remove the assignee from every task"),
      Flag.withDefault(false),
    ),
    due: Flag.String("due").pipe(
      Flag.withDescription(
        "Due date: YYYY-MM-DD, today, tomorrow, +3d, or none to clear",
      ),
      Flag.optional,
    ),
    addLabel: Flag.String("add-label").pipe(
      Flag.withDescription("Add this workspace label to every task"),
      Flag.optional,
    ),
    removeLabel: Flag.String("remove-label").pipe(
      Flag.withDescription("Remove this label from every task"),
      Flag.optional,
    ),
    delete: Flag.Boolean("delete").pipe(
      Flag.withDescription("Delete every task; asks for confirmation"),
      Flag.withDefault(false),
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Delete without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runTaskBulk(options),
).pipe(
  Command.withDescription(
    "Apply one change to many tasks at once; nothing changes if a task is unknown",
  ),
  Command.provide(ApiLayer),
);
