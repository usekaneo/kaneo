import { describe, expect, it } from "vite-plus/test";
import {
  describeImportError,
  type ImportErrorContext,
  sanitizeImportMessage,
} from "./describe-import-error";

class SourceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SourceHttpError";
  }
}

const context: ImportErrorContext = {
  sourceName: "PLANKA",
  credentialHint: "Check the API key.",
  failure: null,
  lastHost: "planka.example.com",
  secrets: ["super-secret-key"],
};

describe("describeImportError", () => {
  it("explains rejected credentials without the adapter's request path", () => {
    expect(
      describeImportError(
        new SourceHttpError("PLANKA /api/users/me: unauthorized", 401),
        context,
      ),
    ).toEqual({
      status: 400,
      message: "Could not sign in to PLANKA. Check the API key.",
    });
    expect(
      describeImportError(new SourceHttpError("forbidden", 403), {
        ...context,
        credentialHint: "Check the username and password.",
      }).message,
    ).toBe("Could not sign in to PLANKA. Check the username and password.");
  });

  it("reports unreachable hosts as a bad gateway", () => {
    expect(
      describeImportError(new Error("PLANKA /api: fetch failed"), {
        ...context,
        failure: { kind: "unreachable", host: "planka.lan:3000" },
      }),
    ).toEqual({
      status: 502,
      message: "Could not reach PLANKA at planka.lan:3000.",
    });
  });

  it("passes the destination check message through", () => {
    expect(
      describeImportError(new Error("wrapped"), {
        ...context,
        failure: {
          kind: "destination",
          message: "PLANKA destination resolves to a non-routable address",
        },
      }),
    ).toEqual({
      status: 400,
      message: "PLANKA destination resolves to a non-routable address",
    });
  });

  it("explains timeouts", () => {
    expect(
      describeImportError(
        new DOMException("The operation timed out.", "TimeoutError"),
        context,
      ),
    ).toEqual({
      status: 502,
      message: "PLANKA at planka.example.com took too long to answer.",
    });
  });

  it("maps upstream failures by status", () => {
    expect(describeImportError(new SourceHttpError("x", 503), context)).toEqual(
      {
        status: 502,
        message: "PLANKA returned an error (HTTP 503). Try again later.",
      },
    );
    expect(
      describeImportError(new SourceHttpError("x", 404), context).status,
    ).toBe(400);
    expect(
      describeImportError(new SourceHttpError("x", 429), context).status,
    ).toBe(502);
  });

  it("shows an adapter's own message without secrets or query strings", () => {
    expect(
      describeImportError(
        new Error(
          "Board not found at https://api.trello.com/1/boards/1?key=abc&token=super-secret-key for super-secret-key",
        ),
        context,
      ),
    ).toEqual({
      status: 400,
      message:
        "Board not found at https://api.trello.com/1/boards/1 for [redacted]",
    });
  });

  it("hides programming errors behind a generic message", () => {
    expect(
      describeImportError(
        new TypeError("Cannot read properties of undefined (reading 'id')"),
        context,
      ),
    ).toEqual({
      status: 502,
      message: "PLANKA sent a response Kaneo could not read.",
    });
    expect(describeImportError("boom", context).status).toBe(502);
  });
});

describe("sanitizeImportMessage", () => {
  it("refuses to show a message containing a short secret", () => {
    expect(sanitizeImportMessage("wrong pin 1234", ["1234"])).toBeNull();
  });

  it("caps long messages", () => {
    const message = sanitizeImportMessage("x".repeat(900), []);
    expect(message?.length).toBe(500);
    expect(message?.endsWith("...")).toBe(true);
  });
});
