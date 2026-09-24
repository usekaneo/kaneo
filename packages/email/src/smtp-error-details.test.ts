import { expect, it } from "vitest";
import { getSmtpErrorDetails } from "./smtp-error-details";

it("retains safe SMTP diagnostics and omits private fields", () => {
  expect(
    getSmtpErrorDetails({
      code: "EAUTH",
      responseCode: 535,
      response: "recipient@example.com",
      message: "password",
      command: "AUTH secret",
      stack: "token",
    }),
  ).toEqual({ code: "EAUTH", responseCode: 535 });
});

it.each([
  null,
  "private",
  new Error("private"),
  { code: "private-token", responseCode: "private-response" },
  { code: "private-token", responseCode: Number.POSITIVE_INFINITY },
])("does not pass arbitrary provider data through to logs: %j", (error) => {
  expect(getSmtpErrorDetails(error)).toEqual({ code: "UNKNOWN" });
});
