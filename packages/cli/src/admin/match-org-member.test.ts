import { describe, expect, it } from "vite-plus/test";
import type { OrganizationMember } from "../api/members.js";
import { sortMembers, toMemberJson } from "./member-json.js";
import { matchOrgMember } from "./match-org-member.js";

function member(
  id: string,
  userId: string,
  name: string,
  email: string,
  role: string,
): OrganizationMember {
  return {
    id,
    userId,
    role,
    createdAt: "2026-03-03T10:00:00.000Z",
    user: { name, email },
  };
}

const ada = toMemberJson(
  member("m_ada", "u_ada", "Ada Lovelace", "ada@example.com", "owner"),
);
const grace = toMemberJson(
  member("m_grace", "u_grace", "Grace Hopper", "grace@example.com", "member"),
);
const alan = toMemberJson(
  member("m_alan", "u_alan", "Alan Turing", "alan@example.com", "admin"),
);
const all = [ada, grace, alan];

describe("toMemberJson", () => {
  it("uses the user id as id and keeps the membership id", () => {
    expect(ada).toEqual({
      id: "u_ada",
      memberId: "m_ada",
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "owner",
      joinedAt: "2026-03-03T10:00:00.000Z",
    });
  });

  it("leaves joinedAt empty when the server sends no date", () => {
    expect(
      toMemberJson({
        ...member("m", "u", "N", "n@x.io", "member"),
        createdAt: null,
      }).joinedAt,
    ).toBeNull();
  });
});

describe("matchOrgMember", () => {
  it("matches email, name, user id and membership id", () => {
    expect(matchOrgMember(all, "GRACE@example.com")).toBe(grace);
    expect(matchOrgMember(all, "alan turing")).toBe(alan);
    expect(matchOrgMember(all, "u_ada")).toBe(ada);
    expect(matchOrgMember(all, "m_grace")).toBe(grace);
  });

  it("falls back to a unique email name or the start of a name", () => {
    expect(matchOrgMember(all, "grace")).toBe(grace);
    expect(matchOrgMember(all, "Alan T")).toBe(alan);
  });

  it("refuses a short form that fits more than one member", () => {
    const adam = toMemberJson(
      member("m_adam", "u_adam", "Adam Smith", "adam@example.com", "member"),
    );
    expect(matchOrgMember([...all, adam], "ad")).toBeUndefined();
    expect(matchOrgMember([...all, adam], "ada")).toBe(ada);
  });

  it("returns nothing for an unknown reference", () => {
    expect(matchOrgMember(all, "linus@example.com")).toBeUndefined();
    expect(matchOrgMember(all, "  ")).toBeUndefined();
  });
});

describe("sortMembers", () => {
  it("puts owners and admins first, then sorts by name", () => {
    expect(sortMembers([grace, alan, ada]).map((entry) => entry.id)).toEqual([
      "u_ada",
      "u_alan",
      "u_grace",
    ]);
  });
});
