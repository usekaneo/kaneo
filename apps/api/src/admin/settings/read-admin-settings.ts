import { isSmtpConfigured } from "@kaneo/email";
import { asc } from "drizzle-orm";
import db from "../../database";
import { instanceRoleTable } from "../../database/schema";
import { readStoredSettings } from "../../instance-settings/read-stored-settings";
import { resolveInstanceSettings } from "../../instance-settings/resolve-instance-settings";
import { integrationPlugins } from "../../plugins";

function instanceUrl() {
  return process.env.KANEO_CLIENT_URL?.trim() || null;
}

/** The settings page: saved values with environment overrides applied. */
export async function readAdminSettings() {
  const [stored, roles] = await Promise.all([
    readStoredSettings(),
    db
      .select({ name: instanceRoleTable.name })
      .from(instanceRoleTable)
      .orderBy(asc(instanceRoleTable.name)),
  ]);
  const effective = resolveInstanceSettings(stored, process.env);
  return {
    instanceName: stored.instanceName,
    instanceUrl: instanceUrl(),
    registrationEnabled: effective.registrationEnabled,
    passwordRegistrationEnabled: effective.passwordRegistrationEnabled,
    requireEmailVerification: effective.requireEmailVerification,
    defaultRole: effective.defaultRole,
    workspaceCreationRestricted: effective.workspaceCreationRestricted,
    disabledIntegrations: effective.disabledIntegrations,
    lockedByEnv: effective.lockedByEnv,
    emailDeliveryConfigured: isSmtpConfigured(),
    roles: roles.map((role) => role.name),
    integrationProviders: integrationPlugins.map(({ type, name }) => ({
      type,
      name,
    })),
  };
}
