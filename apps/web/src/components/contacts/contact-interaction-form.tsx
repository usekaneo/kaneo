import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/components/project/error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ContactTimeline } from "@/fetchers/contact";
import { useLogInteraction } from "@/hooks/mutations/contact/use-log-interaction";
import { toast } from "@/lib/toast";
import { followUpIso } from "./follow-up-label";

type ContactInteractionFormProps = {
  workspaceId: string;
  contactId: string;
  leads: ContactTimeline["leads"];
};

export function ContactInteractionForm({
  workspaceId,
  contactId,
  leads,
}: ContactInteractionFormProps) {
  const { t } = useTranslation();
  const noteId = useId();
  const dateId = useId();
  const [leadId, setLeadId] = useState(leads[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const { mutateAsync: log, isPending } = useLogInteraction(
    workspaceId,
    contactId,
  );

  // Fall back if the selected lead disappeared (unlinked or deleted).
  const lead = leads.find((item) => item.id === leadId) ?? leads[0];
  if (!lead) return null;

  const items = leads.map((item) => ({ value: item.id, label: item.title }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!note.trim() || isPending) return;
    try {
      await log({
        lead: { id: lead.id, projectId: lead.projectId },
        note: note.trim(),
        nextFollowUp: followUpIso(date),
      });
      setNote("");
      setDate("");
      toast.success(t("workspace:contacts.interactionLogged"));
    } catch (error) {
      toast.error(
        errorMessage(error, t("workspace:contacts.interactionError")),
      );
    }
  };

  return (
    <form className="space-y-3" onSubmit={submit}>
      {leads.length > 1 ? (
        <Select
          items={items}
          value={lead.id}
          onValueChange={(next) => {
            if (typeof next === "string" && next) setLeadId(next);
          }}
        >
          <SelectTrigger size="sm" aria-label={t("workspace:contacts.forLead")}>
            <SelectValue>{lead.title}</SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={noteId} className="sr-only">
          {t("workspace:contacts.interactionLabel")}
        </Label>
        <Textarea
          id={noteId}
          value={note}
          maxLength={5000}
          placeholder={t("workspace:contacts.interactionPlaceholder")}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor={dateId} className="text-xs">
            {t("workspace:contacts.nextFollowUp")}
          </Label>
          <Input
            id={dateId}
            type="date"
            className="w-40"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <Button type="submit" size="sm" disabled={!note.trim() || isPending}>
          {t("workspace:contacts.logInteraction")}
        </Button>
      </div>
    </form>
  );
}
