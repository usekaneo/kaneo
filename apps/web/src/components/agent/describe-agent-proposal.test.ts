import { describe, expect, it } from "vite-plus/test";
import type { AgentProposal } from "@/types/agent";
import { describeAgentProposal } from "./describe-agent-proposal";

const base = {
  id: "proposal",
  runId: "run",
  reason: "Balance the week",
  status: "pending",
  after: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  appliedAt: null,
  undoneAt: null,
} as const;

describe("describeAgentProposal", () => {
  it("lists updated fields with their previous values", () => {
    const summary = describeAgentProposal({
      ...base,
      action: {
        type: "task.update",
        taskId: "task-1",
        patch: { userId: "mira", dueDate: null },
      },
      before: {
        id: "task-1",
        projectId: "project",
        title: "Fix reconnect",
        status: "to-do",
        priority: "low",
        userId: "alex",
        dueDate: "2026-10-04T00:00:00.000Z",
      },
    } as AgentProposal);

    expect(summary).toEqual({
      kind: "update",
      taskId: "task-1",
      taskTitle: "Fix reconnect",
      changes: [
        { field: "assignee", from: "alex", to: "mira" },
        { field: "dueDate", from: "2026-10-04T00:00:00.000Z", to: null },
      ],
    });
  });

  it("only lists fields a new task sets beyond the defaults", () => {
    const summary = describeAgentProposal({
      ...base,
      action: {
        type: "task.create",
        projectId: "project",
        title: "Write migration guide",
        description: "",
        status: "to-do",
        priority: "no-priority",
        userId: null,
        dueDate: "2026-10-08T00:00:00.000Z",
      },
      before: null,
    } as AgentProposal);

    expect(summary).toEqual({
      kind: "create",
      taskId: null,
      taskTitle: "Write migration guide",
      changes: [
        { field: "dueDate", from: null, to: "2026-10-08T00:00:00.000Z" },
      ],
    });
  });

  it("carries a comment's body and task title", () => {
    const summary = describeAgentProposal({
      ...base,
      action: {
        type: "comment.create",
        taskId: "task-1",
        body: "Could you review **today**?",
      },
      before: {
        id: "task-1",
        projectId: "project",
        title: "Fix reconnect",
        status: "to-do",
        priority: "low",
        userId: null,
        dueDate: null,
      },
    } as AgentProposal);

    expect(summary).toEqual({
      kind: "comment",
      taskId: "task-1",
      taskTitle: "Fix reconnect",
      body: "Could you review **today**?",
      changes: [],
    });
  });
});
