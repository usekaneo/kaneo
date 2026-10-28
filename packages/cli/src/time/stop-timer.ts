import { Effect } from "effect";
import { updateTimeEntry } from "../api/time-entries.js";
import type { RunningTimer } from "./find-running-timer.js";
import { forgetTimer } from "./timer-pointer-store.js";

export const stopTimer = Effect.fn("time.stopTimer")(function* (
  timer: RunningTimer,
  now: Date,
) {
  const end = Math.max(now.getTime(), Date.parse(timer.entry.startTime));
  const stopped = yield* updateTimeEntry(timer.entry.id, {
    startTime: timer.entry.startTime,
    endTime: new Date(end).toISOString(),
  });
  yield* forgetTimer(timer.entry.id);
  return stopped;
});
