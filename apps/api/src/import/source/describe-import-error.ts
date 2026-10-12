import type { GuardFailure } from "../guarded-fetch";

export type ImportErrorContext = {
  sourceName: string;
  credentialHint: string;
  failure: GuardFailure | null;
  lastHost: string | null;
  secrets: readonly string[];
};

export type DescribedImportError = { status: 400 | 502; message: string };

const MAX_MESSAGE_LENGTH = 500;
const MIN_REDACTABLE_SECRET_LENGTH = 6;
const PROGRAMMING_ERRORS = new Set([
  "TypeError",
  "SyntaxError",
  "RangeError",
  "ReferenceError",
]);

function errorName(error: unknown) {
  return error instanceof Error || error instanceof DOMException
    ? error.name
    : null;
}

function sourceHttpStatus(error: unknown) {
  if (!(error instanceof Error) || error.name !== "SourceHttpError") {
    return null;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function describeHttpStatus(
  status: number,
  { sourceName, credentialHint }: ImportErrorContext,
): DescribedImportError {
  if (status === 401 || status === 403) {
    return {
      status: 400,
      message: `Could not sign in to ${sourceName}. ${credentialHint}`,
    };
  }
  if (status === 404) {
    return {
      status: 400,
      message: `${sourceName} could not find what Kaneo asked for (HTTP 404). Check the URL.`,
    };
  }
  if (status === 429) {
    return {
      status: 502,
      message: `${sourceName} is limiting requests. Try again in a few minutes.`,
    };
  }
  if (status >= 500) {
    return {
      status: 502,
      message: `${sourceName} returned an error (HTTP ${status}). Try again later.`,
    };
  }
  return {
    status: 400,
    message: `${sourceName} refused the request (HTTP ${status}).`,
  };
}

export function sanitizeImportMessage(
  message: string,
  secrets: readonly string[],
): string | null {
  let clean = message.replace(/(https?:\/\/[^\s?#]+)[?#]\S*/gi, "$1");
  for (const secret of secrets) {
    if (!secret || !clean.includes(secret)) continue;
    if (secret.length < MIN_REDACTABLE_SECRET_LENGTH) return null;
    clean = clean.split(secret).join("[redacted]");
  }
  clean = clean.trim();
  if (!clean) return null;
  return clean.length > MAX_MESSAGE_LENGTH
    ? `${clean.slice(0, MAX_MESSAGE_LENGTH - 3)}...`
    : clean;
}

export function describeImportError(
  error: unknown,
  context: ImportErrorContext,
): DescribedImportError {
  const { sourceName, failure, lastHost } = context;

  if (failure?.kind === "destination") {
    return { status: 400, message: failure.message };
  }
  if (failure?.kind === "unreachable") {
    return {
      status: 502,
      message: `Could not reach ${sourceName} at ${failure.host}.`,
    };
  }

  const name = errorName(error);
  if (name === "TimeoutError" || name === "AbortError") {
    return {
      status: 502,
      message: lastHost
        ? `${sourceName} at ${lastHost} took too long to answer.`
        : `${sourceName} took too long to answer.`,
    };
  }

  const httpStatus = sourceHttpStatus(error);
  if (httpStatus !== null) return describeHttpStatus(httpStatus, context);

  if (error instanceof Error && !PROGRAMMING_ERRORS.has(error.name)) {
    const message = sanitizeImportMessage(error.message, context.secrets);
    if (message) return { status: 400, message };
  }

  return {
    status: 502,
    message: `${sourceName} sent a response Kaneo could not read.`,
  };
}
