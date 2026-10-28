import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { parseImportDocument } from "./parse-import-file.js";

describe("parseImportDocument", () => {
  it("reads the document written by kaneo task export", () => {
    const content = JSON.stringify({
      project: { name: "Kaneo Web", slug: "kan" },
      tasks: [
        {
          title: "Fix login",
          description: "",
          status: "in-progress",
          priority: "urgent",
          dueDate: "2026-10-05T19:19:55.960Z",
          startDate: null,
          userId: null,
          labels: [{ name: "Bug", color: "red" }],
        },
      ],
    });
    expect(
      Result.getOrThrow(parseImportDocument(content, "tasks.json")),
    ).toEqual([
      {
        title: "Fix login",
        description: "",
        status: "in-progress",
        priority: "urgent",
        dueDate: "2026-10-05T19:19:55.960Z",
        startDate: null,
        userId: null,
        labels: 1,
      },
    ]);
  });

  it("accepts a bare list with only titles", () => {
    expect(
      Result.getOrThrow(parseImportDocument('[{"title":" Write docs "}]', "-")),
    ).toEqual([
      {
        title: "Write docs",
        description: undefined,
        status: undefined,
        priority: undefined,
        startDate: undefined,
        dueDate: undefined,
        userId: undefined,
        labels: 0,
      },
    ]);
  });

  it("explains what is wrong with the file", () => {
    const message = (content: string) => {
      const result = parseImportDocument(content, "tasks.json");
      return Result.isFailure(result) ? result.failure.message : null;
    };
    expect(message("{")).toBe("tasks.json is not valid JSON.");
    expect(message('{"items": []}')).toBe("tasks.json has no list of tasks.");
    expect(message("[]")).toBe("tasks.json has no tasks to import.");
    expect(message('[{"title":"a"}, 3]')).toBe("Task 2 is not an object.");
    expect(message('[{"status":"done"}]')).toBe("Task 1 has no title.");
    expect(message('[{"title":"a","status":3}]')).toBe(
      "Task 1 (a) has a status that is not text.",
    );
    expect(message('[{"title":"a","dueDate":"soon"}]')).toBe(
      'Task 1 (a) has an invalid dueDate "soon".',
    );
  });
});
