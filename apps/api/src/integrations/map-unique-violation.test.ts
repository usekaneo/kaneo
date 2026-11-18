import { describe, expect, it } from "vite-plus/test";
import { isDatabaseUniqueViolation } from "./map-unique-violation";

describe("isDatabaseUniqueViolation", () => {
  it("recognises a driver unique violation with its constraint", () => {
    const error = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint: "sprint_project_name_unique",
    });

    expect(isDatabaseUniqueViolation(error)).toBe(true);
    if (isDatabaseUniqueViolation(error)) {
      expect(error.constraint).toBe("sprint_project_name_unique");
    }
  });

  it("rejects other database errors", () => {
    expect(isDatabaseUniqueViolation(new Error("connection reset"))).toBe(
      false,
    );
  });

  it("rejects non-error values", () => {
    expect(isDatabaseUniqueViolation("23505")).toBe(false);
    expect(isDatabaseUniqueViolation(null)).toBe(false);
  });
});
