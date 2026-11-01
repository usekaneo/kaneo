import { isCloud } from "../../utils/is-cloud";
import { createPrivateKey } from "node:crypto";
import { z } from "zod";
import { resolveGithubPrivateKey } from "../../plugins/github/utils/github-app-client";
import { getAgentConfig } from "../config";

const settingsSchema = z.object({
  model: z.string().trim().min(1).max(200).default("openai/gpt-6-luna"),
  appId: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]*$/),
  appSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{0,99}$/i)
    .optional(),
  jobTimeoutMinutes: z.coerce.number().int().min(5).max(120).default(30),
  oidcAudience: z.string().trim().min(1).max(500),
});

export type CodeJobsConfig = z.infer<typeof settingsSchema> & {
  privateKey: string;
};

/**
 * The optional Kaneo Agent GitHub App. It holds the write permissions coding
 * jobs need, so the regular integration App never has to be granted them.
 * Invalid or missing values hide coding jobs without affecting the assistant.
 */
export function getCodeJobsConfig(): CodeJobsConfig | null {
  if (isCloud()) return null;
  let privateKey: string;
  try {
    privateKey = resolveGithubPrivateKey("KANEO_AGENT_GITHUB_APP_PRIVATE_KEY");
    if (!privateKey || createPrivateKey(privateKey).asymmetricKeyType !== "rsa")
      return null;
  } catch {
    // File-secret errors include paths; never surface them.
    return null;
  }
  if (!privateKey) return null;
  const result = settingsSchema.safeParse({
    model: process.env.KANEO_CODE_MODEL || process.env.OPENROUTER_MODEL,
    appId: process.env.KANEO_AGENT_GITHUB_APP_ID,
    appSlug: process.env.KANEO_AGENT_GITHUB_APP_SLUG || undefined,
    jobTimeoutMinutes: process.env.KANEO_CODE_JOB_TIMEOUT_MINUTES || undefined,
    oidcAudience:
      process.env.KANEO_CODE_OIDC_AUDIENCE || process.env.KANEO_API_URL,
  });
  if (!result.success) return null;
  return { ...result.data, privateKey };
}

/** Starting jobs also needs the assistant, whose UI shows runs and their jobs. */
export function codeJobsEnabled() {
  return Boolean(getAgentConfig() && getCodeJobsConfig());
}
