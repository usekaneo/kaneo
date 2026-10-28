#!/usr/bin/env node
import { runJob } from "./run-job.js";

try {
  const env = process.env;
  await runJob(
    {
      apiUrl: env.KANEO_API_URL ?? "",
      audience: env.KANEO_CODE_OIDC_AUDIENCE,
      jobId: env.KANEO_JOB_ID ?? "",
      cwd: env.KANEO_JOB_REPOSITORY ?? process.cwd(),
      modelKey: env.OPENROUTER_API_KEY ?? "",
      oidcUrl: env.ACTIONS_ID_TOKEN_REQUEST_URL ?? "",
      oidcToken: env.ACTIONS_ID_TOKEN_REQUEST_TOKEN ?? "",
      repository: env.GITHUB_REPOSITORY ?? "",
    },
    {
      mask: (value) => {
        if (value)
          process.stdout.write(
            `::add-mask::${value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")}\n`,
          );
      },
    },
  );
} catch {
  // Child/HTTP errors may include secrets; never print their raw contents.
  console.error("Kaneo coding job failed");
  process.exitCode = 1;
}
