const smtpErrorCodes = new Set([
  "EAUTH",
  "ECONNECTION",
  "EDNS",
  "EENVELOPE",
  "EMESSAGE",
  "ESOCKET",
  "ESTREAM",
  "ETIMEDOUT",
  "ETLS",
]);

// SMTP messages, responses, commands, and stacks can contain addresses,
// credentials or mail content. Only log known categories and numeric status.
export function getSmtpErrorDetails(error: unknown) {
  const details = error && typeof error === "object" ? error : {};
  const code = "code" in details ? details.code : undefined;
  const responseCode =
    "responseCode" in details ? details.responseCode : undefined;
  return {
    code:
      typeof code === "string" && smtpErrorCodes.has(code) ? code : "UNKNOWN",
    ...(typeof responseCode === "number" &&
    Number.isInteger(responseCode) &&
    responseCode >= 400 &&
    responseCode <= 599
      ? { responseCode }
      : {}),
  };
}
