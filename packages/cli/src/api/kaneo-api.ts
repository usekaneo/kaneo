import {
  Context,
  Duration,
  Effect,
  Layer,
  Option,
  Redacted,
  Schedule,
  Schema,
} from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { ConfigStore } from "../config/config-store.js";
import { withProfile } from "../config/format.js";
import {
  type ApiFailure,
  NotSignedIn,
  PermissionDenied,
  RateLimited,
  ServerUnreachable,
  UnexpectedResponse,
} from "../errors/errors.js";
import { type Credentials, Session } from "../services/session.js";
import { sanitizeDeep } from "../render/sanitize.js";
import { parseErrorBody, parseRetryAfter } from "./error-body.js";
import { toApiFailure } from "./to-api-failure.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type Query = Readonly<
  Record<string, string | number | boolean | undefined>
>;

export type RequestOptions = {
  readonly query?: Query;
  readonly body?: unknown;
  readonly credentials?: Credentials;
  readonly raw?: boolean;
};

export type KaneoApiShape = {
  readonly request: <T>(
    method: HttpMethod,
    path: string,
    schema: Schema.Decoder<T>,
    options?: RequestOptions,
  ) => Effect.Effect<T, ApiFailure>;
};

export class KaneoApi extends Context.Service<KaneoApi, KaneoApiShape>()(
  "kaneo/KaneoApi",
) {}

const REQUEST_TIMEOUT = Duration.seconds(15);
const MAX_RETRY_AFTER_SECONDS = 10;

const rateLimitRetry = Schedule.recurs(2).pipe(
  Schedule.addDelay(({ input }) =>
    Effect.succeed(
      Duration.seconds(
        input instanceof RateLimited ? (input.retryAfterSeconds ?? 1) : 1,
      ),
    ),
  ),
);

function isRetryable(error: ApiFailure): boolean {
  return (
    error._tag === "RateLimited" &&
    (error.retryAfterSeconds ?? 0) <= MAX_RETRY_AFTER_SECONDS
  );
}

function describeTransportError(error: unknown): string {
  const cause = (error as { cause?: unknown } | null)?.cause;
  const code = (cause as { cause?: { code?: unknown } } | null)?.cause?.code;
  if (typeof code === "string") return code;
  if (cause instanceof Error) return cause.message;
  return error instanceof Error ? error.message : String(error);
}

function toUrlParams(query: Query | undefined): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params[key] = String(value);
  }
  return params;
}

export const KaneoApiLayer = Layer.effect(
  KaneoApi,
  Effect.gen(function* () {
    const session = yield* Session;
    const store = yield* ConfigStore;
    const client = yield* HttpClient.HttpClient;

    const forgetStoredToken = store.load.pipe(
      Effect.flatMap((config) =>
        store.save(
          withProfile(config, session.profileName, (profile) => {
            const { token: _token, ...rest } = profile ?? {
              apiUrl: session.apiUrl,
            };
            return rest;
          }),
        ),
      ),
      Effect.ignore,
    );

    const sessionStillValid = (token: Redacted.Redacted<string>) =>
      client
        .execute(
          HttpClientRequest.get(`${session.apiUrl}/api/user/me`).pipe(
            HttpClientRequest.bearerToken(Redacted.value(token)),
            HttpClientRequest.acceptJson,
          ),
        )
        .pipe(
          Effect.timeout(REQUEST_TIMEOUT),
          Effect.map(
            (response) => response.status >= 200 && response.status < 300,
          ),
          Effect.orElseSucceed(() => true),
        );

    const request = <T>(
      method: HttpMethod,
      path: string,
      schema: Schema.Decoder<T>,
      options: RequestOptions = {},
    ): Effect.Effect<T, ApiFailure> => {
      const credentials = options.credentials
        ? Option.some(options.credentials)
        : session.credentials;
      if (Option.isNone(credentials)) {
        return Option.isSome(session.configProblem)
          ? Effect.fail(session.configProblem.value)
          : Effect.fail(new NotSignedIn({ apiUrl: session.apiUrl }));
      }
      const { token, source } = credentials.value;
      const endpoint = `${method} ${path}`;
      const decode = Schema.decodeUnknownEffect(schema);

      let httpRequest = HttpClientRequest.make(method)(
        `${session.apiUrl}${path}`,
      ).pipe(
        HttpClientRequest.setUrlParams(toUrlParams(options.query)),
        HttpClientRequest.bearerToken(Redacted.value(token)),
        HttpClientRequest.acceptJson,
      );
      if (options.body !== undefined) {
        httpRequest = HttpClientRequest.bodyJsonUnsafe(
          httpRequest,
          options.body,
        );
      }

      const attempt = Effect.gen(function* () {
        const response = yield* client.execute(httpRequest).pipe(
          Effect.timeout(REQUEST_TIMEOUT),
          Effect.mapError(
            (error) =>
              new ServerUnreachable({
                apiUrl: session.apiUrl,
                reason:
                  error._tag === "TimeoutError"
                    ? "timed out after 15s"
                    : describeTransportError(error),
              }),
          ),
        );
        if (response.status >= 200 && response.status < 300) {
          const json = yield* response.json.pipe(
            Effect.mapError(
              () =>
                new UnexpectedResponse({
                  endpoint,
                  detail: "the body is not JSON",
                }),
            ),
          );
          return yield* decode(options.raw ? json : sanitizeDeep(json)).pipe(
            Effect.mapError(
              (error) =>
                new UnexpectedResponse({
                  endpoint,
                  detail: error.message.split("\n")[0] ?? "schema mismatch",
                }),
            ),
          );
        }
        const text = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
        const failure = toApiFailure({
          status: response.status,
          body: parseErrorBody(text, response.status),
          retryAfterSeconds: parseRetryAfter(
            response.headers["retry-after"],
            Date.now(),
          ),
          tokenSource: source,
          apiUrl: session.apiUrl,
        });
        if (failure._tag === "SessionExpired" && path !== "/api/user/me") {
          if (yield* sessionStillValid(token)) {
            return yield* new PermissionDenied({
              message: parseErrorBody(text, response.status).message,
              missingPermissions: [],
            });
          }
        }
        if (failure._tag === "SessionExpired") yield* forgetStoredToken;
        return yield* Effect.fail(failure);
      });

      return attempt.pipe(
        Effect.retry({ schedule: rateLimitRetry, while: isRetryable }),
      );
    };

    return { request };
  }),
);

export const KaneoApiLive = KaneoApiLayer.pipe(
  Layer.provide(FetchHttpClient.layer),
);
