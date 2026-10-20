export const BOARD_UNAVAILABLE_WARNING =
  "Jira did not share the board for this project, so columns follow its statuses.";

export type WarningCounts = {
  issuesWithAttachments: number;
  externalLinks: number;
  boardUnavailable: boolean;
};

export function buildWarnings(counts: WarningCounts): string[] {
  const warnings: string[] = [];
  if (counts.issuesWithAttachments > 0) {
    warnings.push(
      counts.issuesWithAttachments === 1
        ? "1 issue has attachments, which are not imported."
        : `${counts.issuesWithAttachments} issues have attachments, which are not imported.`,
    );
  }
  if (counts.externalLinks > 0) {
    warnings.push(
      counts.externalLinks === 1
        ? "1 parent or issue link points to another project, so it was not imported."
        : `${counts.externalLinks} parent or issue links point to other projects, so they were not imported.`,
    );
  }
  if (counts.boardUnavailable) warnings.push(BOARD_UNAVAILABLE_WARNING);
  return warnings;
}
