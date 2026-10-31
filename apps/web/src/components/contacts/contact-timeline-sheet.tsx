import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Contact } from "@/fetchers/contact";
import { useContactTimeline } from "@/hooks/queries/contact/use-contact-timeline";
import { ContactInteractionForm } from "./contact-interaction-form";
import { ContactLeadList } from "./contact-lead-list";
import { ContactTimelineList } from "./contact-timeline-list";
import { contactRegionKey, contactTypeKey } from "./contact-options";

type ContactTimelineSheetProps = {
  workspaceId: string;
  contact: Contact | null;
  canLog: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ContactTimelineSheet({
  workspaceId,
  contact,
  canLog,
  onOpenChange,
}: ContactTimelineSheetProps) {
  const { t } = useTranslation();
  const { data, isPending, isError } = useContactTimeline(
    workspaceId,
    contact?.id ?? null,
  );

  return (
    <Sheet open={contact !== null} onOpenChange={onOpenChange}>
      <SheetPopup className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{contact?.name}</SheetTitle>
          <SheetDescription>
            {contact
              ? [
                  t(contactTypeKey(contact.type)),
                  t(contactRegionKey(contact.region)),
                  contact.phone,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : null}
          </SheetDescription>
        </SheetHeader>
        <SheetPanel className="space-y-6">
          {isPending ? (
            <div aria-busy="true" className="space-y-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-24" />
            </div>
          ) : isError || !data || !contact ? (
            <div role="alert" className="space-y-3">
              <p className="text-destructive-foreground text-sm">
                {t("workspace:contacts.timelineError")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                {t("workspace:contacts.close")}
              </Button>
            </div>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="font-medium text-sm">
                  {t("workspace:contacts.leads")}
                </h3>
                <ContactLeadList leads={data.leads} />
              </section>
              {canLog && data.leads.length > 0 ? (
                <ContactInteractionForm
                  workspaceId={workspaceId}
                  contactId={contact.id}
                  leads={data.leads}
                />
              ) : null}
              <section className="space-y-3">
                <h3 className="font-medium text-sm">
                  {t("workspace:contacts.timeline")}
                </h3>
                <ContactTimelineList entries={data.entries} />
              </section>
            </>
          )}
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
