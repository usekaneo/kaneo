import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { AutomationsSection } from "@/components/project/automations/automations-section";
import type { RepositoryConnection } from "@/components/project/automations/use-repository-connections";
import type { IntegrationState } from "@/components/project/integrations/get-integration-status";

const m = vi.hoisted(() => ({
  states: {} as Record<string, IntegrationState>,
  canUpdate: true,
}));

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
  Trans: ({
    i18nKey,
    values,
  }: {
    i18nKey: string;
    values: Record<string, string>;
  }) => `${i18nKey} ${JSON.stringify(values)}`,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <a href="/integrations" className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateProjects: () => m.canUpdate }),
}));
vi.mock("@/components/project/automations/use-repository-connections", () => ({
  useRepositoryConnections: (): RepositoryConnection[] =>
    (["github", "gitea", "gitlab"] as const).map((id) => ({
      id,
      name: { github: "GitHub", gitea: "Gitea", gitlab: "GitLab" }[id],
      icon: () => <svg />,
      iconClassName: "",
      status: {
        state: m.states[id] ?? "disconnected",
        detail: id === "github" ? "acme/website" : undefined,
      },
    })),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    isLoading: false,
    data: [
      { id: "c1", name: "To Do", slug: "to-do", icon: null, isFinal: false },
      { id: "c2", name: "Done", slug: "done", icon: null, isFinal: true },
    ],
  }),
}));
vi.mock("@/hooks/queries/workflow-rule/use-get-workflow-rules", () => ({
  useGetWorkflowRules: () => ({
    isLoading: false,
    data: [
      {
        id: "r1",
        integrationType: "github",
        eventType: "pr_merged",
        columnId: "c2",
      },
    ],
  }),
}));
vi.mock("@/hooks/mutations/workflow-rule/use-upsert-workflow-rule", () => ({
  useUpsertWorkflowRule: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/workflow-rule/use-delete-workflow-rule", () => ({
  useDeleteWorkflowRule: () => ({ mutateAsync: vi.fn() }),
}));

describe("AutomationsSection", () => {
  beforeEach(() => {
    m.states = {};
    m.canUpdate = true;
  });
  afterEach(cleanup);

  it("explains that automations need a connected repository", () => {
    render(<AutomationsSection projectId="p1" />);
    expect(
      screen.getByText("settings:workflowEditor.emptyTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "settings:workflowEditor.openIntegrations",
      }),
    ).toBeInTheDocument();
  });

  it("shows a card per connected provider and lists the others", () => {
    m.states = { github: "connected" };
    render(<AutomationsSection projectId="p1" />);

    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("acme/website")).toBeInTheDocument();
    expect(
      screen.getByText("settings:projectIntegrations.statusConnected"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Gitea")).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(5);
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(
      screen.getByText(
        'settings:workflowEditor.connectMore {"providers":"Gitea or GitLab"}',
      ),
    ).toBeInTheDocument();
  });

  it("marks paused providers and hides the note when all are set up", () => {
    m.states = { github: "connected", gitea: "paused", gitlab: "connected" };
    render(<AutomationsSection projectId="p1" />);
    expect(
      screen.getByText("settings:projectIntegrations.statusPaused"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(15);
    expect(
      screen.queryByText(/settings:workflowEditor.connectMore/),
    ).toBeNull();
  });

  it("disables rule editing without project update permission", () => {
    m.states = { github: "connected" };
    m.canUpdate = false;
    render(<AutomationsSection projectId="p1" />);
    for (const select of screen.getAllByRole("combobox")) {
      expect(select).toHaveAttribute("data-disabled");
    }
  });
});
