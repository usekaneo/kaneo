import type { PluginLoadError } from "@kaneo/plugin-loader";
import { InvalidArgument } from "../errors/errors.js";

export function loadFailure(error: PluginLoadError): InvalidArgument {
  const heading = error.plugin
    ? `Plugin "${error.plugin}" failed at ${error.stage}:`
    : "Kaneo could not load its plugin config:";
  return new InvalidArgument({
    message: `${heading} ${error.message}`,
    ...(error.hint ? { hint: error.hint } : {}),
  });
}
