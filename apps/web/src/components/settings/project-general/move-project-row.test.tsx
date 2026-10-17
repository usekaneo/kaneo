import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { MoveProjectRow } from "./move-project-row";

const m = vi.hoisted(() => ({ move: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/mutations/project/use-move-project", () => ({
  default: () => ({ mutateAsync: m.move }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const targets = [{ id: "w2", name: "Other" }];

describe("MoveProjectRow", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
  });

  it("explains a failed target lookup instead of offering the move", () => {
    render(
      <MoveProjectRow
        projectId="p1"
        targets={[]}
        targetsFailed
        flushPendingSave={async () => true}
      />,
    );

    expect(
      screen.getByText("settings:projectGeneral.moveTargetsError"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "settings:projectGeneral.moveProjectAction",
      }),
    ).toBeNull();
  });

  it("asks for a workspace before the move can be confirmed", async () => {
    render(
      <MoveProjectRow
        projectId="p1"
        targets={targets}
        targetsFailed={false}
        flushPendingSave={async () => true}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:projectGeneral.moveProjectAction",
      }),
    );

    expect(
      await screen.findByRole("button", {
        name: "settings:projectGeneral.moveModalConfirm",
      }),
    ).toBeDisabled();
    expect(
      screen.getByLabelText("settings:projectGeneral.moveTargetLabel"),
    ).toBeTruthy();
    expect(m.move).not.toHaveBeenCalled();
  });
});
