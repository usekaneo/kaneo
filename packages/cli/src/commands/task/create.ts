import { Effect, Option } from "effect";
import { Argument, Command, Flag, Prompt } from "effect/cli";
import { listColumns } from "../../api/endpoints.js";
import { attachLabelToTask, type Label } from "../../api/labels.js";
import {
  type CreateTaskBody,
  createTask,
  type Priority,
} from "../../api/task-mutations.js";
import { describeError } from "../../errors/describe.js";
import { Cancelled, InvalidArgument } from "../../errors/errors.js";
import { toTaskLabelJson } from "../../labels/label-json.js";
import { resolveLabels } from "../../labels/resolve-labels.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import {
  linkToParent,
  projectOrParent,
  resolveParent,
} from "../../relations/link-subtask.js";
import { labelChip } from "../../render/label-chip.js";
import { taskUrl } from "../../render/links.js";
import { ticketId } from "../../render/task-format.js";
import { themeCodes } from "../../render/theme.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { createStatus, FALLBACK_STATUS } from "../../tasks/create-status.js";
import { checkDateRange } from "../../tasks/date-range.js";
import { parseDateInput } from "../../tasks/parse-date.js";
import { renderTaskChange } from "../../tasks/render-task-change.js";
import { resolveAssignee } from "../../tasks/resolve-assignee.js";
import { toTaskDetailJson } from "../../tasks/task-detail-json.js";
import { readTextInput } from "../../input/read-text-input.js";
import { shellSafeOr } from "../../input/shell-safe.js";
import { ApiLayer } from "../api-layer.js";

const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"] as const;

const dateFlag = (input: Option.Option<string>, now: Date, flag: string) =>
  Option.match(input, {
    onNone: () => Effect.succeed(undefined),
    onSome: (value) => Effect.fromResult(parseDateInput(value, now, flag)),
  });

