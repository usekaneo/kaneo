import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { AgentRunSummary } from "@/types/agent";
import { AgentThread } from "./agent-thread";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("./agent-run-item", () => ({
  AgentRunItem: ({ summary }: { summary: AgentRunSummary }) => (
    <article>{summary.prompt}</article>
  ),
}));
beforeEach(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const run = (id: number) =>
  ({ id: String(id), prompt: `Turn ${id}` }) as AgentRunSummary;

describe("AgentThread history", () => {
  it("loads an older page without moving the current reading position", () => {
    const onLoadOlder = vi.fn();
    const props = {
      workspaceId: "workspace",
      runs: [run(2)],
      isLoading: false,
      isError: false,
      hasOlder: true,
      onLoadOlder,
    };
    const { container, rerender } = render(<AgentThread {...props} />);
    const scroller = container.firstElementChild as HTMLDivElement;
    let height = 1000;
    Object.defineProperty(scroller, "scrollHeight", { get: () => height });
    scroller.scrollTop = 40;
    fireEvent.click(
      screen.getByRole("button", { name: "agent:thread.loadOlder" }),
    );
    expect(onLoadOlder).toHaveBeenCalledOnce();
    rerender(<AgentThread {...props} isLoadingOlder />);
    height = 1500;
    rerender(
      <AgentThread {...props} runs={[run(1), run(2)]} hasOlder={false} />,
    );
    expect(scroller.scrollTop).toBe(540);
    expect(
      screen.getAllByRole("article").map((item) => item.textContent),
    ).toEqual(["Turn 1", "Turn 2"]);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps loaded history visible with a retry button after an older page fails", () => {
    render(
      <AgentThread
        workspaceId="w"
        runs={[run(2)]}
        isLoading={false}
        isError
        hasOlder
        onLoadOlder={() => {}}
      />,
    );
    expect(screen.getByText("Turn 2")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "agent:thread.loadError",
    );
    expect(
      screen.getByRole("button", { name: "agent:thread.loadOlder" }),
    ).toBeEnabled();
  });
});
