import { Option, Result } from "effect";
import type { Priority } from "../api/task-mutations.js";
import { InvalidArgument } from "../errors/errors.js";
import { parseDateChange } from "../tasks/parse-date.js";

export type BulkFlags = {
  readonly status: Option.Option<string>;
  readonly priority: Option.Option<Priority>;
  readonly assignee: Option.Option<string>;
  readonly unassign: boolean;
  readonly due: Option.Option<string>;
  readonly addLabel: Option.Option<string>;
  readonly removeLabel: Option.Option<string>;
  readonly delete: boolean;
};

export type BulkChange =
  | { readonly kind: "status"; readonly reference: string }
  | { readonly kind: "priority"; readonly priority: Priority }
  | { readonly kind: "assignee"; readonly reference: string }
  | { readonly kind: "unassign" }
  | { readonly kind: "due"; readonly dueDate: string | null }
  | { readonly kind: "addLabel"; readonly name: string }
  | { readonly kind: "removeLabel"; readonly name: string }
  | { readonly kind: "delete" };

const FLAG_LIST =
  "--status, --priority, --assignee, --unassign, --due, --add-label, --remove-label or --delete";

function given(flags: BulkFlags): string[] {
  const names: string[] = [];
  if (Option.isSome(flags.status)) names.push("--status");
  if (Option.isSome(flags.priority)) names.push("--priority");
  if (Option.isSome(flags.assignee)) names.push("--assignee");
  if (flags.unassign) names.push("--unassign");
  if (Option.isSome(flags.due)) names.push("--due");
  if (Option.isSome(flags.addLabel)) names.push("--add-label");
  if (Option.isSome(flags.removeLabel)) names.push("--remove-label");
  if (flags.delete) names.push("--delete");
  return names;
}

function nonEmpty(
  value: string,
  flag: string,
): Result.Result<string, InvalidArgument> {
  const trimmed = value.trim();
  return trimmed === ""
    ? Result.fail(new InvalidArgument({ message: `${flag} needs a value.` }))
    : Result.succeed(trimmed);
}

export function parseBulkChange(
  flags: BulkFlags,
  now: Date,
): Result.Result<BulkChange, InvalidArgument> {
  const names = given(flags);
  if (names.length === 0) {
    return Result.fail(
      new InvalidArgument({
        message: "Nothing to change.",
        hint: `Pass one of ${FLAG_LIST}.`,
      }),
    );
  }
  if (names.length > 1) {
    return Result.fail(
      new InvalidArgument({
        message: `Pass one change per call, not ${names.join(" and ")}.`,
        hint: "Run kaneo task bulk once for each change.",
      }),
    );
  }
  if (Option.isSome(flags.status)) {
    return Result.map(
      nonEmpty(flags.status.value, "--status"),
      (reference) => ({
        kind: "status" as const,
        reference,
      }),
    );
  }
  if (Option.isSome(flags.priority)) {
    return Result.succeed({ kind: "priority", priority: flags.priority.value });
  }
  if (Option.isSome(flags.assignee)) {
    return Result.map(
      nonEmpty(flags.assignee.value, "--assignee"),
      (reference) => ({ kind: "assignee" as const, reference }),
    );
  }
  if (flags.unassign) return Result.succeed({ kind: "unassign" });
  if (Option.isSome(flags.due)) {
    return Result.map(
      parseDateChange(flags.due.value, now, "--due"),
      (dueDate) => ({
        kind: "due" as const,
        dueDate,
      }),
    );
  }
  if (Option.isSome(flags.addLabel)) {
    return Result.map(
      nonEmpty(flags.addLabel.value, "--add-label"),
      (name) => ({
        kind: "addLabel" as const,
        name,
      }),
    );
  }
  if (Option.isSome(flags.removeLabel)) {
    return Result.map(
      nonEmpty(flags.removeLabel.value, "--remove-label"),
      (name) => ({ kind: "removeLabel" as const, name }),
    );
  }
  return Result.succeed({ kind: "delete" });
}
