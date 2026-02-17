"use client";

import { SearchIcon } from "lucide-react";
import { useState } from "react";
import SearchCommandMenu from "@/components/search-command-menu";
import { SidebarGroup } from "@/components/ui/sidebar";
import { shortcuts } from "@/constants/shortcuts";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";

export default function Search() {
  const [open, setOpen] = useState(false);

  useRegisterShortcuts({
    shortcuts: {
      [shortcuts.search.prefix]: () => {
        setOpen(true);
      },
    },
  });

  return (
    <SidebarGroup className="pb-1">
      <button
        className="inline-flex h-8 w-full cursor-pointer rounded-md border border-input bg-background px-2 py-1.5 text-foreground text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="flex grow items-center">
          <SearchIcon
            aria-hidden="true"
            className="-ms-1 me-3 text-muted-foreground/80"
            size={16}
          />
          <span className="font-normal text-muted-foreground/70">Search</span>
        </span>
        <kbd className="-me-0.5 ms-6 inline-flex h-4 max-h-full items-center rounded border border-border/70 bg-background px-1 font-[inherit] font-medium text-[0.625rem] text-muted-foreground/60">
          {shortcuts.search.prefix}
        </kbd>
      </button>

      <SearchCommandMenu open={open} setOpen={setOpen} />
    </SidebarGroup>
  );
}
