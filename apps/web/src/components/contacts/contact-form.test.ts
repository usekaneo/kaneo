import { describe, expect, it } from "vite-plus/test";
import { formFromContact, isFormValid, toFields } from "./contact-form";

describe("contact form", () => {
  it("starts blank with the neutral type and region", () => {
    expect(formFromContact(null)).toEqual({
      name: "",
      phone: "",
      email: "",
      type: "other",
      region: "other",
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

  it("needs a name", () => {
    expect(isFormValid(formFromContact(null))).toBe(false);
    expect(isFormValid({ ...formFromContact(null), name: "A" })).toBe(true);
  });
});
