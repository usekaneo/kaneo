import { describe, expect, it } from "vite-plus/test";
import {
  agentPromptToPlainText,
  getAgentMentionRefs,
  serializeAgentMention,
  splitAgentPrompt,
} from "./agent-mention-token";

describe("agent mention tokens", () => {
  it("serializes a mention readably and parses it back", () => {
    const token = serializeAgentMention({
      type: "project",
      id: "p1",
      label: "Launch v3",
    });
    expect(token).toBe("@[Launch v3](project:p1)");
    expect(splitAgentPrompt(`Plan ${token} now`)).toEqual([
      { kind: "text", start: 0, text: "Plan " },
      {
        kind: "mention",
        start: 5,
        mention: { type: "project", id: "p1", label: "Launch v3" },
      },
      { kind: "text", start: 29, text: " now" },
    ]);
  });

  it("keeps labels on one line without brackets", () => {
    const token = serializeAgentMention({
      type: "task",
      id: "t1",
      label: " Fix [proxy]\nbug ",
    });
    expect(token).toBe("@[Fix proxy bug](task:t1)");
    expect(getAgentMentionRefs(token)).toEqual([{ type: "task", id: "t1" }]);
    expect(serializeAgentMention({ type: "task", id: "t1", label: "[]" })).toBe(
      "@[…](task:t1)",
    );
  });

  it("lists distinct references in order and ignores plain @ text", () => {
    expect(
      getAgentMentionRefs(
        "@jordan, tin@northwind.dev: @[A](task:t1) @[B](project:p1) @[A again](task:t1) @[x](user:u1)",
      ),
    ).toEqual([
      { type: "task", id: "t1" },
      { type: "project", id: "p1" },
    ]);
  });

  it("renders mentions as plain @labels for titles and previews", () => {
    expect(
      agentPromptToPlainText(
        "Plan @[Launch v3](project:p1) with @[Fix](task:t1)",
      ),
    ).toBe("Plan @Launch v3 with @Fix");
  });
});
