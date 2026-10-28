import { Flag, GlobalFlag } from "effect/cli";
import { jqFlagValue } from "../jq/jq-flag-value.js";

export const JsonFlag = GlobalFlag.Setting("json")({
  flag: Flag.Boolean("json").pipe(
    Flag.withDescription(
      "Print one JSON value on stdout (the default when stdout is not a terminal)",
    ),
    Flag.withDefault(false),
  ),
});

export const HumanFlag = GlobalFlag.Setting("human")({
  flag: Flag.Boolean("human").pipe(
    Flag.withDescription(
      "Print styled output even when stdout is not a terminal",
    ),
    Flag.withDefault(false),
  ),
});

export const TokenFlag = GlobalFlag.Setting("token")({
  flag: Flag.Redacted("token").pipe(
    Flag.withDescription(
      "API key or access token to use instead of the stored login",
    ),
    Flag.optional,
  ),
});

export const ApiUrlFlag = GlobalFlag.Setting("api-url")({
  flag: Flag.String("api-url").pipe(
    Flag.withDescription("Kaneo server URL (or KANEO_API_URL)"),
    Flag.optional,
  ),
});

export const WorkspaceFlag = GlobalFlag.Setting("workspace")({
  flag: Flag.String("workspace").pipe(
    Flag.withAlias("w"),
    Flag.withDescription("Workspace id (or KANEO_WORKSPACE)"),
    Flag.optional,
  ),
});

export const ProfileFlag = GlobalFlag.Setting("profile")({
  flag: Flag.String("profile").pipe(
    Flag.withDescription("Stored login to use (or KANEO_PROFILE)"),
    Flag.optional,
  ),
});

export const JqFlag = GlobalFlag.Setting("jq")({
  flag: Flag.String("jq").pipe(
    Flag.withDescription(
      "Filter the JSON output with a jq expression, for example '.[].title'",
    ),
    Flag.mapEffect(jqFlagValue),
    Flag.optional,
  ),
});

export const globalFlags = [
  JsonFlag,
  HumanFlag,
  JqFlag,
  TokenFlag,
  ApiUrlFlag,
  WorkspaceFlag,
  ProfileFlag,
] as const;
