import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Effect, Option } from "effect";
import { ConfigStore } from "../config/config-store.js";
import { Session } from "../services/session.js";
import {
  parseTimerPointers,
  serializeTimerPointers,
  type TimerPointer,
  type TimerPointers,
  withTimerPointer,
} from "./timer-pointers.js";

const pointerPath = Effect.gen(function* () {
  const store = yield* ConfigStore;
  return join(dirname(store.path), "timer.json");
});

const load = (path: string) =>
  Effect.tryPromise(() => readFile(path, "utf8")).pipe(
    Effect.map(parseTimerPointers),
    Effect.orElseSucceed((): TimerPointers => ({})),
  );

const update = (
  change: (current: TimerPointers, apiUrl: string) => TimerPointers,
) =>
  Effect.gen(function* () {
    const session = yield* Session;
    const path = yield* pointerPath;
    const current = yield* load(path);
    const next = change(current, session.apiUrl);
    if (next === current) return;
    yield* Effect.tryPromise(async () => {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const temporary = `${path}.${process.pid}.tmp`;
      await writeFile(temporary, serializeTimerPointers(next), { mode: 0o600 });
      await rename(temporary, path);
    }).pipe(Effect.ignore);
  });

export const recallTimer = Effect.gen(function* () {
  const session = yield* Session;
  const path = yield* pointerPath;
  const pointers = yield* load(path);
  return Option.fromUndefinedOr(pointers[session.apiUrl]);
});

export const rememberTimer = (pointer: TimerPointer) =>
  update((current, apiUrl) => withTimerPointer(current, apiUrl, pointer));

export const forgetTimer = (entryId: string) =>
  update((current, apiUrl) =>
    current[apiUrl]?.entryId === entryId
      ? withTimerPointer(current, apiUrl, null)
      : current,
  );
