import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { AvatarRow } from "./avatar-row";

const m = vi.hoisted(() => ({
  remove: vi.fn(),
  refetch: vi.fn(),
  success: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/use-update-user-avatar", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/mutations/use-remove-user-avatar", () => ({
  default: () => ({ mutateAsync: m.remove, isPending: false }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: m.success, error: vi.fn() },
}));

describe("AvatarRow", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    m.remove.mockResolvedValue(undefined);
    m.refetch.mockResolvedValue(undefined);
  });

  it("only offers removal when a picture exists", () => {
    render(<AvatarRow name="Jo" image={null} refetchUser={m.refetch} />);

    expect(
      screen.getByRole("button", {
        name: "settings:informationPage.avatar.upload",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "settings:informationPage.avatar.remove",
      }),
    ).toBeNull();
  });

  it("removes the picture right away", async () => {
    render(
      <AvatarRow
        name="Jo"
        image="https://example.com/a.png"
        refetchUser={m.refetch}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:informationPage.avatar.remove",
      }),
    );

    await waitFor(() => expect(m.remove).toHaveBeenCalled());
    await waitFor(() => expect(m.refetch).toHaveBeenCalled());
  });
});
