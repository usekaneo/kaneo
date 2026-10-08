import { describe, expect, it } from "vite-plus/test";
import { canReadWorkspace } from "./can-read-workspace";

const noRead = JSON.stringify({ task: ["read"] });
const read = JSON.stringify({ workspace: ["read"] });

describe("canReadWorkspace", () => {
  it("allows built-in roles", () => {
    for (const role of ["viewer", "member", "admin", "owner"]) {
      expect(canReadWorkspace({ role, instanceAdmin: false }, [])).toBe(true);
    }
  });

  it("denies a role whose permission lacks workspace:read", () => {
    expect(
      canReadWorkspace({ role: "custom", instanceAdmin: false }, [
        { role: "custom", permission: noRead },
      ]),
    ).toBe(false);
  });

  it("allows a member when any of their roles grants workspace:read", () => {
    expect(
      canReadWorkspace({ role: "limited,reader", instanceAdmin: false }, [
        { role: "limited", permission: noRead },
        { role: "reader", permission: read },
      ]),
    ).toBe(true);
    expect(
      canReadWorkspace({ role: "limited,viewer", instanceAdmin: false }, [
        { role: "limited", permission: noRead },
      ]),
    ).toBe(true);
  });

  it("denies a member when none of their roles grants workspace:read", () => {
    expect(
      canReadWorkspace({ role: "limited,other", instanceAdmin: false }, [
        { role: "limited", permission: noRead },
        { role: "other", permission: noRead },
      ]),
    ).toBe(false);
  });

  it("denies a non-member who is not an instance admin", () => {
    expect(canReadWorkspace({ role: null, instanceAdmin: false }, [])).toBe(
      false,
    );
  });

  it("lets instance admins read regardless of their role", () => {
    expect(
      canReadWorkspace({ role: "custom", instanceAdmin: true }, [
        { role: "custom", permission: noRead },
      ]),
    ).toBe(true);
    expect(canReadWorkspace({ role: null, instanceAdmin: true }, [])).toBe(
      true,
    );
  });
});
