export type DoctorCheckName =
  | "config"
  | "server"
  | "login"
  | "workspace"
  | "compatibility";

export type DoctorCheck = {
  readonly name: DoctorCheckName;
  readonly ok: boolean;
  readonly detail: string;
  readonly missing?: ReadonlyArray<string>;
};

export const CHECK_LABELS: Readonly<Record<DoctorCheckName, string>> = {
  config: "Config file",
  server: "Server",
  login: "Signed in",
  workspace: "Workspace",
  compatibility: "API compatibility",
};
