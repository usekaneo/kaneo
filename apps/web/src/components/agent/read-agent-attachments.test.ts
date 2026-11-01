import { describe, expect, it } from "vite-plus/test";
import type { AgentAttachmentDraft } from "./agent-attachment-draft";
import { readAgentAttachments } from "./read-agent-attachments";

const file = (content: string, name = "notes.md", type = "text/markdown") =>
  new File([content], name, { type });
const text = (name: string, content: string): AgentAttachmentDraft => ({
  kind: "text",
  key: name,
  name,
  content,
});
let next = 0;
const key = () => `k${++next}`;

describe("readAgentAttachments", () => {
  it("reads text files and appends them to the current list", async () => {
    next = 0;
    const result = await readAgentAttachments(
      [file("Ship the guide")],
      [text("a.txt", "x")],
      key,
    );
    expect(result).toEqual({
      attachments: [
        text("a.txt", "x"),
        {
          kind: "text",
          key: "k1",
          name: "notes.md",
          content: "Ship the guide",
        },
      ],
      uploads: [],
    });
  });

  it("replaces a text file attached again under the same name", async () => {
    const result = await readAgentAttachments(
      [file("New notes")],
      [text("notes.md", "Old notes")],
      key,
    );
    expect(result.attachments).toMatchObject([
      { name: "notes.md", content: "New notes" },
    ]);
  });

  it("queues images and PDFs for upload, keeping same-named pastes", async () => {
    const shot = file("png", "image.png", "image/png");
    const again = file("png", "image.png", "image/png");
    const pdf = file("%PDF-", "spec.pdf", "application/pdf");
    const result = await readAgentAttachments([shot, again, pdf], [], key);
    expect(result.error).toBeUndefined();
    expect(result.uploads.map((item) => item.file)).toEqual([shot, again, pdf]);
    expect(result.attachments).toEqual(result.uploads);
    expect(result.uploads[0]).toMatchObject({
      kind: "file",
      name: "image.png",
      mediaType: "image/png",
      id: null,
    });
  });

  it("rejects oversized, empty, and unsupported files but keeps earlier ones", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });
    expect((await readAgentAttachments([big], [])).error).toBe("fileTooLarge");
    expect(
      (await readAgentAttachments([file("", "a.pdf", "application/pdf")], []))
        .error,
    ).toBe("empty");
    expect(
      (await readAgentAttachments([file("x", "a.zip", "application/zip")], []))
        .error,
    ).toBe("unsupported");
    expect(
      (await readAgentAttachments([file("x", "a.svg", "image/svg+xml")], []))
        .error,
    ).toBe("unsupported");
    expect((await readAgentAttachments([file("a\u0000b")], [])).error).toBe(
      "unsupported",
    );
    expect((await readAgentAttachments([file("  \n")], [])).error).toBe(
      "empty",
    );
    expect(
      (await readAgentAttachments([file("x".repeat(50_001))], [])).error,
    ).toBe("tooLarge");

    const ok = file("png", "ok.png", "image/png");
    const partial = await readAgentAttachments([ok, big], [], key);
    expect(partial.error).toBe("fileTooLarge");
    expect(partial.uploads.map((item) => item.file)).toEqual([ok]);
  });

  it("caps text files and uploads together", async () => {
    const five = Array.from({ length: 5 }, (_, index) =>
      text(`${index}.md`, "x"),
    );
    expect(
      await readAgentAttachments([file("png", "a.png", "image/png")], five),
    ).toEqual({ attachments: five, uploads: [], error: "tooMany" });
    expect(await readAgentAttachments([file("y")], five)).toEqual({
      attachments: five,
      uploads: [],
      error: "tooMany",
    });
  });
});
