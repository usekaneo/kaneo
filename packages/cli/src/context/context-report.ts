import type { Capabilities } from "../render/capabilities.js";
import type { OutputMode } from "../output/output-mode.js";
import type { OutputSource } from "./output-provenance.js";
import type { Provenance } from "./provenance.js";

export type ConfigStatus = "ok" | "missing" | "foreign" | "invalid" | "io";

export type ContextReport = {
  readonly server: Provenance["server"];
  readonly web: Provenance["web"];
  readonly profile: Provenance["profile"];
  readonly auth: Provenance["auth"] & { readonly error: string | null };
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  } | null;
  readonly workspace: Provenance["workspace"] & {
    readonly name: string | null;
  };
  readonly project: Provenance["project"] & {
    readonly id: string | null;
    readonly key: string | null;
    readonly name: string | null;
  };
  readonly config: { readonly path: string; readonly status: ConfigStatus };
  readonly output: {
    readonly mode: OutputMode;
    readonly source: OutputSource;
    readonly jq: string | null;
    readonly interactive: boolean;
    readonly stdinIsTTY: boolean;
    readonly stdoutIsTTY: boolean;
    readonly stderrIsTTY: boolean;
    readonly terminal: Capabilities;
  };
};
