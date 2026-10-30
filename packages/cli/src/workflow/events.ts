import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

export const INTEGRATIONS = ["github", "gitlab", "gitea"] as const;
export type Integration = (typeof INTEGRATIONS)[number];

export const INTEGRATION_LABELS: Readonly<Record<Integration, string>> = {
  github: "GitHub",
  gitlab: "GitLab",
  gitea: "Gitea",
};

export const EVENTS = [
  "branch_push",
  "pr_opened",
  "pr_merged",
  "issue_opened",
  "issue_closed",
  "issue_reopened",
] as const;
export type WorkflowEvent = (typeof EVENTS)[number];

export const EVENT_LABELS: Readonly<Record<WorkflowEvent, string>> = {
  branch_push: "Branch pushed",
  pr_opened: "Pull request opened",
  pr_merged: "Pull request merged",
  issue_opened: "Issue opened",
  issue_closed: "Issue closed",
  issue_reopened: "Issue reopened",
};

const EVENT_ALIASES: Readonly<Record<string, WorkflowEvent>> = {
  push: "branch_push",
  mr_opened: "pr_opened",
  mr_merged: "pr_merged",
};

function key(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function isIntegration(value: string): value is Integration {
  return (INTEGRATIONS as ReadonlyArray<string>).includes(value);
}

export function isWorkflowEvent(value: string): value is WorkflowEvent {
  return (EVENTS as ReadonlyArray<string>).includes(value);
}

export function integrationLabel(value: string): string {
  return isIntegration(value) ? INTEGRATION_LABELS[value] : value;
}

export function eventLabel(value: string): string {
  return isWorkflowEvent(value) ? EVENT_LABELS[value] : value;
}

export function parseIntegration(
  input: string,
): Result.Result<Integration, InvalidArgument> {
  const value = key(input);
  if (isIntegration(value)) return Result.succeed(value);
  return Result.fail(
    new InvalidArgument({
      message: `"${input.trim()}" is not an integration with workflow rules.`,
      hint: "Use github, gitlab or gitea.",
    }),
  );
}

export function parseWorkflowEvent(
  input: string,
): Result.Result<WorkflowEvent, InvalidArgument> {
  const value = key(input);
  if (isWorkflowEvent(value)) return Result.succeed(value);
  const alias = EVENT_ALIASES[value];
  if (alias) return Result.succeed(alias);
  const byLabel = EVENTS.find((event) => key(EVENT_LABELS[event]) === value);
  if (byLabel) return Result.succeed(byLabel);
  return Result.fail(
    new InvalidArgument({
      message: `"${input.trim()}" is not a workflow event.`,
      hint: `Use one of: ${EVENTS.join(", ")}.`,
    }),
  );
}
