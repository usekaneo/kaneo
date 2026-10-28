import { Duration, Effect, Option, Redacted, Stream } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/http";
import { Session } from "../services/session.js";
import { resolveImageUrl, sendsToken } from "./image-url.js";

export type FetchedImage =
  | {
      readonly _tag: "Fetched";
      readonly url: string;
      readonly bytes: Uint8Array;
      readonly contentType: string;
    }
  | {
      readonly _tag: "Unavailable";
      readonly url: string;
      readonly reason: string;
    };

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT = Duration.seconds(15);
const MAX_REDIRECTS = 3;
const TOO_LARGE = "larger than 10 MB";

function unavailable(url: string, reason: string): FetchedImage {
  return { _tag: "Unavailable", url, reason };
}

function statusReason(status: number): string {
  if (status === 401 || status === 403) return "no access";
  if (status === 404) return "not found";
  return `HTTP ${status}`;
}

function redirectTarget(location: string | undefined, from: URL): URL | null {
  if (!location) return null;
  try {
    const next = new URL(location, from);
    return next.protocol === "http:" || next.protocol === "https:"
      ? next
      : null;
  } catch {
    return null;
  }
}

function concat(chunks: ReadonlyArray<Uint8Array>, total: number) {
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const readCapped = (response: HttpClientResponse.HttpClientResponse) =>
  Effect.gen(function* () {
    const state = { chunks: [] as Uint8Array[], total: 0, exceeded: false };
    yield* response.stream.pipe(
      Stream.runForEachWhile((chunk) =>
        Effect.sync(() => {
          state.total += chunk.byteLength;
          if (state.total > MAX_IMAGE_BYTES) {
            state.exceeded = true;
            return false;
          }
          state.chunks.push(chunk);
          return true;
        }),
      ),
    );
    return state.exceeded ? null : concat(state.chunks, state.total);
  });

export const fetchImage = Effect.fnUntraced(function* (raw: string) {
  const session = yield* Session;
  const client = yield* HttpClient.HttpClient;
  const resolved = resolveImageUrl(raw, session.apiUrl);
  if (resolved === null) return unavailable(raw, "unsupported link");
  const href = resolved.href;
  const token = Option.getOrUndefined(session.credentials)?.token;

  const load = (url: URL, hops: number): Effect.Effect<FetchedImage, unknown> =>
    Effect.gen(function* () {
      let request = HttpClientRequest.get(url).pipe(
        HttpClientRequest.accept("image/*"),
      );
      if (token && sendsToken(url, session.apiUrl)) {
        request = HttpClientRequest.bearerToken(request, Redacted.value(token));
      }
      const response = yield* client.execute(request);
      if (response.status >= 300 && response.status < 400) {
        const next = redirectTarget(response.headers.location, url);
        if (next === null || hops >= MAX_REDIRECTS) {
          return unavailable(href, "redirected too often");
        }
        return yield* load(next, hops + 1);
      }
      if (response.status < 200 || response.status >= 300) {
        return unavailable(href, statusReason(response.status));
      }
      const contentType = (response.headers["content-type"] ?? "")
        .split(";")[0]
        ?.trim()
        .toLowerCase();
      if (!contentType?.startsWith("image/")) {
        return unavailable(href, "not an image");
      }
      if (Number(response.headers["content-length"]) > MAX_IMAGE_BYTES) {
        return unavailable(href, TOO_LARGE);
      }
      const bytes = yield* readCapped(response);
      if (bytes === null) return unavailable(href, TOO_LARGE);
      return { _tag: "Fetched", url: href, bytes, contentType } as const;
    });

  return yield* load(resolved, 0).pipe(
    Effect.timeout(FETCH_TIMEOUT),
    Effect.catch((error) =>
      Effect.succeed(
        unavailable(
          href,
          (error as { _tag?: unknown })._tag === "TimeoutError"
            ? "timed out"
            : "could not load",
        ),
      ),
    ),
    Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }),
  );
});
