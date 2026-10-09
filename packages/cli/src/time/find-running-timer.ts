import { Effect, Option } from "effect";
import { listAssignedTasks, listWorkspaces } from "../api/endpoints.js";
import {
  getTimeEntry,
  listTimeEntries,
  type TimeEntry,
} from "../api/time-entries.js";
import { taskUrl } from "../render/links.js";
import { ticketId } from "../render/task-format.js";
import { Session } from "../services/session.js";
import { type ResolvedTask, resolveTask } from "../tasks/resolve-task.js";
import { runningEntries } from "./running-entries.js";
import {
  forgetTimer,
  recallTimer,
  rememberTimer,
} from "./timer-pointer-store.js";

export type TaskRef = {
  readonly id: string;
  readonly ticketId: string | null;
  readonly title: string;
  readonly url: string;
};

export type RunningTimer = {
  readonly entry: TimeEntry;
  readonly task: TaskRef;
};

const SCAN_CONCURRENCY = 8;

export function taskRef(resolved: ResolvedTask): TaskRef {
  return {
    id: resolved.task.id,
    ticketId: resolved.ticketId,
    title: resolved.task.title,
    url: resolved.url,
  };
}

const latest = (timers: ReadonlyArray<RunningTimer>) =>
  Option.fromUndefinedOr(
    [...timers].sort(
      (left, right) =>
        Date.parse(right.entry.startTime) - Date.parse(left.entry.startTime),
    )[0],
  );

export const findTaskTimer = Effect.fn("time.findTaskTimer")(function* (
  resolved: ResolvedTask,
  userId: string,
) {
  const entries = yield* listTimeEntries(resolved.task.id);
  const [entry] = runningEntries(entries, userId);
  return entry
    ? Option.some<RunningTimer>({ entry, task: taskRef(resolved) })
    : Option.none<RunningTimer>();
});

const fromPointer = Effect.fnUntraced(function* (userId: string) {
  const pointer = yield* recallTimer;
  if (Option.isNone(pointer)) return Option.none<RunningTimer>();
  const entry = yield* getTimeEntry(pointer.value.entryId).pipe(
    Effect.map((value): TimeEntry | null => value),
    Effect.catchTags({
      NotFound: () => Effect.succeed(null),
      PermissionDenied: () => Effect.succeed(null),
    }),
  );
  if (entry === null || entry.endTime !== null) {
    yield* forgetTimer(pointer.value.entryId);
    return Option.none<RunningTimer>();
  }
  if (entry.userId !== userId) return Option.none<RunningTimer>();
  const resolved = yield* resolveTask(entry.taskId);
  return Option.some<RunningTimer>({ entry, task: taskRef(resolved) });
});

const scanAssignedTasks = Effect.fnUntraced(function* (userId: string) {
  const session = yield* Session;
  const workspaceIds = Option.isSome(session.workspace)
    ? [session.workspace.value.id]
    : (yield* listWorkspaces()).map((workspace) => workspace.id);
  const assigned = yield* Effect.forEach(
    workspaceIds,
    (workspaceId) =>
      listAssignedTasks(workspaceId).pipe(
        Effect.map(({ tasks }) => tasks.map((task) => ({ task, workspaceId }))),
        Effect.catchTag("PermissionDenied", () => Effect.succeed([])),
      ),
    { concurrency: 4 },
  );
  const found = yield* Effect.forEach(
    assigned.flat(),
    ({ task, workspaceId }) =>
      listTimeEntries(task.id).pipe(
        Effect.map((entries) =>
          runningEntries(entries, userId).map((entry): RunningTimer => ({
            entry,
            task: {
              id: task.id,
              ticketId: ticketId(task.projectSlug, task.number),
              title: task.title,
              url: taskUrl(session.webUrl, {
                workspaceId,
                projectId: task.projectId,
                id: task.id,
              }),
            },
          })),
        ),
      ),
    { concurrency: SCAN_CONCURRENCY },
  );
  const timer = latest(found.flat());
  if (Option.isSome(timer)) {
    yield* rememberTimer({
      entryId: timer.value.entry.id,
      taskId: timer.value.task.id,
    });
  }
  return timer;
});

export const findRunningTimer = Effect.fn("time.findRunningTimer")(function* (
  userId: string,
) {
  const remembered = yield* fromPointer(userId);
  if (Option.isSome(remembered)) return remembered;
  return yield* scanAssignedTasks(userId);
});
