import { Layer } from "effect";
import { DatabaseLive, EventsLive } from "../effect/live";
import { makeRunner } from "../effect/run-handler";
import { timeEntryErrorToHttpException } from "./errors";

export const TimeEntryLive = Layer.mergeAll(DatabaseLive, EventsLive);

export const runTimeEntry = makeRunner(
  TimeEntryLive,
  timeEntryErrorToHttpException,
);
