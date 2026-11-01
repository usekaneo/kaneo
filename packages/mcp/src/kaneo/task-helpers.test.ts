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

  it("keeps the primary assignee unless assigneeIds are given", () => {
    const original = {
      title: "T",
      description: "D",
      status: "open",
      priority: "low",
      projectId: "p1",
      position: 1,
      userId: "u1",
    };

    expect(buildFullTaskUpdateBody(original, {})).toMatchObject({
      userId: "u1",
    });
    expect(
      buildFullTaskUpdateBody(original, { assigneeIds: ["u2", "u3"] }),
    ).toMatchObject({ userId: "u1", assigneeIds: ["u2", "u3"] });
  });
});
