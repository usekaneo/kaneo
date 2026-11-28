import { beforeEach, expect, it, vi } from "vite-plus/test";
import { loadDescription } from "./description";
import { api } from "./endpoints";

vi.mock("./endpoints", () => ({ api: { descriptionPage: vi.fn() } }));

beforeEach(() => vi.mocked(api.descriptionPage).mockReset());

it.each([
  { inline: "Read this", expected: "Read this" },
  { inline: null, expected: "" },
  { inline: undefined, expected: "" },
])(
  "returns inline content for $inline without requesting pages",
  async ({ inline, expected }) => {
    await expect(loadDescription("task", inline, false)).resolves.toBe(
      expected,
    );
    expect(api.descriptionPage).not.toHaveBeenCalled();
  },
);

it.each([null, undefined])(
  "follows returned offsets with the description version until %s",
  async (nextOffset) => {
    vi.mocked(api.descriptionPage)
      .mockResolvedValueOnce({
        content: "First ",
        version: "v1",
        nextOffset: 6,
      })
      .mockResolvedValueOnce({ content: "page", version: "v1", nextOffset });

    await expect(loadDescription("task", "Preview", true)).resolves.toBe(
      "First page",
    );
    expect(vi.mocked(api.descriptionPage).mock.calls).toEqual([
      ["task", 0, undefined],
      ["task", 6, "v1"],
    ]);
  },
);
