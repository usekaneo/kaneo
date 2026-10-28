import { isSmtpConfigured } from "@kaneo/email";
import { eq } from "drizzle-orm";
import db from "../../database";
import {
  instanceRoleTable,
  instanceSettingsTable,
} from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import { invalidateInstanceSettings } from "../../instance-settings/get-instance-settings";
import {
  INSTANCE_SETTINGS_ID,
  readStoredSettings,
} from "../../instance-settings/read-stored-settings";
import { resolveInstanceSettings } from "../../instance-settings/resolve-instance-settings";
import { integrationPlugins } from "../../plugins";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { assertAssignableRole } from "../roles/assert-assignable-role";
import { getUserAccess } from "../roles/get-instance-access";
import { readAdminSettings } from "../settings/read-admin-settings";
import type { UpdateInstanceSettingsInput } from "../settings/schema";

// Setting names go in values, not keys: the audit sanitizer drops keys that
// look like credentials, such as `passwordRegistrationEnabled`.
type Change = { setting: string; from: unknown; to: unknown };

function badRequest(code: string, message: string) {
  return new ApiError(400, { code, message });
}

function assertKnownIntegrations(types: string[]) {
  const known = new Set(integrationPlugins.map((plugin) => plugin.type));
  if (types.some((type) => !known.has(type))) {
    throw badRequest("UNKNOWN_INTEGRATION", "Unknown integration provider.");
  }
}

/** Save the changed settings and record which ones changed. */
async function updateAdminSettings(
  input: UpdateInstanceSettingsInput,
  audit: AdminAuditRequest,
) {
  const locked = resolveInstanceSettings(
    await readStoredSettings(),
    process.env,
  ).lockedByEnv;
  for (const key of locked) {
    if (input[key] !== undefined) {
      throw new ApiError(409, {
        code: "SETTING_LOCKED_BY_ENV",
        message: "An environment variable sets this option.",
      });
    }
  }
  if (input.requireEmailVerification === true && !isSmtpConfigured()) {
    throw badRequest(
      "EMAIL_DELIVERY_NOT_CONFIGURED",
      "Email verification needs SMTP to be configured.",
    );
  }
  if (input.defaultRole === "admin") {
    throw badRequest(
      "ADMIN_DEFAULT_ROLE",
      "New users can't become administrators by default.",
    );
  }
  const disabledIntegrations = input.disabledIntegrations
    ? [...new Set(input.disabledIntegrations)].sort()
    : undefined;
  if (disabledIntegrations) assertKnownIntegrations(disabledIntegrations);
  const instanceName =
    input.instanceName === undefined ? undefined : input.instanceName || null;

  const actor = await getUserAccess(audit.actorUserId ?? "");
  await db.transaction(async (tx) => {
    await tx
      .insert(instanceSettingsTable)
      .values({ id: INSTANCE_SETTINGS_ID })
      .onConflictDoNothing();
    await tx
      .select({ id: instanceSettingsTable.id })
      .from(instanceSettingsTable)
      .where(eq(instanceSettingsTable.id, INSTANCE_SETTINGS_ID))
      .for("update");
    const current = await readStoredSettings(tx);

    let defaultRoleId: string | null | undefined;
    if (input.defaultRole !== undefined) {
      // Share-locks the role so it can't be renamed or deleted first, and
      // stops anyone from handing new accounts permissions they lack.
      await assertAssignableRole(input.defaultRole, actor, tx);
      if (input.defaultRole === "user") {
        defaultRoleId = null;
      } else {
        const [role] = await tx
          .select({ id: instanceRoleTable.id })
          .from(instanceRoleTable)
          .where(eq(instanceRoleTable.name, input.defaultRole))
          .limit(1);
        defaultRoleId = role?.id ?? null;
      }
    }

    const next = {
      instanceName,
      registrationEnabled: input.registrationEnabled,
      passwordRegistrationEnabled: input.passwordRegistrationEnabled,
      requireEmailVerification: input.requireEmailVerification,
      defaultRole: input.defaultRole,
      workspaceCreationRestricted: input.workspaceCreationRestricted,
      disabledIntegrations,
    };
    const changes: Change[] = [];
    for (const [setting, to] of Object.entries(next)) {
      if (to === undefined) continue;
      const from = current[setting as keyof typeof current];
      if (JSON.stringify(from) !== JSON.stringify(to))
        changes.push({ setting, from, to });
    }
    if (changes.length === 0) return;

    await tx
      .update(instanceSettingsTable)
      .set({
        instanceName,
        registrationEnabled: input.registrationEnabled,
        passwordRegistrationEnabled: input.passwordRegistrationEnabled,
        requireEmailVerification: input.requireEmailVerification,
        defaultRoleId,
        workspaceCreationRestricted: input.workspaceCreationRestricted,
        disabledIntegrations,
      })
      .where(eq(instanceSettingsTable.id, INSTANCE_SETTINGS_ID));
    await recordAdminAction(
      {
        ...audit,
        action: "instance.settings_updated",
        targetType: "instance",
        targetId: null,
        targetLabel: null,
        metadata: { changes },
      },
      tx,
    );
  });
  invalidateInstanceSettings();
  return readAdminSettings();
}

export default updateAdminSettings;
