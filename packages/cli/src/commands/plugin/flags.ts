import { Flag } from "effect/cli";

export const projectDirFlag = Flag.String("project").pipe(
  Flag.withDescription(
    "Folder with kaneo.config.ts (default: KANEO_PROJECT_DIR, else /kaneo if it exists, else the current folder)",
  ),
  Flag.optional,
);

export const kaneoVersionFlag = Flag.String("kaneo-version").pipe(
  Flag.withDescription(
    "Kaneo version to pick and check plugins for (default: the Kaneo installation the CLI runs in, else @kaneo/config in the project)",
  ),
  Flag.optional,
);
