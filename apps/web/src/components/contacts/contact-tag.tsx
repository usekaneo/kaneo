import { UserRound } from "lucide-react";
import { useContactName } from "@/hooks/queries/contact/use-contact-name";
import { cn } from "@/lib/cn";

type ContactTagProps = {
  contactId: string | null | undefined;
  className?: string;
};

function NamedContactTag({
  contactId,
  className,
}: ContactTagProps & { contactId: string }) {
  const name = useContactName(contactId);
  if (!name) return null;
  return (
    <span
      data-contact-tag={contactId}
      title={name}
      className={cn(
        "inline-flex max-w-32 shrink-0 items-center gap-0.5 truncate rounded-sm bg-primary/10 px-1 font-medium text-[10px] text-primary leading-4",
        className,
      )}
    >
      <UserRound aria-hidden="true" className="size-2.5 shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  );
}

/**
 * Names the contact a lead belongs to. Ordinary tasks return before any hook
 * runs, so boards without leads add no subscriptions or requests.
 */
export function ContactTag({ contactId, className }: ContactTagProps) {
  if (!contactId) return null;
  return <NamedContactTag contactId={contactId} className={className} />;
}
