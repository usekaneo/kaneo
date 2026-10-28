import type { AdminSettings } from "@/fetchers/admin/settings-types";

type LockableSetting = AdminSettings["lockedByEnv"][number];

/** The environment variable that forces each lockable setting. */
export const ENV_LOCK_VARIABLES: Record<LockableSetting, string> = {
  registrationEnabled: "DISABLE_REGISTRATION",
  passwordRegistrationEnabled: "DISABLE_PASSWORD_REGISTRATION",
  workspaceCreationRestricted: "DISABLE_WORKSPACE_CREATION",
};
