import { describe, expect, it } from "vite-plus/test";
import { describeError } from "./describe.js";
import * as Errors from "./errors.js";
import { isAppError } from "./is-app-error.js";

const samples = [
  new Errors.NotSignedIn({ apiUrl: "https://cloud.kaneo.app" }),
  new Errors.SessionExpired({ apiUrl: "https://cloud.kaneo.app" }),
  new Errors.CredentialsRejected({ source: "env" }),
  new Errors.SessionRequired({ message: "A user session is required" }),
  new Errors.PermissionDenied({
    message: "Insufficient permissions",
    missingPermissions: ["task:delete"],
  }),
  new Errors.NotFound({ message: "Task not found" }),
  new Errors.Conflict({ message: "Conflict" }),
  new Errors.InvalidRequest({ message: "title: Required" }),
  new Errors.RateLimited({ retryAfterSeconds: 30 }),
  new Errors.ServerError({ status: 500, message: "Internal Server Error" }),
  new Errors.ServerUnreachable({
    apiUrl: "https://cloud.kaneo.app",
    reason: "ENOTFOUND",
  }),
  new Errors.UnexpectedResponse({
    endpoint: "GET /api/x",
    detail: "Expected string",
  }),
  new Errors.ConfigUnreadable({
    path: "/c.json",
    reason: "foreign",
    detail: "",
  }),
  new Errors.WorkspaceRequired(),
  new Errors.ProjectRequired(),
  new Errors.ProjectNotFound({ query: "XYZ", source: null }),
  new Errors.DeviceClientRejected({
    apiUrl: "https://cloud.kaneo.app",
    clientId: "kaneo-cli",
  }),
  new Errors.DeviceLoginDenied(),
  new Errors.DeviceLoginExpired(),
  new Errors.InvalidArgument({ message: "Bad", hint: "Pass --x" }),
  new Errors.Cancelled(),
];

describe("describeError", () => {
  it("has a message for every error and is recognized as an app error", () => {
    for (const error of samples) {
      expect(isAppError(error)).toBe(true);
      expect(describeError(error).message.length).toBeGreaterThan(0);
    }
  });

  it("points to the next step", () => {
    expect(
      describeError(
        new Errors.NotSignedIn({ apiUrl: "https://cloud.kaneo.app" }),
      ),
    ).toEqual({
      message: "You are not signed in to cloud.kaneo.app.",
      hint: "Run kaneo login, or set KANEO_API_KEY.",
    });
    expect(describeError(new Errors.WorkspaceRequired()).hint).toBe(
      "Pass -w <id>, or run kaneo workspace use.",
    );
  });

  it("lists missing permissions", () => {
    expect(describeError(samples[4] as Errors.PermissionDenied).message).toBe(
      "Insufficient permissions (missing task:delete)",
    );
  });

  it("never treats arbitrary objects as app errors", () => {
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError({ _tag: "Other" })).toBe(false);
  });
});
