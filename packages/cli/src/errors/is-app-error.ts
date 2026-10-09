import type { AppError } from "./errors.js";

const TAGS: ReadonlySet<string> = new Set<AppError["_tag"]>([
  "NotSignedIn",
  "SessionExpired",
  "CredentialsRejected",
  "SessionRequired",
  "PermissionDenied",
  "NotFound",
  "Conflict",
  "InvalidRequest",
  "RateLimited",
  "ServerError",
  "ServerUnreachable",
  "UnexpectedResponse",
  "ConfigUnreadable",
  "WorkspaceRequired",
  "ProjectRequired",
  "ProjectNotFound",
  "DeviceClientRejected",
  "DeviceLoginDenied",
  "DeviceLoginExpired",
  "InvalidArgument",
  "Cancelled",
]);

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    TAGS.has((value as { _tag?: unknown })._tag as string)
  );
}
