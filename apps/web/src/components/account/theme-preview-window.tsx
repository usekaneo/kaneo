import { cn } from "@/lib/cn";

type ThemePreviewWindowProps = {
  tone: "light" | "dark";
  className?: string;
};

// A tiny sketch of the app frame in a fixed palette, so each option shows
// its theme regardless of the theme currently applied.
export function ThemePreviewWindow({
  tone,
  className,
}: ThemePreviewWindowProps) {
  const dark = tone === "dark";

  return (
    <span
      className={cn(
        "flex h-full pt-2.5 pl-2.5",
        dark ? "bg-neutral-950" : "bg-neutral-100",
        className,
      )}
    >
      <span
        className={cn(
          "flex flex-1 gap-2 rounded-tl-md border-t border-l p-2.5",
          dark ? "border-white/10 bg-neutral-900" : "border-black/5 bg-white",
        )}
      >
        <span className="flex w-8 shrink-0 flex-col gap-1.5">
          <span
            className={cn(
              "h-1.5 rounded-full",
              dark ? "bg-white/25" : "bg-black/15",
            )}
          />
          <span
            className={cn(
              "h-1.5 w-6 rounded-full",
              dark ? "bg-white/10" : "bg-black/5",
            )}
          />
          <span
            className={cn(
              "h-1.5 w-7 rounded-full",
              dark ? "bg-white/10" : "bg-black/5",
            )}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span
            className={cn("h-5 rounded", dark ? "bg-white/5" : "bg-black/4")}
          />
          <span
            className={cn("h-5 rounded", dark ? "bg-white/5" : "bg-black/4")}
          />
        </span>
      </span>
    </span>
  );
}
