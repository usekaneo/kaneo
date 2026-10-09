import { Flag } from "effect/cli";

export const noteFlag = Flag.String("note").pipe(
  Flag.withAlias("m"),
  Flag.withDescription("A short note about the work"),
  Flag.optional,
);
