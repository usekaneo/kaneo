import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/cn";
import { i18n } from "@/lib/i18n";

function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof Loader2Icon>) {
  return (
    <Loader2Icon
      aria-label={i18n.t("common:empty.loading")}
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}

export { Spinner };
