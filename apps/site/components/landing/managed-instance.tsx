import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONTACT =
  "mailto:support@kaneo.app?subject=Managed%20Kaneo%20instance&body=Team%20size%3A%0AIdentity%20provider%3A%0AAnything%20else%20we%20should%20know%3A";

const features = [
  "A dedicated instance with its own database",
  "Your own domain and single sign-on",
  "Daily backups and regular restore tests",
  "Upgrades and security fixes applied for you",
  "Hosted in the EU",
  "A direct line to the maintainers",
];

export function ManagedInstance() {
  return (
    <div className="mt-6 rounded-xl border bg-background p-6 lg:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12">
        <div className="min-w-0 max-w-2xl">
          <h2 className="font-medium text-base">Managed instance</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Your own Kaneo, run by us
          </p>
          <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
            For teams that want an isolated instance without being the ones on
            call. One flat monthly price for the whole instance, not per seat.
          </p>
        </div>
        <Button
          variant="outline"
          size="lg"
          className="plausible-event-name=Managed+Instance+Inquiry h-12 w-full shrink-0 gap-3 px-4 text-sm sm:h-12 md:w-auto"
          render={<a href={CONTACT} />}
        >
          Talk to us
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <ul className="mt-6 grid gap-3 border-t pt-6 text-sm sm:grid-cols-2 lg:mt-8 lg:grid-cols-3 lg:pt-8">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            />
            <span className="text-foreground/90">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
