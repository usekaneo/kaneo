import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AgentCodeJob } from "@/types/agent";
import { AgentCodeJobCard } from "./agent-code-job-card";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { number?: number }) =>
      values?.number ? `${key}:${values.number}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
// The card falls back to the run's copy of the job, so the live query and the
// event history stay empty here.
vi.mock("@/hooks/queries/agent/use-agent-code-job", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock("@/hooks/queries/agent/use-agent-code-job-events", () => ({
  default: () => ({
    data: [
      {
        sequence: 1,
        jobId: "job",
        phase: "queued",
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/mutations/agent/use-cancel-agent-code-job", () => ({
  default: () => ({ mutate: vi.fn(), isPending: false }),
}));

afterEach(cleanup);

const baseJob = {
  id: "job",
  runId: "run",
  taskId: "task",
  integrationId: "integration",
  status: "queued",
  outcome: null,
  backend: "repo-ci",
  phase: null,
  progress: null,
  repositoryOwner: "usekaneo",
  repositoryName: "kaneo",
  baseRef: "main",
  baseSha: null,
  branch: "kaneo/web-135-fix",
  model: "model",
  externalUrl: null,
  prNumber: null,
  prUrl: null,
  commitSha: null,
  summary: null,
  error: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  deadline: "2026-10-01T00:30:00.000Z",
} satisfies AgentCodeJob;

function renderCard(overrides: Partial<AgentCodeJob>, readOnly = false) {
  render(
    <AgentCodeJobCard
      workspaceId="ws"
      job={{ ...baseJob, ...overrides }}
      readOnly={readOnly}
    />,
  );
}

const stopButton = () =>
  screen.queryByRole("button", { name: "agent:code.cancel.action" });

describe("AgentCodeJobCard", () => {
  it.each(["queued", "dispatched", "running"] as const)(
    "shows %s as active and lets the owner stop it",
    (status) => {
      renderCard({ status });
      expect(screen.getByRole("heading")).toHaveTextContent("usekaneo/kaneo");
      expect(screen.getByRole("status")).toHaveTextContent(
        `agent:code.status.${status}`,
      );
      expect(stopButton()).toBeInTheDocument();
    },
  );

  it("shows the reported phase while working", () => {
    renderCard({ status: "running", phase: "testing" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "agent:code.phase.testing",
    );
  });

  it("can't be stopped once committing starts", () => {
    renderCard({ status: "committing" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "agent:code.status.committing",
    );
    expect(stopButton()).not.toBeInTheDocument();
  });

  it("links the opened pull request in a new tab", () => {
    renderCard({
      status: "completed",
      outcome: "pr_opened",
      prNumber: 1874,
      prUrl: "https://github.com/usekaneo/kaneo/pull/1874",
      summary: "Retry with backoff",
    });
    const link = screen.getByRole("link", {
      name: "agent:code.status.prOpened:1874",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/usekaneo/kaneo/pull/1874",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Retry with backoff")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(stopButton()).not.toBeInTheDocument();
  });

  it("labels a run without changes", () => {
    renderCard({ status: "completed", outcome: "no_changes" });
    expect(screen.getByText("agent:code.status.noChanges")).toBeInTheDocument();
  });

  it("explains a failure and links its Actions run", () => {
    renderCard({
      status: "failed",
      error: "timed_out",
      externalUrl: "https://github.com/usekaneo/kaneo/actions/runs/1",
    });
    expect(screen.getByText("agent:code.status.failed")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "agent:code.failure.timedOut",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("timed_out");
    expect(
      screen.getByRole("link", { name: "agent:code.actionsRun" }),
    ).toHaveAttribute("target", "_blank");
  });

  it("labels a stopped job", () => {
    renderCard({ status: "cancelled" });
    expect(screen.getByText("agent:code.status.cancelled")).toBeInTheDocument();
    expect(stopButton()).not.toBeInTheDocument();
  });

  it("shows shared viewers the status without stopping", () => {
    renderCard({ status: "running" }, true);
    expect(screen.getByRole("status")).toHaveTextContent(
      "agent:code.status.running",
    );
    expect(stopButton()).not.toBeInTheDocument();
  });

  it("lists the recorded state history", () => {
    renderCard({ status: "queued" });
    expect(
      screen.getByRole("list", { name: "agent:code.history" }),
    ).toHaveTextContent("agent:code.status.queued");
  });
});
