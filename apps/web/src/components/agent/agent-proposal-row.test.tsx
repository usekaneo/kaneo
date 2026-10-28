import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AgentProposal } from "@/types/agent";
import { AgentProposalRow } from "./agent-proposal-row";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/components/public-project/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

afterEach(cleanup);

const proposal = {
  id: "proposal",
  runId: "run",
  reason: "Unblock the proxy fix",
  status: "pending",
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
  after: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  appliedAt: null,
  undoneAt: null,
} as AgentProposal;

function renderRow(overrides: Partial<AgentProposal>, onUndo = vi.fn()) {
  render(
    <AgentProposalRow
      proposal={{ ...proposal, ...overrides } as AgentProposal}
      taskKey="WEB-135"
      selected
      disabled={false}
      onSelectedChange={() => {}}
      onUndo={onUndo}
    />,
  );
  return onUndo;
}

describe("AgentProposalRow", () => {
  it("previews a proposed comment's Markdown under its task key", () => {
    renderRow({});
    expect(screen.getByText("WEB-135")).toBeInTheDocument();
    expect(
      screen.getByText("agent:proposal.action.comment"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent(
      "Could you review **today**?",
    );
    expect(
      screen.getByRole("checkbox", { name: /WEB-135/ }),
    ).toBeInTheDocument();
  });

  it("offers undo once the comment is posted", () => {
    const onUndo = renderRow({ status: "applied" });
    fireEvent.click(
      screen.getByRole("button", { name: "agent:proposal.undo" }),
    );
    expect(onUndo).toHaveBeenCalledOnce();
  });
});
