import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { ApiError } from "../../errors/api-error";
import { parseModelReference } from "../../agent/providers/model-reference";
import { getProviderSettings } from "../../agent/providers/settings";
import { builtinProviders } from "../../agent/providers/builtins";
import { loadCommunityProvider } from "../../agent/providers/resolve-model";
import type { AgentModelPolicy } from "../../agent/providers/types";
import { invalidateInstanceSettings } from "../../instance-settings/get-instance-settings";
import { INSTANCE_SETTINGS_ID } from "../../instance-settings/read-stored-settings";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { readAgentSettings } from "./read-settings";

export async function updateAgentSettings(
  policy: AgentModelPolicy | null,
  audit: AdminAuditRequest,
) {
  if (policy)
    for (const id of policy.models) {
      const reference = parseModelReference(id);
      let configured = false;
      try {
        configured = Boolean(
          reference && getProviderSettings(reference.provider),
        );
        if (
          configured &&
          reference &&
          !Object.hasOwn(builtinProviders, reference.provider)
        )
          await loadCommunityProvider(reference.provider);
      } catch {
        /* Never expose secret-file paths. */
        configured = false;
      }
      if (!configured)
        throw new ApiError(400, {
          code: "AGENT_PROVIDER_UNAVAILABLE",
          message:
            "Configure the model provider on the server before allowing this model.",
        });
    }
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.instanceSettingsTable)
      .values({ id: INSTANCE_SETTINGS_ID })
      .onConflictDoNothing();
    const [current] = await tx
      .select({ agentModels: schema.instanceSettingsTable.agentModels })
      .from(schema.instanceSettingsTable)
      .where(eq(schema.instanceSettingsTable.id, INSTANCE_SETTINGS_ID))
      .for("update");
    if (JSON.stringify(current?.agentModels) === JSON.stringify(policy)) return;
    await tx
      .update(schema.instanceSettingsTable)
      .set({ agentModels: policy })
      .where(eq(schema.instanceSettingsTable.id, INSTANCE_SETTINGS_ID));
    await recordAdminAction(
      {
        ...audit,
        action: "instance.settings_updated",
        targetType: "instance",
        targetId: null,
        targetLabel: null,
        metadata: {
          changes: [
            {
              setting: "agentModels",
              from: current?.agentModels ?? null,
              to: policy,
            },
          ],
        },
      },
      tx,
    );
  });
  invalidateInstanceSettings();
  return readAgentSettings();
}
