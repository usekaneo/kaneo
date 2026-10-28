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
import { PublicLinkUrlRow } from "./public-link-url-row";

const m = vi.hoisted(() => ({ copy: vi.fn(), error: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/copy-to-clipboard", () => ({ copyToClipboard: m.copy }));
vi.mock("@/lib/toast", () => ({ toast: { error: m.error } }));

const url = "https://kaneo.test/public-project/p1";

describe("PublicLinkUrlRow", () => {
  afterEach(cleanup);
  beforeEach(() => vi.clearAllMocks());

  it("shows the link and opens the public page in a new tab", () => {
    render(<PublicLinkUrlRow url={url} />);

    expect(
      screen.getByLabelText("settings:projectVisibility.publicUrl"),
    ).toHaveValue(url);
    const open = screen.getByRole("link", {
      name: "settings:projectVisibility.openPublicPage",
    });
    expect(open).toHaveAttribute("href", url);
    expect(open).toHaveAttribute("target", "_blank");
  });

  it("switches to a copied state after copying", async () => {
    m.copy.mockResolvedValue(true);
    render(<PublicLinkUrlRow url={url} />);

    fireEvent.click(
      screen.getByRole("button", { name: "settings:projectVisibility.copy" }),
    );

    expect(
      await screen.findByRole("button", {
        name: "settings:projectVisibility.copied",
      }),
    ).toBeTruthy();
    expect(m.copy).toHaveBeenCalledWith(url);
    expect(m.error).not.toHaveBeenCalled();
  });

  it("shows an error when the copy fails", async () => {
    m.copy.mockResolvedValue(false);
    render(<PublicLinkUrlRow url={url} />);

    fireEvent.click(
      screen.getByRole("button", { name: "settings:projectVisibility.copy" }),
    );

    await waitFor(() =>
      expect(m.error).toHaveBeenCalledWith(
        "settings:projectVisibility.copyError",
      ),
    );
  });
});
