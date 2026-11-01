import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  AgentPromptEditor,
  type AgentPromptEditorHandle,
} from "./agent-prompt-editor";

const m = vi.hoisted(() => ({ editors: [] as unknown[] }));

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
vi.mock("@/fetchers/search/global-search", () => ({
  default: vi.fn(async () => ({ results: [], totalCount: 0 })),
}));

function setup() {
  const onSubmit = vi.fn();
  const onChange = vi.fn();
  const ref = createRef<AgentPromptEditorHandle>();
  function Harness() {
    const [value, setValue] = useState("");
    return (
      <AgentPromptEditor
        editorRef={ref}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onChange(next);
        }}
        onSubmit={onSubmit}
        onPasteFiles={() => {}}
        placeholder="Prompt"
        mentionScope={{ workspaceId: "ws" }}
        menuPlacement="below"
        multiline
      />
    );
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness />
    </QueryClientProvider>,
  );
  const editor = m.editors.at(-1) as Editor;
  return { editor, ref, onSubmit, onChange };
}

afterEach(() => {
  cleanup();
  m.editors.length = 0;
});

describe("AgentPromptEditor in multiline mode", () => {
  it("keeps Enter for new paragraphs instead of submitting", () => {
    const ui = setup();
    act(() => {
      ui.editor.chain().focus().insertContent("First").run();
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Prompt" }), {
      key: "Enter",
    });
    expect(ui.onSubmit).not.toHaveBeenCalled();
  });

  it("starts a mention with a separating space after a word", () => {
    const ui = setup();
    act(() => ui.ref.current?.startMention());
    expect(ui.onChange).toHaveBeenLastCalledWith("@");

    act(() => {
      ui.editor.commands.setContent("Ask");
      ui.editor.commands.focus("end");
    });
    act(() => ui.ref.current?.startMention());
    expect(ui.onChange).toHaveBeenLastCalledWith("Ask @");
  });
});
