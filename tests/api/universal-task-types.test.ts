import { describe, expect, it } from "vitest";
import {
  getTaskTypesForProjectType,
  isUniversalTaskType,
  isValidTaskTypeForProject,
  UNIVERSAL_TASK_TYPES,
} from "../../apps/api/src/project/task-types";

describe("universal task types", () => {
  it("exports contract and reuniao as universal", () => {
    expect([...UNIVERSAL_TASK_TYPES]).toEqual(["contract", "reuniao"]);
  });

  it("includes contract and reuniao for every project type", () => {
    for (const projectType of [
      "development",
      "maintenance",
      "support",
      "hr",
      "marketing",
      "operations",
    ] as const) {
      const types = getTaskTypesForProjectType(projectType);
      expect(types).toContain("contract");
      expect(types).toContain("reuniao");
    }
  });

  it("accepts universal types regardless of project type", () => {
    expect(isValidTaskTypeForProject("contract", "support")).toBe(true);
    expect(isValidTaskTypeForProject("reuniao", "marketing")).toBe(true);
    expect(isValidTaskTypeForProject("contrato", "operations")).toBe(true);
    expect(isValidTaskTypeForProject("meeting", "maintenance")).toBe(true);
  });

  it("still rejects domain types outside their project type", () => {
    expect(isValidTaskTypeForProject("feat", "support")).toBe(false);
    expect(isValidTaskTypeForProject("chamado", "development")).toBe(false);
  });

  it("detects universal aliases", () => {
    expect(isUniversalTaskType("contract")).toBe(true);
    expect(isUniversalTaskType("Contrato")).toBe(true);
    expect(isUniversalTaskType("meeting")).toBe(true);
    expect(isUniversalTaskType("feat")).toBe(false);
  });
});
