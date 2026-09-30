import { createHash } from "node:crypto";
import { normalizeGiteaBaseUrl } from "../../gitea/config";

export type IssueField = "title" | "description" | "state";
export type DeferredIssueEdit = {
  id: string;
  fields: IssueField[];
  repairFields?: IssueField[];
  scope: string;
};

export function parseDeferredIssueEdit(
  value: unknown,
): DeferredIssueEdit | undefined {
  if (!value || typeof value !== "object") return;
  const job = value as DeferredIssueEdit;
  if (
    typeof job.id !== "string" ||
    typeof job.scope !== "string" ||
    !Array.isArray(job.fields) ||
    (job.repairFields !== undefined &&
      (!Array.isArray(job.repairFields) ||
        job.repairFields.some(
          (field) => !["title", "description", "state"].includes(field),
        ))) ||
    (!job.fields.length && !job.repairFields?.length) ||
    job.fields.some(
      (field) => !["title", "description", "state"].includes(field),
    )
  )
    return;
  return job;
}

// Bind only repository identity; tokens and webhook secrets never enter metadata.
export function issueEditScope(integration: { type: string; config: string }) {
  const config = JSON.parse(integration.config);
  return createHash("sha256")
    .update(
      JSON.stringify([
        integration.type,
        integration.type === "gitea"
          ? normalizeGiteaBaseUrl(config.baseUrl)
          : null,
        config.repositoryOwner,
        config.repositoryName,
        integration.type === "github" ? config.installationId : null,
        integration.type === "github" ? config.repositoryId : null,
      ]),
    )
    .digest("hex");
}
