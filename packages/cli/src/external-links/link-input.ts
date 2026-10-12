import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

export const MAX_LINK_TITLE = 200;

export function validateLinkUrl(
  input: string,
): Result.Result<string, InvalidArgument> {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return Result.fail(
      new InvalidArgument({
        message: `"${trimmed}" is not a URL.`,
        hint: "Pass a full address, for example https://example.com/spec.",
      }),
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return Result.fail(
      new InvalidArgument({
        message: `Links must use http or https, not ${url.protocol.replace(":", "")}.`,
      }),
    );
  }
  return Result.succeed(trimmed);
}

export function validateLinkTitle(
  input: string,
): Result.Result<string | undefined, InvalidArgument> {
  const trimmed = input.trim();
  if (trimmed === "") return Result.succeed(undefined);
  return Array.from(trimmed).length > MAX_LINK_TITLE
    ? Result.fail(
        new InvalidArgument({
          message: `The title is longer than ${MAX_LINK_TITLE} characters.`,
        }),
      )
    : Result.succeed(trimmed);
}
