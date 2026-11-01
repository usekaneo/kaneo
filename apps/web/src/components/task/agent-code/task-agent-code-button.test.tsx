import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { AgentCodeRepository, AgentCodeStatus } from "@/types/agent";
import { TaskAgentCodeButton } from "./task-agent-code-button";

const mocks = vi.hoisted(() => ({
  status: undefined as AgentCodeStatus | undefined,
  repositories: undefined as AgentCodeRepository[] | undefined,
  repositoryWorkspace: undefined as string | undefined,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/agent/use-agent-code-status", () => ({
  default: () => ({ data: mocks.status }),
}));
vi.mock("@/hooks/queries/agent/use-agent-code-repositories", () => ({
  default: (workspaceId: string) => {
    mocks.repositoryWorkspace = workspaceId;
    return { data: workspaceId ? mocks.repositories : undefined };
  },
}));
vi.mock("./task-agent-code-dialog", () => ({
  TaskAgentCodeDialog: ({
    open,
    repositories,
  }: {
    open: boolean;
    repositories: AgentCodeRepository[];
  }) =>
    open ? (
      <div role="dialog">
        {repositories.map((repository) => repository.fullName).join(",")}
      </div>
    ) : null,
}));

const repository = (
  overrides: Partial<AgentCodeRepository> = {},
): AgentCodeRepository => ({
  integrationId: "integration",
  projectId: "project",
  host: "github",
  fullName: "usekaneo/kaneo",
  defaultBranch: "main",
  backend: "repo-ci",
  state: "ready",
  ...overrides,
});

beforeEach(() => {
  mocks.status = { enabled: true, canRunCode: true };
  mocks.repositories = [repository()];
  mocks.repositoryWorkspace = undefined;
});
afterEach(cleanup);

const renderButton = () =>
  render(
    <TaskAgentCodeButton taskId="task" projectId="project" workspaceId="ws" />,
  );
const actionButton = () =>
  screen.queryByRole("button", { name: "agent:code.start.action" });

describe("TaskAgentCodeButton", () => {
  it("opens the start dialog with the project's ready repositories", () => {
    mocks.repositories = [
      repository(),
      repository({ integrationId: "other", projectId: "elsewhere" }),
    ];
    renderButton();
    fireEvent.click(actionButton() as HTMLElement);
    expect(screen.getByRole("dialog")).toHaveTextContent("usekaneo/kaneo");
  });

  it("is hidden when coding jobs aren't configured", () => {
    mocks.status = { enabled: false, canRunCode: false };
    renderButton();
    expect(actionButton()).not.toBeInTheDocument();
  });

  it("is hidden without agent:run_code and skips the repository lookup", () => {
    mocks.status = { enabled: true, canRunCode: false };
    renderButton();
    expect(actionButton()).not.toBeInTheDocument();
    expect(mocks.repositoryWorkspace).toBe("");
  });

  it("is hidden when the project has no opted-in repository", () => {
    mocks.repositories = [repository({ projectId: "elsewhere" })];
    renderButton();
    expect(actionButton()).not.toBeInTheDocument();
  });

  it("is disabled while no repository is ready", () => {
    mocks.repositories = [repository({ state: "unavailable" })];
    renderButton();
    const button = actionButton() as HTMLElement;
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
