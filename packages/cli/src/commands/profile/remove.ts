import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { ConfigStore } from "../../config/config-store.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import type { Ui } from "../../render/ui.js";
import { ApiLayer } from "../api-layer.js";
import { removeProfile } from "./profile-config.js";
import { signOutProfile } from "./sign-out-profile.js";

type RemovedProfile = {
  readonly removed: string;
  readonly apiUrl: string;
  readonly signedOut: boolean;
  readonly activeProfile: string;
};

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function renderProfileRemoved(ui: Ui, result: RemovedProfile): string[] {
  const { theme, glyphs } = ui;
  const detail = result.signedOut
    ? ` ${theme.muted(`${glyphs.separator} signed out of ${host(result.apiUrl)}`)}`
    : "";
  return [
    `  ${theme.success(glyphs.tick)} Removed profile ${theme.strong(result.removed)}${detail}`,
  ];
}

export const runProfileRemove = Effect.fn("command.profile.remove")(
  function* (options: { readonly name: string; readonly yes: boolean }) {
    const store = yield* ConfigStore;
    const config = yield* store.load;
    const profile = config.profiles[options.name];
    const updated = removeProfile(config, options.name);
    if (!profile || !updated) {
      const names = Object.keys(config.profiles);
      return yield* new InvalidArgument({
        message: `There is no profile named "${options.name}".`,
        hint:
          names.length > 0
            ? `Stored profiles: ${names.join(", ")}.`
            : "There are no stored logins.",
      });
    }

    yield* confirmDestructive({
      yes: options.yes,
      action: `Removing the profile ${options.name}`,
      question: `Remove the stored login ${options.name} for ${host(profile.apiUrl)}?`,
    });

    const signedOut = profile.token
      ? yield* withSpinner(`Signing out of ${host(profile.apiUrl)}`)(
          signOutProfile(profile.apiUrl, profile.token),
        )
      : false;
    yield* store.save(updated);

    yield* emit<RemovedProfile>(
      {
        removed: options.name,
        apiUrl: profile.apiUrl,
        signedOut,
        activeProfile: updated.activeProfile,
      },
      renderProfileRemoved,
    );
  },
);

export const profileRemove = Command.make(
  "remove",
  {
    name: Argument.String("name").pipe(
      Argument.withDescription("Profile name"),
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Remove without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runProfileRemove(options),
).pipe(
  Command.withDescription("Sign out of a stored login and forget it"),
  Command.provide(ApiLayer),
);
