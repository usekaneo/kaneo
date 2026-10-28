import { CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

type ShowCompletedToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export default function ShowCompletedToggle({
  checked,
  onChange,
}: ShowCompletedToggleProps) {
  const { t } = useTranslation();
  const label = t("workspace:tasks.showCompleted");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={cn(checked && "bg-accent")}
          />
        }
      >
        <CircleCheck />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
