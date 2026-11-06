import { describe, expect, it } from "vite-plus/test";

import { type MarkdownNode, stripTaskMarker, taskItemState } from "./task-item";

const item = (text: string, nested?: MarkdownNode): MarkdownNode => ({
  type: "list_item",
  children: [
    {
      type: "paragraph",
      children: [
        { type: "textgroup", children: [{ type: "text", content: text }] },
      ],
    },
    ...(nested ? [nested] : []),
  ],
});

describe("taskItemState", () => {
  it("reads checked and unchecked markers", () => {
    expect(taskItemState(item("☑ Ship it"))).toBe("checked");
    expect(taskItemState(item("☐ Ship it"))).toBe("unchecked");
  });

  it("treats plain bullets as regular list items", () => {
    expect(taskItemState(item("Ship it"))).toBeNull();
  });

  it("ignores markers that only appear in a nested list", () => {
    const nested = { type: "bullet_list", children: [item("☐ Child")] };
    expect(taskItemState({ type: "list_item", children: [nested] })).toBeNull();
  });
});

describe("stripTaskMarker", () => {
  it("removes the marker and its space", () => {
    expect(stripTaskMarker("☑ Ship it")).toBe("Ship it");
    expect(stripTaskMarker("☐")).toBe("");
    expect(stripTaskMarker("Ship ☐ it")).toBe("Ship ☐ it");
  });
});
