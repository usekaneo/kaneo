import { Effect, Layer } from "effect";
import { DatabaseLive, EventsLive } from "../effect/live";
import { makeRunner } from "../effect/run-handler";
import createNotification from "../notification/controllers/create-notification";
import { deleteOrphanedAssets } from "../storage/cleanup-assets";
import { commentErrorToHttpException } from "./errors";
import { AssetCleanup, Notifications } from "./services";

export const NotificationsLive = Layer.succeed(Notifications, {
  create: (input) =>
    Effect.promise(async () => {
      await createNotification(input);
    }),
});

export const AssetCleanupLive = Layer.succeed(AssetCleanup, {
  deleteOrphaned: (...args) =>
    Effect.sync(() => {
      deleteOrphanedAssets(...args).catch(() => {});
    }),
});

export const CommentLive = Layer.mergeAll(
  DatabaseLive,
  EventsLive,
  NotificationsLive,
  AssetCleanupLive,
);

export const runComment = makeRunner(CommentLive, commentErrorToHttpException);
