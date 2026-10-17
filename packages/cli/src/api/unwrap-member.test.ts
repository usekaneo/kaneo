import { describe, expect, it } from "vite-plus/test";
import { unwrapMember } from "./members.js";

describe("unwrapMember", () => {
  it("accepts the bare member Better Auth returns", () => {
    expect(unwrapMember({ id: "m1", role: "admin" })).toEqual({
      id: "m1",
      role: "admin",
    });
  });

  it("accepts the wrapped shape the OpenAPI document declares", () => {
    expect(unwrapMember({ member: { id: "m1", role: "admin" } })).toEqual({
      id: "m1",
      role: "admin",
    });
  });
});
