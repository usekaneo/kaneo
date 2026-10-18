import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import TaskShareButton from "./task-share-button";

let canShare = true;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canShareProjects: () => canShare,
    isCheckingPermissions: false,
  }),
}));
vi.mock("./header/header-icon-button", () => ({
  HeaderIconButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => (
    <button type="button" aria-label={label} onClick={onClick}>
      share
    </button>
  ),
}));
vi.mock("./task-share-dialog", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="share-dialog" /> : null,
}));

describe("TaskShareButton", () => {
  afterEach(() => {
    cleanup();
    canShare = true;
  });

  it("opens sharing from task details for an authorized user", () => {
    render(<TaskShareButton taskId="task-1" />);
    fireEvent.click(screen.getByRole("button", { name: "tasks:share.action" }));
    expect(screen.getByTestId("share-dialog")).toBeInTheDocument();
  });

  it("does not expose the action without project sharing permission", () => {
    canShare = false;
    render(<TaskShareButton taskId="task-1" />);
    expect(
      screen.queryByRole("button", { name: "tasks:share.action" }),
    ).not.toBeInTheDocument();
  });
});
