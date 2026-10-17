import { useEffect, useLayoutEffect, useRef } from "react";
import { SHORTCUTS, type ShortcutDefinition, type ShortcutId } from "./catalog";
import { parseBinding } from "./key-combo";
import { type ShortcutScope, shortcutRegistry } from "./registry";

type UseShortcutOptions = {
  enabled?: boolean;
  scope?: ShortcutScope;
};

export function useShortcut(
  id: ShortcutId,
  handler: (event: KeyboardEvent) => void,
  { enabled = true, scope }: UseShortcutOptions = {},
) {
  const handlerRef = useRef(handler);
  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  const definition: ShortcutDefinition = SHORTCUTS[id];
  const resolvedScope = scope ?? definition.scope ?? "global";

  useEffect(() => {
    if (!enabled) return;
    return shortcutRegistry.register({
      id,
      bindings: definition.keys.map(parseBinding),
      scope: resolvedScope,
      allowInInput: definition.allowInInput,
      allowInPopup: definition.allowInPopup,
      handler: (event) => handlerRef.current(event),
    });
  }, [definition, enabled, id, resolvedScope]);
}
