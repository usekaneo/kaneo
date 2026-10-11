import type { FetchLike } from "@kaneo/importers";
import {
  assertPublicDestination,
  nonRoutableDestinationMessage,
} from "../utils/assert-public-destination";
import { withoutOutboundTelemetry } from "../utils/sensitive-outbound";
import { isBlockedDestinationError } from "./blocked-destination-error";
import { destinationFetch } from "./destination-fetch";

export const MAX_IMPORT_REDIRECTS = 3;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const HEADERS_KEPT_ACROSS_SITES = new Set([
  "accept",
  "accept-language",
  "content-type",
  "user-agent",
]);

export type GuardFailure =
  | { kind: "destination"; message: string }
  | { kind: "unreachable"; host: string };

export type GuardedFetch = {
  fetch: FetchLike;
  failure(): GuardFailure | null;
  lastHost(): string | null;
  reset(): void;
};

type GuardOptions = {
  cancelSignal?: AbortSignal;
  baseFetch?: FetchLike;
};

class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportDestinationError";
  }
}

function errorCode(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

function keepsCredentials(from: URL, to: URL) {
  return (
    from.origin === to.origin ||
    (from.protocol === "http:" &&
      to.protocol === "https:" &&
      from.hostname === to.hostname)
  );
}

function redirectInit(
  init: RequestInit,
  status: number,
  sameSite: boolean,
): RequestInit {
  const method = (init.method ?? "GET").toUpperCase();
  const becomesGet =
    (status === 303 && method !== "HEAD") ||
    ((status === 301 || status === 302) && method === "POST");

  const headers = new Headers(init.headers);
  if (!sameSite) {
    for (const name of [...headers.keys()]) {
      if (!HEADERS_KEPT_ACROSS_SITES.has(name)) headers.delete(name);
    }
  }
  if (becomesGet) headers.delete("content-type");

  return {
    ...init,
    headers,
    ...(becomesGet ? { method: "GET", body: undefined } : {}),
  };
}

export function createGuardedFetch(
  label: string,
  { cancelSignal, baseFetch = destinationFetch }: GuardOptions = {},
): GuardedFetch {
  let failure: GuardFailure | null = null;
  let lastHost: string | null = null;

  function fail(next: GuardFailure, message: string): never {
    failure = next;
    throw new GuardError(message);
  }

  async function checkDestination(url: URL) {
    lastHost = url.host;
    try {
      await assertPublicDestination(url.href, label);
    } catch (error) {
      if (errorCode(error)) {
        fail(
          { kind: "unreachable", host: url.host },
          `${label} at ${url.host} could not be resolved`,
        );
      }
      const message =
        error instanceof Error ? error.message : `${label} URL is not allowed`;
      fail({ kind: "destination", message }, message);
    }
  }

  function parse(input: string, base?: URL) {
    try {
      return new URL(input, base);
    } catch {
      const message = `Enter a valid ${label} URL.`;
      return fail({ kind: "destination", message }, message);
    }
  }

  const guarded: FetchLike = async (input, init = {}) => {
    let url = parse(input);
    let request = init;

    for (let redirects = 0; ; redirects++) {
      await checkDestination(url);

      let response: Response;
      try {
        response = await withoutOutboundTelemetry(() =>
          baseFetch(url.href, { ...request, redirect: "manual" }),
        );
      } catch (error) {
        if (isBlockedDestinationError(error)) {
          const message = nonRoutableDestinationMessage(label);
          fail({ kind: "destination", message }, message);
        }
        if (!cancelSignal?.aborted) {
          failure = { kind: "unreachable", host: url.host };
        }
        throw error;
      }

      const location = REDIRECT_STATUSES.has(response.status)
        ? response.headers.get("location")
        : null;
      if (!location) {
        failure = null;
        return response;
      }

      await response.body?.cancel().catch(() => {});
      if (redirects >= MAX_IMPORT_REDIRECTS) {
        const message = `${label} redirected too many times. Check the URL.`;
        fail({ kind: "destination", message }, message);
      }

      const next = parse(location, url);
      request = redirectInit(
        request,
        response.status,
        keepsCredentials(url, next),
      );
      url = next;
    }
  };

  return {
    fetch: guarded,
    failure: () => failure,
    lastHost: () => lastHost,
    reset: () => {
      failure = null;
    },
  };
}
