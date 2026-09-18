import { DatabaseLive } from "../effect/live";
import { makeRunner } from "../effect/run-handler";
import { customFieldErrorToHttpException } from "./errors";

export const runCustomField = makeRunner(
  DatabaseLive,
  customFieldErrorToHttpException,
);
