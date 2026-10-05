import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONTACT =
  "mailto:support@kaneo.app?subject=Managed%20Kaneo%20instance&body=Team%20size%3A%0AIdentity%20provider%3A%0AAnything%20else%20we%20should%20know%3A";

const features = [
  "A dedicated instance with its own database",
  "Your own domain, and SSO with your identity provider",
  "Daily backups and regular restore tests",
  "Upgrades and security fixes applied for you",
  "Hosted in the EU",
  "A direct line to the maintainers",
];

export function ManagedInstance() {
  return (
    <div className="mt-6 grid gap-8 rounded-xl border bg-background p-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12 lg:p-8">
      <div className="flex min-w-0 flex-col">
        <h2 className="font-medium text-base">Managed instance</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Your own Kaneo, run by us
        </p>
        <p className="mt-6 text-muted-foreground text-sm leading-relaxed">
          For teams that want an isolated instance without being the ones on
          call. One flat monthly price for the whole instance, not per seat.
        </p>
        <div className="mt-auto pt-8">
          <Button
            variant="outline"
            size="lg"
            className="plausible-event-name=Managed+Instance+Inquiry h-12 w-full gap-3 px-4 text-sm sm:h-12 sm:w-auto"
            render={<a href={CONTACT} />}
          >
            Talk to us
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>

      <ul className="grid content-start gap-3 text-sm sm:grid-cols-2">
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
