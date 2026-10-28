import { describe, expect, it } from "vite-plus/test";
import { SHORTCUTS, type ShortcutDefinition } from "@/lib/shortcuts/catalog";
import { PLUGIN_VIEW_PREFIX, takenViewKeys } from "./plugin-view-keys";

const shortcut = (...keys: string[]): ShortcutDefinition => ({
  keys,
  category: "views",
});

describe("takenViewKeys", () => {
  it("reserves letters that core shortcuts already use after the prefix", () => {
    expect(
      takenViewKeys([
        shortcut("v b", "v l"),
        shortcut("g b"),
        shortcut("shift+v"),
        shortcut("mod+v c"),
      ]),
    ).toEqual(["b", "l"]);
  });

  it("keeps the bare prefix free in the shortcut catalog", () => {
    const bare = Object.values(SHORTCUTS)
      .flatMap(({ keys }) => keys)
      .filter((key) => key === PLUGIN_VIEW_PREFIX);
    expect(bare).toEqual([]);
  });
});
