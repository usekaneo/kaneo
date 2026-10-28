import { describe, expect, it } from "vite-plus/test";
import { agentPromptToDoc } from "./agent-prompt-doc";

describe("agentPromptToDoc", () => {
  it("turns lines into paragraphs and tokens into mention nodes", () => {
    expect(agentPromptToDoc("Plan @[Launch v3](project:p1)\n\nThanks")).toEqual(
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Plan " },
              {
                type: "agentMention",
                attrs: { type: "project", id: "p1", label: "Launch v3" },
              },
            ],
          },
          { type: "paragraph" },
          { type: "paragraph", content: [{ type: "text", text: "Thanks" }] },
        ],
      },
    );
  });
});
