import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/cn";

const kbdVariants = cva(
  "pointer-events-none inline-flex select-none items-center justify-center border font-medium font-sans data-highlighted:border-foreground/26 data-highlighted:bg-foreground/16 data-highlighted:font-semibold data-highlighted:text-foreground [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      size: {
        sm: "h-[18px] min-w-[18px] rounded-[4px] px-1 text-[11px]",
        md: "h-5 min-w-5 rounded-[5px] px-[5px] text-xs",
      },
      tone: {
        default: "border-foreground/10 bg-foreground/6 text-foreground/85",
        tooltip: "border-foreground/12 bg-foreground/8 text-foreground/85",
        muted: "border-foreground/8 bg-foreground/4 text-muted-foreground",
      },
    },
    defaultVariants: { size: "sm", tone: "default" },
  },
);

type KbdProps = React.ComponentProps<"kbd"> &
  VariantProps<typeof kbdVariants> & { highlighted?: boolean };

function Kbd({ className, size, tone, highlighted, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(kbdVariants({ size, tone }), className)}
      data-highlighted={highlighted || undefined}
      data-slot="kbd"
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn("inline-flex items-center gap-0.5", className)}
      data-slot="kbd-group"
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
export type { KbdProps };
