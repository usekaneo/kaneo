import { createJsonClient, SourceHttpError } from "../http.js";
import type { FetchLike } from "../types.js";

export const LINEAR_API_URL = "https://api.linear.app";

export const INVALID_API_KEY_MESSAGE =
  "Linear rejected the API key. Create a personal API key under Settings > Account > Security & access and try again.";

export const RATE_LIMITED_MESSAGE =
  "Linear rate limit reached. Wait a few minutes and try the import again.";

const RATE_LIMIT_RESET_HEADERS = [
  "x-ratelimit-requests-reset",
  "x-ratelimit-complexity-reset",
];

export type LinearGraphQLError = {
  message?: string;
  extensions?: { code?: string; type?: string; statusCode?: number };
};

type GraphQLResponse<T> = {
  data?: T | null;
  errors?: LinearGraphQLError[];
};

export class LinearApiError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
  ) {
    super(message);
    this.name = "LinearApiError";
  }
}

export type LinearGraphQL = <T>(
  query: string,
  variables?: Record<string, unknown>,
) => Promise<T>;

export type LinearGraphQLOptions = {
  apiKey: string;
  fetch?: FetchLike;
  signal?: AbortSignal;
};

export function createLinearGraphQL(
  options: LinearGraphQLOptions,
): LinearGraphQL {
  const baseFetch: FetchLike =
    options.fetch ?? ((input, init) => fetch(input, init));
  const http = createJsonClient({
    service: "Linear",
    baseUrl: LINEAR_API_URL,
    headers: () => ({ Authorization: options.apiKey }),
    fetch: retryRateLimitedResponses(baseFetch),
    signal: options.signal,
    describeUnauthorized: INVALID_API_KEY_MESSAGE,
  });

  return async <T>(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> => {
    let response: GraphQLResponse<T> | null;
    try {
      response = await http.request<GraphQLResponse<T> | null>("/graphql", {
        method: "POST",
        body: JSON.stringify({ query, variables }),
      });
    } catch (error) {
      if (error instanceof SourceHttpError) throw fromHttpError(error);
      throw error;
    }

    const failure = firstError(response);
    if (failure) throw fromGraphQLError(failure);
    if (!response?.data) {
      throw new LinearApiError("Linear returned an empty response.", undefined);
    }
    return response.data;
  };
}

export function retryRateLimitedResponses(fetchImpl: FetchLike): FetchLike {
  return async (input, init) => {
    const res = await fetchImpl(input, init);
    if (res.status < 400 || res.status === 429) return res;

    const text = await res.text();
    const failure = firstError(parseJson(text));
    if (failure?.extensions?.code !== "RATELIMITED") {
      return new Response(text, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    }
    return new Response(text, {
      status: 429,
      headers: rateLimitHeaders(res.headers),
    });
  };
}

function rateLimitHeaders(source: Headers): Headers {
  const headers = new Headers({ "Content-Type": "application/json" });
  const retryAfter = source.get("retry-after");
  if (retryAfter) headers.set("Retry-After", retryAfter);

  const resets = RATE_LIMIT_RESET_HEADERS.map((name) => source.get(name))
    .filter((value): value is string => value !== null)
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (resets.length > 0) {
    headers.set("X-RateLimit-Reset", String(Math.max(...resets)));
  }
  return headers;
}

function fromHttpError(error: SourceHttpError): Error {
  if (error.status === 401) {
    return new LinearApiError(INVALID_API_KEY_MESSAGE, "AUTHENTICATION_ERROR");
  }
  const failure = firstError(error.body);
  return failure ? fromGraphQLError(failure) : error;
}

function fromGraphQLError(error: LinearGraphQLError): LinearApiError {
  const code = error.extensions?.code;
  if (
    code === "AUTHENTICATION_ERROR" ||
    error.extensions?.type === "authentication error"
  ) {
    return new LinearApiError(INVALID_API_KEY_MESSAGE, code);
  }
  if (code === "RATELIMITED") {
    return new LinearApiError(RATE_LIMITED_MESSAGE, code);
  }
  return new LinearApiError(
    `Linear: ${error.message?.trim() || "the request failed"}`,
    code,
  );
}

function firstError(body: unknown): LinearGraphQLError | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const first: unknown = errors[0];
  return typeof first === "object" && first !== null
    ? (first as LinearGraphQLError)
    : {};
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
