import {
  withGiteaOutboundWrite,
  type GiteaOutboundBinding,
} from "../gitea/services/outbound-fence";
import type { IssueWrite } from "./issue-write";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import db from "../../database";
import { labelTable } from "../../database/schema";
import { withIntegrationLink } from "../github/services/with-integration-link";
import { canSyncTask } from "./eligibility";
import { readSyncRules } from "./rules";
import { sameConfig } from "./same-config";

export class IssueWriteRefused extends Error {
  constructor() {
    super("Issue sync scope changed");
  }
}

export async function dispatchIssueWrite<T>(
  link: { id: string; taskId: string; integrationId: string | null },
  expectedConfig: string | undefined,
  send: () => Promise<T>,
  intent?: GiteaOutboundBinding["intent"],
): Promise<{ value: T } | undefined> {
  if (!link.integrationId) return;
  const integration = await db.query.integrationTable.findFirst({
    where: (table, { eq }) => eq(table.id, link.integrationId!),
    with: { project: true },
  });
  if (!integration) return;
  if (integration.type === "gitea") {
    let config: GiteaOutboundBinding["config"];
    try {
      config = JSON.parse(expectedConfig ?? integration.config);
    } catch {
      return;
    }
    const result = await withGiteaOutboundWrite(
      {
        integrationId: integration.id,
        projectId: integration.projectId,
        config,
        link,
        intent,
      },
      send,
    );
    return result.sent ? { value: result.value } : undefined;
  }
  let request: Promise<{ value: T } | { error: unknown }> | undefined;
  try {
    await withIntegrationLink(
      link,
      integration,
      async (tx) => {
        const rule = readSyncRules(integration.config)?.outgoing;
        if (rule?.mode === "labels") {
          await tx
            .select({ id: labelTable.id })
            .from(labelTable)
            .where(
              and(
                eq(labelTable.workspaceId, integration.project.workspaceId),
                or(
                  and(
                    isNull(labelTable.taskId),
                    inArray(labelTable.id, rule.labels),
                  ),
                  eq(labelTable.taskId, link.taskId),
                ),
              ),
            )
            .orderBy(labelTable.id)
            .for("share");
        }
        if (
          !(await canSyncTask(link.taskId, integration.id, tx, expectedConfig))
        )
          return;
        // Start the request while pause/rule/label writes are excluded. Settle it
        // after commit so provider latency never holds these row locks.
        request = send().then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
      },
      {
        type: integration.type,
        validate: (binding) =>
          sameConfig(binding.config, integration.config) &&
          (expectedConfig === undefined ||
            sameConfig(binding.config, expectedConfig)),
      },
    );
  } catch (error) {
    if (!request) throw error;
    // The eligible dispatch path only reads/locks rows. A failed commit cannot
    // undo its provider request; settle it so the caller records its outcome.
    console.error("Issue write scope transaction failed after dispatch", {
      integrationId: integration.id,
      linkId: link.id,
    });
  }
  if (!request) return;
  const result = await request;
  if ("error" in result) throw result.error;
  return result;
}

export function createIssueWrite(
  link: Parameters<typeof dispatchIssueWrite>[0],
  expectedConfig: string | undefined,
): IssueWrite {
  return async (send) => {
    const result = await dispatchIssueWrite(link, expectedConfig, send);
    if (!result) throw new IssueWriteRefused();
    return result.value;
  };
}
