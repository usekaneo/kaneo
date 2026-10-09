import { describe, expect, it } from "vite-plus/test";
import { toTaskDetailJson } from "../tasks/task-detail-json.js";
import { failed, loaded } from "./section-result.js";
import {
  projectSlugsFixture,
  resolvedTask,
  sectionsFixture,
  viewNow,
  webUrl,
} from "./test-task-view.js";
import { toTaskViewJson } from "./task-view-json.js";

const build = (overrides: Partial<Parameters<typeof toTaskViewJson>[0]> = {}) =>
  toTaskViewJson({
    resolved: resolvedTask,
    sections: sectionsFixture,
    projectSlugs: projectSlugsFixture,
    webUrl,
    commentLimit: 3,
    now: viewNow,
    ...overrides,
  });

const taskUrl = (projectId: string, id: string) =>
  `${webUrl}/dashboard/workspace/ws_1/project/${projectId}/task/${id}`;

describe("toTaskViewJson", () => {
  it("keeps every task detail key and adds the loaded sections", () => {
    const json = build();
    expect(json).toMatchObject(toTaskDetailJson(resolvedTask));
    expect(json.labels).toEqual([
      { name: "bug", color: "red" },
      { name: "auth", color: "#8e51ff" },
    ]);
    expect(json.parent).toEqual({
      id: "t4",
      ticketId: "KAN-4",
      title: "Auth overhaul",
      status: "to-do",
      completed: false,
      url: taskUrl("p1", "t4"),
    });
    expect(
      json.subtasks?.map((task) => [task.ticketId, task.completed]),
    ).toEqual([
      ["KAN-13", true],
      ["KAN-14", true],
      ["KAN-15", false],
      ["KAN-16", false],
      ["KAN-17", false],
    ]);
    expect(
      json.relations?.map((relation) => [
        relation.type,
        relation.direction,
        relation.task.ticketId,
      ]),
    ).toEqual([
      ["blocks", "outgoing", "KAN-20"],
      ["blocked-by", "incoming", "KAN-9"],
      ["relates-to", "outgoing", "MOB-3"],
    ]);
    expect(json.links).toEqual([
      {
        id: "x1",
        url: "https://github.com/usekaneo/kaneo/pull/1960",
        title: "fix(auth): keep state on device redirect",
        source: "github",
        resourceType: "pull_request",
        removable: false,
        createdAt: "2026-10-08T10:00:00.000Z",
      },
      {
        id: "x2",
        url: "https://sentry.io/issues/4211/",
        title: null,
        source: "manual",
        resourceType: "url",
        removable: true,
        createdAt: "2026-10-08T10:00:00.000Z",
      },
    ]);
    expect(json.fields).toEqual([
      { id: "f1", name: "Story points", type: "number", value: 5 },
      {
        id: "f2",
        name: "Platforms",
        type: "multiselect",
        value: ["Web", "CLI"],
      },
    ]);
    expect(json.time).toEqual({
      totalSeconds: 10800,
      running: [
        {
          user: { id: "u1", name: "Ada Lovelace" },
          startedAt: new Date(2026, 9, 7, 11).toISOString(),
        },
      ],
    });
    expect(json.comments?.map((comment) => comment.id)).toEqual([
      "c3",
      "c4",
      "c5",
    ]);
    expect(json.comments?.[1]).toEqual({
      id: "c4",
      taskId: "t12",
      author: { id: "u1", name: "Ada Lovelace" },
      content: "First pass is up, please review.",
      createdAt: new Date(2026, 9, 7, 9).toISOString(),
      updatedAt: new Date(2026, 9, 7, 10).toISOString(),
      edited: true,
    });
    expect(json).not.toHaveProperty("errors");
  });

  it("puts the new keys after the existing ones", () => {
    expect(Object.keys(build()).slice(-8)).toEqual([
      "labels",
      "parent",
      "subtasks",
      "relations",
      "links",
      "fields",
      "time",
      "comments",
    ]);
  });

  it("returns null and an error message for each section that failed", () => {
    const json = build({
      sections: {
        ...sectionsFixture,
        relations: failed("The server failed with 500: boom"),
        time: failed("Time tracking is off."),
      },
    });
    expect(json.parent).toBeNull();
    expect(json.subtasks).toBeNull();
    expect(json.relations).toBeNull();
    expect(json.time).toBeNull();
    expect(json.labels).not.toBeNull();
    expect(json.errors).toEqual({
      relations: "The server failed with 500: boom",
      time: "Time tracking is off.",
    });
  });

  it("returns every comment when the limit is unbounded and none at zero", () => {
    expect(
      build({ commentLimit: Number.POSITIVE_INFINITY }).comments,
    ).toHaveLength(5);
    expect(build({ commentLimit: 0 }).comments).toEqual([]);
  });

  it("leaves the ticket id empty for tasks in projects it could not look up", () => {
    const json = build({ projectSlugs: new Map([["p1", "kan"]]) });
    expect(json.relations?.at(-1)?.task.ticketId).toBeNull();
  });

  it("reports empty sections as empty lists", () => {
    const json = build({
      sections: {
        labels: loaded([]),
        relations: loaded([]),
        links: loaded([]),
        fields: loaded([]),
        time: loaded([]),
        comments: loaded([]),
      },
    });
    expect(json).toMatchObject({
      labels: [],
      parent: null,
      subtasks: [],
      relations: [],
      links: [],
      fields: [],
      time: { totalSeconds: 0, running: [] },
      comments: [],
    });
  });
});
