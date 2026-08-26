import { describe, expect, it } from "vitest";
import {
  GITHUB_EXEMPT_TASK_TYPES,
  isGithubExemptTaskType,
} from "../../apps/api/src/project/task-types";

describe("isGithubExemptTaskType", () => {
  it("marks canonical contract and reuniao as exempt", () => {
    expect(isGithubExemptTaskType("contract")).toBe(true);
    expect(isGithubExemptTaskType("reuniao")).toBe(true);
  });

  it("accepts aliases contrato and meeting", () => {
    expect(isGithubExemptTaskType("contrato")).toBe(true);
    expect(isGithubExemptTaskType("meeting")).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(isGithubExemptTaskType(" Contract ")).toBe(true);
    expect(isGithubExemptTaskType("REUNIAO")).toBe(true);
  });

  it("does not exempt development task types", () => {
    expect(isGithubExemptTaskType("feat")).toBe(false);
    expect(isGithubExemptTaskType("fix")).toBe(false);
    expect(isGithubExemptTaskType(null)).toBe(false);
    expect(isGithubExemptTaskType(undefined)).toBe(false);
    expect(isGithubExemptTaskType("")).toBe(false);
  });

  it("exports the expected exempt slug list", () => {
    expect([...GITHUB_EXEMPT_TASK_TYPES]).toEqual([
      "contract",
      "contrato",
      "reuniao",
      "meeting",
    ]);
  });
});
