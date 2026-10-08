import type { AppError } from "./errors.js";

export type Failure = {
  readonly message: string;
  readonly hint: string | null;
};

function host(apiUrl: string): string {
  try {
    return new URL(apiUrl).host;
  } catch {
    return apiUrl;
  }
}

export function describeError(error: AppError): Failure {
  switch (error._tag) {
    case "NotSignedIn":
      return {
        message: `You are not signed in to ${host(error.apiUrl)}.`,
        hint: "Run kaneo login, or set KANEO_API_KEY.",
      };
    case "SessionExpired":
      return {
        message: `Your session for ${host(error.apiUrl)} has expired.`,
        hint: "Run kaneo login to sign in again.",
      };
    case "CredentialsRejected":
      return error.source === "flag"
        ? {
            message: "The token passed with --token was rejected.",
            hint: "Check the token, or run kaneo login.",
          }
        : {
            message: "The API key in KANEO_API_KEY was rejected.",
            hint: "Create a new key in Settings, then API keys, or unset KANEO_API_KEY.",
          };
    case "SessionRequired":
      return {
        message: error.message,
        hint: "API keys cannot do this. Unset KANEO_API_KEY and run kaneo login.",
      };
    case "PermissionDenied":
      return {
        message:
          error.missingPermissions.length > 0
            ? `${error.message} (missing ${error.missingPermissions.join(", ")})`
            : error.message,
        hint: "Ask a workspace owner or admin for access.",
      };
    case "NotFound":
      return { message: error.message, hint: null };
    case "Conflict":
      return { message: error.message, hint: null };
    case "InvalidRequest":
      return { message: error.message, hint: null };
    case "RateLimited":
      return {
        message: "Too many requests to the Kaneo API.",
        hint:
          error.retryAfterSeconds === null
            ? "Wait a moment and try again."
            : `Try again in ${error.retryAfterSeconds}s.`,
      };
    case "ServerError":
      return {
        message: `The server failed with ${error.status}: ${error.message}`,
        hint: "Try again. If it keeps failing, check the server logs.",
      };
    case "ServerUnreachable":
      return {
        message: `Could not reach ${host(error.apiUrl)} (${error.reason}).`,
        hint: "Check your connection, or pass --api-url to use another server.",
      };
    case "UnexpectedResponse":
      return {
        message: `The server sent a response this CLI does not understand (${error.endpoint}): ${error.detail}`,
        hint: "Update the CLI with npm i -g @kaneo/cli, or check the server version.",
      };
    case "WorkspaceRequired":
      return {
        message: "No workspace selected.",
        hint: "Pass -w <id>, or run kaneo workspace use.",
      };
    case "ProjectRequired":
      return {
        message: "No project selected.",
        hint: "Pass -p with a project key or id, for example -p KAN.",
      };
    case "ProjectNotFound":
      return {
        message: error.source
          ? `No project matches "${error.query}" (from ${error.source}) in this workspace.`
          : `No project matches "${error.query}" in this workspace.`,
        hint: "Run kaneo project list to see the project keys.",
      };
    case "DeviceClientRejected":
      return {
        message: `${host(error.apiUrl)} does not allow browser sign-in from the Kaneo CLI (client ID ${error.clientId}).`,
        hint: `Ask the server admin to add ${error.clientId} to DEVICE_AUTH_CLIENT_IDS, or use an API key with KANEO_API_KEY.`,
      };
    case "DeviceLoginDenied":
      return {
        message: "The sign-in request was denied in the browser.",
        hint: "Run kaneo login to try again.",
      };
    case "DeviceLoginExpired":
      return {
        message: "The sign-in code expired before it was approved.",
        hint: "Run kaneo login to get a new code.",
      };
    case "ConfigUnreadable":
      return error.reason === "foreign"
        ? {
            message: `${error.path} was written by a different kaneo CLI, so it was left untouched.`,
            hint: "Move the file aside, or set KANEO_CONFIG to use another file.",
          }
        : {
            message: `Could not read ${error.path}: ${error.detail}`,
            hint:
              error.reason === "invalid"
                ? "Fix or delete the file, then run kaneo login."
                : null,
          };
    case "InvalidArgument":
      return { message: error.message, hint: error.hint ?? null };
    case "Cancelled":
      return { message: "Cancelled.", hint: null };
    default:
      return error satisfies never;
  }
}
