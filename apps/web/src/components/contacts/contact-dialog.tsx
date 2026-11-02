import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/components/project/error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Contact } from "@/fetchers/contact";
import { useContactOptions } from "@/hooks/queries/contact/use-contact-options";
import { useSaveContact } from "@/hooks/mutations/contact/use-save-contact";
import { toast } from "@/lib/toast";
import { formFromContact, isFormValid, toFields } from "./contact-form";
import { ContactLocationCombobox } from "./contact-location-combobox";
import { contactOptionItems } from "./contact-option-items";
import { ContactOptionSelect } from "./contact-option-select";

type ContactDialogProps = {
  workspaceId: string;
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ContactDialog({
  workspaceId,
  contact,
  open,
  onOpenChange,
}: ContactDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => formFromContact(contact));
  const { mutateAsync: save, isPending } = useSaveContact(workspaceId);
  const ids = {
    name: useId(),
    phone: useId(),
    email: useId(),
    type: useId(),
    region: useId(),
    notes: useId(),
  };
  const editing = contact !== null;
  const { data: options, isPending: optionsPending } =
    useContactOptions(workspaceId);
  const notSet = t("workspace:contacts.notSet");

  const set = (field: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid(form) || isPending) return;
    try {
      await save({ id: contact?.id, fields: toFields(form) });
      toast.success(
        t(
          editing
            ? "workspace:contacts.updateSuccess"
            : "workspace:contacts.createSuccess",
        ),
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, t("workspace:contacts.saveError")));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <form className="contents" noValidate onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {t(
                editing
                  ? "workspace:contacts.editTitle"
                  : "workspace:contacts.newTitle",
              )}
            </DialogTitle>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={ids.name}>{t("workspace:contacts.name")}</Label>
              <Input
                id={ids.name}
                value={form.name}
                maxLength={120}
                autoFocus
                onChange={(event) => set("name")(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={ids.phone}>
                  {t("workspace:contacts.phone")}
                </Label>
                <Input
                  id={ids.phone}
                  type="tel"
                  value={form.phone}
                  maxLength={40}
                  onChange={(event) => set("phone")(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={ids.email}>
                  {t("workspace:contacts.email")}
                </Label>
                <Input
                  id={ids.email}
                  type="email"
                  value={form.email}
                  maxLength={254}
                  onChange={(event) => set("email")(event.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={ids.type}>{t("workspace:contacts.type")}</Label>
                <ContactOptionSelect
                  id={ids.type}
                  value={form.type}
                  items={contactOptionItems(options?.types ?? [], notSet)}
                  disabled={optionsPending}
                  label={t("workspace:contacts.type")}
                  onValueChange={set("type")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={ids.region}>
                  {t("workspace:contacts.region")}
                </Label>
                <ContactLocationCombobox
                  id={ids.region}
                  value={form.region}
                  items={contactOptionItems(options?.regions ?? [], notSet)}
                  disabled={optionsPending}
                  label={t("workspace:contacts.region")}
                  onValueChange={set("region")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={ids.notes}>{t("workspace:contacts.notes")}</Label>
              <Textarea
                id={ids.notes}
                value={form.notes}
                maxLength={2000}
                onChange={(event) => set("notes")(event.target.value)}
              />
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={!isFormValid(form) || isPending}>
              {t(
                editing
                  ? "workspace:contacts.save"
                  : "workspace:contacts.create",
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
