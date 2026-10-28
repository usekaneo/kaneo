import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ShortcutTooltipLabel } from "@/components/shortcuts/shortcut-tooltip-label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { ShortcutId } from "@/lib/shortcuts/catalog";

type HeaderIconButtonProps = {
  label: string;
  shortcutId?: ShortcutId;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
};

export function HeaderIconButton({
  label,
  shortcutId,
  onClick,
  className,
  children,
}: HeaderIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={onClick}
            className={cn(
              "text-muted-foreground hover:text-foreground [&_svg]:size-[15px]",
              className,
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        <ShortcutTooltipLabel label={label} shortcutId={shortcutId} />
      </TooltipContent>
    </Tooltip>
  );
}
