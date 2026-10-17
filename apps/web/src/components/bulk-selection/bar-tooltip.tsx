import type { ReactElement } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCompactBar } from "./use-compact-bar";

type BarTooltipProps = {
  label: string;
  children: ReactElement;
};

export function BarTooltip({ label, children }: BarTooltipProps) {
  const compact = useCompactBar();
  if (!compact) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
