import { basename, dirname } from "node:path";
import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import {
  deleteRepoConfig,
  hasRepoLink,
  linkFilePath,
  readRepoConfigObject,
  removeRepoLink,
  writeRepoConfig,
} from "../config/repo-config.js";
import { Cancelled } from "../errors/errors.js";
import { emit } from "../output/emit.js";
import { Output } from "../output/output.js";
import { confirm } from "../prompts/confirm.js";
import type { Ui } from "../render/ui.js";
import { CliEnvironment } from "../services/cli-environment.js";
import { ApiLayer } from "./api-layer.js";

type UnlinkResult = {
  readonly path: string | null;
  readonly unlinked: boolean;
  readonly deleted: boolean;
};

export function renderUnlink(ui: Ui, result: UnlinkResult): string[] {
  const { theme, glyphs } = ui;
  if (!result.path || !result.unlinked) {
    return [
      `  ${theme.muted(glyphs.dot)} This directory is not linked to Kaneo`,
    ];
  }
  const detail = result.deleted
    ? `removed ${basename(result.path)}`
    : `kept the other keys in ${basename(result.path)}`;
  return [
    `  ${theme.success(glyphs.tick)} Unlinked ${dirname(result.path)} ${theme.muted(`${glyphs.separator} ${detail}`)}`,
  ];
}

export const runUnlink = Effect.fn("command.unlink")(function* (options: {
  readonly yes: boolean;
}) {
  const environment = yield* CliEnvironment;
  const output = yield* Output;
  const path = linkFilePath(environment.cwd);
  const existing = yield* readRepoConfigObject(path);

  if (!path || !existing || !hasRepoLink(existing)) {
    yield* emit<UnlinkResult>(
      { path: path ?? null, unlinked: false, deleted: false },
      renderUnlink,
    );
    return;
  }

  if (!options.yes && output.interactive) {
    const confirmed = yield* confirm(
      `Remove the Kaneo workspace and project from ${path}?`,
    );
    if (!confirmed) return yield* new Cancelled();
  }

  const remaining = removeRepoLink(existing);
  if (remaining) {
    yield* writeRepoConfig(path, remaining);
  } else {
    yield* deleteRepoConfig(path);
  }

  yield* emit<UnlinkResult>(
    { path, unlinked: true, deleted: remaining === undefined },
    renderUnlink,
  );
});

export const unlinkCommand = Command.make(
  "unlink",
  {
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Unlink without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runUnlink(options),
).pipe(
  Command.withDescription("Remove this repository's .kaneo.json settings"),
  Command.provide(ApiLayer),
);
