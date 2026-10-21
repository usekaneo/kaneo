import { describe, expect, it } from "vite-plus/test";
import { buildFullTaskUpdateBody } from "./task-helpers.js";

describe("buildFullTaskUpdateBody", () => {
  it("merges patch onto existing task", () => {
    // Arrange
    const original = {
      title: "T",
      description: "D",
      status: "open",
      priority: "low",
      projectId: "p1",
      position: 1,
      userId: "u1",
    };
    const patch = { status: "done" as const };

    // Act
    const body = buildFullTaskUpdateBody(original, patch);

    // Assert
    expect(body.status).toBe("done");
    expect(body.title).toBe("T");
    expect(body.position).toBe(1);
  });
});

it("does not echo an assignee when updating unrelated fields on a multi-assignee server", () => {
  const original = {
    title: "Shared",
    description: "",
    status: "to-do",
    priority: "low",
    projectId: "project",
    position: 1,
    userId: "ada",
    assignees: [{ id: "ada" }, { id: "grace" }],
  };
  expect(
    buildFullTaskUpdateBody(original, { title: "Renamed" }),
  ).not.toHaveProperty("userId");
  expect(
    buildFullTaskUpdateBody(original, { assigneeIds: ["grace"] }),
  ).toHaveProperty("assigneeIds", ["grace"]);
});
it("keeps the old single-assignee contract for older servers", () => {
  const original = {
    title: "Work",
    description: "",
    status: "to-do",
    priority: "low",
    projectId: "project",
    position: 1,
    userId: "ada",
  };
  expect(
    buildFullTaskUpdateBody(original, { title: "Renamed" }),
  ).toHaveProperty("userId", "ada");
});
