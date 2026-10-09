import { describe, expect, it } from "vite-plus/test";
import type { AssignedTask } from "../../api/schemas.js";
import { makeUi } from "../../render/ui.js";
import { stringWidth } from "../../render/width.js";
import { renderMine, toMineTaskJson } from "./mine.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const now = new Date(2026, 9, 8, 12, 0);

function assigned(
  number: number,
  title: string,
  overrides: Partial<AssignedTask> = {},
): AssignedTask {
  return {
    id: `t${number}`,
    projectId: "p_kan",
    number,
    title,
    status: "in-progress",
    statusName: "In Progress",
    priority: "high",
    dueDate: new Date(2026, 9, 8, 12).toISOString(),
    projectName: "Kaneo Web",
    projectSlug: "kan",
    ...overrides,
  };
}

const webUrl = "https://kaneo.test";

describe("toMineTaskJson", () => {
  it("adds the ticket id, workspace and link", () => {
    expect(toMineTaskJson(assigned(1, "Fix login"), "ws_1", webUrl)).toEqual({
      id: "t1",
      ticketId: "KAN-1",
      number: 1,
      title: "Fix login",
      status: "in-progress",
      statusName: "In Progress",
      priority: "high",
      dueDate: new Date(2026, 9, 8, 12).toISOString(),
      projectId: "p_kan",
      projectName: "Kaneo Web",
      projectSlug: "kan",
      workspaceId: "ws_1",
      url: "https://kaneo.test/dashboard/workspace/ws_1/project/p_kan/task/t1",
    });
  });

  it("falls back to the status slug without a column name", () => {
    expect(
      toMineTaskJson(assigned(2, "Old", { statusName: null }), "ws_1", webUrl)
        .statusName,
    ).toBe("in-progress");
  });
});

describe("renderMine", () => {
  const tasks = [
    toMineTaskJson(
      assigned(1, "Fix login redirect after device sign in"),
      "ws_1",
      webUrl,
    ),
    toMineTaskJson(
      assigned(4, "Dark mode polish", {
        status: "to-do",
        statusName: "To Do",
        priority: "low",
        dueDate: null,
        projectName: "Mobile App",
        projectSlug: "mob",
      }),
      "ws_1",
      webUrl,
    ),
  ];

  it("shows status, priority, due and project at 80 columns", () => {
    expect(
      renderMine(
        ui(80),
        [
          {
            workspaceId: "ws_1",
            workspaceName: "Acme Studio",
            tasks,
            total: 3,
          },
        ],
        now,
      ),
    ).toEqual([
      "",
      "  Acme Studio · 3 open",
      "    KAN-1  Fix login redirect after…  ● In Progress  ▆ High  ◷ Today  Kaneo Web",
      "    MOB-4  Dark mode polish           ● To Do        ▂ Low            Mobile App",
      "    and 1 more, sorted by due date",
      "",
    ]);
  });

  it("drops optional columns before squeezing titles", () => {
    for (const line of renderMine(
      ui(50),
      [{ workspaceId: "ws_1", workspaceName: "Acme Studio", tasks, total: 2 }],
      now,
    )) {
      expect(stringWidth(line)).toBeLessThanOrEqual(50);
    }
  });

  it("groups by workspace and skips empty ones", () => {
    const lines = renderMine(
      ui(80),
      [
        {
          workspaceId: "ws_1",
          workspaceName: "Acme Studio",
          tasks: tasks.slice(0, 1),
          total: 1,
        },
        {
          workspaceId: "ws_2",
          workspaceName: "Side Project",
          tasks: [],
          total: 0,
        },
        {
          workspaceId: "ws_3",
          workspaceName: "Client Work",
          tasks: tasks.slice(1),
          total: 1,
        },
      ],
      now,
    );
    expect(
      lines.filter((line) => line.startsWith("  ") && !line.startsWith("    ")),
    ).toEqual(["  Acme Studio · 1 open", "  Client Work · 1 open"]);
  });

  it("celebrates an empty list", () => {
    expect(renderMine(ui(80), [], now)).toEqual([
      "",
      "  ● Nothing assigned to you. Nice.",
      "",
    ]);
  });
});
