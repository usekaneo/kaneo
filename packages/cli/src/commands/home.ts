import { Effect, Option } from "effect";
import {
  getCurrentUser,
  getWorkspace,
  listAssignedTasks,
} from "../api/endpoints.js";
import type { AssignedTask, CurrentUser, Workspace } from "../api/schemas.js";
import { emit } from "../output/emit.js";
import { withSpinner } from "../output/spinner.js";
import { type Cell, text } from "../render/cell.js";
import { logo } from "../render/logo.js";
import { renderTable } from "../render/table.js";
import { dueSegments, prioritySegments } from "../render/task-format.js";
import type { Ui } from "../render/ui.js";
import { Session } from "../services/session.js";

type HomeResult = {
  readonly signedIn: boolean;
  readonly apiUrl: string;
  readonly user: CurrentUser | null;
  readonly workspace: Workspace | null;
  readonly tasks: ReadonlyArray<AssignedTask>;
  readonly totalTasks: number;
};

const COMMANDS: ReadonlyArray<readonly [string, string]> = [
  ["kaneo task list", "List tasks in a project"],
  ["kaneo whoami", "Show your account and server"],
  ["kaneo login", "Sign in with your browser"],
  ["kaneo --help", "See every command"],
];

export function renderHome(
  ui: Ui,
  result: HomeResult,
  now = new Date(),
): string[] {
  const { theme, glyphs } = ui;
  const host = new URL(result.apiUrl).host;
  const lines = ["", ...logo(ui), ""];
  if (!result.user) {
    lines.push(
      `  ${theme.muted(glyphs.dot)} Not signed in to ${host}`,
      "",
      `  ${theme.muted("Run")} ${theme.strong("kaneo login")} ${theme.muted("to get started.")}`,
      "",
    );
    return lines;
  }
  lines.push(
    `  ${theme.strong(result.user.name)} ${theme.muted(`${glyphs.separator} ${result.workspace?.name ?? "no workspace"} ${glyphs.separator} ${host}`)}`,
    "",
  );
  if (result.workspace) {
    lines.push(`  ${theme.strong("Your open tasks")}`);
    if (result.tasks.length === 0) {
      lines.push(`    ${theme.muted("Nothing assigned to you. Nice.")}`);
    } else {
      lines.push(
        ...renderTable(
          ui,
          result.tasks.slice(0, 8),
          [
            {
              header: "ID",
              cell: (task): Cell => [
                text(
                  task.number !== null
                    ? `${task.projectSlug.toUpperCase()}-${task.number}`
                    : task.id.slice(0, 8),
                  theme.muted,
                ),
              ],
            },
            {
              header: "Title",
              flex: true,
              minWidth: 16,
              cell: (task): Cell => [text(task.title)],
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
          ],
          { width: ui.caps.columns, indent: 4 },
        ),
      );
      const shown = Math.min(8, result.tasks.length);
      if (result.totalTasks > shown) {
        lines.push(
          `    ${theme.muted(`and ${result.totalTasks - shown} more`)}`,
        );
      }
    }
    lines.push("");
  }
  lines.push(`  ${theme.strong("Commands")}`);
  const width = Math.max(...COMMANDS.map(([command]) => command.length));
  for (const [command, description] of COMMANDS) {
    lines.push(`    ${command.padEnd(width)}  ${theme.muted(description)}`);
  }
  lines.push("");
  return lines;
}

export const runHome = Effect.fn("command.home")(function* () {
  const session = yield* Session;
  if (Option.isNone(session.credentials)) {
    yield* emit<HomeResult>(
      {
        signedIn: false,
        apiUrl: session.apiUrl,
        user: null,
        workspace: null,
        tasks: [],
        totalTasks: 0,
      },
      renderHome,
    );
    return;
  }
  const workspaceId = Option.getOrUndefined(session.workspace)?.id;
  const [user, workspace, assigned] = yield* withSpinner("Loading")(
    Effect.all(
      [
        getCurrentUser(),
        workspaceId
          ? getWorkspace(workspaceId).pipe(
              Effect.catchTag("NotFound", () => Effect.succeed(null)),
            )
          : Effect.succeed(null),
        workspaceId
          ? listAssignedTasks(workspaceId)
          : Effect.succeed({ tasks: [], total: 0 }),
      ],
      { concurrency: 3 },
    ),
  );
  yield* emit<HomeResult>(
    {
      signedIn: true,
      apiUrl: session.apiUrl,
      user,
      workspace,
      tasks: assigned.tasks,
      totalTasks: assigned.total,
    },
    renderHome,
  );
});
