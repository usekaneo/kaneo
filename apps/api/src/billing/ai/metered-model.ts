import { APICallError, wrapLanguageModel, type LanguageModel } from "ai";
import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import type { ProviderSettings } from "../../agent/providers/types";
import { aiBillingEnabled, marginBps } from "./config";
import { quoteModel } from "./model-quote";
import { pricedMicroUsd } from "./money";
import { reserveCredit, settleCredit } from "./wallet";

export async function meteredModel(
  model: LanguageModel,
  input: {
    workspaceId: string;
    runId: string;
    model: string;
    maxOutputTokens: number;
    settings?: ProviderSettings;
  },
) {
  if (!aiBillingEnabled()) return model;
  if (typeof model === "string")
    throw new Error("Cloud AI requires an explicit model");
  if (
    input.settings?.baseURL &&
    input.settings.baseURL.replace(/\/$/, "") !== "https://openrouter.ai/api/v1"
  )
    throw new Error("Cloud AI requires the managed OpenRouter endpoint");
  const multiplierBps = marginBps();
  const quote = await quoteModel(
    input.model,
    input.maxOutputTokens,
    multiplierBps,
  );
  return wrapLanguageModel({
    model,
    middleware: {
      specificationVersion: "v4",
      transformParams: async ({ params }) => ({
        ...params,
        maxOutputTokens: input.maxOutputTokens,
        providerOptions: {
          ...params.providerOptions,
          openrouter: {
            ...params.providerOptions?.openrouter,
            // Never silently add separately billed OCR to a token-only quote.
            plugins: [{ id: "file-parser", pdf: { engine: "native" } }],
            provider: {
              require_parameters: true,
              data_collection: "deny",
              zdr: true,
              max_price: quote.maxPrice,
            },
          },
        },
      }),
      wrapGenerate: async () => {
        throw new Error("Cloud AI only supports metered streams");
      },
      wrapStream: async ({ doStream, params }) => {
        params.abortSignal?.throwIfAborted();
        const reservation = await reserveCredit({
          ...input,
          amount: quote.amount,
          multiplierBps,
        });
        if (params.abortSignal?.aborted) {
          await settleCredit(reservation.id, 0n);
          params.abortSignal.throwIfAborted();
        }
        // An opaque audit key lets operators match requests whose stream never
        // supplied a generation ID, without exposing workspace/user details.
        params.providerOptions = {
          ...params.providerOptions,
          openrouter: {
            ...params.providerOptions?.openrouter,
            user: reservation.id,
          },
        };
        // Once a request is sent, a network error does not prove it was free.
        // Retain the reservation if no terminal accounting arrives.
        const result = await Promise.resolve()
          .then(doStream)
          .catch(async (error: unknown) => {
            // These HTTP rejections occur before inference; timeouts/5xx stay held.
            if (
              APICallError.isInstance(error) &&
              [400, 401, 403, 404, 422, 429].includes(error.statusCode ?? 0)
            )
              await settleCredit(reservation.id, 0n);
            throw error;
          });
        return {
          ...result,
          stream: result.stream.pipeThrough(
            new TransformStream({
              async transform(chunk, controller) {
                if (chunk.type === "response-metadata" && chunk.id) {
                  await db
                    .update(schema.aiReservationTable)
                    .set({ generationId: chunk.id })
                    .where(eq(schema.aiReservationTable.id, reservation.id));
                }
                if (chunk.type === "finish") {
                  const accounting = chunk.providerMetadata?.openrouter?.usage;
                  const cost =
                    accounting &&
                    typeof accounting === "object" &&
                    "cost" in accounting
                      ? accounting.cost
                      : undefined;
                  if (
                    typeof cost !== "number" ||
                    !Number.isFinite(cost) ||
                    cost < 0
                  )
                    throw new Error("AI cost is pending reconciliation");
                  await settleCredit(
                    reservation.id,
                    pricedMicroUsd(cost, multiplierBps),
                  );
                }
                controller.enqueue(chunk);
              },
            }),
          ),
        };
      },
    },
  });
}
