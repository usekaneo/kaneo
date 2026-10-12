import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function DisplayMenu({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const title = t("tasks:display.title");

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={title}
                  className="data-popup-open:bg-accent"
                />
              }
            />
          }
        >
          <SlidersHorizontal />
        </TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80">
        <PopoverTitle className="sr-only">{title}</PopoverTitle>
        <div className="-mx-1 divide-y divide-border">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
