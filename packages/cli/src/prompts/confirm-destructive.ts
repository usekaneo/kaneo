import { Effect } from "effect";
import { Cancelled, InvalidArgument } from "../errors/errors.js";
import { Output } from "../output/output.js";
import { confirm } from "./confirm.js";

export const confirmDestructive = Effect.fnUntraced(function* (options: {
  readonly yes: boolean;
  readonly action: string;
  readonly question: string;
}) {
  if (options.yes) return;
  const output = yield* Output;
  if (!output.interactive) {
    return yield* new InvalidArgument({
      message: `${options.action} needs confirmation.`,
      hint: "Pass --yes to skip the prompt.",
    });
  }
  const confirmed = yield* confirm(options.question);
  if (!confirmed) return yield* new Cancelled();
});
