import { Button } from "@/components/button/Button";
import type { ButtonProps } from "@/components/button/Button";
import { cn } from "@/lib/utils";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";

export const RefreshButton = ({ ...props }: ButtonProps) => (
  <Button shape="square" toggled={props.toggled} {...props}>
    <ArrowsClockwiseIcon
      className={cn({
        "animate-refresh": props.toggled,
        "size-4.5": props.size === "base",
        "size-4": props.size === "sm",
        "size-5": props.size === "lg"
      })}
    />
  </Button>
);
