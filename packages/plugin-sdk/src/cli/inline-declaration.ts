import { PLUGIN_API_VERSION } from "../api-version.js";
import type { ProbedTypes } from "./type-probe.js";

function orUndefined(type: string): string {
  return type === "never" ? "undefined" : type;
}

export function renderInlineDeclaration(types: ProbedTypes): string {
  const parameter = types.optional ? "options?: Options" : "options: Options";
  return `type Options = ${orUndefined(types.input)};

type ResolvedOptions = ${orUndefined(types.output)};

type StandardSchemaIssue = {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
};

type StandardSchemaResult =
  | { readonly value: unknown; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<StandardSchemaIssue> };

type StandardSchema = {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => StandardSchemaResult | Promise<StandardSchemaResult>;
    readonly types?: { readonly input: unknown; readonly output: unknown };
  };
};

type PluginDescriptor = {
  readonly kind: "kaneo-plugin";
  readonly apiVersion: ${PLUGIN_API_VERSION};
  readonly url: string;
  readonly options: unknown;
  readonly schema: StandardSchema | null;
  readonly "~output"?: ResolvedOptions;
};

declare const plugin: (${parameter}) => PluginDescriptor;

export default plugin;
`;
}
