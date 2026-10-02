import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { TaskLabels } from "@/components/kanban-board/task-labels";
import { localeCompareSort } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import useGetLabelsByTask from "./use-get-labels-by-task";
import useGetLabelsByWorkspace from "./use-get-labels-by-workspace";

const { getTaskLabels, getWorkspaceLabels } = vi.hoisted(() => ({
  getTaskLabels: vi.fn(),
  getWorkspaceLabels: vi.fn(),
}));

vi.mock("@/fetchers/label/get-labels-by-task", () => ({
  default: getTaskLabels,
}));
vi.mock("@/fetchers/label/get-label-by-workspace", () => ({
  default: getWorkspaceLabels,
}));
vi.mock("@/lib/i18n", async () => {
  const { createInstance } = await import("i18next");
  const { initReactI18next } = await import("react-i18next");
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng: "en-US",
    fallbackLng: "en-US",
    resources: {
      "en-US": { translation: { label: "Label" } },
      "sv-SE": { translation: { label: "Etikett" } },
    },
  });
  return { i18n: instance };
});

const labels = Object.freeze([
  { id: "accented", name: "Äpple", color: "red" },
  { id: "last", name: "Zebra", color: "blue" },
  { id: "first", name: "Apple", color: "green" },
]);

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </I18nextProvider>
  );
}

beforeEach(async () => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-US"]);
  await i18n.changeLanguage("en-US");
  getTaskLabels.mockResolvedValue(labels);
  getWorkspaceLabels.mockResolvedValue(labels);
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("label sorting", () => {
  it("uses the resolved app language over the browser language", async () => {
    await i18n.changeLanguage("sv-SE");

    expect(localeCompareSort("Äpple", "Zebra")).toBeGreaterThan(0);
    expect(localeCompareSort("Äpple", "Zebra", "en-US")).toBeLessThan(0);
    expect(localeCompareSort("Label 2", "Label 10")).toBeLessThan(0);
    expect(localeCompareSort("apple", "Apple")).toBe(0);
  });

  it.each([
    ["task", useGetLabelsByTask, getTaskLabels],
    ["workspace", useGetLabelsByWorkspace, getWorkspaceLabels],
  ] as const)(
    "reorders cached %s labels when the app language changes",
    async (_, useLabels, fetchLabels) => {
      const { result } = renderHook(() => useLabels("test-id"), {
        wrapper: Wrapper,
      });
      await waitFor(() =>
        expect(result.current.data?.map((label) => label.name)).toEqual([
          "Äpple",
          "Apple",
          "Zebra",
        ]),
      );

      await act(async () => {
        await i18n.changeLanguage("sv-SE");
      });

      await waitFor(() =>
        expect(result.current.data?.map((label) => label.name)).toEqual([
          "Apple",
          "Zebra",
          "Äpple",
        ]),
      );
      expect(fetchLabels).toHaveBeenCalledTimes(1);
      expect(queryClient.getQueryData(["labels", "test-id"])).toEqual(labels);

      await act(async () => {
        await i18n.changeLanguage("en-US");
      });
      await waitFor(() =>
        expect(result.current.data?.map((label) => label.name)).toEqual([
          "Äpple",
          "Apple",
          "Zebra",
        ]),
      );
    },
  );

  it("reorders task badges when the app language changes with the same labels", async () => {
    const { container } = render(<TaskLabels labels={[...labels]} />, {
      wrapper: Wrapper,
    });
    const displayedNames = () =>
      [...container.querySelectorAll("span[title]")].map(
        (label) => label.textContent,
      );
    expect(displayedNames()).toEqual(["Äpple", "Apple", "Zebra"]);

    await act(async () => {
      await i18n.changeLanguage("sv-SE");
    });
    expect(displayedNames()).toEqual(["Apple", "Zebra", "Äpple"]);

    await act(async () => {
      await i18n.changeLanguage("en-US");
    });
    expect(displayedNames()).toEqual(["Äpple", "Apple", "Zebra"]);
    expect(labels.map((label) => label.name)).toEqual([
      "Äpple",
      "Zebra",
      "Apple",
    ]);
  });
});
