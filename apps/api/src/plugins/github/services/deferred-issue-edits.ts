import { and, asc, eq, gt, like, sql } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable, taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import type { GiteaConfig } from "../../gitea/config";
import { createGiteaClient } from "../../gitea/utils/gitea-api";
import type { GitHubConfig } from "../config";
import {
  issueEditScope,
  parseDeferredIssueEdit,
  type IssueField,
} from "../utils/deferred-issue-edit";
import {
  formatIssueBody,
  formatTaskDescriptionFromIssue,
} from "../utils/format";
import { getVerifiedInstallationOctokit } from "../utils/github-app";
import { inboundEcho, PendingEcho } from "../utils/inbound-echo";
import { parseLinkMetadata } from "../utils/parse-link-metadata";
import {
  inboundStamp,
  inboundOccurredAfterIntent,
  uncertainOutboundIntent,
  type SyncStamp,
} from "../utils/sync-echo";
import { writeInboundTaskField } from "./apply-observed-task-value";
import { updateExternalLink } from "./link-manager";
import { syncLatestTaskValue } from "./sync-latest-task-value";
import {
  linkedTaskScope,
  type IntegrationDatabase,
} from "./integration-task-scope";
import { withIntegrationLink } from "./with-integration-link";

type Integration = {
  id: string;
  projectId: string;
  type: string;
  config: string;
};
type Metadata = Record<string, unknown> & {
  lastSync?: Record<string, SyncStamp>;
};
const metadataFor = (link: { id: string; metadata: string | null }) =>
  parseLinkMetadata<Metadata>(link.metadata, {
    externalLinkId: link.id,
    source: "deferred_issue_edit",
  });

// Commit the intent before acknowledging a delivery which cannot wait for its writer.
export async function deferIssueEdit(
  link: { id: string; taskId: string },
  integration: Integration,
  fields: IssueField[],
) {
  await withIntegrationLink(
    link,
    integration,
    async (tx) => {
      await updateExternalLink(
        link.id,
        { deferredEdit: { fields, scope: issueEditScope(integration) } },
        tx,
      );
    },
    {
      validate: (binding) =>
        issueEditScope(binding) === issueEditScope(integration),
    },
  );
}

async function taskRevision(
  taskId: string,
  projectId: string,
  database: IntegrationDatabase = db,
) {
  const [task] = await database
    .select({ revision: sql<string>`${taskTable}.xmin::text` })
    .from(taskTable)
    .where(linkedTaskScope(taskId, projectId));
  return task?.revision;
}

async function issueAccess(
  integration: Integration,
  link: { externalId: string; taskId: string },
) {
  const number = Number(link.externalId);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new Error("Invalid issue number");
  const config = JSON.parse(integration.config);
  const { repositoryOwner: owner, repositoryName: repo } = config;
  const payload = (field: IssueField, value: string) =>
    field === "description"
      ? { body: formatIssueBody(value, link.taskId) }
      : { [field]: value };
  if (integration.type === "gitea") {
    const client = createGiteaClient(config as GiteaConfig);
    return {
      read: () => client.getIssue(owner, repo, number),
      write: async (field: IssueField, value: string) =>
        (await client.updateIssue(owner, repo, number, payload(field, value)))
          ?.updated_at,
    };
  }
  const octokit = await getVerifiedInstallationOctokit(
    config as GitHubConfig,
    true,
  );
  return {
    read: async () =>
      (
        await octokit.rest.issues.get({
          owner,
          repo,
          issue_number: number,
          request: { timeout: 10_000 },
        })
      ).data,
    write: async (field: IssueField, value: string) =>
      (
        await octokit.rest.issues.update({
          owner,
          repo,
          issue_number: number,
          ...payload(field, value),
          request: { timeout: 10_000 },
        })
      )?.data?.updated_at,
  };
}

