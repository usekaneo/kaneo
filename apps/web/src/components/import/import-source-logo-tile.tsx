import type { ImportSourceDefinition } from "@/components/import/import-source-definitions";
import type { SourceLogoSize } from "@/components/import/source-logos/source-logo-size";
import { cn } from "@/lib/cn";

type ImportSourceLogoTileProps = {
  source: ImportSourceDefinition;
  size?: SourceLogoSize;
};

export function ImportSourceLogoTile({
  source,
  size = "sm",
}: ImportSourceLogoTileProps) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center border border-border bg-background",
        size === "sm" ? "size-8 rounded-lg" : "size-10 rounded-xl",
      )}
    >
      <source.Logo size={size} />
    </span>
  );
}
