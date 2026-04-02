"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import SearchCommandMenu from "@/components/search-command-menu";
import { SidebarGroup } from "@/components/ui/sidebar";
import { shortcuts } from "@/constants/shortcuts";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";

export default function Search() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useRegisterShortcuts({
    shortcuts: {
      [shortcuts.search.prefix]: () => {
        setOpen(true);
      },
    },
  });

  return (
    <SidebarGroup className="px-4 pb-1">
      <button
        className="inline-flex h-8 w-full cursor-pointer items-center rounded-lg border border-border/40 bg-muted/30 px-3 py-1.5 text-foreground text-sm outline-none transition-all hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="flex grow items-center text-muted-foreground/60">
          {t("navigation:commandPalette.search")}
        </span>
        <kbd className="ms-2 inline-flex h-4 items-center rounded border border-border/50 bg-background px-1.5 font-mono text-[10px] text-muted-foreground/40">
          {shortcuts.search.prefix}
        </kbd>
      </button>

      <SearchCommandMenu open={open} setOpen={setOpen} />
    </SidebarGroup>
  );
}
