import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Kbd } from "@/components/ui/kbd";
import { SHORTCUTS } from "@/lib/shortcuts/catalog";
import { formatCombo } from "@/lib/shortcuts/format-binding";
import { isMacPlatform } from "@/lib/shortcuts/platform";
import { shortcutRegistry } from "@/lib/shortcuts/registry";

const SHOW_AFTER_MS = 400;
const CATALOG_ORDER = Object.keys(SHORTCUTS);
const DRAIN_MS = 1600;

export function SequenceHint() {
  const { t } = useTranslation();
  const pendingKey = useSyncExternalStore(
    shortcutRegistry.subscribe,
    shortcutRegistry.getPendingKey,
    () => null,
  );
  const [shownFor, setShownFor] = useState<string | null>(null);
  const drainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingKey) return;
    const timer = setTimeout(() => setShownFor(pendingKey), SHOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setShownFor(null);
    };
  }, [pendingKey]);

  const visible = Boolean(pendingKey) && shownFor === pendingKey;

  useEffect(() => {
    if (!visible) return;
    const animation = drainRef.current?.animate(
      [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }],
      { duration: DRAIN_MS, easing: "linear", fill: "forwards" },
    );
    return () => animation?.cancel();
  }, [visible]);

  if (!visible || !pendingKey) return null;
  const continuations = shortcutRegistry
    .getContinuations()
    .sort((a, b) => CATALOG_ORDER.indexOf(a.id) - CATALOG_ORDER.indexOf(b.id));
  if (continuations.length === 0) return null;
  const isMac = isMacPlatform();

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-[200] w-60 overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg/10"
    >
      <div className="flex items-center gap-2 px-1.5 pt-0.5 pb-1.5 text-muted-foreground text-xs">
        <Kbd size="md">{pendingKey.toUpperCase()}</Kbd>
        {t("navigation:shortcuts.thenEllipsis")}
      </div>
      <ul>
        {continuations.map(({ id, next }) => (
          <li
            key={id}
            className="flex h-7 items-center gap-2 px-1.5 text-[13px] text-foreground/85"
          >
            <span className="inline-flex gap-0.5">
              {formatCombo(next, isMac).map((cap) => (
                <Kbd key={cap} size="md">
                  {cap}
                </Kbd>
              ))}
            </span>
            {t(`navigation:shortcuts.items.${id}`)}
          </li>
        ))}
      </ul>
      <div
        ref={drainRef}
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-foreground/20 motion-reduce:hidden"
      />
    </div>
  );
}
