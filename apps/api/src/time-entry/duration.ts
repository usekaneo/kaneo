import { Effect } from "effect";
import { InvalidTimeRange, TimeRangeTooLong } from "./errors";

const MAX_DURATION_SECONDS = 2_147_483_647;

export const resolveDuration = Effect.fn("timeEntry.resolveDuration")(
  function* (startTime: Date, endTime?: Date) {
    if (!endTime) {
      return null;
    }

    if (startTime.getTime() > endTime.getTime()) {
      return yield* new InvalidTimeRange({ startTime, endTime });
    }

    const duration = Math.floor(
      (endTime.getTime() - startTime.getTime()) / 1000,
    );

    if (duration > MAX_DURATION_SECONDS) {
      return yield* new TimeRangeTooLong({ duration });
    }

    return duration;
  },
);
