"use client";

import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import SearchCommandMenu from "@/components/search-command-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";

export default function Search() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const openSearch = () => setOpen(true);
  useShortcut("openSearch", openSearch);
  useShortcut("openTask", openSearch);
  useShortcut("openProject", openSearch);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:bg-sidebar-accent/70"
              onClick={() => setOpen(true)}
            >
              <SearchIcon aria-hidden="true" className="size-4" />
              <span className="sr-only">
                {t("navigation:commandPalette.search")}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="flex items-center gap-2 text-[10px]">
              {t("navigation:commandPalette.search")}
              <ShortcutKeys id="openSearch" />
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SearchCommandMenu open={open} setOpen={setOpen} />
    </>
  );
}
