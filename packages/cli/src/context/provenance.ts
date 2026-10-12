import { normalizeBaseUrl } from "@kaneo/mcp/normalize-base-url";
import { Option, Redacted } from "effect";
import { resolveSession, type SessionInputs } from "../services/session.js";

export type ServerSource = "flag" | "env" | "profile" | "default";
export type WebSource = "env" | "profile" | "server";
export type ProfileSource = "flag" | "env" | "config" | "default";
export type AuthSource = "flag" | "env" | "profile" | "none";
export type WorkspaceSource = "flag" | "env" | "repo" | "profile" | "none";
export type ProjectSource = "env" | "repo" | "none";

export type Provenance = {
  readonly server: { readonly url: string; readonly source: ServerSource };
  readonly web: { readonly url: string; readonly source: WebSource };
  readonly profile: {
    readonly name: string;
    readonly source: ProfileSource;
    readonly stored: boolean;
    readonly matchesServer: boolean;
  };
  readonly auth: {
    readonly method: "token" | "api-key" | "login" | null;
    readonly source: AuthSource;
    readonly fingerprint: string | null;
  };
  readonly workspace: {
    readonly id: string | null;
    readonly source: WorkspaceSource;
    readonly path: string | null;
  };
  readonly project: {
    readonly ref: string | null;
    readonly source: ProjectSource;
    readonly path: string | null;
  };
};

function filled(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== "";
}

export function fingerprint(token: string): string | null {
  return token.length >= 12 ? token.slice(-4) : null;
}

const AUTH_METHODS = {
  flag: "token",
  env: "api-key",
  profile: "login",
} as const;

export function buildProvenance(inputs: SessionInputs): Provenance {
  const session = resolveSession(inputs);
  const { flags, env, config, repo } = inputs;
  const stored = config.profiles[session.profileName];

  const profileSource: ProfileSource = Option.isSome(flags.profile)
    ? "flag"
    : filled(env.KANEO_PROFILE)
      ? "env"
      : Object.keys(config.profiles).length > 0 && filled(config.activeProfile)
        ? "config"
        : "default";

  const serverSource: ServerSource = Option.isSome(flags.apiUrl)
    ? "flag"
    : filled(env.KANEO_API_URL)
      ? "env"
      : stored
        ? "profile"
        : "default";

  const webSource: WebSource = env.KANEO_WEB_URL
    ? "env"
    : session.profile?.webUrl
      ? "profile"
      : "server";

  const credentials = Option.getOrUndefined(session.credentials);
  const workspace = Option.getOrUndefined(session.workspace);
  const project = Option.getOrUndefined(session.project);
  const projectFromEnv = project?.source === "KANEO_PROJECT";

  return {
    server: { url: session.apiUrl, source: serverSource },
    web: { url: session.webUrl, source: webSource },
    profile: {
      name: session.profileName,
      source: profileSource,
      stored: stored !== undefined,
      matchesServer:
        stored !== undefined &&
        normalizeBaseUrl(stored.apiUrl) === session.apiUrl,
    },
    auth: credentials
      ? {
          method: AUTH_METHODS[credentials.source],
          source: credentials.source,
          fingerprint: fingerprint(Redacted.value(credentials.token)),
        }
      : { method: null, source: "none", fingerprint: null },
    workspace: workspace
      ? {
          id: workspace.id,
          source: workspace.source,
          path: workspace.source === "repo" ? (repo?.path ?? null) : null,
        }
      : { id: null, source: "none", path: null },
    project: project
      ? {
          ref: project.ref,
          source: projectFromEnv ? "env" : "repo",
          path: projectFromEnv ? null : (repo?.path ?? null),
        }
      : { ref: null, source: "none", path: null },
  };
}
