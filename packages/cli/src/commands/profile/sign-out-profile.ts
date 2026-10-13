import { normalizeBaseUrl } from "@kaneo/mcp/normalize-base-url";
import { Duration, Effect } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";

export const signOutProfile = (apiUrl: string, token: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.post(
      `${normalizeBaseUrl(apiUrl)}/api/auth/sign-out`,
    ).pipe(
      HttpClientRequest.bearerToken(token),
      HttpClientRequest.acceptJson,
      HttpClientRequest.bodyJsonUnsafe({}),
    );
    const response = yield* client
      .execute(request)
      .pipe(Effect.timeout(Duration.seconds(10)));
    return response.status >= 200 && response.status < 300;
  }).pipe(
    Effect.orElseSucceed(() => false),
    Effect.provide(FetchHttpClient.layer),
  );
