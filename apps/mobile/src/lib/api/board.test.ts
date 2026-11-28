import { beforeEach, expect, it, vi } from "vite-plus/test";
import { loadFullBoard } from "./board";
import { api } from "./endpoints";
import type { BoardData, BoardTask } from "./types";

vi.mock("./endpoints", () => ({ api: { board: vi.fn() } }));

const project: BoardData = {
  id: "p1",
  name: "Project",
  slug: "project",
  workspaceId: "w1",
  columns: [],
  archivedTasks: [],
  plannedTasks: [],
};

const todo = { id: "todo", slug: "to-do", name: "To do", position: 1 };
const done = { id: "done", slug: "done", name: "Done", position: 2 };

function task(id: string, fields: Partial<BoardTask> = {}): BoardTask {
  return { id, title: id, status: "to-do", projectId: project.id, ...fields };
}

beforeEach(() => vi.mocked(api.board).mockReset());

it("assembles task and related pages while preserving first-seen metadata", async () => {
  const bug = { id: "bug", name: "Bug", color: "red" };
  const updatedBug = { ...bug, name: "Confirmed bug" };
  const docs = { id: "docs", name: "Docs", color: "green" };
  const ui = { id: "ui", name: "UI", color: "blue" };
  const first = task("first", { position: 1 });
  const labeled = task("labeled", { position: 3, labels: [bug, docs] });
  const unpositioned = task("unpositioned");
  const archived = task("archived", { status: "archived", position: 9 });
  const olderArchive = task("older-archive", {
    status: "archived",
    position: 1,
  });
  const planned = task("planned", { status: "planned" });

  vi.mocked(api.board)
    .mockResolvedValueOnce({
      data: {
        ...project,
        columns: [done, { ...todo, tasks: [unpositioned, labeled] }],
        archivedTasks: [archived],
      },
      pagination: { totalPages: 2, relatedTotalPages: 2 },
    })
    .mockResolvedValueOnce({
      data: {
        ...project,
        columns: [
          {
            ...todo,
            name: "Later column name",
            position: 5,
            tasks: [
              {
                ...labeled,
                title: "Later task title",
                labels: [updatedBug, ui],
              },
            ],
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      data: {
        ...project,
        columns: [{ ...todo, tasks: [first] }],
        archivedTasks: [olderArchive],
        plannedTasks: [planned],
      },
      pagination: { relatedTotalPages: 2 },
    })
    .mockResolvedValueOnce({
      data: { ...project, plannedTasks: [{ ...planned, labels: [ui] }] },
    });

  await expect(loadFullBoard(project.id)).resolves.toEqual({
    ...project,
    columns: [
      {
        ...todo,
        tasks: [
          first,
          { ...labeled, labels: [updatedBug, docs, ui] },
          unpositioned,
        ],
      },
      { ...done, tasks: [] },
    ],
    archivedTasks: [archived, olderArchive],
    plannedTasks: [{ ...planned, labels: [ui] }],
  });
  expect(vi.mocked(api.board).mock.calls).toEqual([
    [project.id, 1],
    [project.id, 1, 2],
    [project.id, 2],
    [project.id, 2, 2],
  ]);
});

it("loads a single page when pagination is absent", async () => {
  vi.mocked(api.board).mockResolvedValueOnce({ data: project });

  await expect(loadFullBoard(project.id)).resolves.toEqual(project);
  expect(vi.mocked(api.board).mock.calls).toEqual([[project.id, 1]]);
});
