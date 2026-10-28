import { Effect, Option } from "effect";
import { Command } from "effect/cli";
import { getCurrentUser, getWorkspace } from "../api/endpoints.js";
import type { CurrentUser, Workspace } from "../api/schemas.js";
import { type Avatar, loadAvatar } from "../images/avatar.js";
import { placeAvatar } from "../images/avatar-layout.js";
import { emit } from "../output/emit.js";
import { withSpinner } from "../output/spinner.js";
import type { Ui } from "../render/ui.js";
import { type SessionShape, Session } from "../services/session.js";
import { ApiLayer } from "./api-layer.js";

type WhoamiResult = {
  readonly user: CurrentUser;
  readonly apiUrl: string;
  readonly profile: string;
  readonly auth: "token" | "api-key" | "login";
  readonly workspace: Workspace | null;
};

function authLabel(session: SessionShape): WhoamiResult["auth"] {
  const source = Option.getOrUndefined(session.credentials)?.source;
  if (source === "flag") return "token";
  if (source === "env") return "api-key";
  return "login";
}

function host(url: string): string {
  return new URL(url).host;
}

export function renderWhoami(
  ui: Ui,
  result: WhoamiResult,
  avatar: Avatar | null = null,
): string[] {
  const { theme, glyphs } = ui;
  const auth =
    result.auth === "api-key"
      ? "KANEO_API_KEY"
      : result.auth === "token"
        ? "--token"
        : `login (${result.profile})`;
  const rows: Array<[string, string]> = [
    ["Server", host(result.apiUrl)],
    ["Auth", auth],
    [
      "Workspace",
      result.workspace
        ? `${result.workspace.name} ${theme.muted(result.workspace.id)}`
        : theme.muted("none selected"),
    ],
  ];
  if (result.user.role?.split(",").includes("admin")) {
    rows.push(["Role", "Instance admin"]);
  }
  const lines = [
    "",
    `  ${theme.success(glyphs.tick)} ${theme.strong(result.user.name)} ${theme.muted(glyphs.separator)} ${result.user.email}`,
    "",
    ...rows.map(
      ([label, value]) => `    ${theme.muted(label.padEnd(10))} ${value}`,
    ),
    "",
  ];
  return placeAvatar(lines, avatar, ui.caps.columns);
}

export const runWhoami = Effect.fn("command.whoami")(function* () {
  const session = yield* Session;
  const user = yield* withSpinner("Checking your account")(getCurrentUser());
  const [workspace, avatar] = yield* Effect.all(
    [
      Option.isSome(session.workspace)
        ? getWorkspace(session.workspace.value.id).pipe(
            Effect.catchTag("NotFound", () => Effect.succeed(null)),
          )
        : Effect.succeed(null),
      loadAvatar(user.image),
    ],
    { concurrency: 2 },
  );
  yield* emit<WhoamiResult>(
    {
      user,
      apiUrl: session.apiUrl,
      profile: session.profileName,
      auth: authLabel(session),
      workspace,
    },
    (ui, result) => renderWhoami(ui, result, avatar),
  );
});

export const whoami = Command.make("whoami", {}, () => runWhoami()).pipe(
  Command.withDescription("Show the account and server you are using"),
  Command.provide(ApiLayer),
);
