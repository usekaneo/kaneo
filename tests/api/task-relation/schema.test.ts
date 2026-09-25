import { describe, expect, it } from "vitest";
import {
  createTaskRelationBody,
  dependencyTypeSchema,
  lagDaysSchema,
  updateTaskRelationBody,
} from "../../../apps/api/src/task-relation/schema";

describe("dependencyTypeSchema", () => {
  it("accepts each of the four standard dependency types", () => {
    for (const type of ["fs", "ss", "ff", "sf"]) {
      expect(dependencyTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it("rejects anything outside the enum", () => {
    expect(dependencyTypeSchema.safeParse("ss ").success).toBe(false);
    expect(dependencyTypeSchema.safeParse("FS").success).toBe(false);
    expect(dependencyTypeSchema.safeParse("finish-to-start").success).toBe(
      false,
    );
    expect(dependencyTypeSchema.safeParse(1).success).toBe(false);
    expect(dependencyTypeSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("lagDaysSchema", () => {
  it("accepts zero, a positive lag, and a negative lead", () => {
    expect(lagDaysSchema.safeParse(0).success).toBe(true);
    expect(lagDaysSchema.safeParse(5).success).toBe(true);
    expect(lagDaysSchema.safeParse(-3).success).toBe(true);
  });

  it("rejects a non-integer", () => {
    expect(lagDaysSchema.safeParse(1.5).success).toBe(false);
  });

  it("rejects a value outside the bounded range", () => {
    expect(lagDaysSchema.safeParse(3651).success).toBe(false);
    expect(lagDaysSchema.safeParse(-3651).success).toBe(false);
    expect(lagDaysSchema.safeParse(3650).success).toBe(true);
    expect(lagDaysSchema.safeParse(-3650).success).toBe(true);
  });
});

describe("createTaskRelationBody", () => {
  it("accepts a body with no dependencyType/lagDays (both optional)", () => {
    const result = createTaskRelationBody.safeParse({
      sourceTaskId: "a",
      targetTaskId: "b",
      relationType: "blocks",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a 'blocks' body with a dependency type and lag", () => {
    const result = createTaskRelationBody.safeParse({
      sourceTaskId: "a",
      targetTaskId: "b",
      relationType: "blocks",
      dependencyType: "ss",
      lagDays: -2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid dependencyType", () => {
    const result = createTaskRelationBody.safeParse({
      sourceTaskId: "a",
      targetTaskId: "b",
      relationType: "blocks",
      dependencyType: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTaskRelationBody", () => {
  it("accepts a partial update with only dependencyType", () => {
    expect(
      updateTaskRelationBody.safeParse({ dependencyType: "ff" }).success,
    ).toBe(true);
  });

  it("accepts a partial update with only lagDays", () => {
    expect(updateTaskRelationBody.safeParse({ lagDays: 4 }).success).toBe(true);
  });

  it("accepts an empty object (both fields optional at the schema level)", () => {
    expect(updateTaskRelationBody.safeParse({}).success).toBe(true);
  });

  it("rejects an invalid dependencyType", () => {
    expect(
      updateTaskRelationBody.safeParse({ dependencyType: "xx" }).success,
    ).toBe(false);
  });
});
