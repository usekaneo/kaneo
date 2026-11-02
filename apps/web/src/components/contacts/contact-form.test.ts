import { describe, expect, it } from "vite-plus/test";
import { formFromContact, isFormValid, toFields } from "./contact-form";

describe("contact form", () => {
  it("starts blank with no type or location", () => {
    expect(formFromContact(null)).toEqual({
      name: "",
      phone: "",
      email: "",
      type: "",
      region: "",
      notes: "",
    });
  });

  it("trims text and sends blank optional fields as null", () => {
    const form = { ...formFromContact(null), name: " Ali ", phone: "  " };
    expect(toFields(form)).toMatchObject({
      name: "Ali",
      phone: null,
      email: null,
      notes: null,
    });
  });

  it("sends a chosen option key and null when none is chosen", () => {
    const base = { ...formFromContact(null), name: "Ali" };
    expect(toFields(base)).toMatchObject({ type: null, region: null });
    expect(toFields({ ...base, type: "partner", region: "x1" })).toMatchObject({
      type: "partner",
      region: "x1",
    });
  });

  it("needs a name", () => {
    expect(isFormValid(formFromContact(null))).toBe(false);
    expect(isFormValid({ ...formFromContact(null), name: "A" })).toBe(true);
  });
});
