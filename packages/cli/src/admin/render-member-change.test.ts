import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import {
  renderMemberRemoved,
  renderMemberRole,
} from "./render-member-change.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("renderMemberRemoved", () => {
  it("names the member and their email", () => {
    expect(
      renderMemberRemoved(ui, {
        name: "Grace Hopper",
        email: "grace@example.com",
      }),
    ).toEqual(["", "  ✓ Removed Grace Hopper · grace@example.com", ""]);
  });
});

describe("renderMemberRole", () => {
  it("shows the new and the previous role", () => {
    expect(
      renderMemberRole(ui, {
        name: "Grace Hopper",
        role: "admin",
        previousRole: "member",
      }),
    ).toEqual(["", "  ✓ Grace Hopper is now Admin · was Member", ""]);
  });

  it("says when nothing changed", () => {
    expect(
      renderMemberRole(ui, {
        name: "Grace Hopper",
        role: "member",
        previousRole: "member",
      }),
    ).toEqual(["", "  ✓ Grace Hopper is already Member", ""]);
  });
});
