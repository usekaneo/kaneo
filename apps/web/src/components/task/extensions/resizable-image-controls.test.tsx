import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, expect, it, vi } from "vitest";
import { ResizableImage } from "./resizable-image";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let editor: Editor | null = null;
afterEach(() => {
  cleanup();
  editor?.destroy();
  editor = null;
});

it("updates resize controls when editing permission changes without replacing the image", async () => {
  const instance = new Editor({
    extensions: [StarterKit, ResizableImage],
    content:
      '<img src="https://example.com/image.png" alt="Diagram" width="320">',
  });
  editor = instance;
  render(<EditorContent editor={instance} />);
  await screen.findByRole("button", {
    name: "tasks:detail.editor.image.resizeHandle",
  });

  act(() => instance.setEditable(false));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", {
        name: "tasks:detail.editor.image.resizeHandle",
      }),
    ).toBeNull(),
  );
  expect(
    screen.queryByRole("button", { name: "tasks:detail.editor.image.small" }),
  ).toBeNull();
  expect(screen.getByRole("img", { name: "Diagram" })).toHaveAttribute(
    "width",
    "320",
  );

  act(() => instance.setEditable(true));
  await screen.findByRole("button", {
    name: "tasks:detail.editor.image.resizeHandle",
  });
  expect(
    screen.getByRole("button", { name: "tasks:detail.editor.image.small" }),
  ).toBeTruthy();
});
