import { Effect } from "effect";
import type {
  ApiFailure,
  NotSignedIn,
  SessionExpired,
} from "../errors/errors.js";
import { describeError } from "../errors/describe.js";

export type SectionResult<A> =
  | { readonly _tag: "Loaded"; readonly value: A }
  | { readonly _tag: "Failed"; readonly message: string };

type SignedOut = NotSignedIn | SessionExpired;

function isSignedOut(error: ApiFailure): error is SignedOut {
  return error._tag === "NotSignedIn" || error._tag === "SessionExpired";
}

export function loaded<A>(value: A): SectionResult<A> {
  return { _tag: "Loaded", value };
}

export function failed<A>(message: string): SectionResult<A> {
  return { _tag: "Failed", message };
}

export function mapSection<A, B>(
  section: SectionResult<A>,
  f: (value: A) => B,
): SectionResult<B> {
  return section._tag === "Loaded" ? loaded(f(section.value)) : section;
}

export function sectionValue<A>(section: SectionResult<A>): A | null {
  return section._tag === "Loaded" ? section.value : null;
}

export const optionalSection = <A, R>(
  effect: Effect.Effect<A, ApiFailure, R>,
): Effect.Effect<SectionResult<A>, SignedOut, R> =>
  effect.pipe(
    Effect.map(loaded),
    Effect.catchIf(
      (error): error is Exclude<ApiFailure, SignedOut> => !isSignedOut(error),
      (error) => Effect.succeed(failed<A>(describeError(error).message)),
    ),
  );
