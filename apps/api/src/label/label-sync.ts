import { Context, type Effect } from "effect";

// Provider sync is fire-and-forget: each call schedules the work and
// returns immediately, exactly like the plain helpers it wraps.
export type LabelSyncShape = {
  readonly syncToGitHub: (
    taskId: string,
    name: string,
    color: string,
  ) => Effect.Effect<void>;
  readonly removeFromGitHub: (
    taskId: string,
    name: string,
  ) => Effect.Effect<void>;
  readonly syncToGitea: (
    taskId: string,
    name: string,
    color: string,
  ) => Effect.Effect<void>;
  readonly removeFromGitea: (
    taskId: string,
    name: string,
  ) => Effect.Effect<void>;
};

export class LabelSync extends Context.Service<LabelSync, LabelSyncShape>()(
  "kaneo/label/LabelSync",
) {}
