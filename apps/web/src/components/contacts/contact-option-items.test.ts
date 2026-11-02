import { describe, expect, it } from "vite-plus/test";
import { contactOptionItems } from "./contact-option-items";

describe("contactOptionItems", () => {
  it("puts the none choice first and maps keys to values", () => {
    expect(
      contactOptionItems(
        [
          { key: "male", label: "Malé" },
          { key: "x1", label: "Maafushi" },
        ],
        "All locations",
      ),
    ).toEqual([
      { value: "", label: "All locations" },
      { value: "male", label: "Malé" },
      { value: "x1", label: "Maafushi" },
    ]);
  });
});
