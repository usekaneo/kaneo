import type { getAdminSettings } from "./get-admin-settings";

export type AdminSettings = Awaited<ReturnType<typeof getAdminSettings>>;

export type AdminSettingsChange = Partial<{
  instanceName: string | null;
  registrationEnabled: boolean;
  passwordRegistrationEnabled: boolean;
  requireEmailVerification: boolean;
  defaultRole: string;
  workspaceCreationRestricted: boolean;
  disabledIntegrations: string[];
}>;
