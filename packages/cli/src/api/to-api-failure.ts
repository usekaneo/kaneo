import {
  type ApiFailure,
  Conflict,
  CredentialsRejected,
  InvalidRequest,
  NotFound,
  PermissionDenied,
  RateLimited,
  ServerError,
  SessionExpired,
  SessionRequired,
} from "../errors/errors.js";
import type { TokenSource } from "../services/session.js";
import type { ErrorBody } from "./error-body.js";

export type FailedResponse = {
  readonly status: number;
  readonly body: ErrorBody;
  readonly retryAfterSeconds: number | null;
  readonly tokenSource: TokenSource;
  readonly apiUrl: string;
};

export function toApiFailure(response: FailedResponse): ApiFailure {
  const { status, body } = response;
  if (status === 401) {
    return response.tokenSource === "profile"
      ? new SessionExpired({ apiUrl: response.apiUrl })
      : new CredentialsRejected({ source: response.tokenSource });
  }
  if (status === 403) {
    if (
      body.code === "SESSION_REQUIRED" ||
      /user session is required/i.test(body.message)
    ) {
      return new SessionRequired({ message: body.message });
    }
    return new PermissionDenied({
      message: body.message,
      missingPermissions: body.missingPermissions,
    });
  }
  if (status === 404) return new NotFound({ message: body.message });
  if (status === 409) return new Conflict({ message: body.message });
  if (status === 429) {
    return new RateLimited({ retryAfterSeconds: response.retryAfterSeconds });
  }
  if (status >= 500) return new ServerError({ status, message: body.message });
  return new InvalidRequest({ message: body.message });
}
