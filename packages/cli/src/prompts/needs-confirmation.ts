import { InvalidArgument } from "../errors/errors.js";

export function needsConfirmation(action: string): InvalidArgument {
  return new InvalidArgument({
    message: `${action} needs confirmation. Pass --yes to confirm.`,
  });
}
