import { brand } from "@kaneo/branding";
import type { SourceLogoProps } from "@/components/import/source-logos/source-logo-size";
import { cn } from "@/lib/cn";

export function KaneoLogo({ size }: SourceLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "shrink-0 font-semibold",
        size === "sm" ? "text-sm" : "text-lg",
      )}
    >
      {brand.name.slice(0, 1)}
    </span>
  );
}
