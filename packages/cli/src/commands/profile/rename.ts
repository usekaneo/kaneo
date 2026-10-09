import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { ConfigStore } from "../../config/config-store.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import type { Ui } from "../../render/ui.js";
import { ApiLayer } from "../api-layer.js";
import { renameProfile } from "./profile-config.js";

type RenamedProfileResult = {
  readonly from: string;
  readonly to: string;
  readonly active: boolean;
};

export function renderProfileRenamed(
  ui: Ui,
  result: RenamedProfileResult,
): string[] {
  const { theme, glyphs } = ui;
  return [
    `  ${theme.success(glyphs.tick)} Renamed profile ${result.from} to ${theme.strong(result.to)}`,
  ];
}

export const runProfileRename = Effect.fn("command.profile.rename")(
  function* (options: { readonly from: string; readonly to: string }) {
    const store = yield* ConfigStore;
    const to = options.to.trim();
    if (to === "" || /\s/.test(to)) {
      return yield* new InvalidArgument({
        message: "Profile names cannot be empty or contain spaces.",
        hint: "Use a short name such as work or acme.",
      });
    }
    const config = yield* store.load;
    const renamed = renameProfile(config, options.from, to);
    if (renamed.kind === "missing") {
      return yield* new InvalidArgument({
        message: `There is no profile named "${options.from}".`,
        hint: "Run kaneo profile list to see the stored profiles.",
      });
    }
    if (renamed.kind === "taken") {
      return yield* new InvalidArgument({
        message: `A profile named "${to}" already exists.`,
        hint: `Pick another name, or remove it first with kaneo profile remove ${to}.`,
      });
    }
    yield* store.save(renamed.config);
    yield* emit<RenamedProfileResult>(
      {
        from: options.from,
        to,
        active: renamed.config.activeProfile === to,
      },
      renderProfileRenamed,
    );
  },
);

export const profileRename = Command.make(
  "rename",
  {
    from: Argument.String("old").pipe(
      Argument.withDescription("Current profile name"),
    ),
    to: Argument.String("new").pipe(
      Argument.withDescription("New profile name"),
    ),
  },
  (options) => runProfileRename(options),
).pipe(
  Command.withDescription("Rename a stored login"),
  Command.provide(ApiLayer),
);
