import { Effect, Option } from "effect";
import { Command, Flag } from "effect/cli";
import { getCurrentUser } from "../../api/endpoints.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import { Session } from "../../services/session.js";
import {
  checkDueWindow,
  dueBound,
  filterTasks,
  needsClientFilter,
  SORT_FIELDS,
  SORT_ORDERS,
  type SortField,
  type SortOrder,
  sortTasks,
  toTaskSort,
} from "../../tasks/list-query.js";
import { loadBoard } from "../../tasks/load-board.js";
import { renderTaskList } from "../../tasks/render-task-list.js";
import { toTaskJson } from "../../tasks/task-json.js";
import { ApiLayer } from "../api-layer.js";

const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"] as const;

const dueFlag = (
  input: Option.Option<string>,
  now: Date,
  edge: "before" | "after",
) =>
  Option.match(input, {
    onNone: () => Effect.succeed(undefined),
    onSome: (value) => Effect.fromResult(dueBound(value, now, edge)),
  });

export const runTaskList = Effect.fn("command.task.list")(function* (options: {
  readonly project: Option.Option<string>;
  readonly status: Option.Option<string>;
  readonly priority: Option.Option<string>;
  readonly assignee: Option.Option<string>;
  readonly mine: boolean;
  readonly label: ReadonlyArray<string>;
  readonly open: boolean;
  readonly sort: Option.Option<SortField>;
  readonly order: Option.Option<SortOrder>;
  readonly dueBefore: Option.Option<string>;
  readonly dueAfter: Option.Option<string>;
  readonly all: boolean;
  readonly limit: number;
}) {
  const session = yield* Session;
  if (options.mine && Option.isSome(options.assignee)) {
    return yield* new InvalidArgument({
      message: "Pass either --mine or --assignee, not both.",
      hint: "--mine is the same as --assignee me.",
    });
  }
  const sort = yield* Effect.fromResult(
    toTaskSort(
      Option.getOrUndefined(options.sort),
      Option.getOrUndefined(options.order),
    ),
  );
  const now = new Date();
  const dueBefore = yield* dueFlag(options.dueBefore, now, "before");
  const dueAfter = yield* dueFlag(options.dueAfter, now, "after");
  yield* Effect.fromResult(checkDueWindow(dueAfter, dueBefore));
  const clientFilters = { labels: options.label, open: options.open };
  const filtered = needsClientFilter(clientFilters);

  const workspaceId = yield* resolveWorkspaceId();
  const project = yield* resolveProject(workspaceId, options.project);
  const assignee = options.mine
    ? Option.some("me")
    : Option.map(options.assignee, (value) => value.trim());
  const assigneeId = yield* Option.match(assignee, {
    onNone: () => Effect.succeed(undefined),
    onSome: (value) =>
      value.toLowerCase() === "me"
        ? Effect.map(getCurrentUser(), (user) => user.id)
        : Effect.succeed(value),
  });
  const limit = options.all ? Number.POSITIVE_INFINITY : options.limit;
  const board = yield* withSpinner(`Loading ${project.name}`)(
    loadBoard(
      project.id,
      {
        status: Option.getOrUndefined(options.status),
        priority: Option.getOrUndefined(options.priority),
        assigneeId,
        sortBy: sort?.sortBy,
        sortOrder: sort?.sortOrder,
        dueBefore,
        dueAfter,
      },
      filtered ? Number.POSITIVE_INFINITY : limit,
    ),
  );
  const matching = filtered
    ? filterTasks(board.tasks, board.columns, clientFilters)
    : board.tasks;
  const ordered = sort ? sortTasks(matching, sort) : matching;
  const tasks = ordered.slice(0, limit).map((task) => ({
    ...toTaskJson(board, task, session.webUrl),
    labels: (task.labels ?? []).map(({ id, name, color }) => ({
      id,
      name,
      color,
    })),
  }));

  yield* emit(tasks, (ui) =>
    renderTaskList(ui, {
      projectName: board.projectName || project.name,
      projectSlug: board.projectSlug || project.slug,
      projectId: project.id,
      workspaceId: board.workspaceId || workspaceId,
      webUrl: session.webUrl,
      columns: board.columns,
      tasks,
      total: filtered ? matching.length : board.total,
      now,
    }),
  );
});

export const taskList = Command.make(
  "list",
  {
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Project key or id, for example KAN"),
      Flag.optional,
    ),
    status: Flag.String("status").pipe(
      Flag.withAlias("s"),
      Flag.withDescription(
        "Only tasks in this column, by slug (for example in-progress)",
      ),
      Flag.optional,
    ),
    priority: Flag.Literals("priority", PRIORITIES).pipe(
      Flag.withDescription("Only tasks with this priority"),
      Flag.optional,
    ),
    assignee: Flag.String("assignee").pipe(
      Flag.withAlias("a"),
      Flag.withDescription('Only tasks assigned to this user id, or "me"'),
      Flag.optional,
    ),
    mine: Flag.Boolean("mine").pipe(
      Flag.withDescription("Only tasks assigned to you, like --assignee me"),
      Flag.withDefault(false),
    ),
    label: Flag.String("label").pipe(
      Flag.withAlias("l"),
      Flag.withDescription(
        "Only tasks with this label; repeat to require several",
      ),
      Flag.atLeast(0),
    ),
    open: Flag.Boolean("open").pipe(
      Flag.withDescription("Hide tasks in done columns"),
      Flag.withDefault(false),
    ),
    sort: Flag.Literals("sort", SORT_FIELDS).pipe(
      Flag.withDescription(
        "Sort by created, priority, due, position, title or number",
      ),
      Flag.optional,
    ),
    order: Flag.Literals("order", SORT_ORDERS).pipe(
      Flag.withDescription(
        "Sort order (default: desc for created and priority, asc otherwise)",
      ),
      Flag.optional,
    ),
    dueBefore: Flag.String("due-before").pipe(
      Flag.withDescription(
        "Only tasks due on or before this day: YYYY-MM-DD, today, tomorrow or +3d",
      ),
      Flag.optional,
    ),
    dueAfter: Flag.String("due-after").pipe(
      Flag.withDescription(
        "Only tasks due on or after this day: YYYY-MM-DD, today, tomorrow or +3d",
      ),
      Flag.optional,
    ),
    all: Flag.Boolean("all").pipe(
      Flag.withDescription("Show every matching task instead of --limit"),
      Flag.withDefault(false),
    ),
    limit: Flag.Int("limit").pipe(
      Flag.withAlias("L"),
      Flag.withDescription("Maximum number of tasks to show"),
      Flag.withDefault(50),
    ),
  },
  (options) => runTaskList(options),
).pipe(
  Command.withDescription("List tasks in a project, grouped by column"),
  Command.provide(ApiLayer),
);
