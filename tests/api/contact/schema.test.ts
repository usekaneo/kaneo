import { describe, expect, it } from "vite-plus/test";
import {
  createContactBody,
  listContactsQuery,
  updateContactBody,
} from "../../../apps/api/src/contact/schema";

describe("contact body validation", () => {
  it("leaves type and region unset by default and trims text", () => {
    expect(
      createContactBody.parse({ name: "  Ali Stores ", phone: " 7771234 " }),
    ).toEqual({ name: "Ali Stores", phone: "7771234" });
  });

  it("takes type and region as free text, blank meaning not set", () => {
    expect(
      createContactBody.parse({ name: "A", type: " Retailer ", region: " " }),
    ).toEqual({ name: "A", type: "Retailer", region: null });
    expect(updateContactBody.parse({ type: null })).toEqual({ type: null });
  });

  it("turns blank optional text into null so it clears the value", () => {
    expect(updateContactBody.parse({ email: "  " })).toEqual({ email: null });
  });

  it("treats an empty filter as no filter", () => {
    expect(listContactsQuery.parse({ region: "", type: " " })).toEqual({
      region: undefined,
      type: undefined,
    });
    expect(listContactsQuery.parse({ region: "Malé" }).region).toBe("Malé");
  });

  it("requires a name and at least one field on update", () => {
    expect(createContactBody.safeParse({ name: "  " }).success).toBe(false);
    expect(updateContactBody.safeParse({}).success).toBe(false);
  });
});
