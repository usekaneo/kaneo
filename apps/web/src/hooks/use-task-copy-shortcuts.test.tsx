import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { KeyboardShortcutsProvider } from "./use-keyboard-shortcuts";
import { useTaskCopyShortcuts } from "./use-task-copy-shortcuts";

afterEach(cleanup);

function renderCopyShortcuts(enabled: boolean) {
  const onCopyLink = vi.fn();
  const onCopyBranch = vi.fn();
  const view = renderHook(
    (props: { enabled: boolean }) =>
      useTaskCopyShortcuts({ ...props, onCopyLink, onCopyBranch }),
    { initialProps: { enabled }, wrapper: KeyboardShortcutsProvider },
  );
  return { ...view, onCopyLink, onCopyBranch };
}

describe("useTaskCopyShortcuts", () => {
  it("copies the link and branch with Ctrl+Shift+C and Ctrl+Shift+G", () => {
    const { onCopyLink, onCopyBranch } = renderCopyShortcuts(true);

    fireEvent.keyDown(document.body, {
      key: "C",
      ctrlKey: true,
      shiftKey: true,
    });
    fireEvent.keyDown(document.body, {
      key: "G",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(onCopyLink).toHaveBeenCalledOnce();
    expect(onCopyBranch).toHaveBeenCalledOnce();
  });

  it("stops copying once the view disables its shortcuts", () => {
    const { onCopyLink, onCopyBranch, rerender } = renderCopyShortcuts(true);

    rerender({ enabled: false });
    fireEvent.keyDown(document.body, {
      key: "C",
      ctrlKey: true,
      shiftKey: true,
    });
    fireEvent.keyDown(document.body, {
      key: "G",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(onCopyLink).not.toHaveBeenCalled();
    expect(onCopyBranch).not.toHaveBeenCalled();
  });

  it("settles and uses the latest handlers when callers pass new ones on every render", () => {
    const firstLink = vi.fn();
    const latestLink = vi.fn();
    let renders = 0;
    const { rerender } = renderHook(
      (props: { onCopyLink: () => void }) => {
        renders += 1;
        useTaskCopyShortcuts({
          enabled: true,
          onCopyLink: () => props.onCopyLink(),
          onCopyBranch: () => {},
        });
      },
      {
        initialProps: { onCopyLink: firstLink },
        wrapper: KeyboardShortcutsProvider,
      },
    );

    rerender({ onCopyLink: latestLink });
    fireEvent.keyDown(document.body, {
      key: "C",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(renders).toBeLessThan(10);
    expect(firstLink).not.toHaveBeenCalled();
    expect(latestLink).toHaveBeenCalledOnce();
  });
});
