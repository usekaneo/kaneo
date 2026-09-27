export type WorkspaceUsage = "solo" | "team";

export const DEFAULT_WORKSPACE_USAGE: WorkspaceUsage = "team";

export const WORKSPACE_USAGE_OPTIONS: {
  value: WorkspaceUsage;
  labelKey: string;
  hintKey: string;
}[] = [
  {
    value: "team",
    labelKey: "auth:onboarding.cloud.usageTeam",
    hintKey: "auth:onboarding.cloud.usageTeamDescription",
  },
  {
    value: "solo",
    labelKey: "auth:onboarding.cloud.usageSolo",
    hintKey: "auth:onboarding.cloud.usageSoloDescription",
  },
];

export const INITIAL_INVITE_FIELDS = 3;

export const MAX_INVITE_FIELDS = 5;
