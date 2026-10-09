import { Duration, Effect } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

export type PublicResponse = {
  readonly status: number;
  readonly milliseconds: number;
  readonly body: unknown;
};

function describeFailure(error: unknown): string {
  if ((error as { _tag?: unknown } | null)?._tag === "TimeoutError") {
    return "timed out after 15s";
  }
  let current: unknown = error;
  let message = String(error);
  for (let depth = 0; current && depth < 8; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    if (current instanceof Error) message = current.message;
    current = (current as { cause?: unknown }).cause;
  }
  return message;
}

export const fetchPublic = (url: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const started = Date.now();
    const response = yield* client
      .execute(HttpClientRequest.get(url).pipe(HttpClientRequest.acceptJson))
      .pipe(Effect.timeout(Duration.seconds(15)));
    const milliseconds = Date.now() - started;
    const body = yield* response.json.pipe(
      Effect.orElseSucceed(() => undefined),
    );
    const result: PublicResponse = {
      status: response.status,
      milliseconds,
      body,
    };
    return result;
  }).pipe(Effect.mapError(describeFailure));
