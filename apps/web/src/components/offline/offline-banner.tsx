import { onlineManager } from "@tanstack/react-query";
import { CloudOff } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
  if (online) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2 rounded-full border bg-popover px-3 py-1.5 text-popover-foreground text-xs shadow-lg"
    >
      <CloudOff className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{t("common:offline.banner")}</span>
    </div>
  );
}
