import { and, asc, eq, gt, like } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import type { GiteaConfig } from "../../gitea/config";
import { createGiteaClient } from "../../gitea/utils/gitea-api";
import type { GitHubConfig } from "../config";
import {
  issueEditScope,
  parseDeferredIssueEdit,
  type IssueField,
} from "../utils/deferred-issue-edit";
import { formatTaskDescriptionFromIssue } from "../utils/format";
import { getVerifiedInstallationOctokit } from "../utils/github-app";
import { inboundEcho, PendingEcho } from "../utils/inbound-echo";
import { parseLinkMetadata } from "../utils/parse-link-metadata";
import { inboundStamp, type SyncStamp } from "../utils/sync-echo";
import { writeInboundTaskField } from "./apply-observed-task-value";
import { updateExternalLink } from "./link-manager";
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
    integration,
  );
}

async function readIssue(integration: Integration, externalId: string) {
  const number = Number(externalId);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new Error("Invalid issue number");
  if (integration.type === "gitea") {
    const config = JSON.parse(integration.config) as GiteaConfig;
    return createGiteaClient(config).getIssue(
      config.repositoryOwner,
      config.repositoryName,
      number,
    );
  }
  const config = JSON.parse(integration.config) as GitHubConfig;
  const octokit = await getVerifiedInstallationOctokit(config, true);
  return (
    await octokit.rest.issues.get({
      owner: config.repositoryOwner,
      repo: config.repositoryName,
      issue_number: number,
      request: { timeout: 10_000 },
    })
  ).data;
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
        const issue = await readIssue(integration, link.externalId);
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
        await withIntegrationLink(
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
            // Classify every field before writing any: PendingEcho commits only its observation.
            const accepted = job.fields.filter(
              (field) =>
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
                  { linkId: link.id, field },
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
                ),
              };
              if (field === "state") current.state = values.state;
            }
            await updateExternalLink(
              link.id,
              {
                metadata: current,
                ...(accepted.includes("title") ? { title: values.title } : {}),
                completeDeferredEdit: job.id,
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
