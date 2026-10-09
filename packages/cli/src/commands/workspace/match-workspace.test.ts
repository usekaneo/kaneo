import { describe, expect, it } from "vite-plus/test";
import type { Workspace } from "../../api/schemas.js";
import { matchWorkspace } from "./match-workspace.js";

function workspace(id: string, name: string, slug: string): Workspace {
  return {
    id,
    name,
    slug,
    logo: null,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    role: "owner",
  };
}

const acme = workspace("ws_acme", "Acme Studio", "acme-studio");
const side = workspace("ws_side", "Side Project", "side-project");
const twin = workspace("ws_twin", "Acme Studio", "acme-two");
const all = [acme, side];

describe("matchWorkspace", () => {
  it("matches the exact id", () => {
    expect(matchWorkspace(all, "ws_side")).toEqual({
      kind: "found",
      workspace: side,
    });
  });

  it("matches the slug without caring about case", () => {
    expect(matchWorkspace(all, "ACME-studio")).toEqual({
      kind: "found",
      workspace: acme,
    });
  });

  it("matches the name without caring about case or outer spaces", () => {
    expect(matchWorkspace(all, "  side project ")).toEqual({
      kind: "found",
      workspace: side,
    });
  });

  it("prefers a slug match over a name match", () => {
    const named = workspace("ws_named", "acme-two", "named");
    expect(matchWorkspace([named, twin], "acme-two")).toEqual({
      kind: "found",
      workspace: twin,
    });
  });

  it("reports names shared by more than one workspace", () => {
    expect(matchWorkspace([acme, twin], "acme studio")).toEqual({
      kind: "ambiguous",
      candidates: [acme, twin],
    });
  });

  it("reports when nothing matches", () => {
    expect(matchWorkspace(all, "nope")).toEqual({ kind: "none" });
  });
});
