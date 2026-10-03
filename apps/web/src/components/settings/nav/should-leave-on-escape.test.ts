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

  it.each(["switch", "checkbox", "radio"])(
    "leaves Escape to a focused %s control",
    (role) => {
      const control = document.createElement("button");
      control.setAttribute("role", role);
      const child = document.createElement("span");
      control.append(child);
      document.body.append(control);
      expect(shouldLeaveOnEscape(escapeFrom(control), document)).toBe(false);
      expect(shouldLeaveOnEscape(escapeFrom(child), document)).toBe(false);
    },
  );

  it("leaves Escape to buttons within a settings form", () => {
    const form = document.createElement("form");
    const button = document.createElement("button");
    form.append(button);
    document.body.append(form);
    expect(shouldLeaveOnEscape(escapeFrom(button), document)).toBe(false);
    expect(shouldLeaveOnEscape(escapeFrom(document.body), document)).toBe(true);
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

  it.each(["toast-popup", "tooltip-popup"])("ignores a visible %s", (slot) => {
    const popup = document.createElement("div");
    popup.dataset.slot = slot;
    document.body.append(popup);

    expect(shouldLeaveOnEscape(escapeFrom(document.body), document)).toBe(true);
  });

  it.each([
    "dialog-popup",
    "alert-dialog-popup",
    "sheet-popup",
    "menu-popup",
    "select-popup",
    "combobox-popup",
    "autocomplete-popup",
    "popover-popup",
    "command-dialog-popup",
    "preview-card-content",
  ])("leaves Escape to an open %s", (slot) => {
    const popup = document.createElement("div");
    popup.dataset.slot = slot;
    document.body.append(popup);

    expect(shouldLeaveOnEscape(escapeFrom(document.body), document)).toBe(
      false,
    );
    popup.setAttribute("data-closed", "");
    expect(shouldLeaveOnEscape(escapeFrom(document.body), document)).toBe(true);
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
