import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function parseEmails(
  inputs: ReadonlyArray<string>,
): Result.Result<ReadonlyArray<string>, InvalidArgument> {
  const emails = inputs
    .flatMap((input) => input.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const invalid = emails.filter((email) => !EMAIL.test(email));
  if (invalid.length > 0) {
    return Result.fail(
      new InvalidArgument({
        message:
          invalid.length === 1
            ? `"${invalid[0]}" is not an email address.`
            : `These are not email addresses: ${invalid.join(", ")}.`,
        hint: "Pass addresses such as grace@example.com, separated by spaces.",
      }),
    );
  }
  if (emails.length === 0) {
    return Result.fail(
      new InvalidArgument({
        message: "Who should be invited?",
        hint: "Pass one or more email addresses, for example kaneo member invite grace@example.com.",
      }),
    );
  }
  return Result.succeed([...new Set(emails)]);
}
