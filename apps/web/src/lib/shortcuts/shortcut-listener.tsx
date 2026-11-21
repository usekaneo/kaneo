import { useEffect } from "react";
import { SHORTCUTS, type ShortcutDefinition } from "./catalog";
import { matchesCombo, parseBinding } from "./key-combo";
import { isMacPlatform } from "./platform";
import { shortcutRegistry } from "./registry";

const blockedCombos = Object.values<ShortcutDefinition>(SHORTCUTS)
  .filter((definition) => definition.blocksBrowserDefault)
  .flatMap((definition) =>
    definition.keys.map((keys) => parseBinding(keys)[0]),
  );

export function ShortcutListener() {
  useEffect(() => {
    const isMac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent) => {
      if (shortcutRegistry.handleKeyDown(event)) return;
      if (blockedCombos.some((combo) => matchesCombo(combo, event, isMac)))
        event.preventDefault();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}
