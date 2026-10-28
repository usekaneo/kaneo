import { SHORTCUTS, type ShortcutDefinition } from "@/lib/shortcuts/catalog";
import { parseBinding } from "@/lib/shortcuts/key-combo";

export const PLUGIN_VIEW_PREFIX = "v";

export function takenViewKeys(
  definitions: readonly ShortcutDefinition[] = Object.values(SHORTCUTS),
): string[] {
  return definitions.flatMap(({ keys }) =>
    keys
      .map(parseBinding)
      .flatMap(([first, next]) =>
        next &&
        first.key === PLUGIN_VIEW_PREFIX &&
        !first.mod &&
        !first.ctrl &&
        !first.alt &&
        !first.shift
          ? [next.key]
          : [],
      ),
  );
}
