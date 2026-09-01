import { describe, expect, it } from "vitest";
import {
  assertValidTaskType,
  VALID_TASK_TYPES,
} from "../../../apps/api/src/task/validate-task-fields";

describe("assertValidTaskType", () => {
  it("accepts every valid task type", () => {
    for (const type of VALID_TASK_TYPES) {
      expect(() => assertValidTaskType(type)).not.toThrow();
    }
  });

  it("rejects an unknown task type", () => {
    expect(() => assertValidTaskType("story")).toThrowError(
      /Invalid type "story"/,
    );
  });
});
