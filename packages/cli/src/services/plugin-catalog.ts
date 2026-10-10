import { Context, Effect, Layer } from "effect";
import {
  type CatalogLookup,
  catalogUrl,
  lookupCatalog,
} from "../plugins/lookup-catalog.js";
import { CliEnvironment } from "./cli-environment.js";

export type PluginCatalogShape = {
  readonly lookup: (packageName: string) => Effect.Effect<CatalogLookup>;
};

export class PluginCatalog extends Context.Service<
  PluginCatalog,
  PluginCatalogShape
>()("kaneo/PluginCatalog") {}

export const PluginCatalogLive = Layer.effect(
  PluginCatalog,
  Effect.gen(function* () {
    const { env } = yield* CliEnvironment;
    const url = catalogUrl(env);
    return {
      lookup: (packageName) =>
        Effect.promise(() => lookupCatalog(packageName, { url })),
    };
  }),
);
