import { existsSync } from "node:fs";
import { Effect, Option } from "effect";
import { Command } from "effect/cli";
import { FetchHttpClient } from "effect/http";
import { getCurrentUser, getWorkspace } from "../api/endpoints.js";
import { ConfigStore } from "../config/config-store.js";
import { missingOperations } from "../doctor/compare-operations.js";
import type { DoctorCheck } from "../doctor/doctor-check.js";
import { fetchPublic } from "../doctor/fetch-public.js";
import { renderDoctor } from "../doctor/render-doctor.js";
import { REQUIRED_OPERATIONS } from "../doctor/required-operations.js";
import { describeError } from "../errors/describe.js";
import { emit } from "../output/emit.js";
import { withSpinner } from "../output/spinner.js";
import { Session, type SessionShape } from "../services/session.js";
import { ApiLayer } from "./api-layer.js";

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const AUTH_LABELS = {
  flag: "--token",
  env: "KANEO_API_KEY",
  profile: "stored login",
} as const;

const WORKSPACE_SOURCES = {
  flag: "-w",
  env: "KANEO_WORKSPACE",
} as const;

function skipped(name: DoctorCheck["name"], reason: string): DoctorCheck {
  return { name, ok: false, detail: `Skipped because ${reason}` };
}

function checkConfig(session: SessionShape, path: string): DoctorCheck {
  if (Option.isSome(session.configProblem)) {
    return {
      name: "config",
      ok: false,
      detail: describeError(session.configProblem.value).message,
    };
  }
  return {
    name: "config",
    ok: true,
    detail: existsSync(path) ? path : `${path} (not created yet)`,
  };
}

const checkServer = Effect.fn("doctor.server")(function* (apiUrl: string) {
  const response = yield* Effect.result(fetchPublic(`${apiUrl}/api/health`));
  if (response._tag === "Failure") {
    return {
      name: "server",
      ok: false,
      detail: `Could not reach ${host(apiUrl)} (${response.failure})`,
    } satisfies DoctorCheck;
  }
  const { status, milliseconds } = response.success;
  return {
    name: "server",
    ok: status >= 200 && status < 300,
    detail:
      status >= 200 && status < 300
        ? `${host(apiUrl)} responded in ${milliseconds} ms`
        : `${host(apiUrl)} answered ${status} on /api/health`,
  } satisfies DoctorCheck;
});

const checkLogin = Effect.fn("doctor.login")(function* (session: SessionShape) {
  const credentials = Option.getOrUndefined(session.credentials);
  if (!credentials) {
    return {
      name: "login",
      ok: false,
      detail: "Not signed in. Run kaneo login, or set KANEO_API_KEY.",
    } satisfies DoctorCheck;
  }
  const user = yield* Effect.result(getCurrentUser());
  if (user._tag === "Failure") {
    return {
      name: "login",
      ok: false,
      detail: describeError(user.failure).message,
    } satisfies DoctorCheck;
  }
  return {
    name: "login",
    ok: true,
    detail: `${user.success.name} (${user.success.email}) with ${AUTH_LABELS[credentials.source]}`,
  } satisfies DoctorCheck;
});

const checkWorkspace = Effect.fn("doctor.workspace")(function* (
  session: SessionShape,
) {
  const selected = Option.getOrUndefined(session.workspace);
  if (!selected) {
    return {
      name: "workspace",
      ok: true,
      detail: "None selected. Commands ask for one, or pass -w.",
    } satisfies DoctorCheck;
  }
  const source =
    selected.source === "repo"
      ? (session.repo?.path ?? ".kaneo.json")
      : selected.source === "profile"
        ? `profile ${session.profileName}`
        : WORKSPACE_SOURCES[selected.source];
  const workspace = yield* Effect.result(getWorkspace(selected.id));
  if (workspace._tag === "Failure") {
    return {
      name: "workspace",
      ok: false,
      detail:
        workspace.failure._tag === "NotFound"
          ? `${selected.id} (from ${source}) was not found, or you are not a member`
          : describeError(workspace.failure).message,
    } satisfies DoctorCheck;
  }
  return {
    name: "workspace",
    ok: true,
    detail: `${workspace.success.name} (from ${source})`,
  } satisfies DoctorCheck;
});

const checkCompatibility = Effect.fn("doctor.compatibility")(function* (
  apiUrl: string,
) {
  const response = yield* Effect.result(fetchPublic(`${apiUrl}/api/openapi`));
  if (response._tag === "Failure") {
    return {
      name: "compatibility",
      ok: false,
      detail: `Could not load /api/openapi (${response.failure})`,
    } satisfies DoctorCheck;
  }
  const missing =
    response.success.status >= 200 && response.success.status < 300
      ? missingOperations(REQUIRED_OPERATIONS, response.success.body)
      : undefined;
  if (!missing) {
    return {
      name: "compatibility",
      ok: false,
      detail:
        "The server does not publish /api/openapi, so it is probably older than this CLI. Update the server.",
    } satisfies DoctorCheck;
  }
  const total = REQUIRED_OPERATIONS.length;
  if (missing.length === 0) {
    return {
      name: "compatibility",
      ok: true,
      detail: `All ${total} operations the CLI uses are available`,
    } satisfies DoctorCheck;
  }
  const listed = missing.map(
    (operation) => `${operation.method} ${operation.path}`,
  );
  return {
    name: "compatibility",
    ok: false,
    detail: `Missing ${missing.length} of ${total} operations. Update the server.`,
    missing: listed,
  } satisfies DoctorCheck;
});

export const runDoctor = Effect.fn("command.doctor")(function* () {
  const session = yield* Session;
  const store = yield* ConfigStore;

  const config = checkConfig(session, store.path);
  const server = yield* withSpinner(`Checking ${host(session.apiUrl)}`)(
    checkServer(session.apiUrl),
  );
  const [login, compatibility] = yield* withSpinner("Checking your account")(
    Effect.all(
      server.ok
        ? [checkLogin(session), checkCompatibility(session.apiUrl)]
        : [
            Effect.succeed(skipped("login", "the server is unreachable")),
            Effect.succeed(
              skipped("compatibility", "the server is unreachable"),
            ),
          ],
      { concurrency: 2 },
    ),
  );
  const workspace = login.ok
    ? yield* withSpinner("Checking the workspace")(checkWorkspace(session))
    : skipped(
        "workspace",
        server.ok ? "you are not signed in" : "the server is unreachable",
      );

  const checks: ReadonlyArray<DoctorCheck> = [
    config,
    server,
    login,
    workspace,
    compatibility,
  ];
  yield* emit({ checks }, renderDoctor);

  if (checks.some((check) => !check.ok)) {
    yield* Effect.sync(() => {
      process.exitCode = 1;
    });
  }
}, Effect.provide(FetchHttpClient.layer));

export const doctorCommand = Command.make("doctor", {}, () => runDoctor()).pipe(
  Command.withDescription("Check the server, your login and API compatibility"),
  Command.provide(ApiLayer),
);
