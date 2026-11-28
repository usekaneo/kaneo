import { errorMessage } from "./error-message.js";
import { BuildFailed, type BuildError } from "./errors.js";
import { isBuildError } from "./is-build-error.js";

export function toBuildError(error: unknown): BuildError {
  return isBuildError(error)
    ? error
    : new BuildFailed({ message: errorMessage(error) });
}
