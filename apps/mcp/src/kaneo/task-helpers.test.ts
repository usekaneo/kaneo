import { describe, expect, it } from "vitest";
import { buildFullTaskUpdateBody } from "./task-helpers.js";

describe("buildFullTaskUpdateBody", () => {
  it("merges patch onto existing task", () => {
    const body = buildFullTaskUpdateBody(
      {
        title: "T",
        description: "D",
        status: "open",
        priority: "low",
        projectId: "p1",
        position: 1,
        userId: "u1",
      },
      { status: "done" },
    );
    expect(body.status).toBe("done");
    expect(body.title).toBe("T");
    expect(body.position).toBe(1);
  });
});
