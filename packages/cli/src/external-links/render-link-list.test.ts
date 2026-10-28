import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { toLinkJson } from "./link-json.js";
import { renderLinkChange } from "./render-link-change.js";
import { renderLinkList } from "./render-link-list.js";
import { externalLink } from "./test-links.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const view = {
  taskLabel: "KAN-3",
  taskTitle: "Fix login redirect",
  taskUrl: "https://kaneo.test/t",
};

describe("renderLinkList", () => {
  it("lists links with short ids at 80 columns", () => {
    const lines = renderLinkList(ui, {
      ...view,
      links: [
        toLinkJson(
          externalLink({
            id: "tsl4l6e5rvapbu3zo2ff2lt6",
            url: "https://example.com/spec",
            title: "Design spec",
          }),
        ),
        toLinkJson(
          externalLink({
            id: "eh2p47610rlk2ri520mxu5b9",
            url: "https://github.com/usekaneo/kaneo/pull/1958",
            integrationId: "i1",
            resourceType: "pull_request",
            title:
              "fix(calendar): allow feeds without label filters, a long pull request title",
            integration: { id: "i1", type: "github" },
          }),
        ),
      ],
    });
    expect(lines.slice(0, 4)).toEqual([
      "",
      "  KAN-3 · Fix login redirect",
      "",
      "    tsl4l6e5  Design spec            example.com/spec                     manual",
    ]);
    expect(lines[4]?.endsWith("github")).toBe(true);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
  });

  it("explains how to add the first link", () => {
    expect(renderLinkList(ui, { ...view, links: [] })).toEqual([
      "",
      "  KAN-3 · Fix login redirect",
      "",
      "  No links yet. Add one with kaneo task link add KAN-3 <url>.",
      "",
    ]);
  });
});

describe("renderLinkChange", () => {
  it("prints the linked and unlinked task on one line", () => {
    expect(
      renderLinkChange(ui, {
        verb: "Linked",
        taskLabel: "KAN-3",
        taskUrl: "https://kaneo.test/t",
        linkTitle: "Design spec (https://example.com/spec)",
      }),
    ).toEqual([
      "",
      "  ✓ Linked KAN-3 · Design spec (https://example.com/spec)",
      "",
    ]);
    const [, line] = renderLinkChange(ui, {
      verb: "Unlinked",
      taskLabel: "KAN-3",
      taskUrl: "https://kaneo.test/t",
      linkTitle: `https://example.com/${"x".repeat(100)}`,
    });
    expect(stringWidth(line ?? "")).toBeLessThanOrEqual(80);
  });
});
