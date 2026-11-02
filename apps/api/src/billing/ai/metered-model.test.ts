import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { meteredModel } from "./metered-model";

const state = vi.hoisted(() => {
  const where = vi.fn(async () => undefined);
  return {
    where,
    set: vi.fn(() => ({ where })),
    reserve: vi.fn(async () => ({ id: "reservation" })),
    settle: vi.fn(async () => undefined),
  };
});

vi.mock("../../database", () => ({
  default: { update: () => ({ set: state.set }) },
  schema: { aiReservationTable: { id: "id" } },
}));
vi.mock("./wallet", () => ({
  reserveCredit: state.reserve,
  settleCredit: state.settle,
}));
vi.mock("./model-quote", () => ({
  quoteModel: async () => ({
    amount: 1000n,
    maxPrice: { prompt: 1, completion: 1, request: 0 },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("KANEO_CLOUD", "true");
  vi.stubEnv("KANEO_AI_PRICE_MULTIPLIER_BPS", "15000");
});
afterEach(() => vi.unstubAllEnvs());

async function wrappedModel(fetch: typeof globalThis.fetch) {
  const model = await meteredModel(
    createOpenRouter({ apiKey: "test-only-key", fetch })("test/model"),
    {
      workspaceId: "workspace",
      runId: "run",
      model: "openrouter:test/model",
      maxOutputTokens: 256,
    },
  );
  if (typeof model === "string") throw new Error("Missing wrapped model");
  return model;
}

function streamedAnswer(id: string, chunks: number) {
  const events = Array.from({ length: chunks }, () => ({
    id,
    object: "chat.completion.chunk",
    created: 1,
    model: "test/model",
    choices: [{ index: 0, delta: { content: "x" }, finish_reason: null }],
  }));
  const finish = {
    id,
    object: "chat.completion.chunk",
    created: 1,
    model: "test/model",
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    usage: {
      prompt_tokens: 1,
      completion_tokens: chunks,
      total_tokens: chunks + 1,
      cost: 0.01,
    },
  };
  const data = [...events, finish]
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("");
  return new Response(`${data}data: [DONE]\n\n`, {
    headers: { "content-type": "text/event-stream" },
  });
}

describe("metered model provider responses", () => {
  it.each([400, 401, 402, 403, 404, 422, 429])(
    "releases the reservation when OpenRouter rejects inference with HTTP %s",
    async (status) => {
      const model = await wrappedModel(async () =>
        Response.json(
          { error: { code: status, message: "Rejected" } },
          { status },
        ),
      );
      await expect(model.doStream({ prompt: [] })).rejects.toMatchObject({
        statusCode: status,
      });
      expect(state.reserve).toHaveBeenCalledOnce();
      expect(state.settle).toHaveBeenCalledExactlyOnceWith("reservation", 0n);
      expect(state.set).not.toHaveBeenCalled();
    },
  );

  it("retains the reservation after a server error with unknown inference cost", async () => {
    const model = await wrappedModel(async () =>
      Response.json(
        { error: { code: 500, message: "Unavailable" } },
        { status: 500 },
      ),
    );
    await expect(model.doStream({ prompt: [] })).rejects.toMatchObject({
      statusCode: 500,
    });
    expect(state.reserve).toHaveBeenCalledOnce();
    expect(state.settle).not.toHaveBeenCalled();
  });

  it("retains the reservation after a network failure with unknown inference cost", async () => {
    const model = await wrappedModel(async () => {
      throw new TypeError("Network unavailable");
    });
    await expect(model.doStream({ prompt: [] })).rejects.toThrow();
    expect(state.reserve).toHaveBeenCalledOnce();
    expect(state.settle).not.toHaveBeenCalled();
  });

  it("persists the repeated generation ID once while retaining every text chunk and settlement", async () => {
    const model = await wrappedModel(async () =>
      streamedAnswer("gen-same", 1000),
    );
    const result = await model.doStream({ prompt: [] });
    let text = "";
    for await (const chunk of result.stream)
      if (chunk.type === "text-delta") text += chunk.delta;

    expect(text).toHaveLength(1000);
    expect(state.set).toHaveBeenCalledExactlyOnceWith({
      generationId: "gen-same",
    });
    expect(state.where).toHaveBeenCalledOnce();
    expect(state.settle).toHaveBeenCalledExactlyOnceWith("reservation", 15000n);
  });

  it("persists metadata for every request even when the provider reuses its ID", async () => {
    const model = await wrappedModel(async () => streamedAnswer("gen-same", 2));
    for (let request = 0; request < 2; request++) {
      const result = await model.doStream({ prompt: [] });
      for await (const _chunk of result.stream) {
        /* Consume metadata and terminal accounting. */
      }
    }
    expect(state.set).toHaveBeenCalledTimes(2);
    expect(state.settle).toHaveBeenCalledTimes(2);
  });
});
