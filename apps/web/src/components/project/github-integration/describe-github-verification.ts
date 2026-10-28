import type { VerifyGithubInstallationResponse } from "@/fetchers/github-integration/verify-github-installation";

export type GithubVerificationOutcome =
  | { kind: "ready" }
  | { kind: "missingPermissions"; permissions: string[]; settingsUrl?: string }
  | { kind: "notInstalled"; installationUrl?: string }
  | { kind: "message"; message: string };

export function describeGithubVerification(
  result: VerifyGithubInstallationResponse,
): GithubVerificationOutcome {
  if (result.isInstalled && result.hasRequiredPermissions) {
    return { kind: "ready" };
  }
  if (result.isInstalled && result.repositoryExists !== false) {
    return {
      kind: "missingPermissions",
      permissions: result.missingPermissions,
      settingsUrl: result.settingsUrl,
    };
  }
  if (!result.isInstalled) {
    return { kind: "notInstalled", installationUrl: result.installationUrl };
  }
  return { kind: "message", message: result.message };
}

export function githubVerificationTone(outcome: GithubVerificationOutcome) {
  if (outcome.kind === "ready") return "success" as const;
  if (outcome.kind === "missingPermissions") return "warning" as const;
  return "destructive" as const;
}

export function isGithubVerificationReady(
  result: VerifyGithubInstallationResponse | undefined,
) {
  return Boolean(result?.isInstalled && result.hasRequiredPermissions);
}
