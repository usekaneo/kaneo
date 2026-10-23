import { describe, expect, it } from "vite-plus/test";
import { groupPinnedLabels } from "./group-pinned-labels";

const pin = (id: string, name: string, workspaceId = "w1") => ({
  id,
  name,
  color: "red",
  workspaceId,
});

describe("groupPinnedLabels", () => {
  it("merges same-named pins from different workspaces, keeping pin order", () => {
    const groups = groupPinnedLabels([
      pin("a", "animacja"),
      pin("b", "pc-oldschool"),
      pin("c", "Animacja", "w2"),
    ]);
    expect(groups.map((group) => group.name)).toEqual([
      "animacja",
      "pc-oldschool",
    ]);
    expect(groups[0]?.pins.map((item) => item.id)).toEqual(["a", "c"]);
  });
});
