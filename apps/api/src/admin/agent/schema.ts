import { z } from "../../openapi";
import { parseModelReference } from "../../agent/providers/model-reference";

const modelId = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((id) => Boolean(parseModelReference(id)), "Invalid model ID");
export const agentModelPolicySchema = z
  .object({
    model: modelId,
    models: z.array(modelId).min(1).max(20),
  })
  .strict()
  .refine(
    (policy) => policy.models.includes(policy.model),
    "The default must be an allowed model",
  )
  .refine(
    (policy) => new Set(policy.models).size === policy.models.length,
    "Duplicate models",
  );

export const adminAgentSettingsSchema = z.object({
  enabled: z.boolean(),
  managed: z.boolean(),
  model: z.string().nullable(),
  models: z.array(z.object({ id: z.string(), label: z.string() })),
  providers: z.array(z.object({ id: z.string(), label: z.string() })),
});

export const catalogSchema = z.object({
  supported: z.boolean(),
  models: z.array(z.object({ id: z.string(), label: z.string() })),
});
