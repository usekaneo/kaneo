import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

type JsonObject = Record<string, unknown>;

function splitAssignment(
  raw: string,
  flag: string,
): Result.Result<readonly [string, string], InvalidArgument> {
  const index = raw.indexOf("=");
  const key = index === -1 ? "" : raw.slice(0, index).trim();
  if (key === "") {
    return Result.fail(
      new InvalidArgument({
        message: `${flag} ${raw} is not a key=value pair.`,
        hint: `Pass it as key=value, for example ${flag} title=Hello.`,
      }),
    );
  }
  return Result.succeed([key, raw.slice(index + 1)] as const);
}

export function parseFieldValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function setOwn(target: JsonObject, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

export function parseFields(
  fields: ReadonlyArray<string>,
): Result.Result<JsonObject, InvalidArgument> {
  const body: JsonObject = {};
  for (const raw of fields) {
    const pair = splitAssignment(raw, "-f");
    if (Result.isFailure(pair)) return Result.fail(pair.failure);
    const [key, value] = pair.success;
    const segments = key.split(".");
    if (segments.some((segment) => segment === "")) {
      return Result.fail(
        new InvalidArgument({
          message: `-f ${raw} has an empty key segment.`,
          hint: "Nest keys with dots, for example -f settings.color=blue.",
        }),
      );
    }
    let target = body;
    for (const segment of segments.slice(0, -1)) {
      const existing = Object.hasOwn(target, segment)
        ? target[segment]
        : undefined;
      if (existing === undefined) {
        const next: JsonObject = {};
        setOwn(target, segment, next);
        target = next;
      } else if (isObject(existing)) {
        target = existing;
      } else {
        return Result.fail(
          new InvalidArgument({
            message: `-f ${raw} conflicts with an earlier value for ${segment}.`,
          }),
        );
      }
    }
    setOwn(
      target,
      segments[segments.length - 1] ?? key,
      parseFieldValue(value),
    );
  }
  return Result.succeed(body);
}

export function parseQuery(
  pairs: ReadonlyArray<string>,
): Result.Result<Record<string, string>, InvalidArgument> {
  const query: Record<string, string> = {};
  for (const raw of pairs) {
    const pair = splitAssignment(raw, "--query");
    if (Result.isFailure(pair)) return Result.fail(pair.failure);
    setOwn(query, pair.success[0], pair.success[1]);
  }
  return Result.succeed(query);
}
