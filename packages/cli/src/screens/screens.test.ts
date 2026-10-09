import { describe, expect, it } from "vite-plus/test";
import { renderHome } from "../commands/home.js";
import { renderDeviceCode, renderWelcome } from "../commands/login.js";
import { renderWhoami } from "../commands/whoami.js";
import { renderFailure } from "../output/report-failure.js";
import type { ColorLevel } from "../render/capabilities.js";
import { makeUi } from "../render/ui.js";
import {
  renderTaskList,
  type TaskListView,
} from "../tasks/render-task-list.js";
import type { TaskJson } from "../tasks/task-json.js";

const now = new Date(2026, 9, 7, 12, 0, 0);
const day = (offset: number) =>
  new Date(2026, 9, 7 + offset, 12, 0, 0).toISOString();

const user = {
  id: "u1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  image: null,
  role: null,
};

const workspace = {
  id: "ws_1",
  name: "Acme Studio",
  slug: "acme-studio",
  logo: null,
  description: null,
  createdAt: day(-30),
  role: "owner",
};

function task(
  number: number,
  title: string,
  status: string,
  priority: string,
  options: { due?: number; assignee?: string } = {},
): TaskJson {
  return {
    id: `t${number}`,
    ticketId: `KAN-${number}`,
    number,
    title,
    status,
    statusName: status,
    priority,
    assignee: options.assignee ? { id: "u1", name: options.assignee } : null,
    dueDate: options.due === undefined ? null : day(options.due),
    startDate: null,
    createdAt: day(-10),
    projectId: "p1",
    workspaceId: "ws_1",
    url: `https://cloud.kaneo.app/dashboard/workspace/ws_1/project/p1/task/t${number}`,
  };
}

const board: TaskListView = {
  projectName: "Kaneo Web",
  projectSlug: "kan",
  projectId: "p1",
  workspaceId: "ws_1",
  webUrl: "https://cloud.kaneo.app",
  columns: [
    { slug: "to-do", name: "To Do", isFinal: false },
    { slug: "in-progress", name: "In Progress", isFinal: false },
    { slug: "in-review", name: "In Review", isFinal: false },
    { slug: "done", name: "Done", isFinal: true },
  ],
  tasks: [
    task(
      3,
      "Add keyboard shortcuts for moving cards between columns on the board view",
      "to-do",
      "medium",
      { due: 4 },
    ),
    task(4, "Dark mode polish", "to-do", "low", { assignee: "Ada Lovelace" }),
    task(5, "Write CLI docs", "to-do", "no-priority", { due: 20 }),
    task(
      1,
      "Fix login redirect after device approval",
      "in-progress",
      "urgent",
      { due: -2, assignee: "Ada Lovelace" },
    ),
    task(2, "Board performance with 5000 tasks", "in-progress", "high", {
      due: 0,
      assignee: "Grace Hopper",
    }),
    task(6, "Review API error shape", "in-review", "high", {
      assignee: "Ada Lovelace",
    }),
    task(7, "Ship v2.35", "done", "medium", { due: -5 }),
  ],
  total: 12,
  now,
};

const screens = {
  "task list": (ui: ReturnType<typeof makeUi>) => renderTaskList(ui, board),
  "task list empty": (ui: ReturnType<typeof makeUi>) =>
    renderTaskList(ui, { ...board, tasks: [], total: 0 }),
  home: (ui: ReturnType<typeof makeUi>) =>
    renderHome(
      ui,
      {
        signedIn: true,
        apiUrl: "https://cloud.kaneo.app",
        user,
        workspace,
        tasks: board.tasks.slice(3, 6).map((item) => ({
          id: item.id,
          projectId: "p1",
          number: item.number,
          title: item.title,
          status: item.status,
          statusName: item.statusName,
          priority: item.priority,
          dueDate: item.dueDate,
          projectName: "Kaneo Web",
          projectSlug: "kan",
        })),
        totalTasks: 3,
      },
      now,
    ),
  "home signed out": (ui: ReturnType<typeof makeUi>) =>
    renderHome(ui, {
      signedIn: false,
      apiUrl: "https://cloud.kaneo.app",
      user: null,
      workspace: null,
      tasks: [],
      totalTasks: 0,
    }),
  "login code": (ui: ReturnType<typeof makeUi>) =>
    renderDeviceCode(ui, {
      apiUrl: "https://cloud.kaneo.app",
      code: "WDJB-MJHT",
      url: "https://cloud.kaneo.app/device?user_code=WDJBMJHT",
      copied: true,
      opened: true,
      expiresInSeconds: 1800,
    }),
  "login welcome": (ui: ReturnType<typeof makeUi>) =>
    renderWelcome(ui, {
      user,
      apiUrl: "https://cloud.kaneo.app",
      profile: "default",
      workspace,
    }),
  whoami: (ui: ReturnType<typeof makeUi>) =>
    renderWhoami(ui, {
      user,
      apiUrl: "https://cloud.kaneo.app",
      profile: "default",
      auth: "login",
      workspace,
    }),
  error: (ui: ReturnType<typeof makeUi>) =>
    renderFailure(ui, {
      message: "You are not signed in to cloud.kaneo.app.",
      hint: "Run kaneo login, or set KANEO_API_KEY.",
    }),
};

const variants: ReadonlyArray<{ columns: number; color: ColorLevel }> = [
  { columns: 80, color: 0 },
  { columns: 120, color: 0 },
  { columns: 80, color: 3 },
  { columns: 120, color: 3 },
];

describe("screens", () => {
  for (const [name, render] of Object.entries(screens)) {
    for (const { columns, color } of variants) {
      it(`${name} at ${columns} columns, ${color === 0 ? "no color" : "truecolor"}`, () => {
        const ui = makeUi({
          color,
          unicode: true,
          hyperlinks: color > 0,
          animate: false,
          columns,
        });
        expect(`\n${render(ui).join("\n")}\n`).toMatchSnapshot();
      });
    }
  }

  it("task list at 80 columns in ascii", () => {
    const ui = makeUi({
      color: 0,
      unicode: false,
      hyperlinks: false,
      animate: false,
      columns: 80,
    });
    expect(`\n${renderTaskList(ui, board).join("\n")}\n`).toMatchSnapshot();
  });
});
