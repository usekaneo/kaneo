import { Effect } from "effect";
import { toBuildError } from "./errors/to-build-error.js";

export const attempt = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: toBuildError });

export const attemptSync = <A>(run: () => A) =>
  Effect.try({ try: run, catch: toBuildError });
