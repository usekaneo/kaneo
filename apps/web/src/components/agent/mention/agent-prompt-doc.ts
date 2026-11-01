import type { JSONContent } from "@tiptap/core";
import { splitAgentPrompt } from "./agent-mention-token";

// Builds the composer document from a serialized prompt, so drafts set from
// outside (examples, clearing after send) round-trip with their chips.
export function agentPromptToDoc(text: string): JSONContent {
  return {
    type: "doc",
    content: text.split("\n").map((line) => {
      const content = splitAgentPrompt(line).map((segment) =>
        segment.kind === "text"
          ? { type: "text", text: segment.text }
          : { type: "agentMention", attrs: segment.mention },
      );
      return content.length
        ? { type: "paragraph", content }
        : { type: "paragraph" };
    }),
  };
}
