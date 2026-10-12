import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import {
  getWorkspace,
  listAssignedTasks,
  listWorkspaces,
} from "../../api/endpoints.js";
import type { AssignedTask } from "../../api/schemas.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { type Cell, text } from "../../render/cell.js";
import { taskUrl } from "../../render/links.js";
import { renderTable } from "../../render/table.js";
import {
  dueSegments,
  prioritySegments,
  statusDot,
  ticketId,
} from "../../render/task-format.js";
import type { Ui } from "../../render/ui.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";

export type MineTaskJson = {
  readonly id: string;
  readonly ticketId: string | null;
  readonly number: number | null;
  readonly title: string;
  readonly status: string;
  readonly statusName: string;
  readonly priority: string;
  readonly dueDate: string | null;
  readonly projectId: string;
  readonly projectName: string;
  readonly projectSlug: string;
  readonly workspaceId: string;
  readonly url: string;
};

export type MineGroup = {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly tasks: ReadonlyArray<MineTaskJson>;
  readonly total: number;
};

export function toMineTaskJson(
  task: AssignedTask,
  workspaceId: string,
  webUrl: string,
): MineTaskJson {
  return {
    id: task.id,
    ticketId: ticketId(task.projectSlug, task.number),
    number: task.number,
    title: task.title,
    status: task.status,
    statusName: task.statusName ?? task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    projectId: task.projectId,
    projectName: task.projectName,
    projectSlug: task.projectSlug,
    workspaceId,
    url: taskUrl(webUrl, {
      workspaceId,
      projectId: task.projectId,
      id: task.id,
    }),
  };
}

export function renderMine(
  ui: Ui,
  groups: ReadonlyArray<MineGroup>,
  now: Date,
): string[] {
  const { theme, glyphs } = ui;
  const filled = groups.filter((group) => group.tasks.length > 0);
  if (filled.length === 0) {
    return [
      "",
      `  ${theme.muted(glyphs.dot)} Nothing assigned to you. Nice.`,
      "",
    ];
  }
  const rows = renderTable(
    ui,
    filled.flatMap((group) => group.tasks),
    [
      {
        header: "ID",
        cell: (task): Cell => [
          text(task.ticketId ?? task.id.slice(0, 8), theme.muted, task.url),
        ],
      },
      {
        header: "Title",
        flex: true,
        minWidth: 16,
        cell: (task): Cell => [text(task.title, undefined, task.url)],
      },
      {
        header: "Status",
        minWidth: 6,
        cell: (task): Cell => [
          statusDot(ui, task.status, false),
          text(` ${task.statusName}`),
        ],
      },
      {
        header: "Priority",
        optional: true,
        cell: (task): Cell => prioritySegments(ui, task.priority),
      },
      {
        header: "Due",
        optional: true,
        cell: (task): Cell => dueSegments(ui, task.dueDate, false, now),
      },
      {
        header: "Project",
        optional: true,
        minWidth: 10,
        cell: (task): Cell => [text(task.projectName, theme.muted)],
      },
    ],
    { width: ui.caps.columns, indent: 4 },
  );
  const lines = [""];
  let offset = 0;
  for (const group of filled) {
    lines.push(
      `  ${theme.strong(group.workspaceName)} ${theme.muted(`${glyphs.separator} ${group.total} open`)}`,
      ...rows.slice(offset, offset + group.tasks.length),
    );
    if (group.total > group.tasks.length) {
      lines.push(
        `    ${theme.muted(`and ${group.total - group.tasks.length} more, sorted by due date`)}`,
      );
    }
    lines.push("");
    offset += group.tasks.length;
  }
  return lines;
}

function toGroup(
  workspace: { readonly id: string; readonly name: string },
  assigned: {
    readonly tasks: ReadonlyArray<AssignedTask>;
    readonly total: number;
  },
  webUrl: string,
): MineGroup {
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    tasks: assigned.tasks.map((task) =>
      toMineTaskJson(task, workspace.id, webUrl),
    ),
    total: assigned.total,
  };
}

export const runTaskMine = Effect.fn("command.task.mine")(function* (options: {
  readonly allWorkspaces: boolean;
}) {
  const session = yield* Session;
  const groups = options.allWorkspaces
    ? yield* withSpinner("Loading your tasks")(
        listWorkspaces().pipe(
          Effect.flatMap((workspaces) =>
            Effect.forEach(
              workspaces,
              (workspace) =>
                listAssignedTasks(workspace.id).pipe(
                  Effect.map((assigned) => [
                    toGroup(workspace, assigned, session.webUrl),
                  ]),
                  Effect.catchTag("PermissionDenied", () => Effect.succeed([])),
                ),
              { concurrency: 4 },
            ),
          ),
          Effect.map((loaded) => loaded.flat()),
        ),
      )
    : yield* Effect.gen(function* () {
        const workspaceId = yield* resolveWorkspaceId();
        const [workspace, assigned] = yield* withSpinner("Loading your tasks")(
          Effect.all(
            [
              getWorkspace(workspaceId).pipe(
                Effect.catchTag("NotFound", () =>
                  Effect.succeed({ id: workspaceId, name: workspaceId }),
                ),
              ),
              listAssignedTasks(workspaceId),
            ],
            { concurrency: 2 },
          ),
        );
        return [toGroup(workspace, assigned, session.webUrl)];
      });

  yield* emit(
    groups.flatMap((group) => group.tasks),
    (ui) => renderMine(ui, groups, new Date()),
  );
});

export const taskMine = Command.make(
  "mine",
  {
    allWorkspaces: Flag.Boolean("all-workspaces").pipe(
      Flag.withDescription("Include every workspace you belong to"),
      Flag.withDefault(false),
    ),
  },
  (options) => runTaskMine(options),
).pipe(
  Command.withDescription(
    "List the open tasks assigned to you, soonest due first",
  ),
  Command.provide(ApiLayer),
);
