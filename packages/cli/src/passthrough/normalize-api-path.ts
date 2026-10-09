import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

export type ApiTarget = {
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
};

export function normalizeApiPath(
  input: string,
): Result.Result<ApiTarget, InvalidArgument> {
  const trimmed = input.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return Result.fail(
      new InvalidArgument({
        message: `${trimmed} is a full URL.`,
        hint: "Pass the path under /api, for example /task/assigned. Use --api-url to pick the server.",
      }),
    );
  }
  const [pathPart = "", ...rest] = trimmed.split("?");
  const withSlash = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const relative =
    withSlash === "/api" || withSlash.startsWith("/api/")
      ? withSlash.slice(4)
      : withSlash;
  const query: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(rest.join("?"))) {
    query[key] = value;
  }
  return Result.succeed({
    path: `/api${relative === "" ? "/" : relative}`,
    query,
  });
}
