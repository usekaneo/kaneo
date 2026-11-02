import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import useAgentRun from "@/hooks/queries/agent/use-agent-run";
import type { AgentRun } from "@/types/agent";
import { AutomationRunPanel } from "./automation-run-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("@/hooks/queries/agent/use-agent-run", () => ({ default: vi.fn() }));
vi.mock("../agent-run-output", () => ({
  AgentRunOutput: ({ response }: { response: string }) => <div>{response}</div>,
}));
vi.mock("./automation-run-trigger", () => ({
  AutomationRunTrigger: () => null,
}));
vi.mock("@/lib/format", () => ({ formatDateTime: (value: string) => value }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const run = {
  id: "older",
  conversationId: "conversation",
  trigger: { automationId: "automation" },
  status: "completed",
  response: "The requested older result",
  inputTokens: 0,
  outputTokens: 0,
  costUsd: null,
  createdAt: "2026-10-01T00:00:00Z",
  finishedAt: null,
  error: null,
} as unknown as AgentRun;

it("loads and renders a linked run without requiring its paginated summary", () => {
  vi.mocked(useAgentRun).mockReturnValue({
    data: run,
    isError: false,
  } as ReturnType<typeof useAgentRun>);
  render(
    <AutomationRunPanel
      workspaceId="workspace"
      runId="older"
      automationId="automation"
      conversationId="conversation"
      summary={undefined}
      readOnly
    />,
  );
  expect(useAgentRun).toHaveBeenCalledWith("workspace", "older", true);
  expect(screen.getByText("The requested older result")).toBeInTheDocument();
});
it("does not display a run from another automation or conversation", () => {
  vi.mocked(useAgentRun).mockReturnValue({
    data: { ...run, conversationId: "other" },
    isError: false,
  } as ReturnType<typeof useAgentRun>);
  render(
    <AutomationRunPanel
      workspaceId="workspace"
      runId="older"
      automationId="automation"
      conversationId="conversation"
      summary={undefined}
      readOnly
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("agent:run.loadError");
  expect(
    screen.queryByText("The requested older result"),
  ).not.toBeInTheDocument();
});
