import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  KeyboardShortcutsProvider,
  useKeyboardShortcuts,
} from "./use-keyboard-shortcuts";

afterEach(cleanup);

describe("shortcut key normalization", () => {
  it("dispatches and unregisters mixed-case Enter registrations", () => {
    const handler = vi.fn();
    const { result } = renderHook(useKeyboardShortcuts, {
      wrapper: KeyboardShortcutsProvider,
    });
    act(() => result.current.registerShortcut("Enter", handler));
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(handler).toHaveBeenCalledOnce();
    act(() => result.current.unregisterShortcut("Enter"));
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("normalizes sequential shortcuts during registration and cleanup", () => {
    const handler = vi.fn();
    const { result } = renderHook(useKeyboardShortcuts, {
      wrapper: KeyboardShortcutsProvider,
    });
    act(() => result.current.registerSequentialShortcut("G", "Enter", handler));
    fireEvent.keyDown(document.body, { key: "g" });
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(handler).toHaveBeenCalledOnce();
    act(() => result.current.unregisterSequentialShortcut("G", "Enter"));
    fireEvent.keyDown(document.body, { key: "g" });
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not take Enter away from text inputs", () => {
    const handler = vi.fn();
    const { result } = renderHook(useKeyboardShortcuts, {
      wrapper: KeyboardShortcutsProvider,
    });
    act(() => result.current.registerShortcut("Enter", handler));
    const input = document.createElement("input");
    document.body.append(input);
    try {
      fireEvent.keyDown(input, { key: "Enter" });
    } finally {
      input.remove();
    }
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("modifier shortcuts", () => {
  it("matches shortcuts that need several modifiers", () => {
    const handler = vi.fn();
    const { result } = renderHook(useKeyboardShortcuts, {
      wrapper: KeyboardShortcutsProvider,
    });
    act(() =>
      result.current.registerModifierShortcut("Ctrl+Shift", "c", handler),
    );
    fireEvent.keyDown(document.body, { key: "c", ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, {
      key: "C",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("ignores single-modifier shortcuts while extra modifiers are held", () => {
    const handler = vi.fn();
    const { result } = renderHook(useKeyboardShortcuts, {
      wrapper: KeyboardShortcutsProvider,
    });
    act(() => result.current.registerModifierShortcut("Ctrl", "k", handler));
    fireEvent.keyDown(document.body, {
      key: "K",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(handler).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });
});
