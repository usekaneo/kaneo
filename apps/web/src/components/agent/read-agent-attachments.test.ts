import { describe, expect, it } from "vite-plus/test";
import { readAgentAttachments } from "./read-agent-attachments";

const file = (content: string, name = "notes.md", type = "text/markdown") =>
  new File([content], name, { type });

describe("readAgentAttachments", () => {
  it("reads text files and appends them to the current list", async () => {
    const result = await readAgentAttachments(
      [file("Ship the guide")],
      [{ name: "a.txt", content: "x" }],
    );
    expect(result).toEqual({
      attachments: [
        { name: "a.txt", content: "x" },
        { name: "notes.md", content: "Ship the guide" },
      ],
    });
  });

  it("replaces a file attached again under the same name", async () => {
    const result = await readAgentAttachments(
      [file("New notes")],
      [{ name: "notes.md", content: "Old notes" }],
    );
    expect(result.attachments).toEqual([
      { name: "notes.md", content: "New notes" },
    ]);
  });

  it("rejects binary, empty, oversized, and extra files but keeps earlier ones", async () => {
    expect(
      (await readAgentAttachments([file("x", "a.png", "image/png")], [])).error,
    ).toBe("notText");
    expect((await readAgentAttachments([file("a\u0000b")], [])).error).toBe(
      "notText",
    );
    expect((await readAgentAttachments([file("  \n")], [])).error).toBe(
      "empty",
    );
    expect(
      (await readAgentAttachments([file("x".repeat(50_001))], [])).error,
    ).toBe("tooLarge");
    const three = Array.from({ length: 3 }, (_, index) => ({
      name: `${index}.md`,
      content: "x",
    }));
    expect(await readAgentAttachments([file("y")], three)).toEqual({
      attachments: three,
      error: "tooMany",
    });
  });
});
