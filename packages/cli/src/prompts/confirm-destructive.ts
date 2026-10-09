import { Effect } from "effect";
import { Cancelled } from "../errors/errors.js";
import { Output } from "../output/output.js";
import { confirm } from "./confirm.js";
import { needsConfirmation } from "./needs-confirmation.js";

export const confirmDestructive = Effect.fnUntraced(function* (options: {
  readonly yes: boolean;
  readonly action: string;
  readonly question: string;
}) {
  if (options.yes) return;
  const output = yield* Output;
  if (!output.interactive) return yield* needsConfirmation(options.action);
  const confirmed = yield* confirm(options.question);
  if (!confirmed) return yield* new Cancelled();
});
