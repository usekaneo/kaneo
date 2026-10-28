import type { WorkspaceUsage } from "@/constants/onboarding";

export type OnboardingStepId =
  | "workspace"
  | "usage"
  | "project"
  | "invite"
  | "plan"
  | "ready";

type StepOptions = {
  usage: WorkspaceUsage;
  canInvite: boolean;
  offersPlan: boolean;
};

export function getOnboardingSteps({
  usage,
  canInvite,
  offersPlan,
}: StepOptions): OnboardingStepId[] {
  const steps: OnboardingStepId[] = ["workspace", "usage", "project"];
  if (usage === "team" && canInvite) steps.push("invite");
  steps.push(offersPlan ? "plan" : "ready");
  return steps;
}

export function getStepProgress(
  steps: OnboardingStepId[],
  current: OnboardingStepId,
) {
  const counted: OnboardingStepId[] = steps.filter((step) => step !== "ready");
  return {
    current: counted.indexOf(current) + 1,
    total: counted.length,
  };
}

export function getNextStep(
  steps: OnboardingStepId[],
  current: OnboardingStepId,
): OnboardingStepId {
  return steps[steps.indexOf(current) + 1] ?? "ready";
}

export function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  return Array.from(parts[0] ?? "")[0]?.toUpperCase() ?? "";
}
