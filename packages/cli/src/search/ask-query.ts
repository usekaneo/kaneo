import { Effect } from "effect";
import { Prompt } from "effect/cli";
import { Cancelled } from "../errors/errors.js";
import { Output } from "../output/output.js";
import { themeCodes } from "../render/theme.js";

export const askQuery = Effect.fnUntraced(function* () {
  const output = yield* Output;
  const { glyphs, caps } = output.ui;
  const codes = themeCodes(caps.color);
  return yield* Prompt.run(
    Prompt.String({
      message: "Search for",
      validate: (value) =>
        value.trim() === ""
          ? Effect.fail("Type a few words to search for")
          : Effect.succeed(value.trim()),
      theme: {
        prefix: glyphs.diamond,
        tick: glyphs.tick,
        ellipsis: glyphs.ellipsis,
        primaryColor: codes.bold,
        mutedColor: codes.muted,
        successColor: codes.success,
        errorColor: codes.danger,
        submittedColor: "",
      },
    }),
  ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
});
