import { describe, expect, it } from "vite-plus/test";
import {
  createContactBody,
  listContactsQuery,
  updateContactBody,
} from "../../../apps/api/src/contact/schema";

describe("contact body validation", () => {
  it("defaults type and region and trims text", () => {
    expect(
      createContactBody.parse({ name: "  Ali Stores ", phone: " 7771234 " }),
    ).toEqual({
      name: "Ali Stores",
      phone: "7771234",
      type: "other",
      region: "other",
    });
  });

  it("turns blank optional text into null so it clears the value", () => {
    expect(updateContactBody.parse({ email: "  " })).toEqual({ email: null });
  });

  it("rejects values outside the fixed type and region lists", () => {
    expect(
      createContactBody.safeParse({ name: "A", type: "wholesaler" }).success,
    ).toBe(false);
    expect(
      createContactBody.safeParse({ name: "A", region: "mars" }).success,
    ).toBe(false);
    expect(listContactsQuery.safeParse({ region: "mars" }).success).toBe(false);
  });

  it("requires a name and at least one field on update", () => {
    expect(createContactBody.safeParse({ name: "  " }).success).toBe(false);
    expect(updateContactBody.safeParse({}).success).toBe(false);
  });
});
