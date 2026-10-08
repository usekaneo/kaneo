import type { PluginDescriptor } from "@kaneo/plugin-sdk";
import { formatIssues } from "./format-issues";
import { StageError } from "./stage-error";

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
  const result = await schema["~standard"].validate(descriptor.options);
  if (result.issues) {
    throw new StageError(
      `The options are invalid:\n${formatIssues(result.issues)}`,
    );
  }
  return result.value;
}
