import { Result, Schema } from "effect";

export const ProfileSchema = Schema.Struct({
  apiUrl: Schema.String,
  webUrl: Schema.optionalKey(Schema.String),
  token: Schema.optionalKey(Schema.String),
  workspaceId: Schema.optionalKey(Schema.String),
  user: Schema.optionalKey(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      email: Schema.String,
    }),
  ),
});

export type Profile = typeof ProfileSchema.Type;

export const ConfigFileSchema = Schema.Struct({
  kind: Schema.Literal("kaneo-cli"),
  version: Schema.Literal(1),
  activeProfile: Schema.String,
  profiles: Schema.Record(Schema.String, ProfileSchema),
});

export type ConfigFile = typeof ConfigFileSchema.Type;

export const DEFAULT_PROFILE = "default";

export const emptyConfig: ConfigFile = {
  kind: "kaneo-cli",
  version: 1,
  activeProfile: DEFAULT_PROFILE,
  profiles: {},
};

export type ParsedConfig =
  | { readonly status: "ok"; readonly config: ConfigFile }
  | { readonly status: "foreign" }
  | { readonly status: "invalid"; readonly detail: string };

const decodeConfig = Schema.decodeUnknownResult(ConfigFileSchema);

export function parseConfig(text: string): ParsedConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { status: "foreign" };
  }
  if (
    typeof raw !== "object" ||
    raw === null ||
    (raw as { kind?: unknown }).kind !== "kaneo-cli"
  ) {
    return { status: "foreign" };
  }
  const decoded = decodeConfig(raw);
  return Result.isSuccess(decoded)
    ? { status: "ok", config: decoded.success }
    : {
        status: "invalid",
        detail: decoded.failure.message.split("\n")[0] ?? "",
      };
}

export function serializeConfig(config: ConfigFile): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function withProfile(
  config: ConfigFile,
  name: string,
  update: (profile: Profile | undefined) => Profile,
): ConfigFile {
  return {
    ...config,
    activeProfile: name,
    profiles: { ...config.profiles, [name]: update(config.profiles[name]) },
  };
}
