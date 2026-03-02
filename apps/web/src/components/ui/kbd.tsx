import type * as React from "react";

import { cn } from "@/lib/cn";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded bg-muted px-1 font-medium font-sans text-muted-foreground text-xs [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      data-slot="kbd"
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="kbd-group"
      {...props}
    />
  );
}

function KbdSequence({
  keys,
  className,
  description,
  separator = "+",
}: {
  keys: string[];
  className?: string;
  description?: string;
  separator?: string;
}) {
  return (
    <KbdGroup aria-label={description} className={className}>
      {keys.map((key, index) => (
        <span key={key} className="inline-flex items-center gap-1">
          <Kbd>{key}</Kbd>
          {separator && index < keys.length - 1 ? (
            <span className="text-muted-foreground/72 text-xs">
              {separator}
            </span>
          ) : null}
        </span>
      ))}
    </KbdGroup>
  );
}

export { Kbd, KbdGroup, KbdSequence };
