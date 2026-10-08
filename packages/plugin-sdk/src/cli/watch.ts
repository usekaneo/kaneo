import { rm } from "node:fs/promises";
import { join } from "node:path";
import { emitTypes } from "./emit-types.js";
import { findEntries } from "./entries.js";
import { errorMessage } from "./errors.js";
import { describeVite, loadVite } from "./load-vite.js";
import { log } from "./log.js";
import { readManifest } from "./manifest.js";
import { createNodeConfig } from "./node-config.js";
import { createWebConfig } from "./web-config.js";

type WatcherEvent = {
  code: string;
  error?: unknown;
  result?: { close?: () => unknown };
};

type Watcher = {
  on(event: "event", listener: (event: WatcherEvent) => void): unknown;
};

function isWatcher(value: unknown): value is Watcher {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { on?: unknown }).on === "function"
  );
}

function onBuilt(
  watcher: unknown,
  label: string,
  afterBuild: () => Promise<unknown>,
) {
  if (!isWatcher(watcher)) return;
  watcher.on("event", (event) => {
    if (event.code === "BUNDLE_END") void event.result?.close?.();
    if (event.code === "ERROR") log.error(errorMessage(event.error));
    if (event.code !== "END") return;
    afterBuild().then(
      () => log.success(`Built ${label}`),
      (error) => log.error(errorMessage(error)),
    );
  });
}

export async function watchPlugin(root: string): Promise<void> {
  const manifest = await readManifest(root);
  const entries = findEntries(root);
  const vite = await loadVite(root);
  const flavor = describeVite(vite);

  await rm(join(root, "dist"), { recursive: true, force: true });

  const node = await vite.build(createNodeConfig(root, entries, flavor, true));
  onBuilt(node, "server entries", () =>
    emitTypes(root, entries, manifest.packageJson),
  );

  if (entries.web) {
    const web = await vite.build(
      createWebConfig(root, entries.web, flavor, true),
    );
    onBuilt(web, "web entry", async () => undefined);
  }

  log.info("Watching for changes. Press Ctrl+C to stop.");
}
