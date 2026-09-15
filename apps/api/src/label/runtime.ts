import { Effect, Layer } from "effect";
import { DatabaseLive, EventsLive } from "../effect/live";
import { makeRunner } from "../effect/run-handler";
import {
  removeLabelFromGitea,
  syncLabelToGitea,
} from "../plugins/gitea/utils/sync-label-to-gitea";
import {
  removeLabelFromGitHub,
  syncLabelToGitHub,
} from "../plugins/github/utils/sync-label-to-github";
import { labelErrorToHttpException } from "./errors";
import { LabelSync } from "./label-sync";

export const LabelSyncLive = Layer.succeed(LabelSync, {
  syncToGitHub: (taskId, name, color) =>
    Effect.sync(() => {
      syncLabelToGitHub(taskId, name, color).catch((error) => {
        console.error("Failed to sync label to GitHub:", error);
      });
    }),
  removeFromGitHub: (taskId, name) =>
    Effect.sync(() => {
      removeLabelFromGitHub(taskId, name).catch((error) => {
        console.error("Failed to remove label from GitHub:", error);
      });
    }),
  syncToGitea: (taskId, name, color) =>
    Effect.sync(() => {
      syncLabelToGitea(taskId, name, color).catch((error) => {
        console.error("Failed to sync label to Gitea:", error);
      });
    }),
  removeFromGitea: (taskId, name) =>
    Effect.sync(() => {
      removeLabelFromGitea(taskId, name).catch((error) => {
        console.error("Failed to remove label from Gitea:", error);
      });
    }),
});

export const LabelLive = Layer.mergeAll(
  DatabaseLive,
  EventsLive,
  LabelSyncLive,
);

export const runLabel = makeRunner(LabelLive, labelErrorToHttpException);
