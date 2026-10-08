import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../../render/ui.js";
import { stringWidth } from "../../render/width.js";
import { renderWorkspaceList } from "./render-workspace-list.js";
import { renderWorkspaceUsed } from "./render-workspace-used.js";
import type { WorkspaceJson } from "./workspace-json.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const acme: WorkspaceJson = {
  id: "tXNwjPJWwrkrDurpqDXi6O4q5FhiqVvC",
  name: "Acme Studio",
  slug: "acme-studio",
  role: "owner",
  description: null,
  active: true,
};

const side: WorkspaceJson = {
  id: "kqV6iY1NsUHx7GOWYfUo48SPnju4BGTU",
  name: "Side Project",
  slug: "side-project",
  role: "member",
  description: null,
  active: false,
};

describe("renderWorkspaceList", () => {
  it("marks the active workspace and fits 80 columns", () => {
    const lines = renderWorkspaceList(ui, [acme, side]);
    expect(lines).toEqual([
      "",
      "  ●  Acme Studio   acme-studio   Owner   tXNwjPJWwrkrDurpqDXi6O4q5FhiqVvC",
      "     Side Project  side-project  Member  kqV6iY1NsUHx7GOWYfUo48SPnju4BGTU",
      "",
    ]);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
  });

  it("drops the marker column and suggests a default when none is active", () => {
    const lines = renderWorkspaceList(ui, [{ ...acme, active: false }, side]);
    expect(lines[1]?.startsWith("  Acme Studio")).toBe(true);
    expect(lines).toContain(
      "  No workspace selected. Run kaneo workspace use to choose one.",
    );
  });

  it("leaves the role empty when the server does not report it", () => {
    const [, row] = renderWorkspaceList(ui, [{ ...acme, role: null }]);
    expect(row).toBe(
      "  ●  Acme Studio  acme-studio  tXNwjPJWwrkrDurpqDXi6O4q5FhiqVvC",
    );
  });

  it("says so when there are no workspaces", () => {
    expect(renderWorkspaceList(ui, [])).toEqual([
      "",
      "  You are not a member of any workspace yet.",
      "",
    ]);
  });
});

describe("renderWorkspaceUsed", () => {
  it("confirms the workspace with its id below", () => {
    expect(renderWorkspaceUsed(ui, { workspace: acme })).toEqual([
      "",
      "  ✓ Using Acme Studio",
      "    tXNwjPJWwrkrDurpqDXi6O4q5FhiqVvC",
      "",
    ]);
  });
});
