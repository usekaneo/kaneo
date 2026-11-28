import { Flag, GlobalFlag } from "effect/cli";

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

export const globalFlags = [JsonFlag, HumanFlag] as const;
