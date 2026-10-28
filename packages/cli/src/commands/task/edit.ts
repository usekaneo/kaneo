import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { listTaskLabels } from "../../api/labels.js";
import {
  type Priority,
  updateTaskDescription,
  updateTaskDueDate,
  updateTaskPriority,
  updateTaskStartDate,
  updateTaskTitle,
} from "../../api/task-mutations.js";
import { InvalidArgument } from "../../errors/errors.js";
import { toTaskLabelJson } from "../../labels/label-json.js";
import { describeLabelChanges } from "../../labels/plan-task-labels.js";
import {
  applyTaskLabelEdits,
  prepareTaskLabelEdits,
} from "../../labels/task-label-edits.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { checkDateRange } from "../../tasks/date-range.js";
import { parseDateChange } from "../../tasks/parse-date.js";
import { renderTaskChange } from "../../tasks/render-task-change.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { toTaskDetailJson } from "../../tasks/task-detail-json.js";
import { readTextInput } from "../../input/read-text-input.js";
import { ApiLayer } from "../api-layer.js";

const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"] as const;

const dateChange = (input: Option.Option<string>, now: Date, flag: string) =>
  Option.match(input, {
    onNone: () => Effect.succeed(Option.none<string | null>()),
    onSome: (value) =>
      Effect.fromResult(parseDateChange(value, now, flag)).pipe(
        Effect.map(Option.some),
      ),
  });

export const runTaskEdit = Effect.fn("command.task.edit")(function* (options: {
  readonly task: string;
  readonly title: Option.Option<string>;
  readonly description: Option.Option<string>;
  readonly priority: Option.Option<Priority>;
  readonly due: Option.Option<string>;
  readonly start: Option.Option<string>;
  readonly addLabel: ReadonlyArray<string>;
  readonly removeLabel: ReadonlyArray<string>;
}) {
  const { title, description, priority } = options;
  if (
    [title, description, priority, options.due, options.start].every((flag) =>
      Option.isNone(flag),
    ) &&
    options.addLabel.length === 0 &&
    options.removeLabel.length === 0
  ) {
    return yield* new InvalidArgument({
      message: "Nothing to change.",
      hint: "Pass at least one of --title, --description, --priority, --due, --start, --add-label or --remove-label.",
    });
  }
  const newTitle = Option.map(title, (value) => value.trim());
  if (Option.isSome(newTitle) && newTitle.value === "") {
    return yield* new InvalidArgument({
      message: "The title cannot be empty.",
      hint: 'Pass a title, for example --title "Fix login redirect".',
    });
  }
  const now = new Date();
  const due = yield* dateChange(options.due, now, "--due");
  const start = yield* dateChange(options.start, now, "--start");

  const resolved = yield* withSpinner(`Loading ${options.task.trim()}`)(
    resolveTask(options.task),
  );
  if (Option.isSome(due) || Option.isSome(start)) {
    yield* Effect.fromResult(
      checkDateRange(
        Option.getOrElse(start, () => resolved.task.startDate),
        Option.getOrElse(due, () => resolved.task.dueDate),
      ),
    );
  }

  const id = resolved.task.id;
  const label = resolved.ticketId ?? id.slice(0, 8);
  const labelPlan = yield* withSpinner("Loading labels")(
    prepareTaskLabelEdits({
      workspaceId: resolved.workspaceId,
      taskId: id,
      taskRef: label,
      add: options.addLabel,
      remove: options.removeLabel,
    }),
  );
  const labelChanges = describeLabelChanges(labelPlan);
  const changed: string[] = [];
  yield* withSpinner(`Updating ${label}`)(
    Effect.gen(function* () {
      if (Option.isSome(newTitle)) {
        yield* updateTaskTitle(id, newTitle.value);
        changed.push("title");
      }
      if (Option.isSome(description)) {
        yield* updateTaskDescription(id, description.value);
        changed.push("description");
      }
      if (Option.isSome(priority)) {
        yield* updateTaskPriority(id, priority.value);
        changed.push("priority");
      }
      if (Option.isSome(due)) {
        yield* updateTaskDueDate(id, due.value);
        changed.push("due date");
      }
      if (Option.isSome(start)) {
        yield* updateTaskStartDate(id, start.value);
        changed.push("start date");
      }
      if (labelChanges) {
        yield* applyTaskLabelEdits(id, labelPlan);
        changed.push(labelChanges);
      }
    }),
  );

  const [updated, taskLabels] = yield* withSpinner(`Loading ${label}`)(
    Effect.all([resolveTask(id, { columns: true }), listTaskLabels(id)], {
      concurrency: 2,
    }),
  );
  const json = {
    ...toTaskDetailJson(updated),
    labels: taskLabels.map(toTaskLabelJson),
  };
  yield* emit(json, (ui, task) =>
    renderTaskChange(ui, {
      verb: "Updated",
      reference: task.ticketId ?? label,
      url: task.url,
      detail: changed.join(", "),
    }),
  );
});

export const taskEdit = Command.make(
  "edit",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or a task id"),
    ),
    title: Flag.String("title").pipe(
      Flag.withDescription("New title"),
      Flag.optional,
    ),
    description: Flag.String("description").pipe(
      Flag.withAlias("d"),
      Flag.withDescription(
        "New description in Markdown; replaces the current one",
      ),
      Flag.optional,
    ),
    descriptionFile: Flag.String("description-file").pipe(
      Flag.withAlias("F"),
      Flag.withDescription("Read the description from a file, or - for stdin"),
      Flag.optional,
    ),
    priority: Flag.Literals("priority", PRIORITIES).pipe(
      Flag.withDescription("New priority"),
      Flag.optional,
    ),
    due: Flag.String("due").pipe(
      Flag.withDescription(
        "Due date: YYYY-MM-DD, today, tomorrow, +3d, or none to clear",
      ),
      Flag.optional,
    ),
    start: Flag.String("start").pipe(
      Flag.withDescription(
        "Start date: YYYY-MM-DD, today, tomorrow, +3d, or none to clear",
      ),
      Flag.optional,
    ),
    addLabel: Flag.String("add-label").pipe(
      Flag.withDescription("Add a workspace label by name; repeat for more"),
      Flag.atLeast(0),
    ),
    removeLabel: Flag.String("remove-label").pipe(
      Flag.withDescription("Remove a label by name; repeat for more"),
      Flag.atLeast(0),
    ),
  },
  (options) =>
    Effect.flatMap(
      readTextInput({
        value: options.description,
        file: options.descriptionFile,
        flag: "--description",
      }),
      (description) => runTaskEdit({ ...options, description }),
    ),
).pipe(
  Command.withDescription(
    "Change a task's title, description, priority, dates or labels",
  ),
  Command.provide(ApiLayer),
);
