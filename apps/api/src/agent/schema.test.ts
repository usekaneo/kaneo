import { describe, expect, it } from "vite-plus/test";
import { agentActionSchema } from "./schema";

describe("agent action boundary", () => {
  it.each([
    { type: "task.delete", taskId: "task" },
    { type: "task.update", taskId: "task", patch: {} },
    { type: "task.update", taskId: "task", patch: { projectId: "foreign" } },
    { type: "task.update", taskId: "task", patch: { priority: "invalid" } },
    { type: "task.update", taskId: "task", patch: { dueDate: "next week" } },
    {
      type: "task.update",
      taskId: "task",
      patch: { dueDate: "2026-02-30T00:00:00Z" },
    },
    { type: "comment.create", taskId: "task", body: "   " },
    { type: "comment.create", taskId: "task", body: "x".repeat(10_001) },
    { type: "comment.create", taskId: "task", body: "Hi", userId: "other" },
    { type: "comment.create", body: "Hi" },
  ])("rejects unsupported or malformed changes: %j", (action) => {
    expect(agentActionSchema.safeParse(action).success).toBe(false);
  });

  it("accepts a Markdown comment and trims surrounding whitespace", () => {
    expect(
      agentActionSchema.parse({
        type: "comment.create",
        taskId: "task",
        body: "  **Ping** — could you review today?\n",
      }),
    ).toEqual({
      type: "comment.create",
      taskId: "task",
      body: "**Ping** — could you review today?",
    });
  });
});
