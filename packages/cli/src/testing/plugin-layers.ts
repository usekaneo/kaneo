import { Effect, Layer } from "effect";
import type { PackageRelease } from "../plugins/select-version.js";
import type { CatalogLookup } from "../plugins/lookup-catalog.js";
import { CliEnvironment } from "../services/cli-environment.js";
import { Npm, type NpmInstallResult } from "../services/npm.js";
import { PluginCatalog } from "../services/plugin-catalog.js";

export function testEnvironment(
  cwd: string,
  env: Readonly<Record<string, string | undefined>> = {},
) {
  const stream = { isTTY: false, columns: 80 };
  return Layer.succeed(CliEnvironment, {
    env,
    cwd,
    home: cwd,
    platform: "linux",
    stdin: stream,
    stdout: stream,
    stderr: stream,
  });
}

export type NpmCall =
  | { readonly kind: "releases"; readonly cwd: string; readonly name: string }
  | {
      readonly kind: "install";
      readonly cwd: string;
      readonly specs: ReadonlyArray<string>;
    };

export function fakeNpm(
  releases: ReadonlyArray<PackageRelease>,
  install: NpmInstallResult = { ok: true },
) {
  const calls: NpmCall[] = [];
  const layer = Layer.succeed(Npm, {
    releases: (cwd, name) =>
      Effect.sync(() => {
        calls.push({ kind: "releases", cwd, name });
        return { ok: true as const, releases: [...releases] };
      }),
    install: (cwd, specs) =>
      Effect.sync(() => {
        calls.push({ kind: "install", cwd, specs });
        return install;
      }),
  });
  return { layer, calls };
}

export function fakeCatalog(lookup: CatalogLookup) {
  return Layer.succeed(PluginCatalog, {
    lookup: () => Effect.succeed(lookup),
  });
}
