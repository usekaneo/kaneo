import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { ReactNode } from "react";
import type { Automation } from "@/types/agent-automation";
import { AutomationDetail } from "./automation-detail";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/components/common/workspace-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/hooks/queries/agent/use-agent-config", () => ({
  default: () => ({ data: { enabled: true } }),
}));
vi.mock("@/hooks/queries/agent-automation/use-automation-runs", () => ({
  default: () => ({
    data: [{ id: "newest" }],
    isPending: false,
    isError: false,
  }),
}));
vi.mock("./use-automations-breadcrumbs", () => ({
  useAutomationsBreadcrumbs: () => [],
}));
vi.mock("./automation-meta", () => ({ AutomationMeta: () => null }));
vi.mock("./automation-owner-actions", () => ({
  AutomationOwnerActions: () => null,
}));
vi.mock("./automation-prompt-preview", () => ({
  AutomationPromptPreview: () => null,
}));
vi.mock("./automation-state-line", () => ({ AutomationStateLine: () => null }));
vi.mock("./automation-take-over-dialog", () => ({
  AutomationTakeOverDialog: () => null,
}));
vi.mock("./automation-run-list", () => ({ AutomationRunList: () => null }));
vi.mock("./automation-run-panel", () => ({
  AutomationRunPanel: ({ runId }: { runId: string }) => (
    <div data-testid="selected-run">{runId}</div>
  ),
}));
afterEach(cleanup);

const automation = {
  id: "automation",
  name: "Daily",
  prompt: "Review",
  conversationId: "conversation",
  viewer: { isOwner: true, canTakeOver: false },
  monthCostUsd: null,
} as unknown as Automation;
it("opens the requested older run even when it is outside the current history page", () => {
  render(
    <AutomationDetail
      workspaceId="workspace"
      automation={automation}
      runId="older-linked-run"
    />,
  );
  expect(screen.getByTestId("selected-run")).toHaveTextContent(
    "older-linked-run",
  );
});
it("selects the newest run when no run is requested", () => {
  render(
    <AutomationDetail
      workspaceId="workspace"
      automation={automation}
      runId={undefined}
    />,
  );
  expect(screen.getByTestId("selected-run")).toHaveTextContent("newest");
});
