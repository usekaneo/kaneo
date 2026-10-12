import { Data } from "effect";

export class NotSignedIn extends Data.TaggedError("NotSignedIn")<{
  readonly apiUrl: string;
}> {}

export class SessionExpired extends Data.TaggedError("SessionExpired")<{
  readonly apiUrl: string;
}> {}

export class CredentialsRejected extends Data.TaggedError(
  "CredentialsRejected",
)<{
  readonly source: "flag" | "env";
}> {}

export class SessionRequired extends Data.TaggedError("SessionRequired")<{
  readonly message: string;
}> {}

export class PermissionDenied extends Data.TaggedError("PermissionDenied")<{
  readonly message: string;
  readonly missingPermissions: ReadonlyArray<string>;
}> {}

export class NotFound extends Data.TaggedError("NotFound")<{
  readonly message: string;
}> {}

export class Conflict extends Data.TaggedError("Conflict")<{
  readonly message: string;
}> {}

export class InvalidRequest extends Data.TaggedError("InvalidRequest")<{
  readonly message: string;
}> {}

export class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly retryAfterSeconds: number | null;
}> {}

export class ServerError extends Data.TaggedError("ServerError")<{
  readonly status: number;
  readonly message: string;
}> {}

export class ServerUnreachable extends Data.TaggedError("ServerUnreachable")<{
  readonly apiUrl: string;
  readonly reason: string;
}> {}

export class UnexpectedResponse extends Data.TaggedError("UnexpectedResponse")<{
  readonly endpoint: string;
  readonly detail: string;
}> {}

export class WorkspaceRequired extends Data.TaggedError(
  "WorkspaceRequired",
)<{}> {}

export class ProjectRequired extends Data.TaggedError("ProjectRequired")<{}> {}

export class ProjectNotFound extends Data.TaggedError("ProjectNotFound")<{
  readonly query: string;
  readonly source: string | null;
}> {}

export class DeviceClientRejected extends Data.TaggedError(
  "DeviceClientRejected",
)<{
  readonly apiUrl: string;
  readonly clientId: string;
}> {}

export class DeviceLoginDenied extends Data.TaggedError(
  "DeviceLoginDenied",
)<{}> {}

export class DeviceLoginExpired extends Data.TaggedError(
  "DeviceLoginExpired",
)<{}> {}

export class ConfigUnreadable extends Data.TaggedError("ConfigUnreadable")<{
  readonly path: string;
  readonly reason: "foreign" | "invalid" | "io";
  readonly detail: string;
}> {}

export class InvalidArgument extends Data.TaggedError("InvalidArgument")<{
  readonly message: string;
  readonly hint?: string;
}> {}

export class Cancelled extends Data.TaggedError("Cancelled")<{}> {}

export type ApiFailure =
  | NotSignedIn
  | SessionExpired
  | CredentialsRejected
  | SessionRequired
  | PermissionDenied
  | NotFound
  | Conflict
  | InvalidRequest
  | RateLimited
  | ServerError
  | ServerUnreachable
  | UnexpectedResponse
  | ConfigUnreadable;

export type AppError =
  | ApiFailure
  | WorkspaceRequired
  | ProjectRequired
  | ProjectNotFound
  | DeviceClientRejected
  | DeviceLoginDenied
  | DeviceLoginExpired
  | InvalidArgument
  | Cancelled;
