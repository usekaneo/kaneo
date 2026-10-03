import { afterEach, describe, expect, it } from "vite-plus/test";
import { shouldLeaveOnEscape } from "@/components/settings/nav/should-leave-on-escape";

function escapeFrom(target: HTMLElement, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  Object.defineProperty(event, "target", { value: target });
  return event;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("shouldLeaveOnEscape", () => {
  it("leaves on a bare Escape on the page", () => {
    expect(shouldLeaveOnEscape(escapeFrom(document.body), document)).toBe(true);
  });

  it("ignores other keys and modified Escape", () => {
    const enter = new KeyboardEvent("keydown", { key: "Enter" });
    expect(shouldLeaveOnEscape(enter, document)).toBe(false);
    expect(
      shouldLeaveOnEscape(
        escapeFrom(document.body, { metaKey: true }),
        document,
      ),
    ).toBe(false);
  });

  it("leaves Escape to text fields", () => {
    const input = document.createElement("input");
    document.body.append(input);

    expect(shouldLeaveOnEscape(escapeFrom(input), document)).toBe(false);
  });

  it("leaves Escape to open dialogs and popups", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    expect(shouldLeaveOnEscape(escapeFrom(document.body), document)).toBe(
      false,
    );

    dialog.remove();
    const popup = document.createElement("div");
    popup.dataset.slot = "select-popup";
    document.body.append(popup);
    expect(shouldLeaveOnEscape(escapeFrom(document.body), document)).toBe(
      false,
    );
  });

  it("ignores popups that stay mounted after closing", () => {
    const positioner = document.createElement("div");
    positioner.hidden = true;
    const popup = document.createElement("div");
    popup.dataset.slot = "select-popup";
    popup.setAttribute("data-closed", "");
    positioner.append(popup);
    document.body.append(positioner);

    expect(shouldLeaveOnEscape(escapeFrom(document.body), document)).toBe(true);
  });

  it("respects handlers that already consumed Escape", () => {
    const event = escapeFrom(document.body);
    event.preventDefault();

    expect(shouldLeaveOnEscape(event, document)).toBe(false);
  });
});
