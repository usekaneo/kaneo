import { DatabaseLive } from "../effect/live";
import { makeRunner } from "../effect/run-handler";
import { columnErrorToHttpException } from "./errors";

export const runColumn = makeRunner(DatabaseLive, columnErrorToHttpException);
