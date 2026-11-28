import type { PluginDescriptor } from "@kaneo/plugin-sdk";
import { formatIssues } from "./format-issues.js";
import { StageError } from "./stage-error.js";

export async function validateOptions(
  descriptor: PluginDescriptor,
): Promise<unknown> {
  const { schema } = descriptor;
  if (!schema) return descriptor.options;
  if (typeof schema["~standard"]?.validate !== "function") {
    throw new StageError(
      "The plugin's options schema is not a Standard Schema.",
      "Report this to the plugin's author.",
    );
  }
  const standard = schema["~standard"];
  const result = await standard.validate(descriptor.options);
  // The factory allows omitted options for schemas with only optional inputs.
  if (result.issues && descriptor.options === undefined) {
    const defaults = await standard.validate({});
    if (!defaults.issues) return defaults.value;
  }
  if (result.issues) {
    throw new StageError(
      `The options are invalid:\n${formatIssues(result.issues)}`,
    );
  }
  return result.value;
}