const promptTitle = Effect.fnUntraced(function* () {
  const output = yield* Output;
  const { glyphs, caps } = output.ui;
  const codes = themeCodes(caps.color);
  return yield* Prompt.run(
    Prompt.String({
      message: "Task title",
      validate: (value) =>
        value.trim() === ""
          ? Effect.fail("Enter a title")
          : Effect.succeed(value.trim()),
      theme: {
        prefix: glyphs.diamond,
        tick: glyphs.tick,
        ellipsis: glyphs.ellipsis,
        primaryColor: codes.bold,
        mutedColor: codes.muted,
        successColor: codes.success,
        errorColor: codes.danger,
        submittedColor: "",
      },
    }),
  ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
});

const resolveTitle = Effect.fnUntraced(function* (
  title: Option.Option<string>,
) {
  const output = yield* Output;
  const given = title.pipe(
    Option.map((value) => value.trim()),
    Option.filter((value) => value !== ""),
  );
  if (Option.isSome(given)) return given.value;
  if (output.interactive) return yield* promptTitle();
  return yield* new InvalidArgument({
    message: "A task title is required.",
    hint: 'Pass it as the first argument, for example kaneo task create "Fix login redirect".',
  });
});

export const runTaskCreate = Effect.fn("command.task.create")(
  function* (options: {
    readonly title: Option.Option<string>;
    readonly project: Option.Option<string>;
    readonly description: Option.Option<string>;
    readonly priority: Priority;
    readonly status: Option.Option<string>;
    readonly assignee: Option.Option<string>;
    readonly due: Option.Option<string>;
    readonly start: Option.Option<string>;
    readonly label: ReadonlyArray<string>;
    readonly parent: Option.Option<string>;
  }) {
    const session = yield* Session;
    const now = new Date();
    const dueDate = yield* dateFlag(options.due, now, "--due");
    const startDate = yield* dateFlag(options.start, now, "--start");
    yield* Effect.fromResult(checkDateRange(startDate, dueDate));

    const workspaceId = yield* resolveWorkspaceId();
    const parent = yield* resolveParent(options.parent, workspaceId);
    const project = yield* resolveProject(
      workspaceId,
      projectOrParent(options.project, parent),
    );
    const title = yield* resolveTitle(options.title);

    const [columns, assignee, labels] = yield* withSpinner(
      `Loading ${project.name}`,
    )(
      Effect.all(
        [
          listColumns(project.id),
          Option.match(options.assignee, {
            onNone: () => Effect.succeed(null),
            onSome: (reference) => resolveAssignee(workspaceId, reference),
          }),
          resolveLabels(workspaceId, options.label),
        ],
        { concurrency: 3 },
      ),
    );
    const column = yield* Effect.fromResult(
      createStatus(
        columns,
        Option.getOrUndefined(options.status),
        project.name,
      ),
    );

    const body: CreateTaskBody = {
      title,
      description: Option.getOrElse(options.description, () => ""),
      priority: options.priority,
      status: column?.slug ?? FALLBACK_STATUS,
      ...(assignee ? { userId: assignee.id } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(startDate ? { startDate } : {}),
    };
    const created = yield* withSpinner("Creating task")(
      createTask(project.id, body),
    );
    const createdTicket = ticketId(project.slug, created.number);
    const createdLabel = createdTicket ?? created.id;
    const createdArgument = shellSafeOr(createdTicket, created.id);
    const attached: ReadonlyArray<Label> =
      labels.length > 0
        ? yield* withSpinner("Adding labels")(
            Effect.forEach(labels, (label) =>
              attachLabelToTask(label.id, created.id),
            ),
          ).pipe(
            Effect.mapError(
              (error) =>
                new InvalidArgument({
                  message: `Created ${createdLabel}, but could not add the labels: ${describeError(error).message}`,
                  hint: `Add them with kaneo task edit ${createdArgument} ${labels.map((label) => `--add-label ${shellSafeOr(label.name, label.id)}`).join(" ")}`,
                }),
            ),
          )
        : [];
    const parentRef = yield* linkToParent(parent, {
      id: created.id,
      label: createdLabel,
      argument: createdArgument,
    });

    const json = toTaskDetailJson({
      task: {
        id: created.id,
        projectId: created.projectId,
        number: created.number,
        title: created.title,
        description: created.description,
        status: created.status,
        priority: created.priority,
        startDate: created.startDate,
        dueDate: created.dueDate,
        createdAt: created.createdAt,
        assigneeId: created.userId,
        assigneeName: created.userId ? (assignee?.name ?? null) : null,
      },
      workspaceId: project.workspaceId,
      project,
      columns,
      ticketId: ticketId(project.slug, created.number),
      url: taskUrl(session.webUrl, {
        workspaceId: project.workspaceId,
        projectId: created.projectId,
        id: created.id,
      }),
    });

    yield* emit(
      { ...json, labels: attached.map(toTaskLabelJson), parent: parentRef },
      (ui, task) =>
        renderTaskChange(ui, {
          verb: "Created",
          reference: task.ticketId ?? task.id.slice(0, 8),
          url: task.url,
          detail: [
            task.title,
            ...task.labels.map(
              (label) => `${labelChip(ui, label.color)} ${label.name}`,
            ),
            ...(task.parent
              ? [
                  ui.theme.muted(
                    `subtask of ${task.parent.ticketId ?? task.parent.id.slice(0, 8)}`,
                  ),
                ]
              : []),
          ].join("  "),
        }),
    );
  },
);

export const taskCreate = Command.make(
  "create",
  {
    title: Argument.String("title").pipe(
      Argument.withDescription(
        "Task title; asked for when omitted in a terminal",
      ),
      Argument.optional,
    ),
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Project key or id, for example KAN"),
      Flag.optional,
    ),
    description: Flag.String("description").pipe(
      Flag.withAlias("d"),
      Flag.withDescription("Description in Markdown"),
      Flag.optional,
    ),
    descriptionFile: Flag.String("description-file").pipe(
      Flag.withAlias("F"),
      Flag.withDescription("Read the description from a file, or - for stdin"),
      Flag.optional,
    ),
    priority: Flag.Literals("priority", PRIORITIES).pipe(
      Flag.withDescription("Task priority"),
      Flag.withDefault("no-priority"),
    ),
    status: Flag.String("status").pipe(
      Flag.withAlias("s"),
      Flag.withDescription(
        "Column slug, for example in-progress (default: the first column)",
      ),
      Flag.optional,
    ),
    assignee: Flag.String("assignee").pipe(
      Flag.withAlias("a"),
      Flag.withDescription('Assign to "me", or a member by email, name or id'),
      Flag.optional,
    ),
    due: Flag.String("due").pipe(
      Flag.withDescription("Due date: YYYY-MM-DD, today, tomorrow or +3d"),
      Flag.optional,
    ),
    start: Flag.String("start").pipe(
      Flag.withDescription("Start date: YYYY-MM-DD, today, tomorrow or +3d"),
      Flag.optional,
    ),
    label: Flag.String("label").pipe(
      Flag.withDescription("Add a workspace label by name; repeat for more"),
      Flag.atLeast(0),
    ),
    parent: Flag.String("parent").pipe(
      Flag.withDescription(
        "Create it as a subtask of this task, for example KAN-12 (default project: the parent's)",
      ),
      Flag.optional,
    ),
  },
  (options) =>
    Effect.flatMap(
      readTextInput({
        value: options.description,
        file: options.descriptionFile,
        flag: "--description",
      }),
      (description) => runTaskCreate({ ...options, description }),
    ),
).pipe(
  Command.withDescription("Create a task in a project"),
  Command.provide(ApiLayer),
);
