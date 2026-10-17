import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import type { MemberJson } from "./member-json.js";
import { renderMemberList } from "./render-member-list.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const now = new Date(2026, 9, 8, 12);

const ada: MemberJson = {
  id: "u_ada",
  memberId: "m_ada",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "owner",
  joinedAt: new Date(2026, 2, 3, 12).toISOString(),
};

const grace: MemberJson = {
  id: "u_grace",
  memberId: "m_grace",
  name: "Grace Hopper",
  email: "grace@example.com",
  role: "member",
  joinedAt: new Date(2026, 9, 8, 9).toISOString(),
};

describe("renderMemberList", () => {
  it("shows name, email, role and join date in 80 columns", () => {
    const lines = renderMemberList(ui, { members: [ada, grace], now });
    expect(lines).toEqual([
      "",
      "  Ada Lovelace  ada@example.com    Owner   Mar 3",
      "  Grace Hopper  grace@example.com  Member  Today",
      "",
    ]);
  });

  it("drops the join date and shortens long values to fit", () => {
    const long: MemberJson = {
      ...grace,
      name: "Grace Brewster Murray Hopper of the United States Navy",
      email: "grace.brewster.murray.hopper@navy.example.com",
      role: "admin,contractor",
    };
    const lines = renderMemberList(ui, { members: [ada, long], now });
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
    expect(lines[2]).toContain("Admin, Contractor");
    expect(lines[2]).toContain("…");
  });

  it("says so when there are no members", () => {
    expect(renderMemberList(ui, { members: [], now })).toEqual([
      "",
      "  This workspace has no members.",
      "",
    ]);
  });
});
