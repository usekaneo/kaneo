import { describe, expect, it } from "vite-plus/test";
import { isJsonFile, parseTasksImport } from "./tasks-import-file";

describe("parseTasksImport", () => {
  it("returns the tasks array from an export file", () => {
    expect(
      parseTasksImport(JSON.stringify({ tasks: [{ title: "Ship" }] })),
    ).toEqual([{ title: "Ship" }]);
  });

  it("returns null when the file has no tasks array", () => {
    expect(parseTasksImport(JSON.stringify({ tasks: "nope" }))).toBeNull();
    expect(parseTasksImport(JSON.stringify([]))).toBeNull();
    expect(parseTasksImport("null")).toBeNull();
  });

  it("throws on content that is not JSON", () => {
    expect(() => parseTasksImport("not json")).toThrow();
  });
});

describe("isJsonFile", () => {
  it("accepts JSON by type or extension", () => {
    expect(isJsonFile({ name: "a.txt", type: "application/json" })).toBe(true);
    expect(isJsonFile({ name: "tasks.json", type: "" })).toBe(true);
    expect(isJsonFile({ name: "tasks.csv", type: "text/csv" })).toBe(false);
  });
});
