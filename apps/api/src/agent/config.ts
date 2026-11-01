import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { config } from "dotenv-mono";
import { parseAgentModels } from "./model-list";
import { parseModelReference } from "./providers/model-reference";
import { getProviderSettings } from "./providers/settings";
import type { AgentModelPolicy, ProviderSettings } from "./providers/types";

// Vite's .env.local must not hide server-only keys in the root .env.
config({ priorities: { ".env": 100 } });

const settingsSchema = z.object({
  model: z.string().trim().min(1).max(200).default("openai/gpt-6-luna"),
  maxSteps: z.coerce.number().int().min(1).max(12).default(8),
  maxOutputTokens: z.coerce.number().int().min(256).max(4096).default(2048),
  timeoutMs: z.coerce.number().int().min(10000).max(300000).default(120000),
  concurrency: z.coerce.number().int().min(1).max(4).default(1),
});

export function getAgentConfig(policy?: AgentModelPolicy | null) {
  if (process.env.KANEO_AGENT_ENABLED !== "true") return null;
  const result = settingsSchema.safeParse({
    model:
      policy?.model ??
      process.env.KANEO_AGENT_MODEL ??
      process.env.OPENROUTER_MODEL,
    maxSteps: process.env.KANEO_AGENT_MAX_STEPS,
    maxOutputTokens: process.env.KANEO_AGENT_MAX_OUTPUT_TOKENS,
    timeoutMs: process.env.KANEO_AGENT_TIMEOUT_MS,
    concurrency: process.env.KANEO_AGENT_CONCURRENCY,
  });
  if (!result.success) return null;
  const models = parseAgentModels(
    result.data.model,
    policy
      ? policy.models.join(",")
      : (process.env.KANEO_AGENT_MODELS ?? process.env.OPENROUTER_MODELS),
  );
  if (!models) return null;
  const providers: Record<string, ProviderSettings> = {};
  try {
    for (const model of models) {
      const reference = parseModelReference(model);
      if (!reference) return null;
      if (Object.hasOwn(providers, reference.provider)) continue;
      const settings = getProviderSettings(reference.provider);
      if (!settings) return null;
      providers[reference.provider] = settings;
    }
  } catch {
    // File-secret and module errors can include private paths.
    return null;
  }
  return {
    ...result.data,
    models,
    providers,
    zeroDataRetention: process.env.OPENROUTER_ZDR === "true",
  };
}

export function requireAgentConfig() {
  const config = getAgentConfig();
  if (!config)
    throw new HTTPException(503, {
      message: "Agent is not configured on this instance",
    });
  return config;
}
