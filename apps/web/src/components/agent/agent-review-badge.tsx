import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AgentReviewBadge() {
  const { t } = useTranslation();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-muted px-2 font-medium text-muted-foreground text-xs">
            <Lock aria-hidden="true" className="size-3" />
            {t("agent:composer.reviewMode")}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-56 text-xs">
            {t("agent:composer.reviewModeHint")}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
