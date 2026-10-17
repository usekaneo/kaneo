import { describe, expect, it } from "vite-plus/test";
import { matchesCombo, parseBinding, parseCombo } from "./key-combo";

const event = (
  key: string,
  code: string,
  mods: Partial<
    Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>
  > = {},
) => ({
  key,
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("parseBinding", () => {
  it("reads chords and sequences", () => {
    expect(parseCombo("mod+shift+,")).toEqual({
      key: ",",
      mod: true,
      ctrl: false,
      alt: false,
      shift: true,
    });
    expect(parseBinding("g i").map((combo) => combo.key)).toEqual(["g", "i"]);
  });
});

describe("matchesCombo", () => {
  it("maps mod to Command on Mac and Control elsewhere", () => {
    const combo = parseCombo("mod+k");
    expect(
      matchesCombo(combo, event("k", "KeyK", { metaKey: true }), true),
    ).toBe(true);
    expect(
      matchesCombo(combo, event("k", "KeyK", { ctrlKey: true }), true),
    ).toBe(false);
    expect(
      matchesCombo(combo, event("k", "KeyK", { ctrlKey: true }), false),
    ).toBe(true);
  });

  it("requires exact modifiers", () => {
    expect(
      matchesCombo(
        parseCombo("c"),
        event("c", "KeyC", { shiftKey: true }),
        true,
      ),
    ).toBe(false);
    expect(
      matchesCombo(
        parseCombo("shift+d"),
        event("D", "KeyD", { shiftKey: true }),
        true,
      ),
    ).toBe(true);
    expect(matchesCombo(parseCombo("shift+d"), event("d", "KeyD"), true)).toBe(
      false,
    );
  });

  it("uses the physical key when Option changes the typed character", () => {
    expect(
      matchesCombo(
        parseCombo("alt+u"),
        event("¨", "KeyU", { altKey: true }),
        true,
      ),
    ).toBe(true);
    expect(
      matchesCombo(
        parseCombo("alt+shift+q"),
        event("Œ", "KeyQ", { altKey: true, shiftKey: true }),
        true,
      ),
    ).toBe(true);
  });

  it("matches shifted punctuation by its unshifted key", () => {
    expect(
      matchesCombo(
        parseCombo("mod+shift+,"),
        event("<", "Comma", { metaKey: true, shiftKey: true }),
        true,
      ),
    ).toBe(true);
    expect(
      matchesCombo(
        parseCombo("ctrl+shift+1"),
        event("!", "Digit1", { ctrlKey: true, shiftKey: true }),
        true,
      ),
    ).toBe(true);
  });

  it("lets symbol bindings ignore the Shift needed to type them", () => {
    expect(
      matchesCombo(
        parseCombo("?"),
        event("?", "Slash", { shiftKey: true }),
        true,
      ),
    ).toBe(true);
    expect(matchesCombo(parseCombo("/"), event("/", "Slash"), true)).toBe(true);
  });

  it("names special keys", () => {
    expect(matchesCombo(parseCombo("space"), event(" ", "Space"), true)).toBe(
      true,
    );
    expect(
      matchesCombo(
        parseCombo("mod+backspace"),
        event("Backspace", "Backspace", { metaKey: true }),
        true,
      ),
    ).toBe(true);
    expect(
      matchesCombo(
        parseCombo("alt+arrowup"),
        event("ArrowUp", "ArrowUp", { altKey: true }),
        true,
      ),
    ).toBe(true);
  });
});
