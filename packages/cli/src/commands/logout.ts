import { Effect, Option, Redacted, Schema } from "effect";
import { Command } from "effect/cli";
import { KaneoApi } from "../api/kaneo-api.js";
import { ConfigStore } from "../config/config-store.js";
import { withProfile } from "../config/format.js";
import { emit } from "../output/emit.js";
import type { Ui } from "../render/ui.js";
import { Session } from "../services/session.js";
import { ApiLayer } from "./api-layer.js";

type LogoutResult = {
  readonly loggedOut: boolean;
  readonly apiUrl: string;
  readonly profile: string;
  readonly apiKeyStillSet: boolean;
};

export function renderLogout(ui: Ui, result: LogoutResult): string[] {
  const { theme, glyphs } = ui;
  const host = new URL(result.apiUrl).host;
  const lines = result.loggedOut
    ? [`  ${theme.success(glyphs.tick)} Signed out of ${host}`]
    : [`  ${theme.muted(glyphs.dot)} You were not signed in to ${host}`];
  if (result.apiKeyStillSet) {
    lines.push(
      `  ${theme.warning(glyphs.warning)} KANEO_API_KEY is still set, so commands keep using it.`,
    );
  }
  return lines;
}

export const runLogout = Effect.fn("command.logout")(function* () {
  const session = yield* Session;
  const store = yield* ConfigStore;
  const api = yield* KaneoApi;
  const token = session.profile?.token;

  if (token) {
    yield* api
      .request("POST", "/api/auth/sign-out", Schema.Unknown, {
        body: {},
        credentials: { token: Redacted.make(token), source: "profile" },
      })
      .pipe(Effect.ignore);
    yield* store.save(
      withProfile(session.config, session.profileName, (profile) => {
        const { token: _token, ...rest } = profile ?? {
          apiUrl: session.apiUrl,
        };
        return rest;
      }),
    );
  }

  yield* emit<LogoutResult>(
    {
      loggedOut: Boolean(token),
      apiUrl: session.apiUrl,
      profile: session.profileName,
      apiKeyStillSet:
        Option.getOrUndefined(session.credentials)?.source === "env",
    },
    renderLogout,
  );
});

export const logout = Command.make("logout", {}, () => runLogout()).pipe(
  Command.withDescription("Sign out and forget the stored token"),
  Command.provide(ApiLayer),
);
