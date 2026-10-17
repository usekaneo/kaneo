import { Effect, Option } from "effect";
import { Argument, Command } from "effect/cli";
import { ConfigStore } from "../../config/config-store.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit, note } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { pick } from "../../prompts/pick.js";
import type { Ui } from "../../render/ui.js";
import { CliEnvironment } from "../../services/cli-environment.js";
import { ApiLayer } from "../api-layer.js";
import {
  listProfiles,
  type ProfileJson,
  toProfileJson,
  useProfile,
} from "./profile-config.js";

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function renderProfileUsed(
  ui: Ui,
  result: { readonly profile: ProfileJson },
): string[] {
  const { theme, glyphs } = ui;
  const { profile } = result;
  const user = profile.user
    ? ` ${theme.muted(glyphs.separator)} ${profile.user.name}`
    : "";
  return [
    `  ${theme.success(glyphs.tick)} Using profile ${theme.strong(profile.name)} ${theme.muted(glyphs.separator)} ${host(profile.apiUrl)}${user}`,
  ];
}

export const runProfileUse = Effect.fn("command.profile.use")(
  function* (options: { readonly name: Option.Option<string> }) {
    const store = yield* ConfigStore;
    const output = yield* Output;
    const environment = yield* CliEnvironment;
    const config = yield* store.load;
    const names = Object.keys(config.profiles);

    if (names.length === 0) {
      return yield* new InvalidArgument({
        message: "There are no stored logins yet.",
        hint: "Run kaneo login to add one.",
      });
    }
    const name = Option.isSome(options.name)
      ? options.name.value
      : output.interactive
        ? yield* pick(
            "Switch to which profile?",
            listProfiles(config, config.activeProfile).map((profile) => ({
              title: profile.name,
              value: profile.name,
              description: profile.user
                ? `${host(profile.apiUrl)} ${output.ui.glyphs.separator} ${profile.user.email}`
                : host(profile.apiUrl),
            })),
          )
        : yield* new InvalidArgument({
            message: "Which profile should be used?",
            hint: `Pass its name, for example kaneo profile use ${names[0]}. Run kaneo profile list to see them.`,
          });

    const updated = useProfile(config, name);
    const profile = updated?.profiles[name];
    if (!updated || !profile) {
      return yield* new InvalidArgument({
        message: `There is no profile named "${name}".`,
        hint: `Stored profiles: ${names.join(", ")}.`,
      });
    }
    yield* store.save(updated);
    yield* emit(
      { profile: toProfileJson(name, profile, true) },
      renderProfileUsed,
    );

    const override = environment.env.KANEO_PROFILE?.trim();
    if (override && override !== name) {
      yield* note((ui) => [
        `  ${ui.theme.warning(ui.glyphs.warning)} KANEO_PROFILE is set to ${override} and is used instead until you unset it.`,
        "",
      ]);
    }
  },
);

export const profileUse = Command.make(
  "use",
  {
    name: Argument.String("name").pipe(
      Argument.withDescription("Profile name"),
      Argument.optional,
    ),
  },
  (options) => runProfileUse(options),
).pipe(
  Command.withDescription("Switch the stored login your commands use"),
  Command.provide(ApiLayer),
);
