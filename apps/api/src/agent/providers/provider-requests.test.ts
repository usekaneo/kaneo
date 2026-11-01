import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { resolveAgentModel } from "./resolve-model";

afterEach(() => vi.unstubAllGlobals());

it("runs an Anthropic tool round trip with its own credentials and records token usage", async () => {
  const execute = vi.fn(async () => ({ title: "Local task" }));
  const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const hasToolResult = body.messages.some((message: { content: unknown }) =>
      JSON.stringify(message.content).includes('"tool_result"'),
    );
    return Response.json({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-test",
      content: hasToolResult
        ? [{ type: "text", text: "The task is Local task." }]
        : [
            {
              type: "tool_use",
              id: "tool_test",
              name: "readTask",
              input: { id: "local-task" },
            },
          ],
      stop_reason: hasToolResult ? "end_turn" : "tool_use",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 5 },
    });
  });
  vi.stubGlobal("fetch", fetch);
  const id = "anthropic:claude-test";
  const model = await resolveAgentModel(id, {
    models: [id],
    providers: { anthropic: { apiKey: "anthropic-only-key" } },
  });
  const result = await generateText({
    model,
    prompt: "Read the local task",
    stopWhen: stepCountIs(2),
    maxOutputTokens: 256,
    tools: {
      readTask: tool({ inputSchema: z.object({ id: z.string() }), execute }),
    },
  });
  expect(result.text).toBe("The task is Local task.");
  expect(execute).toHaveBeenCalledWith({ id: "local-task" }, expect.anything());
  expect(result.totalUsage.inputTokens).toBe(20);
  expect(result.totalUsage.outputTokens).toBe(10);
  expect(fetch).toHaveBeenCalledTimes(2);
  for (const [url, init] of fetch.mock.calls) {
    expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
    expect(new Headers(init?.headers).get("x-api-key")).toBe(
      "anthropic-only-key",
    );
    expect(String(init?.body)).not.toContain("data_collection");
    expect(String(init?.body)).not.toContain("openrouter");
  }
});

it("uses the configured local OpenAI-compatible endpoint without requiring a key", async () => {
  const fetch = vi.fn(async () =>
    Response.json({
      id: "local-completion",
      object: "chat.completion",
      created: 1,
      model: "local-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Local response" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const id = "compatible:local-model";
  const model = await resolveAgentModel(id, {
    models: [id],
    providers: { compatible: { baseURL: "http://127.0.0.1:11434/v1" } },
  });
  const result = await generateText({ model, prompt: "Hello" });
  expect(result.text).toBe("Local response");
  expect(fetch).toHaveBeenCalledWith(
    "http://127.0.0.1:11434/v1/chat/completions",
    expect.anything(),
  );
});

it("sends direct OpenAI requests to the Responses API with the selected model", async () => {
  const fetch = vi.fn(async (_input: unknown, _init?: RequestInit) =>
    Response.json({
      id: "resp_test",
      object: "response",
      created_at: 1,
      status: "completed",
      model: "gpt-6-luna",
      output: [
        {
          type: "message",
          id: "msg_test",
          role: "assistant",
          status: "completed",
          content: [
            { type: "output_text", text: "Direct response", annotations: [] },
          ],
        },
      ],
      usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const id = "openai:gpt-6-luna";
  const model = await resolveAgentModel(id, {
    models: [id],
    providers: { openai: { apiKey: "openai-only-key" } },
  });
  const result = await generateText({ model, prompt: "Hello" });
  expect(result.text).toBe("Direct response");
  const [url, init] = fetch.mock.calls[0]!;
  expect(String(url)).toBe("https://api.openai.com/v1/responses");
  expect(new Headers(init?.headers).get("authorization")).toBe(
    "Bearer openai-only-key",
  );
  expect(JSON.parse(String(init?.body)).model).toBe("gpt-6-luna");
});

it("preserves legacy OpenRouter requests and usage accounting through the registry", async () => {
  const fetch = vi.fn(async (_input: unknown, _init?: RequestInit) =>
    Response.json({
      id: "openrouter-completion",
      object: "chat.completion",
      created: 1,
      model: "openai/gpt-6-luna",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Router response" },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 3,
        completion_tokens: 2,
        total_tokens: 5,
        cost: 0.001,
      },
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const id = "openai/gpt-6-luna";
  const model = await resolveAgentModel(id, {
    models: [id],
    providers: { openrouter: { apiKey: "router-only-key" } },
  });
  const result = await generateText({ model, prompt: "Hello" });
  expect(result.text).toBe("Router response");
  const [url, init] = fetch.mock.calls[0]!;
  expect(String(url)).toBe("https://openrouter.ai/api/v1/chat/completions");
  expect(new Headers(init?.headers).get("authorization")).toBe(
    "Bearer router-only-key",
  );
  expect(JSON.parse(String(init?.body)).usage).toEqual({ include: true });
  expect(result.providerMetadata?.openrouter?.usage).toMatchObject({
    cost: 0.001,
  });
});
