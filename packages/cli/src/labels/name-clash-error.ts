import { InvalidArgument } from "../errors/errors.js";
import { type NameClash, quoteName } from "./match-label.js";

export function nameClashError(
  clash: NameClash,
  name: string,
  currentName?: string,
): InvalidArgument {
  if (clash.kind === "task") {
    return new InvalidArgument({
      message: `Some tasks already have a label named "${name}" next to "${currentName ?? name}".`,
      hint: `Remove one of the two from those tasks first, or pick another name.`,
    });
  }
  const existing = quoteName(clash.label.name);
  if (clash.label.deletionStartedAt) {
    return new InvalidArgument({
      message: `The label "${clash.label.name}" is still being deleted.`,
      hint: `Run kaneo label delete ${existing} to finish, then try again.`,
    });
  }
  return new InvalidArgument({
    message: `A label named "${clash.label.name}" already exists.`,
    hint: `Pick another name, or change the existing one with kaneo label edit ${existing}.`,
  });
}
