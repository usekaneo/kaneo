import { Contact } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { Button } from "@/components/ui/button";
import { useContactOptions } from "@/hooks/queries/contact/use-contact-options";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import type { ContactOptionCopy } from "./contact-option-copy";
import { ContactOptionsCard } from "./contact-options-card";

export function ContactOptionsSettings() {
  const { t } = useTranslation();
  const { workspace, canManageSettings, isCheckingPermissions } =
    useWorkspacePermission();
  const workspaceId = workspace?.id ?? "";
  const { data, isPending, isError, refetch } = useContactOptions(workspaceId);

  const typeCopy: ContactOptionCopy = {
    title: t("settings:workspaceContacts.types.title"),
    description: t("settings:workspaceContacts.types.description"),
    listLabel: t("settings:workspaceContacts.types.listLabel"),
    addLabel: t("settings:workspaceContacts.types.addLabel"),
    addPlaceholder: t("settings:workspaceContacts.types.addPlaceholder"),
    bulkLabel: t("settings:workspaceContacts.types.bulkLabel"),
    bulkPlaceholder: t("settings:workspaceContacts.types.bulkPlaceholder"),
    bulkHint: t("settings:workspaceContacts.bulkHint"),
    empty: t("settings:workspaceContacts.types.empty"),
    deleteTitle: (name) =>
      t("settings:workspaceContacts.types.deleteTitle", { name }),
    deleteDescription: (count) =>
      count === 0
        ? t("settings:workspaceContacts.types.deleteDescriptionNone")
        : t("settings:workspaceContacts.types.deleteDescription", { count }),
    deleteSuccess: (count) =>
      count === 0
        ? t("settings:workspaceContacts.types.deleteSuccessNone")
        : t("settings:workspaceContacts.types.deleteSuccess", { count }),
  };
  const regionCopy: ContactOptionCopy = {
    title: t("settings:workspaceContacts.regions.title"),
    description: t("settings:workspaceContacts.regions.description"),
    listLabel: t("settings:workspaceContacts.regions.listLabel"),
    addLabel: t("settings:workspaceContacts.regions.addLabel"),
    addPlaceholder: t("settings:workspaceContacts.regions.addPlaceholder"),
    bulkLabel: t("settings:workspaceContacts.regions.bulkLabel"),
    bulkPlaceholder: t("settings:workspaceContacts.regions.bulkPlaceholder"),
    bulkHint: t("settings:workspaceContacts.bulkHint"),
    empty: t("settings:workspaceContacts.regions.empty"),
    deleteTitle: (name) =>
      t("settings:workspaceContacts.regions.deleteTitle", { name }),
    deleteDescription: (count) =>
      count === 0
        ? t("settings:workspaceContacts.regions.deleteDescriptionNone")
        : t("settings:workspaceContacts.regions.deleteDescription", { count }),
    deleteSuccess: (count) =>
      count === 0
        ? t("settings:workspaceContacts.regions.deleteSuccessNone")
        : t("settings:workspaceContacts.regions.deleteSuccess", { count }),
  };

  const body = () => {
    if (!isCheckingPermissions && !canManageSettings()) {
      return (
        <p role="alert" className="text-muted-foreground text-sm">
          {t("settings:workspaceContacts.noPermission")}
        </p>
      );
    }
    if (isPending) {
      return (
        <SettingsCard aria-busy="true">
          <SettingsRowsSkeleton />
        </SettingsCard>
      );
    }
    if (isError || !data) {
      return (
        <SettingsEmpty
          icon={<Contact />}
          title={t("settings:workspaceContacts.loadError")}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              {t("settings:workspaceContacts.retry")}
            </Button>
          }
        />
      );
    }
    return (
      <>
        <ContactOptionsCard
          workspaceId={workspaceId}
          kind="type"
          options={data.types}
          copy={typeCopy}
        />
        <ContactOptionsCard
          workspaceId={workspaceId}
          kind="region"
          options={data.regions}
          copy={regionCopy}
        />
      </>
    );
  };

  return (
    <SettingsPage
      title={t("settings:workspaceContacts.title")}
      description={t("settings:workspaceContacts.subtitle")}
    >
      {body()}
    </SettingsPage>
  );
}
