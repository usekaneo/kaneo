import {
  extractIssuePriority,
  extractIssueStatus,
} from "../github/utils/extract-priority";
import { parseLinkMetadata } from "../github/utils/parse-link-metadata";

export function resumeLabelChanges(
  link: { id: string; metadata: string | null },
  current: string[],
) {
  const value = parseLinkMetadata<{ syncResumeLabelBaseline?: unknown }>(
    link.metadata,
    {
      externalLinkId: link.id,
      source: "resume_labels",
    },
  ).syncResumeLabelBaseline;
  const baseline =
    Array.isArray(value) && value.every((name) => typeof name === "string")
      ? (value as string[])
      : undefined;
  return {
    baseline,
    priorityChanged:
      !baseline ||
      extractIssuePriority(baseline) !== extractIssuePriority(current),
    statusChanged:
      !baseline || extractIssueStatus(baseline) !== extractIssueStatus(current),
  };
}
