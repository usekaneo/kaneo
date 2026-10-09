import { Flag } from "effect/cli";

export const projectFlag = Flag.String("project").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("Project key or id, for example KAN"),
  Flag.optional,
);
