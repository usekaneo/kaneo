import { Data } from "effect";
import { HTTPException } from "hono/http-exception";

export class InvalidTimeRange extends Data.TaggedError("InvalidTimeRange")<{
  readonly startTime: Date;
  readonly endTime: Date;
}> {}

export class TimeRangeTooLong extends Data.TaggedError("TimeRangeTooLong")<{
  readonly duration: number;
}> {}

export class TimeEntryCreateFailed extends Data.TaggedError(
  "TimeEntryCreateFailed",
)<{
  readonly taskId: string;
}> {}

export type TimeEntryError =
  | InvalidTimeRange
  | TimeRangeTooLong
  | TimeEntryCreateFailed;

export function timeEntryErrorToHttpException(
  error: TimeEntryError,
): HTTPException {
  switch (error._tag) {
    case "InvalidTimeRange":
      return new HTTPException(400, {
        message:
          "Start time cannot be after end time. Please adjust the time range.",
      });
    case "TimeRangeTooLong":
      return new HTTPException(400, {
        message: "The time range is too long to record.",
      });
    case "TimeEntryCreateFailed":
      return new HTTPException(500, {
        message: "Failed to create time entry",
      });
    default:
      return error satisfies never;
  }
}
