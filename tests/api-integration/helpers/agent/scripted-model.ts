import { MockLanguageModelV4 } from "ai/test";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

function stream(parts: unknown[], finish: "stop" | "tool-calls") {
  return {
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });
        for (const part of parts) controller.enqueue(part);
        controller.enqueue({
          type: "finish",
          finishReason: { unified: finish, raw: finish },
          usage,
        });
        controller.close();
      },
    }),
  };
}

// One model step per tool call, in order, then a final text answer.
export function scriptedModel(
  calls: Array<{ toolName: string; input: unknown }>,
  answer = "Done.",
) {
  return new MockLanguageModelV4({
    doStream: [
      ...calls.map((call, index) =>
        stream(
          [
            {
              type: "tool-call",
              toolCallId: `call-${index}`,
              toolName: call.toolName,
              input: JSON.stringify(call.input),
            },
          ],
          "tool-calls",
        ),
      ),
      stream(
        [
          { type: "text-start", id: "answer" },
          { type: "text-delta", id: "answer", delta: answer },
          { type: "text-end", id: "answer" },
        ],
        "stop",
      ),
    ],
  });
}
