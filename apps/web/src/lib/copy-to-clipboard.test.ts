import { afterEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "./copy-to-clipboard";

const originalClipboard = navigator.clipboard;
const originalExecCommand = document.execCommand;

afterEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: originalClipboard,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(document, "execCommand", {
    value: originalExecCommand,
    configurable: true,
    writable: true,
  });
  vi.restoreAllMocks();
});

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value,
    configurable: true,
    writable: true,
  });
}

describe("copyToClipboard", () => {
  it("uses the async clipboard API when it is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await expect(copyToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when the clipboard API is missing", async () => {
    // Plain-HTTP self-hosted instances land here: not a secure context.
    setClipboard(undefined);
    const textareaState: {
      value?: string;
      selectionStart?: number;
      selectionEnd?: number;
    } = {};
    const execCommand = vi.fn(function (this: Document, _cmd: string) {
      // Capture textarea state at the moment execCommand is called (before removal)
      const textarea = document.querySelector("textarea");
      if (textarea) {
        textareaState.value = textarea.value;
        textareaState.selectionStart = textarea.selectionStart;
        textareaState.selectionEnd = textarea.selectionEnd;
      }
      return true;
    });
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
      writable: true,
    });

    await expect(copyToClipboard("hello")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    // Verify the textarea had the correct text and was selected at copy time
    expect(textareaState.value).toBe("hello");
    expect(textareaState.selectionStart).toBe(0);
    expect(textareaState.selectionEnd).toBe("hello".length);
  });

  it("falls back to execCommand when the clipboard API rejects", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    const textareaState: {
      value?: string;
      selectionStart?: number;
      selectionEnd?: number;
    } = {};
    const execCommand = vi.fn(function (this: Document, _cmd: string) {
      // Capture textarea state at the moment execCommand is called
      const textarea = document.querySelector("textarea");
      if (textarea) {
        textareaState.value = textarea.value;
        textareaState.selectionStart = textarea.selectionStart;
        textareaState.selectionEnd = textarea.selectionEnd;
      }
      return true;
    });
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
      writable: true,
    });

    await expect(copyToClipboard("hello")).resolves.toBe(true);
    // Verify the textarea had the correct text and was selected at copy time
    expect(textareaState.value).toBe("hello");
    expect(textareaState.selectionStart).toBe(0);
    expect(textareaState.selectionEnd).toBe("hello".length);
  });

  it("reports failure when neither path works", async () => {
    setClipboard(undefined);
    Object.defineProperty(document, "execCommand", {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
      writable: true,
    });

    await expect(copyToClipboard("hello")).resolves.toBe(false);
  });

  it("leaves no scratch node behind", async () => {
    setClipboard(undefined);
    Object.defineProperty(document, "execCommand", {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
      writable: true,
    });

    await copyToClipboard("hello");
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
  });

  it("cleans up the scratch node when execCommand throws", async () => {
    setClipboard(undefined);
    Object.defineProperty(document, "execCommand", {
      value: vi.fn(() => {
        throw new Error("copy operation failed");
      }),
      configurable: true,
      writable: true,
    });

    await expect(copyToClipboard("hello")).resolves.toBe(false);
    // Verify the scratch node was removed despite the exception
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
  });
});