let running = false;
let cursor: string | undefined;
export async function replayDeferredIssueEdits() {
  if (running) return {};
  running = true;
  let degraded = false;
  const deadline = Date.now() + 45_000;
  try {
    const links = await db.query.externalLinkTable.findMany({
      where: and(
        eq(externalLinkTable.resourceType, "issue"),
        like(externalLinkTable.metadata, '%"deferredIssueEdit":%'),
        cursor ? gt(externalLinkTable.id, cursor) : undefined,
      ),
      with: { integration: true },
      orderBy: asc(externalLinkTable.id),
      limit: 20,
    });
    if (!links.length) cursor = undefined;
    let processed = 0;
    for (const link of links) {
      if (Date.now() >= deadline) break;
      cursor = link.id;
      processed++;
      try {
        const metadata = metadataFor(link);
        const job = parseDeferredIssueEdit(metadata.deferredIssueEdit);
        if (!job) continue;
        const integration = link.integration;
        if (
          !integration?.isActive ||
          !["github", "gitea"].includes(integration.type) ||
          issueEditScope(integration) !== job.scope
        ) {
          await updateExternalLink(link.id, { completeDeferredEdit: job.id });
          continue;
        }
        // An orphaned writer expires after five minutes; until then let it settle.
        if (
          job.fields.some((field) =>
            metadata.lastSync?.[field]?.outbound?.some(
              (entry) =>
                entry.pending &&
                !entry.cancelled &&
                Date.now() - Date.parse(entry.timestamp) < 300_000,
            ),
          )
        )
          continue;
        const revision = await taskRevision(link.taskId, integration.projectId);
        if (!revision) continue;
        const provider = await issueAccess(integration, link);
        let issue: Awaited<ReturnType<typeof provider.read>>;
        try {
          issue = await provider.read();
        } catch (error) {
          if (
            typeof error !== "object" ||
            error === null ||
            !("status" in error) ||
            error.status !== 404
          )
            throw error;
          // Only retire this read's job; credentials, binding, or queued fields
          // may have changed while the provider request was in flight.
          await withIntegrationLink(
            link,
            integration,
            async (tx) => {
              await updateExternalLink(
                link.id,
                { completeDeferredEdit: job.id },
                tx,
              );
            },
            integration,
          );
          continue;
        }
        if (
          typeof issue.title !== "string" ||
          !["open", "closed"].includes(issue.state)
        )
          throw new Error("Invalid issue response");
        const values = {
          title: issue.title,
          description: formatTaskDescriptionFromIssue(
            issue.body ?? null,
            link.taskId,
          ),
          state: issue.state,
        };
        const repairs: Array<{
          field: IssueField;
          value: string;
          intentId?: string;
          providerValue: string;
        }> = [];
        const applied = await withIntegrationLink(
          link,
          integration,
          async (tx, afterCommit, locked) => {
            const current = metadataFor(locked);
            if (
              parseDeferredIssueEdit(current.deferredIssueEdit)?.id !== job.id
            )
              return;
            if (
              job.fields.some(
                (field) =>
                  JSON.stringify(current.lastSync?.[field]) !==
                  JSON.stringify(metadata.lastSync?.[field]),
              )
            )
              return;
            if (
              (await taskRevision(link.taskId, integration.projectId, tx)) !==
              revision
            )
              return;
            const task = await tx.query.taskTable.findFirst({
              where: linkedTaskScope(link.taskId, integration.projectId),
              columns: { title: true, description: true, status: true },
            });
            if (!task) return;
            for (const field of job.fields) {
              const stamp = current.lastSync?.[field];
              const uncertain = uncertainOutboundIntent(stamp, values[field]);
              const local =
                field === "state"
                  ? task.status === "done"
                    ? "closed"
                    : "open"
                  : field === "description"
                    ? task.description || ""
                    : task.title;
              // A crashed older writer can leave the provider behind our completed
              // local value. Its missing receipt does not make it a remote edit.
              if (
                uncertain &&
                !(
                  stamp?.source !== "kaneo" &&
                  stamp?.inboundValue === local &&
                  inboundOccurredAfterIntent(stamp, uncertain)
                ) &&
                local !== values[field]
              ) {
                if (uncertain.intentId)
                  await updateExternalLink(
                    link.id,
                    {
                      outbound: {
                        field,
                        value: values[field],
                        intentId: uncertain.intentId,
                        pending: false,
                        uncertain: true,
                      },
                    },
                    tx,
                  );
                repairs.push({
                  field,
                  value: local,
                  intentId: uncertain.intentId,
                  providerValue: values[field],
                });
              }
            }
            // Classify every field before writing any: PendingEcho commits only its observation.
            const accepted = job.fields.filter(
              (field) =>
                !repairs.some((repair) => repair.field === field) &&
                !(
                  field === "state" &&
                  integration.type === "github" &&
                  current.createdFrom === "kaneo"
                ) &&
                !inboundEcho(
                  current.lastSync?.[field],
                  values[field],
                  issue.updated_at,
                  values[field],
                  {
                    linkId: link.id,
                    field,
                    localValue:
                      field === "state"
                        ? task.status === "done"
                          ? "closed"
                          : "open"
                        : field === "description"
                          ? task.description || ""
                          : task.title,
                  },
                ),
            );
            for (const field of accepted) {
              await writeInboundTaskField(
                tx,
                afterCommit,
                link,
                integration,
                field,
                values[field],
              );
              current.lastSync = {
                ...current.lastSync,
                [field]: inboundStamp(
                  current.lastSync?.[field],
                  values[field],
                  integration.type,
                  issue.updated_at,
                ),
              };
              if (field === "state") current.state = values.state;
            }
            await updateExternalLink(
              link.id,
              {
                metadata: current,
                ...(accepted.includes("title") ? { title: values.title } : {}),
                ...(repairs.length ? {} : { completeDeferredEdit: job.id }),
              },
              tx,
            );
            if (accepted.length)
              afterCommit(() =>
                publishEvent("task.updated", {
                  taskId: link.taskId,
                  projectId: integration.projectId,
                }),
              );
            return true;
          },
          integration,
        );
        if (applied !== true) continue;
        for (const repair of repairs) {
          await syncLatestTaskValue(
            link.taskId,
            integration.projectId,
            link,
            repair.field,
            repair.value,
            (value) => provider.write(repair.field, value),
            async () => {
              const current = await provider.read();
              return repair.field === "description"
                ? formatTaskDescriptionFromIssue(
                    current.body ?? null,
                    link.taskId,
                  )
                : current[repair.field];
            },
          );
        }
        if (repairs.length)
          await withIntegrationLink(
            link,
            integration,
            async (tx) => {
              // The repair succeeded. Retire its uncertain intent so a future
              // genuine provider edit to the old value remains importable.
              for (const repair of repairs) {
                if (repair.intentId)
                  await updateExternalLink(
                    link.id,
                    {
                      outbound: {
                        field: repair.field,
                        value: repair.providerValue,
                        intentId: repair.intentId,
                        updatedAt: issue.updated_at,
                        pending: false,
                        uncertain: false,
                        cancelled: true,
                      },
                    },
                    tx,
                  );
              }
              await updateExternalLink(
                link.id,
                { completeDeferredEdit: job.id },
                tx,
              );
            },
            integration,
          );
      } catch (error) {
        if (error instanceof PendingEcho) continue;
        degraded = true;
        console.error("Deferred issue edit failed", {
          externalLinkId: link.id,
        });
      }
    }
    if (processed === links.length && links.length < 20) cursor = undefined;
    return { degraded };
  } finally {
    running = false;
  }
}
