import { useEffect } from "react";
import { shortcutRegistry } from "./registry";

export function ShortcutListener() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      shortcutRegistry.handleKeyDown(event);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}
