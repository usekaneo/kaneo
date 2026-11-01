import { describe, expect, it } from "vite-plus/test";
import { summarizeAttachments } from "./attachment-summary";

describe("summarizeAttachments", () => {
  it("returns metadata for legacy text and uploaded files without contents", () => {
    expect(
      summarizeAttachments([
        { name: "notes.md", content: "Ship it" },
        { id: "a1", name: "shot.png", mediaType: "image/png", size: 42 },
      ]),
    ).toEqual([
      { type: "text", name: "notes.md", size: 7 },
      {
        type: "file",
        id: "a1",
        name: "shot.png",
        mediaType: "image/png",
        size: 42,
      },
    ]);
  });
});
