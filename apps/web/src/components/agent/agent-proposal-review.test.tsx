import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AgentProposal, AgentRun } from "@/types/agent";
import { AgentProposalReview } from "./agent-proposal-review";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/mutations/agent/use-review-agent-proposals", () => ({
  default: () => {
    const mutation = { mutateAsync: vi.fn(), isPending: false };
    return { apply: mutation, discard: mutation, undo: mutation };
  },
}));

vi.mock("./use-agent-value-formatter", () => ({
  useAgentValueFormatter: () => (_field: string, value: string | null) =>
    value ?? "",
}));

afterEach(cleanup);

const before = {
  id: "task-1",
  projectId: "project",
  title: "Fix reconnect",
  status: "to-do",
  priority: "low",
  userId: null,
  dueDate: null,
};
const proposal = (id: string, status: AgentProposal["status"]) =>
  ({
    id,
    runId: "run",
    reason: "Due soon",
    status,
    action: {
      type: "task.update",
      taskId: "task-1",
      patch: { priority: "high" },
    },
    before,
    after: status === "applied" ? { ...before, priority: "high" } : null,
    createdAt: "2026-10-01T00:00:00.000Z",
    appliedAt: null,
    undoneAt: null,
  }) as AgentProposal;
const run = {
  id: "run",
  status: "awaiting_review",
  proposals: [proposal("pending", "pending"), proposal("applied", "applied")],
} as AgentRun;

describe("AgentProposalReview", () => {
  it("lets the owner select, apply, discard, and undo", () => {
    render(<AgentProposalReview workspaceId="ws" run={run} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "agent:review.discard" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "agent:proposal.undo" }),
    ).toBeInTheDocument();
  });

  it("shows proposals without review controls to shared viewers", () => {
    render(<AgentProposalReview workspaceId="ws" run={run} readOnly />);
    expect(screen.getByText("agent:review.title")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
