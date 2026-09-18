import { Context, type Effect } from "effect";
import type createNotification from "../notification/controllers/create-notification";
import type { deleteOrphanedAssets } from "../storage/cleanup-assets";

export type NotificationsShape = {
  readonly create: (
    input: Parameters<typeof createNotification>[0],
  ) => Effect.Effect<void>;
};

export class Notifications extends Context.Service<
  Notifications,
  NotificationsShape
>()("kaneo/comment/Notifications") {}

export type AssetCleanupShape = {
  readonly deleteOrphaned: (
    ...args: Parameters<typeof deleteOrphanedAssets>
  ) => Effect.Effect<void>;
};

export class AssetCleanup extends Context.Service<
  AssetCleanup,
  AssetCleanupShape
>()("kaneo/comment/AssetCleanup") {}
