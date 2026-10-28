import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { useState } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { AgentPromptEditor } from "./agent-prompt-editor";

const m = vi.hoisted(() => ({
  search: vi.fn(),
  editors: [] as unknown[],
}));

vi.mock("@tiptap/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tiptap/react")>();
  return {
    ...actual,
    useEditor: (...args: Parameters<typeof actual.useEditor>) => {
      const editor = actual.useEditor(...args);
      if (editor && !m.editors.includes(editor)) m.editors.push(editor);
      return editor;
    },
  };
});
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/search/global-search", () => ({ default: m.search }));

const results = {
  tasks: [
    {
      id: "t1",
      type: "task",
      title: "Launch checklist",
      projectSlug: "WEB",
      taskNumber: 135,
      projectName: "Kaneo Web",
    },
  ],
  projects: [{ id: "p1", type: "project", title: "Launch v3" }],
};

function Harness({
  onSubmit,
  onChange,
  projectId,
}: {
  onSubmit: () => void;
  onChange: (value: string) => void;
  projectId?: string;
}) {
  const [value, setValue] = useState("");
  return (
    <AgentPromptEditor
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      onSubmit={onSubmit}
      onPasteFiles={() => {}}
      placeholder="Ask"
      mentionScope={{ workspaceId: "ws", projectId }}
      menuPlacement="above"
    />
  );
}

function setup(projectId?: string) {
  const onSubmit = vi.fn();
  const onChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness onSubmit={onSubmit} onChange={onChange} projectId={projectId} />
    </QueryClientProvider>,
  );
  const editor = m.editors.at(-1) as Editor;
  const input = screen.getByRole("textbox", { name: "Ask" });
  const type = (text: string) =>
    act(() => {
      editor.chain().focus().insertContent(text).run();
    });
  const press = (key: string) => fireEvent.keyDown(input, { key });
  const lastValue = () => onChange.mock.calls.at(-1)?.[0];
  return { editor, input, type, press, onSubmit, lastValue };
}

beforeEach(() => {
  m.editors.length = 0;
  m.search.mockImplementation(
    async ({ type }: { type: "tasks" | "projects" }) => ({
      results: results[type],
      totalCount: results[type].length,
      searchQuery: "",
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AgentPromptEditor mentions", () => {
  it("searches on @, moves with arrows, and inserts the picked item as a chip", async () => {
    const ui = setup();
    ui.type("Plan @lau");

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "WEB-135Launch checklistKaneo Web",
      "Launch v3",
    ]);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(ui.input).toHaveAttribute(
      "aria-controls",
      screen.getByRole("listbox").id,
    );
    expect(m.search).toHaveBeenCalledWith(
      expect.objectContaining({ q: "lau", type: "tasks", workspaceId: "ws" }),
    );

    ui.press("ArrowDown");
    await waitFor(() =>
      expect(screen.getAllByRole("option")[1]).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    expect(ui.input).toHaveAttribute(
      "aria-activedescendant",
      screen.getAllByRole("option")[1]?.id,
    );
    ui.press("ArrowDown");
    await waitFor(() =>
      expect(screen.getAllByRole("option")[0]).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    ui.press("ArrowUp");
    ui.press("Enter");

    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(ui.onSubmit).not.toHaveBeenCalled();
    expect(ui.lastValue()).toBe("Plan @[Launch v3](project:p1) ");
    expect(screen.getByText("Launch v3")).toBeInTheDocument();

    ui.press("Enter");
    expect(ui.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape so Enter sends the text as typed", async () => {
    const ui = setup();
    ui.type("@lau");
    await screen.findByRole("listbox");

    ui.press("Escape");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    ui.press("Enter");
    expect(ui.onSubmit).toHaveBeenCalledTimes(1);
    expect(ui.lastValue()).toBe("@lau");
  });

  it("removes a chip with one Backspace", async () => {
    const ui = setup();
    ui.type("Ship @lau");
    await screen.findByRole("listbox");
    ui.press("Enter");
    await waitFor(() =>
      expect(ui.lastValue()).toBe("Ship @[Launch checklist](task:t1) "),
    );

    // Put the caret right after the chip; jsdom has no native text deletion.
    act(() => {
      ui.editor.commands.setTextSelection(ui.editor.state.selection.from - 1);
    });
    ui.press("Backspace");
    expect(ui.lastValue()).toBe("Ship  ");
  });

  it("searches only the board's project tasks from the panel", async () => {
    const ui = setup("proj");
    ui.type("@lau");

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(1);
    expect(m.search).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tasks", projectId: "proj" }),
    );
    expect(m.search).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "projects" }),
    );
  });
});
