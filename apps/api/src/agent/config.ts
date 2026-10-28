import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { config } from "dotenv-mono";
import { resolveFileSecret } from "../utils/file-secret";
import { parseAgentModels } from "./model-list";

// Vite's .env.local must not hide server-only keys in the root .env.
config({ priorities: { ".env": 100 } });

const settingsSchema = z.object({
  model: z.string().trim().min(1).max(200).default("openai/gpt-6-luna"),
  maxSteps: z.coerce.number().int().min(1).max(12).default(8),
  maxOutputTokens: z.coerce.number().int().min(256).max(4096).default(2048),
  timeoutMs: z.coerce.number().int().min(10000).max(300000).default(120000),
  concurrency: z.coerce.number().int().min(1).max(4).default(1),
});

export function getAgentConfig() {
  if (process.env.KANEO_AGENT_ENABLED !== "true") return null;
  let apiKey: string | undefined;
  try {
    apiKey = resolveFileSecret("OPENROUTER_API_KEY");
  } catch {
    // File-secret errors include paths; do not expose them through HTTP errors.
    return null;
  }
  if (!apiKey) return null;
  const result = settingsSchema.safeParse({
    model: process.env.OPENROUTER_MODEL,
    maxSteps: process.env.KANEO_AGENT_MAX_STEPS,
    maxOutputTokens: process.env.KANEO_AGENT_MAX_OUTPUT_TOKENS,
    timeoutMs: process.env.KANEO_AGENT_TIMEOUT_MS,
    concurrency: process.env.KANEO_AGENT_CONCURRENCY,
  });
  if (!result.success) return null;
  const models = parseAgentModels(
    result.data.model,
    process.env.OPENROUTER_MODELS,
  );
  if (!models) return null;
  return {
    ...result.data,
    models,
    apiKey,
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
