import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { parseModelReference } from "../../agent/providers/model-reference";
import { applyMargin, microUsd } from "./money";

const catalogSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      context_length: z.number().int().positive(),
      pricing: z.object({
        prompt: z.string(),
        completion: z.string(),
        request: z.string().optional(),
        image: z.string().optional(),
        web_search: z.string().optional(),
        internal_reasoning: z.string().optional(),
      }),
    }),
  ),
});
let cached:
  | { expires: number; data: z.infer<typeof catalogSchema>["data"] }
  | undefined;

export async function quoteModel(
  id: string,
  maxOutputTokens: number,
  multiplierBps: number,
) {
  const ref = parseModelReference(id);
  if (ref?.provider !== "openrouter")
    throw new HTTPException(503, {
      message: "Cloud AI requires a metered OpenRouter model",
    });
  if (!cached || cached.expires < Date.now()) {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("AI pricing unavailable");
    cached = {
      expires: Date.now() + 60000,
      data: catalogSchema.parse(await response.json()).data,
    };
  }
  const model = cached.data.find((item) => item.id === ref.model);
  if (!model) throw new Error("AI model pricing unavailable");
  // Separate image/search/reasoning fees are not covered by token-only bounds.
  if (
    [
      model.pricing.image,
      model.pricing.web_search,
      model.pricing.internal_reasoning,
    ].some((price) => price && Number(price) !== 0)
  )
    throw new Error("AI model has unsupported metering");
  const promptRate = Number(model.pricing.prompt),
    completionRate = Number(model.pricing.completion);
  if (
    ![promptRate, completionRate].every(
      (rate) => Number.isFinite(rate) && rate >= 0,
    )
  )
    throw new Error("Invalid AI model pricing");
  // Reserve against the full context window, including tool definitions/results and
  // attachments. This deliberately overestimates rather than guessing tokenization.
  // Round total charges UP after multiplication, so microdollar arithmetic is conservative.
  const amount = applyMargin(
    microUsd(model.pricing.prompt, BigInt(model.context_length)) +
      microUsd(model.pricing.completion, BigInt(maxOutputTokens)) +
      microUsd(model.pricing.request ?? "0"),
    multiplierBps,
  );
  return {
    amount: amount > 0n ? amount : 1n,
    maxPrice: {
      prompt: promptRate * 1e6,
      completion: completionRate * 1e6,
      request: Number(model.pricing.request ?? "0"),
    },
  };
}
