import { Effect, Option, Redacted } from "effect";
import { Command, Flag } from "effect/cli";
import { getCurrentUser, listWorkspaces } from "../api/endpoints.js";
import type { CurrentUser, Workspace } from "../api/schemas.js";
import {
  formatUserCode,
  waitForApproval,
  webUrlFromVerificationUri,
} from "../auth/wait-for-approval.js";
import { ConfigStore } from "../config/config-store.js";
import { withProfile } from "../config/format.js";
import { emit, note } from "../output/emit.js";
import { Output } from "../output/output.js";
import { withSpinner } from "../output/spinner.js";
import { pick } from "../prompts/pick.js";
import { box } from "../render/box.js";
import { logo } from "../render/logo.js";
import type { Ui } from "../render/ui.js";
import { Desktop } from "../services/desktop.js";
import { DeviceAuth } from "../services/device-auth.js";
import { type Credentials, Session } from "../services/session.js";
import { ApiLayer } from "./api-layer.js";

type LoginResult = {
  readonly user: CurrentUser;
  readonly apiUrl: string;
  readonly profile: string;
  readonly workspace: Workspace | null;
};

function host(url: string): string {
  return new URL(url).host;
}

export function renderDeviceCode(
  ui: Ui,
  details: {
    readonly apiUrl: string;
    readonly code: string;
    readonly url: string;
    readonly copied: boolean;
    readonly opened: boolean;
    readonly expiresInSeconds: number;
  },
): string[] {
  const { theme, glyphs } = ui;
  const spaced = details.code.split("").join(" ");
  const lines = [
    "",
    theme.muted("Enter this code in your browser"),
    "",
    `      ${theme.strong(spaced)}`,
    "",
    details.copied
      ? `${theme.success(glyphs.tick)} ${theme.muted("Copied to your clipboard")}`
      : theme.muted(
          `Expires in ${Math.max(1, Math.round(details.expiresInSeconds / 60))} minutes`,
        ),
    "",
  ];
  return [
    "",
    ...box(ui, lines, {
      title: `Sign in to ${host(details.apiUrl)}`,
      minWidth: 36,
    }).map((line) => `  ${line}`),
    "",
    details.opened
      ? `  ${theme.muted(glyphs.arrow)} Opened ${theme.info(details.url)}`
      : `  ${theme.muted(glyphs.arrow)} Open ${theme.info(details.url)}`,
    "",
  ];
}

export function renderWelcome(ui: Ui, result: LoginResult): string[] {
  const { theme, glyphs } = ui;
  const workspace = result.workspace
    ? result.workspace.name
    : theme.muted("none selected, run kaneo workspace use");
  return [
    "",
    ...logo(ui),
    "",
    `  ${theme.success(glyphs.tick)} Signed in as ${theme.strong(result.user.name)} ${theme.muted(glyphs.separator)} ${result.user.email}`,
    "",
    `    ${theme.muted("Server".padEnd(10))} ${host(result.apiUrl)}`,
    `    ${theme.muted("Workspace".padEnd(10))} ${workspace}`,
    "",
    `  ${theme.muted("Try")} ${theme.strong("kaneo task list")} ${theme.muted("or just")} ${theme.strong("kaneo")}`,
    "",
  ];
}

const chooseWorkspace = Effect.fn("login.chooseWorkspace")(function* (
  workspaces: ReadonlyArray<Workspace>,
  previous: string | undefined,
) {
  const output = yield* Output;
  const kept = workspaces.find((workspace) => workspace.id === previous);
  if (kept) return kept;
  const [only] = workspaces;
  if (workspaces.length === 1 && only) return only;
  if (workspaces.length > 1 && output.interactive) {
    return yield* pick(
      "Choose your default workspace",
      workspaces.map((workspace) => ({
        title: workspace.name,
        value: workspace,
        description: workspace.slug,
      })),
    );
  }
  return null;
});

export const runLogin = Effect.fn("command.login")(function* (options: {
  readonly browser: boolean;
}) {
  const session = yield* Session;
  const output = yield* Output;
  const device = yield* DeviceAuth;
  const desktop = yield* Desktop;
  const store = yield* ConfigStore;

  if (Option.isSome(session.configProblem)) {
    return yield* Effect.fail(session.configProblem.value);
  }

  const code = yield* withSpinner(`Connecting to ${host(session.apiUrl)}`)(
    device.requestCode(session.apiUrl),
  );
  const userCode = formatUserCode(code.user_code);
  const url = code.verification_uri_complete ?? code.verification_uri;
  const copied = output.interactive ? yield* desktop.copy(userCode) : false;
  const opened =
    output.interactive && options.browser ? yield* desktop.openUrl(url) : false;

  if (output.mode === "json") {
    yield* note(() => [`Open ${url} and enter the code ${userCode}`]);
  } else {
    yield* output.out(
      `${renderDeviceCode(output.ui, {
        apiUrl: session.apiUrl,
        code: userCode,
        url,
        copied,
        opened,
        expiresInSeconds: code.expires_in,
      }).join("\n")}\n`,
    );
  }

  const token = yield* withSpinner("Waiting for approval in your browser")(
    waitForApproval(session.apiUrl, code),
  );
  const credentials: Credentials = {
    token: Redacted.make(token),
    source: "profile",
  };
  const [user, workspaces] = yield* withSpinner("Loading your account")(
    Effect.all([getCurrentUser(credentials), listWorkspaces(credentials)], {
      concurrency: 2,
    }),
  );
  const workspace = yield* chooseWorkspace(
    workspaces,
    session.profile?.workspaceId,
  );
  const webUrl =
    webUrlFromVerificationUri(code.verification_uri) ?? session.apiUrl;

  yield* store.save(
    withProfile(session.config, session.profileName, () => ({
      apiUrl: session.apiUrl,
      webUrl,
      token,
      user: { id: user.id, name: user.name, email: user.email },
      ...(workspace ? { workspaceId: workspace.id } : {}),
    })),
  );

  yield* emit<LoginResult>(
    { user, apiUrl: session.apiUrl, profile: session.profileName, workspace },
    renderWelcome,
  );

  const overriding = Option.getOrUndefined(session.credentials)?.source;
  if (overriding === "env") {
    yield* note((ui) => [
      `  ${ui.theme.warning(ui.glyphs.warning)} KANEO_API_KEY is set and is used instead of this login until you unset it.`,
      "",
    ]);
  }
});

export const login = Command.make(
  "login",
  {
    noBrowser: Flag.Boolean("no-browser").pipe(
      Flag.withDescription(
        "Print the sign-in link instead of opening a browser",
      ),
      Flag.withDefault(false),
    ),
  },
  ({ noBrowser }) => runLogin({ browser: !noBrowser }),
).pipe(
  Command.withDescription("Sign in with your browser"),
  Command.provide(ApiLayer),
);
