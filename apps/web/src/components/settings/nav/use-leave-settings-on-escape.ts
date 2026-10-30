import { useEffect } from "react";
import { shouldLeaveOnEscape } from "@/components/settings/nav/should-leave-on-escape";

export function useLeaveSettingsOnEscape(onLeave: (() => void) | undefined) {
  useEffect(() => {
    if (!onLeave) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldLeaveOnEscape(event, document)) onLeave();
    };

    // Capture runs before overlays handle Escape, while they are still open.
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onLeave]);
}
