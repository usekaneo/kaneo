import { PLUGIN_API_VERSION } from "./api-version.js";
import type {
  InferSchemaInput,
  InferSchemaOutput,
  StandardSchemaV1,
} from "./standard-schema.js";

export type PluginDescriptor<Output = unknown> = {
  readonly kind: "kaneo-plugin";
  readonly apiVersion: typeof PLUGIN_API_VERSION;
  readonly url: string;
  readonly options: unknown;
  readonly schema: StandardSchemaV1 | null;
  readonly "~output"?: Output;
};

type FactoryArgs<Input> = undefined extends Input
  ? [options?: Input]
  : {} extends Input
    ? [options?: Input]
    : [options: Input];

export type PluginFactory<Input = undefined, Output = undefined> = (
  ...args: FactoryArgs<Input>
) => PluginDescriptor<Output>;

export type PluginOptions<P> = P extends (
  ...args: never[]
) => PluginDescriptor<infer Output>
  ? Output
  : never;

export function definePlugin(url: string): PluginFactory;
export function definePlugin<S extends StandardSchemaV1>(
  url: string,
  config: { options: S },
): PluginFactory<InferSchemaInput<S>, InferSchemaOutput<S>>;
export function definePlugin(
  url: string,
  config?: { options: StandardSchemaV1 },
): (options?: unknown) => PluginDescriptor<never> {
  return (options?: unknown) => ({
    kind: "kaneo-plugin",
    apiVersion: PLUGIN_API_VERSION,
    url,
    options,
    schema: config?.options ?? null,
  });
}

export function isPluginDescriptor(value: unknown): value is PluginDescriptor {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "kaneo-plugin" &&
    typeof (value as { url?: unknown }).url === "string"
  );
}
