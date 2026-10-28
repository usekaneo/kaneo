import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  SHORTCUT_CATEGORIES,
  SHORTCUTS,
  type ShortcutId,
} from "@/lib/shortcuts/catalog";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { capMatcher, matchesShortcut } from "./match-shortcut";
import { shortcutCaps } from "./shortcut-keys";
import { ShortcutRow } from "./shortcut-row";
import { useShortcutsPanelStore } from "./shortcuts-panel-store";

const SHORTCUT_IDS = Object.keys(SHORTCUTS) as ShortcutId[];

export function ShortcutsPanel() {
  const { t } = useTranslation();
  const open = useShortcutsPanelStore((state) => state.open);
  const setOpen = useShortcutsPanelStore((state) => state.setOpen);
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useShortcut("openShortcuts", () =>
    setOpen(!useShortcutsPanelStore.getState().open),
  );

  const isHighlighted = capMatcher(query);
  const sections = SHORTCUT_CATEGORIES.map((category) => ({
    category,
    items: SHORTCUT_IDS.filter((id) => SHORTCUTS[id].category === category)
      .map((id) => ({ id, label: t(`navigation:shortcuts.items.${id}`) }))
      .filter((item) =>
        matchesShortcut(item.label, shortcutCaps(item.id), query),
      ),
  })).filter((section) => section.items.length > 0);
  const resultCount = sections.reduce(
    (total, section) => total + section.items.length,
    0,
  );

  return (
    <DialogPrimitive.Root
      open={open}
      modal={false}
      onOpenChange={(next, details) => {
        if (!next && details.reason === "escape-key" && query) {
          setQuery("");
          return;
        }
        setOpen(next);
        if (!next) {
          setQuery("");
          setScrolled(false);
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup
          data-shortcuts="allow"
          initialFocus={searchRef}
          className="fixed inset-y-2 right-2 z-50 flex w-[408px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl/10 outline-none transition-[translate,opacity] duration-200 ease-out data-ending-style:translate-x-3 data-ending-style:opacity-0 data-starting-style:translate-x-3 data-starting-style:opacity-0 motion-reduce:data-ending-style:translate-x-0 motion-reduce:data-starting-style:translate-x-0"
        >
          <div className="flex h-13 shrink-0 items-center justify-between ps-4 pe-2">
            <DialogPrimitive.Title className="font-semibold text-sm">
              {t("navigation:shortcuts.title")}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("common:actions.close")}
                />
              }
            >
              <X />
            </DialogPrimitive.Close>
          </div>
          <div
            className={cn(
              "shrink-0 border-b border-transparent px-4 pb-3 transition-colors",
              scrolled && "border-border",
            )}
          >
            <div className="flex h-[34px] items-center gap-2 rounded-lg border bg-foreground/3 px-2.5 focus-within:border-ring">
              <Search
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("navigation:shortcuts.searchPlaceholder")}
                aria-label={t("navigation:shortcuts.searchPlaceholder")}
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
              {query.trim() && (
                <span
                  aria-live="polite"
                  className="shrink-0 text-muted-foreground text-xs tabular-nums"
                >
                  {t("navigation:shortcuts.results", { count: resultCount })}
                </span>
              )}
            </div>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
            onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
          >
            {sections.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground text-sm">
                {t("navigation:shortcuts.noResults")}
              </p>
            ) : (
              sections.map((section) => (
                <section key={section.category} className="pt-3">
                  <h3 className="pb-1 font-medium text-muted-foreground text-xs">
                    {t(`navigation:shortcuts.categories.${section.category}`)}
                  </h3>
                  <ul>
                    {section.items.map((item) => (
                      <ShortcutRow
                        key={item.id}
                        id={item.id}
                        label={item.label}
                        query={query}
                        isHighlighted={isHighlighted}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
