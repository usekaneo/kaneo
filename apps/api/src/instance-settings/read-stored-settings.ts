import { eq } from "drizzle-orm";
import db from "../database";
import { instanceRoleTable, instanceSettingsTable } from "../database/schema";
import type { DbOrTx } from "../project-access/db-or-tx";
import {
  DEFAULT_STORED_SETTINGS,
  type StoredInstanceSettings,
} from "./resolve-instance-settings";

export const INSTANCE_SETTINGS_ID = "instance";

export async function readStoredSettings(
  tx: DbOrTx = db,
): Promise<StoredInstanceSettings & { defaultRoleId: string | null }> {
  const [row] = await tx
    .select({
      instanceName: instanceSettingsTable.instanceName,
      registrationEnabled: instanceSettingsTable.registrationEnabled,
      passwordRegistrationEnabled:
        instanceSettingsTable.passwordRegistrationEnabled,
      requireEmailVerification: instanceSettingsTable.requireEmailVerification,
      defaultRoleId: instanceSettingsTable.defaultRoleId,
      defaultRole: instanceRoleTable.name,
      workspaceCreationRestricted:
        instanceSettingsTable.workspaceCreationRestricted,
      disabledIntegrations: instanceSettingsTable.disabledIntegrations,
    })
    .from(instanceSettingsTable)
    .leftJoin(
      instanceRoleTable,
      eq(instanceRoleTable.id, instanceSettingsTable.defaultRoleId),
    )
    .where(eq(instanceSettingsTable.id, INSTANCE_SETTINGS_ID))
    .limit(1);
  if (!row) return { ...DEFAULT_STORED_SETTINGS, defaultRoleId: null };
  return { ...row, defaultRole: row.defaultRole ?? "user" };
}
