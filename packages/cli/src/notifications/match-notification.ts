import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

const MIN_PREFIX = 4;
const FULL_ID_LENGTH = 20;

export function matchNotificationId(
  known: ReadonlyArray<string>,
  reference: string,
): Result.Result<string, InvalidArgument> {
  const wanted = reference.trim();
  if (known.includes(wanted)) return Result.succeed(wanted);
  const matches =
    wanted.length >= MIN_PREFIX
      ? known.filter((id) => id.startsWith(wanted))
      : [];
  const [only] = matches;
  if (matches.length === 1 && only) return Result.succeed(only);
  if (matches.length > 1) {
    return Result.fail(
      new InvalidArgument({
        message: `"${wanted}" matches ${matches.length} notifications.`,
        hint: "Type more of the id.",
      }),
    );
  }
  if (wanted.length >= FULL_ID_LENGTH) return Result.succeed(wanted);
  return Result.fail(
    new InvalidArgument({
      message: `No recent notification matches "${wanted}".`,
      hint: "Run kaneo notification list to see the ids.",
    }),
  );
}
