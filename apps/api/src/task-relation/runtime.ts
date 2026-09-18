import { Layer } from "effect";
import { DatabaseLive, EventsLive } from "../effect/live";
import { makeRunner } from "../effect/run-handler";
import { taskRelationErrorToHttpException } from "./errors";

export const TaskRelationLive = Layer.mergeAll(DatabaseLive, EventsLive);

export const runTaskRelation = makeRunner(
  TaskRelationLive,
  taskRelationErrorToHttpException,
);
