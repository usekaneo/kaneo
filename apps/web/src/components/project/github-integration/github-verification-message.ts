import type { GithubVerificationOutcome } from "@/components/project/github-integration/describe-github-verification";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function githubVerificationMessage(
  outcome: GithubVerificationOutcome,
  fallback: string,
  t: Translate,
) {
  if (outcome.kind === "ready")
    return t("settings:githubIntegration.verifyReady");
  if (outcome.kind === "notInstalled")
    return t("settings:githubIntegration.verifyNotInstalled");
  if (outcome.kind === "missingPermissions" && outcome.permissions.length)
    return t("settings:githubIntegration.verifyMissingPermissions", {
      list: outcome.permissions.join(", "),
    });
  return outcome.kind === "message" ? outcome.message : fallback;
}
