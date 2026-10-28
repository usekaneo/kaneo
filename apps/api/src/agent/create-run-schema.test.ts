import { describe, expect, it } from "vite-plus/test";
import { createRunSchema } from "./schema";

const base = { requestId: "ac69d55b-fb53-48b5-94ce-bfd07b2c7c75" };
const prompt = "Plan @[Launch v3](project:p1) and @[WEB-1 Fix](task:t1)";

describe("createRunSchema mentions", () => {
  it("accepts mentions that match the prompt's tokens in any order", () => {
    const result = createRunSchema.safeParse({
      ...base,
      prompt,
      mentions: [
        { type: "task", id: "t1" },
        { type: "project", id: "p1" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("still accepts prompts without a mentions array", () => {
    expect(createRunSchema.safeParse({ ...base, prompt }).success).toBe(true);
  });

  it.each([
    [[{ type: "task", id: "t1" }]],
    [
      [
        { type: "task", id: "t1" },
        { type: "project", id: "p1" },
        { type: "task", id: "t2" },
      ],
    ],
    [
      [
        { type: "task", id: "t1" },
        { type: "task", id: "t1" },
        { type: "project", id: "p1" },
      ],
    ],
    [
      [
        { type: "user", id: "t1" },
        { type: "project", id: "p1" },
      ],
    ],
  ])("rejects mentions that differ from the prompt: %j", (mentions) => {
    expect(
      createRunSchema.safeParse({ ...base, prompt, mentions }).success,
    ).toBe(false);
  });

  it("limits a prompt to ten mentioned items", () => {
    const tokens = Array.from(
      { length: 11 },
      (_, index) => `@[Task ${index}](task:t${index})`,
    ).join(" ");
    expect(createRunSchema.safeParse({ ...base, prompt: tokens }).success).toBe(
      false,
    );
  });
});
