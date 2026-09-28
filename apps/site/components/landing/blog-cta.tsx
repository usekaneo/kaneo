import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIGN_UP = "https://cloud.kaneo.app/auth/sign-up";
const PRICING = "/pricing";

export function BlogCta({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className={cn(
        "rounded-xl border bg-sidebar",
        compact ? "p-6" : "p-6 md:p-8",
      )}
    >
      <p
        className={cn(
          "text-balance font-medium leading-snug",
          compact ? "text-base" : "text-xl md:text-2xl",
        )}
      >
        Put your team on Kaneo Cloud
      </p>
      <p
        className={cn(
          "mt-2.5 text-muted-foreground leading-relaxed",
          compact ? "text-sm" : "",
        )}
      >
        Managed, EU-hosted project management from $4 a month. Automatic backups
        and updates, single sign-on, workspace roles, and email support, with
        none of the servers to look after.
      </p>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2.5",
          compact ? "mt-5" : "mt-6",
        )}
      >
        <Button
          size="lg"
          className={cn("h-12 px-5 text-sm sm:h-12", compact && "w-full")}
          render={<a href={SIGN_UP} />}
        >
          Start a 14-day free trial
        </Button>
        <Button
          variant="outline"
          size="lg"
          className={cn("h-12 px-5 text-sm sm:h-12", compact && "w-full")}
          render={<a href={PRICING} />}
        >
          See pricing
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        No credit card required.
      </p>
    </aside>
  );
}
