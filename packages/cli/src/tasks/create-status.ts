import { Result } from "effect";
import type { Column } from "../api/schemas.js";
import { InvalidArgument } from "../errors/errors.js";
import { BACKLOG_STATUS, matchStatus } from "./backlog.js";

export const FALLBACK_STATUS = "to-do";

export function createStatus(
  columns: ReadonlyArray<Column>,
  wanted: string | undefined,
  projectName: string,
): Result.Result<Column | null, InvalidArgument> {
  const ordered = [...columns].sort((a, b) => a.position - b.position);
  if (wanted === undefined) return Result.succeed(ordered[0] ?? null);
  const match = matchStatus(ordered, wanted);
  if (match) return Result.succeed(match);
  return Result.fail(
    new InvalidArgument({
      message: `${projectName} has no column "${wanted}".`,
      hint: `Pass -s with one of: ${[...ordered.map((column) => column.slug), BACKLOG_STATUS].join(", ")}.`,
    }),
  );
}
