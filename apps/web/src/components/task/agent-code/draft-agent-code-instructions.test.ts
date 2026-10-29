import { expect, it } from "vite-plus/test";
import { draftAgentCodeInstructions } from "./draft-agent-code-instructions";

it("drafts instructions from the task title and description", () => {
  expect(
    draftAgentCodeInstructions({
      title: " Fix reconnect loop ",
      description: "Retry with **backoff**.\n",
    }),
  ).toBe("Fix reconnect loop\n\nRetry with **backoff**.");
  expect(draftAgentCodeInstructions({ title: "Fix", description: null })).toBe(
    "Fix",
  );
  expect(
    draftAgentCodeInstructions({ title: "x", description: "y".repeat(9000) })
      .length,
  ).toBe(8000);
});
