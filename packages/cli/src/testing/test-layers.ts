import { Effect, Layer, Option, Redacted } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { ConfigStore, type ConfigStoreShape } from "../config/config-store.js";
import { type ConfigFile, emptyConfig } from "../config/format.js";
import { Output, type OutputShape } from "../output/output.js";
import { makeUi } from "../render/ui.js";
import {
  Session,
  type SessionShape,
  type TokenSource,
} from "../services/session.js";

export type RecordedRequest = {
  readonly method: string;
  readonly url: string;
  readonly authorization: string | undefined;
  readonly body: unknown;
};

export type Responder = (request: RecordedRequest) => Response;

export function fakeHttpClient(
  respond: Responder,
  recorded: RecordedRequest[] = [],
) {
  return Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) =>
      Effect.sync(() => {
        const body =
          request.body._tag === "Uint8Array"
            ? JSON.parse(new TextDecoder().decode(request.body.body))
            : undefined;
        const entry: RecordedRequest = {
          method: request.method,
          url: url.toString(),
          authorization: request.headers.authorization,
          body,
        };
        recorded.push(entry);
        return HttpClientResponse.fromWeb(request, respond(entry));
      }),
    ),
  );
}

export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function testSession(
  overrides: Partial<SessionShape> & {
    token?: string;
    tokenSource?: TokenSource;
  } = {},
) {
  const { token = "test-token", tokenSource = "profile", ...rest } = overrides;
  const session: SessionShape = {
    apiUrl: "https://kaneo.test",
    webUrl: "https://kaneo.test",
    profileName: "default",
    config: emptyConfig,
    configProblem: Option.none(),
    profile: undefined,
    credentials: Option.some({
      token: Redacted.make(token),
      source: tokenSource,
    }),
    workspace: Option.some({ id: "ws_1", source: "flag" }),
    project: Option.none(),
    repo: undefined,
    ...rest,
  };
  return Layer.succeed(Session, session);
}

export function memoryConfigStore(initial: ConfigFile = emptyConfig) {
  let current = initial;
  const store: ConfigStoreShape = {
    path: "/memory/config.json",
    load: Effect.sync(() => current),
    save: (config) =>
      Effect.sync(() => {
        current = config;
      }),
  };
  return { layer: Layer.succeed(ConfigStore, store), read: () => current };
}

export function captureOutput(
  mode: OutputShape["mode"] = "json",
  options: { readonly interactive?: boolean; readonly columns?: number } = {},
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const ui = makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns: options.columns ?? 80,
  });
  const output: OutputShape = {
    mode,
    ui,
    errUi: ui,
    interactive: options.interactive ?? false,
    out: (text) => Effect.sync(() => void stdout.push(text)),
    err: (text) => Effect.sync(() => void stderr.push(text)),
  };
  return { layer: Layer.succeed(Output, output), stdout, stderr };
}
