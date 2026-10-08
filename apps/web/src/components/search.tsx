"use client";

import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import SearchCommandMenu from "@/components/search-command-menu";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
              <KbdSequence keys={[shortcuts.search.prefix]} />
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SearchCommandMenu open={open} setOpen={setOpen} />
    </>
  );
}
