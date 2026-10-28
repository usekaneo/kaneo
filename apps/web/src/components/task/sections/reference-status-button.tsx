import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function ReferenceStatusButton({
  className,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex size-3.5 shrink-0 items-center justify-center rounded-full outline-none before:absolute before:-inset-1.5 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}
