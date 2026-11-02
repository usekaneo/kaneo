import { cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { AgentCodeProposal, AgentProposal, AgentRun } from "@/types/agent";
import { AgentProposalReview } from "./agent-proposal-review";

const destination = vi.hoisted(() => ({
  projectName: "Project Bravo",
  statusName: "Done",
  pending: false,
  ready: true,
}));

vi.mock("./use-agent-creation-destinations", () => ({
  useAgentCreationDestinations: () => new Map([["create", destination]]),
}));

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

vi.mock("@/hooks/queries/agent/use-agent-code-repositories", () => ({
  default: (workspaceId: string) => ({
    data: workspaceId
      ? [{ integrationId: "integration", fullName: "usekaneo/kaneo" }]
      : undefined,
  }),
}));
vi.mock("@/components/public-project/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

vi.mock("./use-agent-value-formatter", () => ({
  useAgentValueFormatter: () => (_field: string, value: string | null) =>
    value ?? "",
}));

afterEach(cleanup);
beforeEach(() => {
  destination.pending = false;
  destination.ready = true;
});

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
  codeProposals: [],
} as unknown as AgentRun;
const codeProposal = {
  ...proposal("code", "pending"),
  reason: "Requested from chat",
  action: {
    type: "code.run",
    taskId: "task-1",
    integrationId: "integration",
    instructions: "Retry with **backoff**",
    baseRef: "main",
  },
} as AgentCodeProposal;
const codeRun = {
  id: "run",
  status: "awaiting_review",
  proposals: [],
  codeProposals: [codeProposal],
} as unknown as AgentRun;

describe("AgentProposalReview", () => {
  it("keeps Undo enabled after applying the last proposal", () => {
    render(
      <AgentProposalReview
        workspaceId="ws"
        run={{
          ...run,
          status: "completed",
          proposals: [proposal("applied", "applied")],
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "agent:proposal.undo" }),
    ).toBeEnabled();
  });

  it("shows the destination, initial status, and full creation description", () => {
    render(<AgentProposalReview workspaceId="ws" run={creationRun} />);
    expect(screen.queryByText("agent:review.undoHint")).not.toBeInTheDocument();
    expect(screen.getByText("Project Bravo")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent(
      "Include **all** migration details.",
    );
    expect(
      screen.getByRole("button", { name: "agent:review.apply" }),
    ).toBeEnabled();
  });

  it.each([true, false])(
    "blocks creation while its destination is unresolved (pending=%s)",
    (pending) => {
      destination.pending = pending;
      destination.ready = false;
      render(<AgentProposalReview workspaceId="ws" run={creationRun} />);
      expect(screen.getByRole("checkbox")).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(
        screen.getByRole("button", { name: "agent:review.apply" }),
      ).toBeDisabled();
      if (!pending)
        expect(screen.getByRole("alert")).toHaveTextContent(
          "agent:proposal.destinationUnavailable",
        );
    },
  );
  it("lets the owner select, apply, discard, and undo", () => {
    render(<AgentProposalReview workspaceId="ws" run={run} />);
    expect(screen.getByText("agent:review.undoHint")).toBeInTheDocument();
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

  it("reviews a coding proposal with its repository and instructions", () => {
    render(
      <AgentProposalReview
        workspaceId="ws"
        run={codeRun}
        getTaskKey={() => "WEB-135"}
      />,
    );
    expect(screen.queryByText("agent:review.undoHint")).not.toBeInTheDocument();
    expect(screen.getByText("agent:proposal.action.code")).toBeInTheDocument();
    expect(screen.getByText("usekaneo/kaneo")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent(
      "Retry with **backoff**",
    );
    expect(
      screen.getByRole("checkbox", { name: /WEB-135/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "agent:review.apply" }),
    ).toBeEnabled();
  });

  it("shows a coding proposal read-only to shared viewers", () => {
    render(<AgentProposalReview workspaceId="ws" run={codeRun} readOnly />);
    expect(screen.getByText("agent:proposal.action.code")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

const creationRun = {
  ...run,
  proposals: [
    {
      ...proposal("create", "pending"),
      action: {
        type: "task.create",
        projectId: "bravo",
        title: "Write the migration guide",
        description: "Include **all** migration details.",
        status: "done",
        priority: "low",
        userId: null,
        dueDate: null,
      },
      before: null,
    },
  ],
} as AgentRun;
