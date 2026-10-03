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
  ])("rejects unsupported or malformed changes: %j", (action) => {
    expect(agentActionSchema.safeParse(action).success).toBe(false);
  });
});
