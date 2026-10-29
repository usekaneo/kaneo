import { describe, expect, it } from "vite-plus/test";
import { buildUserUpdate, getEditUserValues } from "./edit-user-values";

const ada = {
  id: "ada",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "user,admin",
};

describe("getEditUserValues", () => {
  it("reads a multi-role account with admin as an admin", () => {
    expect(getEditUserValues(ada)).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "admin",
    });
  });

  it("reads a custom role, or user without one", () => {
    expect(getEditUserValues({ ...ada, role: "user,support" }).role).toBe(
      "support",
    );
    expect(getEditUserValues({ ...ada, role: "user" }).role).toBe("user");
  });
});

describe("buildUserUpdate", () => {
  it("trims the name and normalizes the email", () => {
    expect(
      buildUserUpdate(
        ada,
        { name: "  Ada  ", email: " ADA@Example.com ", role: "admin" },
        "someone-else",
      ),
    ).toEqual({ userId: "ada", name: "Ada", email: "ada@example.com" });
  });

  it("returns nothing when the name or email is blank", () => {
    expect(
      buildUserUpdate(
        ada,
        { name: " ", email: "ada@example.com", role: "admin" },
        "someone-else",
      ),
    ).toBeNull();
    expect(
      buildUserUpdate(
        ada,
        { name: "Ada", email: " ", role: "admin" },
        "someone-else",
      ),
    ).toBeNull();
  });

  it("assigns the chosen role on its own", () => {
    expect(
      buildUserUpdate(
        ada,
        { name: "Ada", email: "ada@example.com", role: "support" },
        "someone-else",
      ),
    ).toMatchObject({ role: "support" });
  });

  it("demotes an admin to user", () => {
    expect(
      buildUserUpdate(
        ada,
        { name: "Ada", email: "ada@example.com", role: "user" },
        "someone-else",
      ),
    ).toMatchObject({ role: "user" });
  });

  it("never changes your own role", () => {
    expect(
      buildUserUpdate(
        ada,
        { name: "Ada", email: "ada@example.com", role: "user" },
        "ada",
      ),
    ).not.toHaveProperty("role");
  });
});
