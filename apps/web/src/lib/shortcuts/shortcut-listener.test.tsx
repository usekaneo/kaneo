import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ShortcutListener } from "./shortcut-listener";

afterEach(() => {
  cleanup();
});

describe("ShortcutListener", () => {
  it("keeps Ctrl+S from opening the browser's save dialog on any page", () => {
    const { getByRole } = render(
      <>
        <ShortcutListener />
        <textarea aria-label="draft" />
      </>,
    );
    const press = (target: Element) =>
      fireEvent.keyDown(target, { key: "s", code: "KeyS", ctrlKey: true });

    expect(press(document.body)).toBe(false);
    expect(press(getByRole("textbox", { name: "draft" }))).toBe(false);
  });

  it("leaves other unbound keys to the browser", () => {
    render(<ShortcutListener />);

    expect(
      fireEvent.keyDown(document.body, {
        key: "p",
        code: "KeyP",
        ctrlKey: true,
      }),
    ).toBe(true);
  });
});
