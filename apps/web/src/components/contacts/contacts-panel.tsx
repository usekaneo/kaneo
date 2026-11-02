import { Pencil, Phone, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Contact } from "@/fetchers/contact";
import { useContactOptions } from "@/hooks/queries/contact/use-contact-options";
import { useContacts } from "@/hooks/queries/contact/use-contacts";
import { ContactDeleteDialog } from "./contact-delete-dialog";
import { ContactDialog } from "./contact-dialog";
import { knownOptionKey } from "./contact-form";
import { ContactTimelineSheet } from "./contact-timeline-sheet";
import { ContactLocationCombobox } from "./contact-location-combobox";
import { contactOptionItems } from "./contact-option-items";
import { ContactOptionSelect } from "./contact-option-select";
import { ContactOptionValue } from "./contact-option-value";

type ContactsPanelProps = {
  workspaceId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

type DialogState = { open: boolean; contact: Contact | null; key: number };

export function ContactsPanel({
  workspaceId,
  canCreate,
  canUpdate,
  canDelete,
}: ContactsPanelProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  // Option keys; "" means no filter.
  const [pickedType, setType] = useState("");
  const [pickedRegion, setRegion] = useState("");
  const { data: options } = useContactOptions(workspaceId);
  const type = knownOptionKey(options?.types, pickedType);
  const region = knownOptionKey(options?.regions, pickedRegion);
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    contact: null,
    key: 0,
  });
  const [toDelete, setToDelete] = useState<Contact | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);

  const {
    data: contacts,
    isPending,
    isError,
    refetch,
  } = useContacts(workspaceId, {
    search: search.trim(),
    type,
    region,
  });

  const openDialog = (contact: Contact | null) =>
    setDialog((current) => ({ open: true, contact, key: current.key + 1 }));
  const filtered = search.trim() !== "" || type !== "" || region !== "";

  const addButton = canCreate ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => openDialog(null)}
    >
      <Plus aria-hidden="true" />
      {t("workspace:contacts.add")}
    </Button>
  ) : null;

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("workspace:contacts.pageTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("workspace:contacts.description")}
          </p>
        </div>
        {addButton}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          className="w-56"
          value={search}
          placeholder={t("workspace:contacts.searchPlaceholder")}
          aria-label={t("workspace:contacts.searchPlaceholder")}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="w-40">
          <ContactOptionSelect
            size="sm"
            value={type}
            items={contactOptionItems(
              options?.types ?? [],
              t("workspace:contacts.allTypes"),
            )}
            label={t("workspace:contacts.type")}
            onValueChange={setType}
          />
        </div>
        <div className="w-44">
          <ContactLocationCombobox
            size="sm"
            value={region}
            items={contactOptionItems(
              options?.regions ?? [],
              t("workspace:contacts.allRegions"),
            )}
            label={t("workspace:contacts.region")}
            onValueChange={setRegion}
          />
        </div>
      </div>

      {isPending ? (
        <SettingsCard aria-busy="true">
          {["a", "b", "c"].map((row) => (
            <Skeleton key={row} className="m-3 h-8" />
          ))}
        </SettingsCard>
      ) : isError && !contacts ? (
        <SettingsCard>
          <SettingsEmpty
            icon={<Users />}
            title={t("workspace:contacts.loadError")}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
              >
                {t("workspace:contacts.retry")}
              </Button>
            }
          />
        </SettingsCard>
      ) : contacts.length === 0 ? (
        <SettingsCard>
          <SettingsEmpty
            icon={<Users />}
            title={t(
              filtered
                ? "workspace:contacts.noMatches"
                : "workspace:contacts.emptyTitle",
            )}
            description={
              filtered ? undefined : t("workspace:contacts.emptyDescription")
            }
            action={filtered ? undefined : addButton}
          />
        </SettingsCard>
      ) : (
        <SettingsCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("workspace:contacts.name")}</TableHead>
                <TableHead>{t("workspace:contacts.type")}</TableHead>
                <TableHead>{t("workspace:contacts.region")}</TableHead>
                <TableHead>{t("workspace:contacts.phone")}</TableHead>
                <TableHead className="text-right">
                  {t("workspace:contacts.leads")}
                </TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => setSelected(contact)}
                    >
                      {contact.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <ContactOptionValue label={contact.typeLabel} />
                  </TableCell>
                  <TableCell>
                    <ContactOptionValue label={contact.regionLabel} />
                  </TableCell>
                  <TableCell>
                    {contact.phone ? (
                      <a
                        className="inline-flex items-center gap-1.5 hover:underline"
                        href={`tel:${contact.phone}`}
                      >
                        <Phone aria-hidden="true" className="size-3" />
                        {contact.phone}
                      </a>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {contact.leadCount ?? 0}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canUpdate ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("workspace:contacts.editAria", {
                            name: contact.name,
                          })}
                          onClick={() => openDialog(contact)}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("workspace:contacts.deleteAria", {
                            name: contact.name,
                          })}
                          onClick={() => setToDelete(contact)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SettingsCard>
      )}

      {canCreate || canUpdate ? (
        <ContactDialog
          key={dialog.key}
          workspaceId={workspaceId}
          contact={dialog.contact}
          open={dialog.open}
          onOpenChange={(open) =>
            setDialog((current) => ({ ...current, open }))
          }
        />
      ) : null}
      <ContactTimelineSheet
        workspaceId={workspaceId}
        contact={selected}
        canLog={canUpdate}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
      <ContactDeleteDialog
        workspaceId={workspaceId}
        contact={toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
      />
    </section>
  );
}
